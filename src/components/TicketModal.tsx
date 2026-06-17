import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, LifeBuoy, Loader2, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

// Logs a support ticket when self-service didn't resolve the issue. Stored in
// support_tickets (so it's tracked immediately); the push to CustomerHub is
// handled separately once that integration is wired.
export default function TicketModal({ onClose, query, sensorModelId, defaultDescription, userEmail }: {
  onClose: () => void;
  query?: string;
  sensorModelId?: string | null;
  defaultDescription?: string;
  userEmail?: string | null;
}) {
  const [subject, setSubject] = useState(query ? `Issue: ${query}` : '');
  const [description, setDescription] = useState(defaultDescription ?? '');
  const [plant, setPlant] = useState('');
  const [contact, setContact] = useState(userEmail ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const plants = useQuery({
    queryKey: ['plants-for-ticket'],
    queryFn: async () => (await supabase.from('plants').select('id,name').order('name')).data ?? [],
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!subject.trim() || !description.trim()) { setErr('Please add a subject and a description.'); return; }
    setBusy(true);
    const { error } = await supabase.from('support_tickets').insert({
      subject: subject.trim(),
      description: description.trim(),
      query: query || null,
      sensor_model_id: sensorModelId || null,
      plant_name: plant || null,
      contact_email: contact.trim() || null,
    });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setDone(true);
  }

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="relative overflow-hidden bg-gradient-to-r from-brand-600 to-brand-800 text-white px-5 py-3.5 flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-lg bg-white/15 ring-1 ring-white/20 flex items-center justify-center"><LifeBuoy size={16} /></span>
          <div className="flex-1 font-semibold tracking-tight">Log a support ticket</div>
          <button onClick={onClose} aria-label="Close" className="tap rounded-lg hover:bg-white/15 w-8 h-8 flex items-center justify-center"><X size={18} /></button>
        </div>

        {done ? (
          <div className="p-6 text-center">
            <CheckCircle2 size={40} className="text-emerald-500 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-900">Ticket logged</h3>
            <p className="text-sm text-slate-500 mt-1 mb-5">Our team will pick it up. You can keep using the assistant in the meantime.</p>
            <button onClick={onClose} className="btn-primary w-full">Done</button>
          </div>
        ) : (
          <form onSubmit={submit} className="p-5 space-y-3">
            {err && <div role="alert" className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm p-3">{err}</div>}
            <label className="block">
              <span className="label">Subject</span>
              <input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Short summary of the problem" />
            </label>
            <label className="block">
              <span className="label">What's happening?</span>
              <textarea className="input min-h-24" value={description} onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the issue, what you tried, and any error or reading you're seeing." />
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="label">Plant (optional)</span>
                <select className="input" value={plant} onChange={(e) => setPlant(e.target.value)}>
                  <option value="">Select a plant…</option>
                  {(plants.data ?? []).map((p: any) => <option key={p.id} value={p.name}>{p.name}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="label">Contact email</span>
                <input type="email" className="input" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="you@digitalpaani.com" />
              </label>
            </div>
            <button className="btn-primary w-full" disabled={busy}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : 'Submit ticket'}
            </button>
            <p className="text-[11px] text-slate-400 text-center">This is logged for the support team to follow up.</p>
          </form>
        )}
      </div>
    </div>
  );
}
