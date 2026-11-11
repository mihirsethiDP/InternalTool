import * as pdfjsLib from 'pdfjs-dist';
import { supabase } from './supabase';
import { sanitizeText } from './text';

// OCR for scanned PDFs, driven from the browser.
//
// The first attempt sent the whole PDF to the edge function, which either
// base64-encoded 8 MB in the worker (CPU limit) or waited two minutes for a
// single 18-page transcription (wall-clock limit). Both hit Supabase's
// WORKER_RESOURCE_LIMIT. So the browser does the heavy part — pdf.js renders
// each page to a JPEG — and the edge function only relays one small image at
// a time to Claude (`ocr-page`), a few pages in parallel.

export interface OcrProgress { page: number; total: number }

const MAX_WIDTH = 1400; // px — enough for 10 pt print, ~150–300 KB per page as JPEG
const PARALLEL = 3;

async function renderPage(pdf: pdfjsLib.PDFDocumentProxy, n: number): Promise<string> {
  const page = await pdf.getPage(n);
  const base = page.getViewport({ scale: 1 });
  const scale = Math.min(2, MAX_WIDTH / base.width);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas unavailable');
  await page.render({ canvasContext: ctx, viewport }).promise;
  const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
  canvas.width = 0; canvas.height = 0;
  return dataUrl.slice(dataUrl.indexOf(',') + 1);
}

async function ocrOne(b64: string, page: number, total: number): Promise<string> {
  const { data, error } = await supabase.functions.invoke('chat-answer', {
    body: { mode: 'ocr-page', image_b64: b64, media_type: 'image/jpeg', page, total },
  });
  if (error) throw new Error(error.message);
  const text = (data as any)?.text;
  if (typeof text !== 'string') throw new Error((data as any)?.error ?? 'no text');
  return text;
}

// Returns the document text as "[Page n]" blocks, like the pdf.js path, so
// the review screen and the splitter see the same shape.
export async function ocrPdfInBrowser(file: File, onProgress?: (p: OcrProgress) => void): Promise<{ text: string; pages: number; failed: number[] }> {
  const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
  const total = pdf.numPages;
  const out: string[] = new Array(total).fill('');
  const failed: number[] = [];
  let next = 1; let done = 0;
  const worker = async () => {
    while (next <= total) {
      const n = next++;
      try {
        const img = await renderPage(pdf, n);
        out[n - 1] = await ocrOne(img, n, total);
      } catch (e) {
        console.warn(`ocr page ${n} failed`, e);
        failed.push(n);
      }
      done++;
      onProgress?.({ page: done, total });
    }
  };
  await Promise.all(Array.from({ length: Math.min(PARALLEL, total) }, worker));
  const text = out.map((t, i) => `[Page ${i + 1}]\n${t.trim() || (failed.includes(i + 1) ? '[page could not be read]' : '')}`).join('\n\n');
  return { text: sanitizeText(text), pages: total, failed };
}
