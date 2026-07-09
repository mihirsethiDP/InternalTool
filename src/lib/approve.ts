import type { QueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import { replaceSection, appendSection, SECTION_LABEL } from './consolidated';
import { writeConsolidated } from './consolidatedWrite';
import { awardApproval, awardFlowBonus } from './contributions';
import type { SubmissionSection } from './types';

// Shared approval routine — used by the detailed review screen AND the
// one-click quick-approve in the queue, so the two can never drift. Merges the
// submission into the sensor's consolidated reference, marks it approved,
// notifies + rewards the uploader, and kicks off diagnostic-flow drafting.
export async function approveSubmission(opts: {
  submission: any;
  editedText: string;
  section: SubmissionSection;
  mode?: 'replace' | 'append';
  note?: string;
  qc: QueryClient;
}): Promise<void> {
  const { submission, editedText, section, mode = 'replace', note = '', qc } = opts;
  const sensorModelId = submission.sensor_model_id;
  if (!sensorModelId) throw new Error('Submission has no sensor model.');

  // 1. Get or create the consolidated doc.
  let { data: cdoc } = await supabase
    .from('consolidated_docs').select('*').eq('sensor_model_id', sensorModelId).maybeSingle();
  if (!cdoc) {
    const ins = await supabase.from('consolidated_docs')
      .insert({ sensor_model_id: sensorModelId, content_markdown: '' }).select('*').single();
    if (ins.error) throw ins.error;
    cdoc = ins.data;
  }

  // 2. Merge into the target section.
  const merged = mode === 'replace'
    ? replaceSection(cdoc.content_markdown, section, editedText)
    : appendSection(cdoc.content_markdown, section, editedText,
        `Appended from "${submission.title}" on ${new Date().toLocaleDateString()}`);

  // 3. Persist markdown + rebuild chunks + revision snapshot.
  await writeConsolidated({
    docId: cdoc.id, sensorModelId, markdown: merged, changeKind: 'approval',
    note: `Approved "${submission.title}" into ${SECTION_LABEL[section]} (${mode})${note ? ` — ${note}` : ''}`,
  });

  // 4. Mark approved.
  const decision = mode === 'replace' ? 'replace_section' : 'append_section';
  const upd = await supabase.from('document_submissions').update({
    status: 'approved', decision, target_section: section,
    reviewer_notes: note || null, reviewed_at: new Date().toISOString(),
    extracted_text: editedText,
  }).eq('id', submission.id);
  if (upd.error) throw upd.error;

  // 5. Notify the maker.
  try {
    if (submission.uploaded_by) {
      await supabase.from('notifications').insert({
        recipient_id: submission.uploaded_by, kind: 'submission_approved',
        submission_id: submission.id,
        message: `Your submission "${submission.title}" was approved${note ? ` — ${note}` : ''}.`,
      });
    }
  } catch (e) { console.warn('notify maker failed', e); }

  // 6. Reward the uploader (idempotent).
  try { await awardApproval(submission.uploaded_by, submission.id); } catch (e) { console.warn('award failed', e); }

  // 7. Auto-draft diagnostic flows (fire-and-forget); a flow earns a bonus.
  supabase.functions.invoke('chat-answer', { body: { mode: 'generate-flow', consolidated_doc_id: cdoc.id } })
    .then((res) => {
      const n = Array.isArray((res as any)?.data?.flows) ? (res as any).data.flows.length : 0;
      if (n > 0) awardFlowBonus(submission.uploaded_by, submission.id).catch(() => {});
      ['admin-draft-flows-count', 'my-score', 'contribution-leaderboard'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
    })
    .catch((e) => console.warn('auto generate-flow failed', e));

  // Base points are already written (awaited above), so refresh the score now
  // to show +10 promptly; the .then() refreshes again when the flow bonus lands.
  ['my-score', 'contribution-leaderboard', 'review-queue', 'review-queue-counts',
   'my-submissions', 'admin-consolidated-docs', 'recent-consolidated', 'admin-coverage', 'admin-draft-flows-count']
    .forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
}
