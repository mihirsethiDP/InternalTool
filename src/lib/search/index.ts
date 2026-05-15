import type { SearchHit } from '../types';
import { keywordSearch } from './keywordProvider';

export interface SearchFilters {
  plant_id?: string;
  sensor_model_id?: string;
  plc_id?: string;
  type_key?: string;
  category_id?: string;
  make_id?: string;
  equipment_id?: string;
}

export interface SearchResult {
  hits: SearchHit[];
  answer?: string;
}

export type SearchMode = 'keyword' | 'hybrid_ai';
const MODE: SearchMode = (import.meta.env.VITE_SEARCH_MODE as SearchMode) || 'keyword';

export async function runSearch(query: string, filters: SearchFilters = {}): Promise<SearchResult> {
  if (MODE === 'keyword') {
    const hits = await keywordSearch(query, filters);
    return { hits };
  }
  return { hits: [] };
}
