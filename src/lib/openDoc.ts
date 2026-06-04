import type { NavigateFunction } from 'react-router-dom';
import { supabase } from './supabase';

interface OpenOpts {
  id: string;
  nav: NavigateFunction;
  page?: number | null;
  query?: string;
}

/**
 * Shared "open document" behaviour. Used by search results, recent uploads,
 * sensor detail docs, etc.
 *  - If the document has a file (storage_path) → route to /view/:id with
 *    page + q query params so the embedded viewer scrolls + highlights.
 *  - Else if a vendor URL is set → open it in a new tab.
 *  - Else → show a clear message.
 */
export async function openDocument({ id, nav, page, query }: OpenOpts) {
  const { data: doc } = await supabase
    .from('documents')
    .select('storage_path, vendor_url')
    .eq('id', id)
    .maybeSingle();

  if (doc?.storage_path) {
    const params = new URLSearchParams();
    if (page) params.set('page', String(page));
    if (query) params.set('q', query);
    const qs = params.toString();
    nav(`/view/${id}${qs ? '?' + qs : ''}`);
    return;
  }
  if (doc?.vendor_url) {
    window.open(doc.vendor_url, '_blank');
    return;
  }
  alert(
    'No file attached to this document yet.\n\n' +
    'This document is searchable by its content but has no PDF file. ' +
    'An uploader can attach the actual PDF via the "+ Upload" button.'
  );
}
