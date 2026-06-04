import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { supabase } from '../lib/supabase';

// Use the worker version that matches the pdfjs react-pdf bundles.
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export default function Viewer() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const nav = useNavigate();

  const initialPage = Math.max(1, parseInt(params.get('page') || '1', 10) || 1);
  const initialQuery = params.get('q') || '';

  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [docTitle, setDocTitle] = useState('Document');
  const [error, setError] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [visiblePage, setVisiblePage] = useState(initialPage);
  const [query, setQuery] = useState(initialQuery);
  const [pageWidth, setPageWidth] = useState(900);
  const pageRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const scrolledToInitial = useRef(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data, error: dbErr } = await supabase
        .from('documents').select('title, storage_path, vendor_url').eq('id', id).maybeSingle();
      if (dbErr || !data) { setError('Document not found.'); return; }
      setDocTitle(data.title || 'Document');
      if (!data.storage_path) {
        setError(data.vendor_url ? 'No PDF uploaded — this document links to a vendor URL only.' : 'No PDF file has been uploaded for this document yet.');
        return;
      }
      const { data: signed, error: signErr } = await supabase.storage
        .from('documents').createSignedUrl(data.storage_path, 600);
      if (signErr || !signed?.signedUrl) { setError('Could not sign URL: ' + (signErr?.message ?? '?')); return; }
      setFileUrl(signed.signedUrl);
    })();
  }, [id]);

  useEffect(() => {
    function onResize() {
      const w = Math.min(900, (window.innerWidth || 900) - 80);
      setPageWidth(Math.max(360, w));
    }
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const terms = useMemo(() =>
    query.split(/\s+/).map((t) => t.trim()).filter((t) => t.length > 1),
  [query]);

  function customTextRenderer({ str }: { str: string }) {
    if (terms.length === 0) return escapeHtml(str);
    let out = escapeHtml(str);
    for (const t of terms) {
      const re = new RegExp(`(${escapeRegex(t)})`, 'gi');
      out = out.replace(re, '<mark class="dp-mark">$1</mark>');
    }
    return out;
  }

  function onLoad({ numPages: n }: { numPages: number }) {
    setNumPages(n);
  }

  // Scroll to the initial page once it has rendered
  useEffect(() => {
    if (scrolledToInitial.current || !numPages) return;
    const target = Math.min(initialPage, numPages);
    const el = pageRefs.current[target];
    if (el) {
      el.scrollIntoView({ behavior: 'auto', block: 'start' });
      setVisiblePage(target);
      scrolledToInitial.current = true;
    }
  }, [numPages, initialPage]);

  // Track which page is currently in view (using IntersectionObserver)
  useEffect(() => {
    if (!numPages) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .map((e) => Number((e.target as HTMLElement).dataset.page))
          .sort((a, b) => a - b);
        if (visible.length) setVisiblePage(visible[0]);
      },
      { rootMargin: '-40% 0px -40% 0px', threshold: 0 }
    );
    Object.values(pageRefs.current).forEach((el) => { if (el) obs.observe(el); });
    return () => obs.disconnect();
  }, [numPages]);

  function jumpTo(p: number) {
    if (!numPages) return;
    const target = Math.max(1, Math.min(numPages, p));
    pageRefs.current[target]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div className="min-h-[80vh]">
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-slate-200 -mx-5 px-5 py-3 flex items-center gap-3 flex-wrap">
        <button onClick={() => nav(-1)} className="btn-ghost btn-sm">← Back</button>
        <div className="font-semibold text-slate-900 truncate max-w-md">{docTitle}</div>
        <div className="ml-auto flex items-center gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Highlight in document…"
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm w-56 focus:border-brand-700 focus:ring-2 focus:ring-brand-700/20 outline-none"
          />
          <div className="flex items-center gap-1 border border-slate-200 rounded-lg px-2 py-1">
            <button onClick={() => jumpTo(visiblePage - 1)} className="px-1.5 text-slate-600 hover:text-brand-700" disabled={visiblePage <= 1}>‹</button>
            <input
              type="number" min={1} max={numPages ?? 1} value={visiblePage}
              onChange={(e) => jumpTo(parseInt(e.target.value || '1', 10) || 1)}
              className="w-12 text-center text-sm outline-none"
            />
            <span className="text-sm text-slate-500">/ {numPages ?? '…'}</span>
            <button onClick={() => jumpTo(visiblePage + 1)} className="px-1.5 text-slate-600 hover:text-brand-700" disabled={numPages != null && visiblePage >= numPages}>›</button>
          </div>
          {fileUrl && <a href={fileUrl} target="_blank" rel="noreferrer" className="btn-secondary btn-sm">Open native ↗</a>}
        </div>
      </div>

      {error && (
        <div className="card mt-4 text-sm">
          <div className="font-semibold text-amber-700 mb-1">Can't open this document</div>
          <div className="text-slate-700">{error}</div>
        </div>
      )}

      {fileUrl && (
        <div className="flex justify-center pt-4">
          <Document
            file={fileUrl}
            onLoadSuccess={onLoad}
            onLoadError={(e) => setError('Failed to load PDF: ' + e.message)}
            loading={<div className="muted py-12">Loading PDF…</div>}
            error={<div className="card text-sm text-red-600">Failed to render PDF.</div>}
          >
            {numPages && Array.from({ length: numPages }, (_, i) => {
              const p = i + 1;
              return (
                <div
                  key={p}
                  data-page={p}
                  ref={(el) => { pageRefs.current[p] = el; }}
                  className="mb-4 last:mb-0"
                >
                  <Page
                    pageNumber={p}
                    width={pageWidth}
                    customTextRenderer={customTextRenderer as any}
                    renderAnnotationLayer={false}
                    className="shadow-lg rounded-lg overflow-hidden bg-white"
                  />
                  <div className="text-center text-xs text-slate-400 mt-1">{p}</div>
                </div>
              );
            })}
          </Document>
        </div>
      )}

      <style>{`
        /* Translucent so the canvas-rendered text underneath stays visible. */
        .dp-mark {
          background: rgba(255, 213, 0, 0.45);
          border-radius: 2px;
          padding: 0;
        }
        .react-pdf__Page__textContent { user-select: text; }
        .react-pdf__Page { background: white; }
      `}</style>
    </div>
  );
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
}
function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
