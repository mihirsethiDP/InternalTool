import { queryTokens } from './routing';

// Recognise small-talk / meta messages so the assistant can reply
// conversationally instead of running a documentation search and reporting
// "nothing matches". Only matches when the WHOLE message is conversational, so
// real (often short) sensor queries like "pH drifting" are never caught.
export function conversationalReply(raw: string): string | null {
  const q = (raw ?? '').trim().toLowerCase().replace(/[!.?,]+$/g, '').replace(/\s+/g, ' ');
  if (!q) return null;
  if (/^(hi+|hello+|hey+|hiya|yo|good (morning|afternoon|evening)|namaste|namaskar)$/.test(q))
    return 'Hi! What sensor issue can I help you troubleshoot?';
  if (/^(how are you( doing)?|how'?s it going)$/.test(q))
    return 'Doing well, thanks! Describe a sensor or the problem you’re seeing and I’ll dig through the docs.';
  if (/^(thanks|thank you|thank u|thx|ty|cheers|great|perfect|awesome|nice|cool|got it|understood|makes sense|ok|okay|alright|k|kk|noted|sounds good)$/.test(q))
    return 'You’re welcome! Anything else I can help with?';
  if (/^(bye|goodbye|see ya|see you|that'?s all|that is all|done|nothing else|no thanks|no thank you)$/.test(q))
    return 'Glad to help — come back anytime you hit a sensor issue.';
  if (/(move on|another (issue|question|problem|one)|next (issue|question|problem|one)|let'?s continue|never ?mind|forget it)/.test(q))
    return 'Sure — go ahead and describe the next sensor issue.';
  if (/^(who are you|what (can|do) you do|what is this|help)$/.test(q))
    return 'I help you troubleshoot water and wastewater sensors using your team’s verified documentation. Tell me the sensor or the symptom you’re seeing.';
  return null;
}

// Hinglish complaint vocabulary — the SINGLE source shared with the spelling
// lexicon (which must know these words so the corrector never rewrites them,
// e.g. 'band' must not become 'brand'; vagueness detection needs them intact).
export const HINGLISH_COMPLAINT_WORDS = [
  'kharab', 'kaam', 'nahi', 'nahin', 'chal', 'chalta', 'kar', 'karta', 'karti', 'hua', 'hui',
  'raha', 'rahi', 'gaya', 'gayi', 'band', 'theek', 'thik', 'hai', 'ho', 'mera', 'meri',
  'apna', 'koi', 'kuch', 'jaldi', 'bhai', 'ji', 'sir', 'madam',
];

// Words that say "something is broken" without saying WHAT: naming the device
// or a complaint, but no symptom, parameter, or model. A message made only of
// these (e.g. "sensor not working", "meter kharab hai") can't be answered from
// docs — the assistant should PROBE (which sensor? what is it doing?) instead
// of dumping a generic answer.
const GENERIC_TOKENS = new Set([
  // the device, generically
  'sensor', 'sensors', 'probe', 'meter', 'device', 'instrument', 'transmitter', 'equipment', 'machine', 'unit',
  // generic complaint / request
  'working', 'work', 'works', 'worked', 'broken', 'broke', 'faulty', 'fault', 'faulted',
  'problem', 'problems', 'issue', 'issues', 'trouble', 'help', 'fix', 'fixed', 'repair',
  'bad', 'wrong', 'properly', 'correctly', 'fine', 'good', 'well', 'today', 'suddenly',
  // negation / filler that carries no searchable signal
  'not', 'no', 'isnt', 'doesnt', 'dont', 'wont', 'cant', 'stopped', 'stops',
  'please', 'there', 'something', 'anything', 'very', 'really',
  'at', 'all', 'still', 'now', 'again', 'always', 'since', 'urgent', 'urgently',
  ...HINGLISH_COMPLAINT_WORDS,
]);

// True when the message contains no token that could actually narrow a search —
// run on SPELL-CORRECTED text so "senser not workng" is judged as "sensor not
// working". Empty-token messages are NOT vague here (small-talk handles them).
// This client heuristic is the fast path; the route-mode LLM's `vague` flag
// (chat-answer edge function) backs it up for phrasings this list misses.
export function isVagueQuery(corrected: string): boolean {
  // Uppercase DO = dissolved oxygen (a named parameter, so NOT vague) — but
  // lowercase "do" is just a verb queryTokens drops as a stopword anyway.
  if (/\bDO\b/.test(corrected)) return false;
  // Strip apostrophes BEFORE tokenizing so "isn't" matches the 'isnt' token
  // (queryTokens would otherwise split it into 'isn' + dropped 't').
  const toks = queryTokens(corrected.replace(/['’]/g, ''));
  if (toks.length === 0) return false;
  return toks.every((t) => GENERIC_TOKENS.has(t));
}
