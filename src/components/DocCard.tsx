import { useNavigate } from 'react-router-dom';
import type { SearchHit } from '../lib/types';
import { useState } from 'react';
import { openDocument } from '../lib/openDoc';

export function DocCard({ hit, query }: { hit: SearchHit; query?: string }) {
  const [opening, setOpening] = useState(false);
  const nav = useNavigate();

  async function open() {
    setOpening(true);
    await openDocument({ id: hit.document_id, nav, page: hit.page_number ?? null, query });
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
  // ts_headline wraps matches in <b>...</b>. Swap to placeholders before escaping,
  // then convert placeholders to <mark> after. This keeps the content safe from
  // injection while preserving Postgres-side highlights.
  const OPEN = '\x01';
  const CLOSE = '\x02';
  const preserved = text.replace(/<b>/g, OPEN).replace(/<\/b>/g, CLOSE);
  const escaped = preserved.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));
  let out = escaped.replace(new RegExp(OPEN, 'g'), '<mark>').replace(new RegExp(CLOSE, 'g'), '</mark>');
  if (q) {
    const terms = q.split(/\s+/).filter((t) => t.length > 2);
    for (const t of terms) {
      const re = new RegExp(`(${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig');
      out = out.replace(re, (m) => (/<\/?mark>/.test(m) ? m : `<mark>${m}</mark>`));
    }
  }
  return out;
}
