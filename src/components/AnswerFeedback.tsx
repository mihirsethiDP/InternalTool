import { useState } from 'react';
import { ThumbsUp, ThumbsDown, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';

/**
 * "Did this solve your problem?" widget. Records answer_feedback:
 *   helpful=true  -> solved (a ticket avoided — the key success metric)
 *   helpful=false -> existed but didn't help (optional reason)
 */
export default function AnswerFeedback({ query, consolidatedDocId, sensorModelId, source, compact }: {
  query?: string;
  consolidatedDocId?: string | null;
  sensorModelId?: string | null;
  source: 'viewer' | 'search' | 'chat';
  compact?: boolean;
}) {
  const [stage, setStage] = useState<'ask' | 'reason' | 'done'>('ask');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  async function record(helpful: boolean, reasonText?: string) {
    setBusy(true);
    try {
      await supabase.from('answer_feedback').insert({
        query: query || null,
        consolidated_doc_id: consolidatedDocId || null,
        sensor_model_id: sensorModelId || null,
        helpful,
        reason: reasonText || null,
        source,
      });
    } catch (e) { console.warn('feedback insert failed', e); }
    setBusy(false);
    setStage('done');
  }

  if (stage === 'done') {
    return (
      <div className={`inline-flex items-center gap-1.5 text-emerald-700 ${compact ? 'text-xs' : 'text-sm'}`}>
        <Check size={compact ? 13 : 15} /> Thanks — noted.
      </div>
    );
  }

  if (stage === 'reason') {
    return (
      <div className={compact ? 'space-y-1.5' : 'space-y-2'}>
        <div className={`text-slate-600 ${compact ? 'text-xs' : 'text-sm'}`}>What was missing or unclear?</div>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="The steps didn't match my situation / content was unclear / …"
          className={`w-full rounded-md border border-slate-300 px-2.5 py-1.5 outline-none focus:border-brand-700 ${compact ? 'text-xs min-h-14' : 'text-sm min-h-16'}`}
        />
        <div className="flex gap-2">
          <button onClick={() => record(false, reason)} disabled={busy} className="btn-primary btn-sm">Send</button>
          <button onClick={() => record(false)} disabled={busy} className="btn-ghost btn-sm">Skip</button>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-3 flex-wrap ${compact ? '' : ''}`}>
      <span className={`text-slate-600 ${compact ? 'text-xs' : 'text-sm font-medium'}`}>Did this solve your problem?</span>
      <div className="flex items-center gap-2">
        <button
          onClick={() => record(true)}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white hover:border-emerald-500 hover:text-emerald-700 px-2.5 py-1.5 text-xs font-medium transition"
        >
          <ThumbsUp size={13} /> Solved
        </button>
        <button
          onClick={() => setStage('reason')}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white hover:border-red-400 hover:text-red-600 px-2.5 py-1.5 text-xs font-medium transition"
        >
          <ThumbsDown size={13} /> Didn't help
        </button>
      </div>
    </div>
  );
}
