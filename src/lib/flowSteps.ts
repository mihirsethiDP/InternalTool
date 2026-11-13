import type { FlowDefinition, FlowNode } from './flows';

// "Just give me the steps": the matched diagnostic flow written out as one
// numbered checklist, straight from the approved definition — no model call,
// so nothing can be invented and the steps always match the guided fix.
//
// Nodes are numbered in walk order from the start. An action continues to
// the next number unless its "done" path goes elsewhere; a question lists
// each answer with where it leads; resolve / escalate nodes are written
// inline as the outcome of the step that reaches them.

export interface StepsOptions {
  fixedLabel?: string;   // "Fixed:"
  helpLabel?: string;    // "Get help:"
  ifLabel?: (answer: string) => string; // If “Yes”
  goTo?: (n: number) => string;         // go to step 4
  failLabel?: string;    // If that didn't work
}

const DEFAULTS: Required<StepsOptions> = {
  fixedLabel: 'Fixed:',
  helpLabel: 'Get help:',
  ifLabel: (a) => `If “${a}”`,
  goTo: (n) => `go to step ${n}`,
  failLabel: 'If that didn’t work',
};

export function flowToSteps(def: FlowDefinition, opts: StepsOptions = {}): string {
  const o = { ...DEFAULTS, ...opts };
  const byId = new Map(def.nodes.map((n) => [n.id, n] as const));
  const isTerminal = (n?: FlowNode | null) => !!n && (n.kind === 'resolve' || n.kind === 'escalate');

  // Number the non-terminal nodes in depth-first walk order, following the
  // main path first so a straight-line flow reads 1, 2, 3 …
  const order: string[] = [];
  const seen = new Set<string>();
  const visit = (id: string | undefined) => {
    if (!id || seen.has(id)) return;
    const n = byId.get(id);
    if (!n || isTerminal(n)) return;
    seen.add(id);
    order.push(id);
    if (n.kind === 'action') { visit(n.next); visit(n.fail_next); }
    else if (n.kind === 'question') for (const opt of n.options ?? []) visit(opt.next);
  };
  visit(def.start);
  const num = new Map(order.map((id, i) => [id, i + 1] as const));

  // Where an edge leads, as text: an outcome written inline, or a step number.
  const target = (id: string | undefined, fromIndex: number): string => {
    const n = id ? byId.get(id) : undefined;
    if (!n) return '';
    if (n.kind === 'resolve') return `${o.fixedLabel} ${n.text.trim()}`;
    if (n.kind === 'escalate') return `${o.helpLabel} ${n.text.trim()}`;
    const k = num.get(n.id)!;
    return k === fromIndex + 1 ? '' : o.goTo(k);
  };

  const lines: string[] = [];
  // A flow that starts at its outcome (rare) still says something.
  const startNode = byId.get(def.start);
  if (isTerminal(startNode)) return `1. ${target(def.start, 0)}`;

  order.forEach((id, i) => {
    const n = byId.get(id)!;
    const k = i + 1;
    lines.push(`${k}. ${n.text.trim()}`);
    if (n.kind === 'action') {
      const done = target(n.next, k);
      if (done) lines.push(`   - ${done.charAt(0).toUpperCase()}${done.slice(1)}`);
      if (n.fail_next) {
        const fail = target(n.fail_next, -1);
        if (fail) lines.push(`   - ${o.failLabel}: ${fail}`);
      }
    } else if (n.kind === 'question') {
      for (const opt of n.options ?? []) {
        const t = target(opt.next, k);
        lines.push(`   - ${o.ifLabel(opt.label.trim())}: ${t || o.goTo(k + 1)}`);
      }
    }
  });

  // If no step's "didn't work" leads anywhere explicit, the runner falls back
  // to the flow's escalation — say so once at the end.
  const esc = def.nodes.find((n) => n.kind === 'escalate');
  const anyFail = def.nodes.some((n) => n.kind === 'action' && n.fail_next);
  if (esc && !anyFail && !lines.some((l) => l.includes(esc.text.trim()))) {
    lines.push(`\n${o.failLabel}: ${o.helpLabel} ${esc.text.trim()}`);
  }
  return lines.join('\n');
}
