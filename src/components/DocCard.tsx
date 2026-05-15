import { Link } from 'react-router-dom';
import type { SearchHit } from '../lib/types';
import { supabase } from '../lib/supabase';
import { useState } from 'react';

export function DocCard({ hit, query }: { hit: SearchHit; query?: string }) {
  const [opening, setOpening] = useState(false);

  async function open() {
    setOpening(true);
    const { data: doc } = await supabase
      .from('documents')
      .select('storage_path, vendor_url')
      .eq('id', hit.document_id)
      .maybeSingle();
    if (doc?.storage_path) {
      const { data, error } = await supabase.storage
        .from('documents')
        .createSignedUrl(doc.storage_path, 600);
      if (data?.signedUrl) {
        const url = hit.page_number ? `${data.signedUrl}#page=${hit.page_number}` : data.signedUrl;
        window.open(url, '_blank');
      } else if (error) {
        alert('Could not open file: ' + error.message);
      }
    } else if (doc?.vendor_url) {
      window.open(doc.vendor_url, '_blank');
    }
    setOpening(false);
  }

  return (
    <div className="card hover:shadow-md transition cursor-pointer" onClick={open}>
      <div className="flex items-start gap-3">
        <div className="text-2xl">📄</div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-slate-900 truncate">{hit.document_title}</h3>
            {hit.type_label && <span className="badge-blue">{hit.type_label}</span>}
            {hit.page_number != null && <span className="badge">p.{hit.page_number}</span>}
          </div>
          <div className="text-xs text-slate-500 mt-0.5 flex gap-3 flex-wrap">
            {hit.plant_name && <span>🏭 {hit.plant_name}</span>}
            {hit.equipment_name && <span>⚙️ {hit.equipment_name}</span>}
            {hit.sensor_make && hit.sensor_model_no && (
              <span>🔧 {hit.sensor_make} {hit.sensor_model_no}</span>
            )}
          </div>
          {hit.snippet && (
            <p
              className="text-sm text-slate-700 mt-2 line-clamp-3"
              dangerouslySetInnerHTML={{ __html: highlight(hit.snippet, query) }}
            />
          )}
        </div>
        <button className="btn-secondary" disabled={opening}>{opening ? '…' : 'Open'}</button>
      </div>
    </div>
  );
}

function highlight(text: string, q?: string) {
  const safe = text.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));
  if (!q) return safe;
  const terms = q.split(/\s+/).filter((t) => t.length > 2);
  let out = safe;
  for (const t of terms) {
    const re = new RegExp(`(${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig');
    out = out.replace(re, '<mark>$1</mark>');
  }
  return out;
}
