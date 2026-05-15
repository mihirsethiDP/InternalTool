import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

interface Props {
  onClose: () => void;
  onCreated?: (id: string) => void;
  defaultMakeName?: string;
}

/**
 * Reusable modal for creating a new sensor model.
 * Used standalone on the Sensor catalog AND inline from the Upload modal.
 */
export default function AddSensorModal({ onClose, onCreated, defaultMakeName }: Props) {
  const qc = useQueryClient();
  const [makeName, setMakeName] = useState(defaultMakeName ?? '');
  const [categoryId, setCategoryId] = useState('');
  const [modelNo, setModelNo] = useState('');
  const [name, setName] = useState('');
  const [vendorUrl, setVendorUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const cats = useQuery({ queryKey: ['cats'], queryFn: async () => (await supabase.from('sensor_categories').select('id,name').order('name')).data ?? [] });
  const makes = useQuery({ queryKey: ['makes'], queryFn: async () => (await supabase.from('sensor_makes').select('id,name').order('name')).data ?? [] });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!makeName.trim() || !categoryId || !modelNo.trim()) {
      setErr('Make, category and model number are required.');
      return;
    }
    setBusy(true);
    // Find-or-create make
    let { data: existing } = await supabase.from('sensor_makes').select('id').ilike('name', makeName.trim()).maybeSingle();
    let makeId = existing?.id;
    if (!makeId) {
      const { data: newMake, error } = await supabase.from('sensor_makes').insert({ name: makeName.trim() }).select('id').single();
      if (error) { setErr(error.message); setBusy(false); return; }
      makeId = newMake.id;
    }
    const { data, error } = await supabase
      .from('sensor_models')
      .insert({ make_id: makeId, category_id: categoryId, model_no: modelNo.trim(), name: name.trim() || null, vendor_url: vendorUrl.trim() || null })
      .select('id').single();
    setBusy(false);
    if (error) { setErr(error.message); return; }
    qc.invalidateQueries({ queryKey: ['makes'] });
    qc.invalidateQueries({ queryKey: ['models'] });
    qc.invalidateQueries({ queryKey: ['models-by-make'] });
    qc.invalidateQueries({ queryKey: ['sensor-models'] });
    onCreated?.(data.id);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[60] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white rounded-t-2xl">
          <div>
            <div className="text-lg font-bold tracking-tight">Add sensor to catalog</div>
            <div className="text-xs text-slate-500 mt-0.5">Make + category + model number are required.</div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-2xl leading-none">×</button>
        </div>
        <form onSubmit={submit} className="px-6 py-5 space-y-4">
          <div>
            <label className="label">Make</label>
            <input className="input" list="add-sensor-makes" value={makeName} onChange={(e) => setMakeName(e.target.value)} placeholder="e.g. Brotek, Siemens, E+H" autoFocus />
            <datalist id="add-sensor-makes">
              {makes.data?.map((m: any) => <option key={m.id} value={m.name} />)}
            </datalist>
            <div className="text-xs text-slate-500 mt-1.5">Pick from suggestions, or type a new make — it'll be created automatically.</div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="label">Category</label>
              <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                <option value="">— Select —</option>
                {cats.data?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Model number</label>
              <input className="input" value={modelNo} onChange={(e) => setModelNo(e.target.value)} placeholder="UT-116" />
            </div>
          </div>
          <div>
            <label className="label">Description (optional)</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ultrasonic level transmitter" />
          </div>
          <div>
            <label className="label">Vendor URL (optional)</label>
            <input className="input" value={vendorUrl} onChange={(e) => setVendorUrl(e.target.value)} placeholder="https://www.brotek.com/UT-116" />
          </div>
          {err && <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{err}</div>}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
            <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Creating…' : 'Create sensor'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
