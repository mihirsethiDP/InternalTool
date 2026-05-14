/**
 * Stub for future AI-powered hybrid search. Activated by setting
 * VITE_SEARCH_MODE=hybrid_ai and providing the LLM API key on the backend.
 *
 * Planned flow:
 *   1. Embed the user query (Claude / OpenAI embedding model).
 *   2. Call `hybrid_search_documents(q, embedding, filters...)` RPC, which:
 *        - runs the same FTS as v1 (keywordProvider)
 *        - runs cosine similarity over document_chunks.embedding
 *        - merges with Reciprocal Rank Fusion
 *   3. Pipe top-k chunks to Claude with a system prompt that produces a
 *      synthesized answer + citations (document_id + page_number).
 *   4. Return { hits, answer } so the UI shows both the answer and the docs.
 *
 * No UI changes required when this is enabled — runSearch() returns the same
 * shape as the keyword provider, with `answer` optionally populated.
 */
import type { SearchResult } from './index';

export async function hybridAISearch(_query: string): Promise<SearchResult> {
  throw new Error('AI search not enabled — set VITE_SEARCH_MODE=hybrid_ai and provide API key.');
}
