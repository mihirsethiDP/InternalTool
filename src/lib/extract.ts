import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import { extractPdfText, sanitizeText } from './pdf';

// Text extraction for every upload type the picker accepts.
//
// Until 2026-11 only PDFs were read; a Word file uploaded fine, landed in the
// review queue with NO text, and was rejected ("Upload PDF only") — which is
// how Nagendra's EZVIZ manual and SAT report never reached the library.
//
//  .pdf        pdf.js (text layer). A scanned PDF has no text layer and comes
//              back with ~0 characters per page — the caller then asks the edge
//              function to OCR it (`needsOcr`).
//  .docx       the document.xml inside the zip, tags stripped, paragraphs and
//              table cells kept as line breaks / separators.
//  .xlsx/.xls/.csv  every sheet as pipe-separated rows.
//  .doc (legacy binary) and images: no reader in the browser — the caller
//              tells the user to save as .docx / PDF.

export interface Extracted {
  text: string;
  pages: number; // PDF pages; 1 for other kinds
  kind: 'pdf' | 'docx' | 'sheet' | 'unsupported';
  needsOcr?: boolean; // PDF with (almost) no text layer
}

export function extractionKind(file: File): Extracted['kind'] {
  const name = file.name.toLowerCase();
  if (name.endsWith('.pdf') || /pdf/i.test(file.type)) return 'pdf';
  if (name.endsWith('.docx') || /wordprocessingml/i.test(file.type)) return 'docx';
  if (/\.(xlsx|xlsm|xls|csv)$/.test(name) || /spreadsheetml|ms-excel|csv/i.test(file.type)) return 'sheet';
  return 'unsupported';
}

// A real text layer gives hundreds of characters per page; a scanned manual
// gives none (or a few from a stamped header).
const OCR_THRESHOLD_PER_PAGE = 40;

export async function extractFileText(file: File): Promise<Extracted> {
  const kind = extractionKind(file);
  if (kind === 'pdf') {
    const pages = await extractPdfText(file);
    const text = pages.map((p) => `[Page ${p.page}]\n${p.text}`).join('\n\n');
    const chars = pages.reduce((a, p) => a + p.text.length, 0);
    return { text, pages: pages.length, kind, needsOcr: pages.length > 0 && chars / pages.length < OCR_THRESHOLD_PER_PAGE };
  }
  if (kind === 'docx') return { text: await extractDocxText(file), pages: 1, kind };
  if (kind === 'sheet') return { text: await extractSheetText(file), pages: 1, kind };
  return { text: '', pages: 0, kind };
}

const XML_ENTITIES: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'" };

export function docxXmlToText(xml: string): string {
  const text = xml
    .replace(/<w:tab\/>/g, '\t')
    .replace(/<w:br[^>]*\/>/g, '\n')
    // a paragraph that ends a table cell must not break the row
    .replace(/<\/w:p>(\s*<\/w:tc>)/g, '$1')
    .replace(/<\/w:p>/g, '\n')
    .replace(/<\/w:tc>/g, ' | ')
    .replace(/<\/w:tr>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&(amp|lt|gt|quot|apos);/g, (m) => XML_ENTITIES[m] ?? m)
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/[ \t]+\|/g, ' |')
    .replace(/\n{3,}/g, '\n\n');
  return sanitizeText(text).trim();
}

export async function extractDocxText(file: File): Promise<string> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const main = zip.file('word/document.xml');
  if (!main) throw new Error('not a Word document (no word/document.xml)');
  let text = docxXmlToText(await main.async('string'));
  // Headers/footers often carry the model number and revision — keep them.
  const extras = Object.keys(zip.files).filter((n) => /^word\/(header|footer)\d*\.xml$/.test(n)).sort();
  for (const n of extras) {
    const t = docxXmlToText(await zip.file(n)!.async('string'));
    if (t && t.length > 3 && !text.includes(t)) text += `\n\n${t}`;
  }
  return text;
}

export async function extractSheetText(file: File): Promise<string> {
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const out: string[] = [];
  for (const name of wb.SheetNames) {
    const rows: unknown[][] = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, blankrows: false, defval: '' });
    const lines = rows.map((r) => r.map((c) => String(c ?? '').trim()).join(' | ').replace(/( \|)+$/, '')).filter((l) => l.replace(/[\s|]/g, ''));
    if (lines.length) out.push(`## ${name}\n${lines.join('\n')}`);
  }
  return sanitizeText(out.join('\n\n')).trim();
}
