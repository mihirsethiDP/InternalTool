import { supabase } from './supabase';
import { parseSections, chunkSections } from './consolidated';

/**
 * Single source of truth for writing a consolidated reference. Every write:
 *   1. updates consolidated_docs.content_markdown (+ last_updated_at)
 *   2. rebuilds consolidated_doc_chunks (search index)
 *   3. records a revision snapshot (version history)
 * Used by approval-merge, the admin editor, and revert.
 */
export async function writeConsolidated(opts: {
  docId: string;
  sensorModelId: string;
  markdown: string;
  changeKind: 'approval' | 'edit' | 'revert';
  note?: string | null;
}) {
  const { docId, sensorModelId, markdown, changeKind, note } = opts;

  const upd = await supabase.from('consolidated_docs')
    .update({ content_markdown: markdown, last_updated_at: new Date().toISOString() })
    .eq('id', docId);
  if (upd.error) throw upd.error;

  // Rebuild the search index.
  //
  // Insert FIRST, then delete the old rows. The reverse order lost real
  // content in production: a rejected insert (a section the DB did not yet
  // accept) left the document approved but with an EMPTY index — invisible to
  // search, with no error the admin ever saw. This way a failed insert leaves
  // the previous index intact and the error surfaces.
  const sections = parseSections(markdown);
  const chunks = chunkSections(sections);
  const { data: oldChunks } = await supabase
    .from('consolidated_doc_chunks').select('id').eq('consolidated_doc_id', docId);
  const inserted: string[] = [];
  try {
    for (let i = 0; i < chunks.length; i += 50) {
      const batch = chunks.slice(i, i + 50).map((c) => ({
        consolidated_doc_id: docId,
        sensor_model_id: sensorModelId,
        section: c.section,
        chunk_text: c.text,
      }));
      const { data, error } = await supabase.from('consolidated_doc_chunks').insert(batch).select('id');
      if (error) throw error;
      for (const r of (data ?? []) as { id: string }[]) inserted.push(r.id);
    }
  } catch (e) {
    // Roll back the partial index so the document keeps the one it had.
    if (inserted.length) await supabase.from('consolidated_doc_chunks').delete().in('id', inserted);
    throw e;
  }
  const oldIds = (oldChunks ?? []).map((c: { id: string }) => c.id);
  if (oldIds.length) await supabase.from('consolidated_doc_chunks').delete().in('id', oldIds);

  // Record a revision snapshot (best-effort; never block the write on it)
  try {
    await supabase.from('consolidated_doc_revisions').insert({
      consolidated_doc_id: docId,
      content_markdown: markdown,
      change_kind: changeKind,
      note: note ?? null,
    });
  } catch (e) {
    console.warn('revision snapshot failed', e);
  }
}

export type DiffLine = { t: 'ctx' | 'add' | 'del'; line: string };

/** Line-level diff via LCS. Small docs only — O(m*n). */
export function lineDiff(oldText: string, newText: string): DiffLine[] {
  const a = (oldText || '').split('\n');
  const b = (newText || '').split('\n');
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out: DiffLine[] = [];
  let i = 0, j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) { out.push({ t: 'ctx', line: a[i] }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { out.push({ t: 'del', line: a[i] }); i++; }
    else { out.push({ t: 'add', line: b[j] }); j++; }
  }
  while (i < m) out.push({ t: 'del', line: a[i++] });
  while (j < n) out.push({ t: 'add', line: b[j++] });
  return out;
}
