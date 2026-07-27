import { supabase } from './supabase';
import { queryTokens } from './routing';
import type { DiagnosticFlow } from './flows';

// Issue taxonomy — the curated vocabulary of user-side problem statements
// ("Reading fluctuating"), each mapped to an ORDERED list of diagnostic flows
// (the "flow queue"): if the first fix doesn't resolve it, the chat offers
// the next. Admins curate in Admin → Diagnostic flows; AI seeds proposals.

export interface Issue {
  id: string;
  sensor_category_id: string | null; // null = applies across categories
  label: string;
  aliases: string[];
}

export interface IssueFlowLink { id: string; issue_id: string; flow_id: string; rank: number }

export async function fetchIssues(categoryId?: string | null): Promise<Issue[]> {
  let q = supabase.from('issues').select('id, sensor_category_id, label, aliases').order('label');
  if (categoryId) q = q.or(`sensor_category_id.eq.${categoryId},sensor_category_id.is.null`);
  const { data, error } = await q;
  if (error) { console.warn('fetchIssues failed', error.message); return []; }
  return (data ?? []) as Issue[];
}

// Cheap, instant issue match: token overlap between the (corrected) message
// and each issue's label + aliases. The edge fn's match-issue mode is the
// semantic backstop when this misses.
export function matchIssueClient(corrected: string, issues: Issue[]): Issue | null {
  const qTokens = new Set(queryTokens(corrected));
  if (qTokens.size === 0) return null;
  let best: Issue | null = null;
  let bestScore = 0;
  for (const iss of issues) {
    for (const phrase of [iss.label, ...(iss.aliases ?? [])]) {
      const pTokens = queryTokens(phrase);
      if (pTokens.length === 0) continue;
      const overlap = pTokens.filter((t) => qTokens.has(t)).length;
      const score = overlap / pTokens.length; // how much of the phrase is present
      if (overlap >= 1 && score > bestScore) { bestScore = score; best = iss; }
    }
  }
  return bestScore >= 0.6 ? best : null;
}

// The ordered, APPROVED flows for an issue — the queue the chat walks.
// Model-scoped: keeps generic flows (sensor_model_id null) plus the ones for
// the user's model; drops flows for OTHER models.
export async function flowQueueForIssue(issueId: string, opts?: { modelId?: string | null }): Promise<DiagnosticFlow[]> {
  const { data, error } = await supabase
    .from('issue_flows')
    .select('rank, diagnostic_flows(*)')
    .eq('issue_id', issueId)
    .order('rank');
  if (error) { console.warn('flowQueueForIssue failed', error.message); return []; }
  return ((data ?? []) as any[])
    .map((r) => (Array.isArray(r.diagnostic_flows) ? r.diagnostic_flows[0] : r.diagnostic_flows))
    .filter((f) => f && f.status === 'approved')
    .filter((f) => !f.sensor_model_id || !opts?.modelId || f.sensor_model_id === opts.modelId) as DiagnosticFlow[];
}

// ---------- admin curation helpers ----------

export async function createIssue(categoryId: string | null, label: string, aliases: string[]): Promise<string | null> {
  const { data, error } = await supabase.from('issues')
    .insert({ sensor_category_id: categoryId, label: label.trim(), aliases })
    .select('id').single();
  if (error) { console.warn('createIssue failed', error.message); return null; }
  return (data as any)?.id ?? null;
}

export async function updateIssue(id: string, patch: Partial<Pick<Issue, 'label' | 'aliases'>>) {
  await supabase.from('issues').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
}

export async function deleteIssue(id: string) {
  await supabase.from('issues').delete().eq('id', id);
}

export async function linkFlow(issueId: string, flowId: string) {
  const { count } = await supabase.from('issue_flows').select('id', { count: 'exact', head: true }).eq('issue_id', issueId);
  await supabase.from('issue_flows').upsert(
    { issue_id: issueId, flow_id: flowId, rank: (count ?? 0) + 1 },
    { onConflict: 'issue_id,flow_id', ignoreDuplicates: true },
  );
}

export async function unlinkFlow(issueId: string, flowId: string) {
  await supabase.from('issue_flows').delete().eq('issue_id', issueId).eq('flow_id', flowId);
}

// Swap the rank of two adjacent links (the ↑/↓ buttons).
export async function swapRanks(a: IssueFlowLink, b: IssueFlowLink) {
  await supabase.from('issue_flows').update({ rank: b.rank }).eq('id', a.id);
  await supabase.from('issue_flows').update({ rank: a.rank }).eq('id', b.id);
}
