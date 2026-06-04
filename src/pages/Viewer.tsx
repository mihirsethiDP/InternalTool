import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { supabase } from '../lib/supabase';

pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

export default function Viewer() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const nav = useNavigate();

  const initialPage = Math.max(1, parseInt(params.get('page') || '1', 10) || 1);
  const initialQuery = params.get('q') || '';

  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [docTitle, setDocTitle] = useState<string>('Document');
  const [error, setError] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [page, setPage] = useState<number>(initialPage);
  const [query, setQuery] = useState<string>(initialQuery);
  const [pageWidth, setPageWidth] = useState<number>(900);

  // Fetch the document and get a signed URL for the file.
  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data, error: dbErr } = await supabase
        .from('documents')
        .select('title, storage_path, vendor_url')
        .eq('id', id)
        .maybeSingle();
      if (dbErr || !data) { setError('Document not found.'); return; }
      setDocTitle(data.title || 'Document');
      if (!data.storage_path) {
        setError(
          data.vendor_url
            ? 'This document has no PDF file uploaded — it links to the vendor URL.'
            : 'This document has no PDF file uploaded yet.'
        );
        return;
      }
      const { data: signed, error: signErr } = await supabase.storage
        .from('documents').createSignedUrl(data.storage_path, 600);
      if (signErr || !signed?.signedUrl) {
        setError('Could not generate a signed URL: ' + (signErr?.message ?? '?'));
        return;
      }
      setFileUrl(signed.signedUrl);
    })();
  }, [id]);

  // Responsive width — fit page to container.
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

  // Wrap matches in <mark> within the text layer.
  // react-pdf calls this once per text item; we return HTML.
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
    if (page > n) setPage(n);
  }

  function go(delta: number) {
    if (!numPages) return;
    setPage((p) => Math.min(numPages, Math.max(1, p + delta)));
  }

  return (
    <div className="min-h-[80vh]">
      {/* Toolbar */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 -mx-5 px-5 py-3 flex items-center gap-3 flex-wrap">
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
            <button onClick={() => go(-1)} className="px-1.5 text-slate-600 hover:text-brand-700" disabled={page <= 1}>‹</button>
            <input
              type="number" min={1} max={numPages ?? 1} value={page}
              onChange={(e) => setPage(Math.max(1, Math.min(numPages ?? 1, parseInt(e.target.value || '1', 10) || 1)))}
              className="w-12 text-center text-sm outline-none"
            />
            <span className="text-sm text-slate-500">/ {numPages ?? '…'}</span>
            <button onClick={() => go(1)} className="px-1.5 text-slate-600 hover:text-brand-700" disabled={numPages != null && page >= numPages}>›</button>
          </div>
          {fileUrl && (
            <a href={fileUrl} target="_blank" rel="noreferrer" className="btn-secondary btn-sm">Open native ↗</a>
          )}
        </div>
      </div>

      {error && (
        <div className="card mt-4 text-sm">
          <div className="font-semibold text-amber-700 mb-1">Can't open this document</div>
          <div className="text-slate-700">{error}</div>
        </div>
      )}

      {/* PDF */}
      {fileUrl && (
        <div className="flex justify-center pt-4">
          <Document
            file={fileUrl}
            onLoadSuccess={onLoad}
            loading={<div className="muted py-12">Loading PDF…</div>}
            error={<div className="card text-sm text-red-600">Failed to render PDF.</div>}
          >
            <Page
              pageNumber={page}
              width={pageWidth}
              customTextRenderer={customTextRenderer as any}
              renderAnnotationLayer={false}
              className="shadow-lg rounded-lg overflow-hidden"
            />
          </Document>
        </div>
      )}

      {/* Local style for highlights */}
      <style>{`
        .dp-mark { background: #fde68a; color: inherit; padding: 0; border-radius: 2px; }
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
