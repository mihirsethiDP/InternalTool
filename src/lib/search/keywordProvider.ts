import { supabase } from '../supabase';
import type { SearchHit } from '../types';
import type { SearchFilters } from './index';

/**
 * Calls the `search_documents` Postgres RPC defined in the migration.
 * The RPC performs a tsvector-ranked search over document_chunks and joins
 * back document/plant/sensor/type metadata. Filters narrow before ranking.
 *
 * When AI search is enabled later, the equivalent RPC `hybrid_search_documents`
 * will accept the same args plus an `embedding` parameter — the UI layer does
 * not change.
 */
export async function keywordSearch(query: string, filters: SearchFilters): Promise<SearchHit[]> {
  const { data, error } = await supabase.rpc('search_documents', {
    q: query || null,
    p_plant_id: filters.plant_id ?? null,
    p_sensor_model_id: filters.sensor_model_id ?? null,
    p_plc_id: filters.plc_id ?? null,
    p_type_key: filters.type_key ?? null,
    p_category_id: filters.category_id ?? null,
    p_make_id: filters.make_id ?? null,
    p_limit: 50,
  });
  if (error) {
    console.error('search_documents error', error);
    return [];
  }
  return (data as SearchHit[]) ?? [];
}
