import type { NavigateFunction } from 'react-router-dom';

interface OpenOpts {
  id: string;
  nav: NavigateFunction;
  page?: number | null;
  query?: string;
}

/**
 * Shared "open document" behaviour.
 *
 * In the maker-checker / consolidated-doc model, the `id` we receive from
 * search results is a consolidated_doc_id (one per sensor), not an
 * individual document. So Open always routes to the consolidated viewer
 * with an optional ?q= for in-document highlighting. The viewer offers
 * a sidebar of "Original PDFs" — clicking those opens the raw file.
 */
export async function openDocument({ id, nav, query }: OpenOpts) {
  const params = new URLSearchParams();
  if (query) params.set('q', query);
  const qs = params.toString();
  nav(`/consolidated/${id}${qs ? '?' + qs : ''}`);
}
