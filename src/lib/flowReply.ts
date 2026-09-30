import { queryTokens, matchScore } from './routing';
import type { FlowNode } from './flows';

// Typed replies inside a diagnostic flow. The flow shows chips, but people
// type — "yes", "done", "haan ho gaya", "no change", "the second one", or a
// question about the step. This resolves the unambiguous cases locally
// (instant, offline-safe); anything else goes to the edge function's
// flow-reply mode.

export type FlowReply =
  | { action: 'option'; option: number } // 1-based; for action nodes 1 = done, 2 = didn't work
  | { action: 'question' }
  | { action: 'new_problem' }
  | { action: 'leave' }
  | { action: 'unclear' };

const YES = /^(y|yes|yeah|yep|yup|ya|ok|okay|sure|correct|right|true|done|did it|did that|completed|finished|haan|han|ha|haa|ji|ji haan|hanji|theek|thik|ho gaya|hogaya|kar diya|kardiya|kiya|check kiya|it is|it does|yes it is|yes it does|आणि|हाँ|हा|हो|ঠিক|হ্যাঁ|అవును|ஆம்|હા|ಹೌದು)[.! ]*$/i;
const NO = /^(n|no|nope|nah|not|no change|nothing|nothing happened|still same|same|still|didn'?t work|did not work|not working|not fixed|nahi|nahin|nai|nhi|nahi hua|nahi hui|nahi chala|nahi kaam|kaam nahi|wahi|same hai|कुछ नहीं|नहीं|ना|না|కాదు|இல்லை|ના|ಇಲ್ಲ)[.! ]*$/i;
const NO_CHANGE = /\b(no change|same as before|as before|still (same|not|the same|dead|blank|off|offline|beeping|not working|shows|showing|says|getting|coming|giving|no)|same (problem|issue|thing)|didn'?t (work|help)|did not (work|help)|not (working|fixed|helped|helping)|nahi (hua|chala|hui)|kaam nahi|kuch nahi|no luck|same hai|wahi)\b/i;
const DONE = /\b(done|did (it|that|this)|completed|finished|checked|tightened|replaced|restarted|rebooted|cleaned|closed|opened|switched|plugged|reset|ho gaya|hogaya|kar (diya|liya)|kardiya|kiya|complete)\b/i;
const LEAVE = /\b(stop|skip|exit|quit|cancel|leave|never ?mind|forget it|not this|wrong (flow|fix|steps)|different (problem|issue)|band karo|rehne do|chhodo|chodo|छोड़ो|रहने दो)\b/i;
const QUESTION = /(\?|^(what|where|which|how|why|when|who|can i|should i|do i|is it|does it|kya|kahan|kaise|kaun|kyu|kyun|kab|क्या|कहाँ|कैसे|कौन|क्यों)\b|\b(what does|what is|meaning|means|matlab|samajh nahi|not sure how|don'?t know how|how do i|where is|which one|kaunsa|konsa)\b)/i;

// Pick an option chip by its ordinal ("the first one", "2", "option 3", "second").
const ORDINALS: Record<string, number> = { first: 1, '1st': 1, one: 1, second: 2, '2nd': 2, two: 2, third: 3, '3rd': 3, three: 3, fourth: 4, '4th': 4, four: 4, pehla: 1, dusra: 2, doosra: 2, teesra: 3, tisra: 3 };
function ordinal(text: string, max: number): number {
  const t = text.trim().toLowerCase();
  const num = t.match(/^(?:option\s*)?(\d)\b[.)]?$/)?.[1] ?? t.match(/^(?:the\s+)?(\w+)(?:\s+one)?$/)?.[1];
  const n = num ? (Number(num) || ORDINALS[num] || 0) : 0;
  return n >= 1 && n <= max ? n : 0;
}

export function interpretFlowReplyLocal(text: string, node: Pick<FlowNode, 'kind' | 'options'>): FlowReply | null {
  const raw = (text ?? '').trim();
  if (!raw) return null;
  if (LEAVE.test(raw) && !QUESTION.test(raw)) return { action: 'leave' };

  if (node.kind === 'action') {
    if (NO.test(raw) || NO_CHANGE.test(raw)) return { action: 'option', option: 2 };
    if (YES.test(raw) || (DONE.test(raw) && !QUESTION.test(raw))) return { action: 'option', option: 1 };
    if (QUESTION.test(raw)) return { action: 'question' };
    return null;
  }

  if (node.kind === 'question') {
    const opts = node.options ?? [];
    const n = ordinal(raw, opts.length);
    if (n) return { action: 'option', option: n };
    // The reply appears verbatim inside exactly one label ("red light is on"
    // → "Yes — red light is on"), or a label appears inside the reply.
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9ऀ-෿ ]+/g, ' ').replace(/\s+/g, ' ').trim();
    const nr = norm(raw);
    if (nr.length >= 3) {
      const contained = opts.map((o, i) => ({ i: i + 1, l: norm(o.label) })).filter((o) => o.l.includes(nr) || (o.l.length >= 4 && nr.includes(o.l)));
      if (contained.length === 1) return { action: 'option', option: contained[0].i };
    }
    // Otherwise word overlap with exactly one label. Two close matches → let
    // the model decide.
    const qt = queryTokens(raw);
    if (qt.length > 0) {
      const scored = opts.map((o, i) => ({ i: i + 1, s: matchScore(qt, o.label) }));
      const best = [...scored].sort((a, b) => b.s - a.s);
      if (best[0] && best[0].s >= 0.6 && (!best[1] || best[1].s < best[0].s - 0.2)) return { action: 'option', option: best[0].i };
    }
    // Yes/No typed against Yes/No-style options.
    const yesIdx = opts.findIndex((o) => /^(yes|haan|ha\b)/i.test(o.label.trim()));
    const noIdx = opts.findIndex((o) => /^(no|nahi|still|not)/i.test(o.label.trim()));
    if (YES.test(raw) && yesIdx >= 0) return { action: 'option', option: yesIdx + 1 };
    if (NO.test(raw) && noIdx >= 0) return { action: 'option', option: noIdx + 1 };
    // "it still shows offline after that" answers a Yes/No question with No.
    if (NO_CHANGE.test(raw) && noIdx >= 0 && !QUESTION.test(raw)) return { action: 'option', option: noIdx + 1 };
    if (QUESTION.test(raw)) return { action: 'question' };
    return null;
  }
  return null;
}

// The option label for a resolved reply (what the user bubble echoes).
export function flowReplyLabel(reply: FlowReply, node: Pick<FlowNode, 'kind' | 'options'>, doneLabel: string, failLabel: string): string | null {
  if (reply.action !== 'option') return null;
  if (node.kind === 'action') return reply.option === 1 ? doneLabel : failLabel;
  return node.options?.[reply.option - 1]?.label ?? null;
}

// Where a resolved reply goes.
export function flowReplyNext(reply: FlowReply, node: Pick<FlowNode, 'kind' | 'options' | 'next'>, failNext: string | null): string | null {
  if (reply.action !== 'option') return null;
  if (node.kind === 'action') return reply.option === 1 ? (node.next ?? null) : failNext;
  return node.options?.[reply.option - 1]?.next ?? null;
}
