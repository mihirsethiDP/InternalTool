import { useNavigate } from 'react-router-dom';
import type { SearchHit } from '../lib/types';
import { useState } from 'react';
import { FileText } from 'lucide-react';
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
    <div className="card hover:border-brand-700 hover:shadow-sm transition cursor-pointer" onClick={open}>
      <div className="flex items-start gap-3">
        <div className="bg-brand-50 text-brand-700 rounded-md w-9 h-9 flex items-center justify-center shrink-0">
          <FileText size={16} strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-slate-900 truncate">{hit.document_title?.trim()}</h3>
            {hit.type_label && <span className="badge-blue">{hit.type_label}</span>}
            {hit.page_number != null && <span className="badge">p.{hit.page_number}</span>}
          </div>
          <div className="text-xs text-slate-500 mt-0.5 flex gap-3 flex-wrap">
            {hit.plant_name && <span>{hit.plant_name}</span>}
            {hit.equipment_name && <span>· {hit.equipment_name}</span>}
            {hit.sensor_make && hit.sensor_model_no && (
              <span>{hit.sensor_make} {hit.sensor_model_no}</span>
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
  // Server returns plain-text snippets now (no markup); do all highlighting
  // here with a prefix-aware regex so it matches what Postgres FTS prefix
  // matching actually returns.
  const escaped = text.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));
  if (!q || !q.trim()) return escaped;
  const terms = q
    .split(/\s+/)
    .map((t) => t.replace(/[^a-zA-Z0-9]/g, ''))
    .filter((t) => t.length > 1);
  if (terms.length === 0) return escaped;
  const pattern = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  // Match a whole word that STARTS with any of the terms (prefix match).
  const re = new RegExp(`\\b(?:${pattern})\\w*`, 'gi');
  return escaped.replace(re, '<mark>$&</mark>');
}
