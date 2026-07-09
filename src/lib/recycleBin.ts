import { supabase } from './supabase';
import { writeConsolidated } from './consolidatedWrite';

// Recycle bin — soft delete with a 30-day window (admin-only surface).
//
// Soft-deleting a consolidated reference stamps deleted_at, removes its
// DERIVED search chunks (so chat/search exclusion is automatic everywhere,
// including service-role retrieval), and archives the diagnostic flows that
// were generated from it. Restore reverses all of that: chunks are rebuilt
// from content_markdown and the doc's flows return as drafts for re-approval.
// Submissions keep their storage file for the 30 days; hard delete (or the
// 30-day purge) removes file + row for good.

export const RETENTION_DAYS = 30;

export function daysLeft(deletedAt: string): number {
  const expiry = new Date(deletedAt).getTime() + RETENTION_DAYS * 86_400_000;
  return Math.max(0, Math.ceil((expiry - Date.now()) / 86_400_000));
}

// ---------- consolidated references ----------

export async function softDeleteConsolidated(docId: string, userId: string | null) {
  const { error } = await supabase.from('consolidated_docs')
    .update({ deleted_at: new Date().toISOString(), deleted_by: userId })
    .eq('id', docId);
  if (error) throw error;
  // Derived data out; content_markdown stays for restore.
  await supabase.from('consolidated_doc_chunks').delete().eq('consolidated_doc_id', docId);
  // Flows drafted from this doc go dormant with it.
  await supabase.from('diagnostic_flows').update({ status: 'archived' })
    .eq('source_doc_id', docId).neq('status', 'archived');
}

export async function restoreConsolidated(doc: { id: string; sensor_model_id: string; content_markdown: string }) {
  const { error } = await supabase.from('consolidated_docs')
    .update({ deleted_at: null, deleted_by: null })
    .eq('id', doc.id);
  if (error) throw error;
  // Rebuild the search chunks from the kept markdown (+ revision snapshot).
  await writeConsolidated({
    docId: doc.id,
    sensorModelId: doc.sensor_model_id,
    markdown: doc.content_markdown,
    changeKind: 'edit',
    note: 'Restored from recycle bin',
  });
  // Its flows come back as DRAFTS — an admin re-approves what should be live.
  await supabase.from('diagnostic_flows').update({ status: 'draft' })
    .eq('source_doc_id', doc.id).eq('status', 'archived');
}

export async function hardDeleteConsolidated(docId: string) {
  // Delete the diagnostic flows generated from this reference FIRST — the FK is
  // ON DELETE SET NULL, so without this they'd survive as orphans with a null
  // source_doc_id. Flows belong to their reference: reference gone → flows gone.
  await supabase.from('diagnostic_flows').delete().eq('source_doc_id', docId);
  // Row delete cascades to chunks/revisions.
  const { error } = await supabase.from('consolidated_docs').delete().eq('id', docId);
  if (error) throw error;
}

// ---------- document submissions ----------

export async function softDeleteSubmission(subId: string, userId: string | null) {
  const { error } = await supabase.from('document_submissions')
    .update({ deleted_at: new Date().toISOString(), deleted_by: userId })
    .eq('id', subId);
  if (error) throw error;
}

export async function restoreSubmission(subId: string) {
  const { error } = await supabase.from('document_submissions')
    .update({ deleted_at: null, deleted_by: null })
    .eq('id', subId);
  if (error) throw error;
}

export async function hardDeleteSubmission(sub: { id: string; storage_path: string | null }) {
  if (sub.storage_path) {
    const { error: se } = await supabase.storage.from('documents').remove([sub.storage_path]);
    if (se) console.warn('storage delete failed (continuing):', se.message);
  }
  const { error } = await supabase.from('document_submissions').delete().eq('id', sub.id);
  if (error) throw error;
}

// ---------- 30-day purge (lazy — runs when an admin opens the bin) ----------

export async function purgeExpired(): Promise<number> {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 86_400_000).toISOString();
  let purged = 0;
  try {
    const { data: docs } = await supabase.from('consolidated_docs')
      .select('id').not('deleted_at', 'is', null).lt('deleted_at', cutoff);
    for (const d of (docs ?? []) as any[]) { await hardDeleteConsolidated(d.id); purged++; }
    const { data: subs } = await supabase.from('document_submissions')
      .select('id, storage_path').not('deleted_at', 'is', null).lt('deleted_at', cutoff);
    for (const s of (subs ?? []) as any[]) { await hardDeleteSubmission(s); purged++; }
  } catch (e) {
    console.warn('recycle bin purge failed', e);
  }
  return purged;
}
