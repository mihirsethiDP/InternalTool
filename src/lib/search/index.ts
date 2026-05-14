import type { SearchHit } from '../types';
import { keywordSearch } from './keywordProvider';
// import { hybridAISearch } from './hybridAIProvider'; // future

export interface SearchFilters {
  plant_id?: string;
  sensor_model_id?: string;
  plc_id?: string;
  type_key?: string;
  category_id?: string;
  make_id?: string;
}

export interface SearchResult {
  hits: SearchHit[];
  /** Set when the AI provider produced a synthesized answer with citations. */
  answer?: string;
}

export type SearchMode = 'keyword' | 'hybrid_ai';

const MODE: SearchMode = (import.meta.env.VITE_SEARCH_MODE as SearchMode) || 'keyword';

export async function runSearch(query: string, filters: SearchFilters = {}): Promise<SearchResult> {
  if (!query.trim() && !Object.values(filters).some(Boolean)) {
    return { hits: [] };
  }
  // Swap point: when paid AI is enabled, change MODE to 'hybrid_ai'.
  // The hybrid provider will: (1) embed the query, (2) cosine-search the
  // `embedding` column on document_chunks, (3) merge with the same FTS results
  // below, (4) ask Claude to synthesize. The function signature stays identical.
  if (MODE === 'keyword') {
    const hits = await keywordSearch(query, filters);
    return { hits };
  }
  // return hybridAISearch(query, filters);
  return { hits: [] };
}
