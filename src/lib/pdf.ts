import * as pdfjsLib from 'pdfjs-dist';
// Vite-friendly worker import
// eslint-disable-next-line
// @ts-ignore
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

export interface ExtractedPage {
  page: number;
  text: string;
}

export async function extractPdfText(file: File): Promise<ExtractedPage[]> {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const out: ExtractedPage[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const text = (content.items as Array<{ str: string }>).map((i) => i.str).join(' ');
    out.push({ page: p, text: normalize(text) });
  }
  return out;
}

function normalize(t: string) {
  return t.replace(/\s+/g, ' ').trim();
}

// Chunk a page into ~1000 char chunks at sentence boundaries when possible.
export function chunkPage(text: string, page: number, target = 1000): Array<{ page: number; text: string }> {
  if (text.length <= target) return [{ page, text }];
  const sentences = text.split(/(?<=[.!?])\s+/);
  const chunks: Array<{ page: number; text: string }> = [];
  let cur = '';
  for (const s of sentences) {
    if ((cur + ' ' + s).length > target && cur) {
      chunks.push({ page, text: cur });
      cur = s;
    } else {
      cur = cur ? cur + ' ' + s : s;
    }
  }
  if (cur) chunks.push({ page, text: cur });
  return chunks;
}
