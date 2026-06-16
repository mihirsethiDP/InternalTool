# chat-answer — Groq RAG for the troubleshooting assistant

Grounded answers: retrieves verified content (`chat_retrieve` RPC), asks the LLM
to answer **only** from that content, returns answer + citations. The API key
lives only as a secret on this function — never in the browser bundle.

Provider is **Groq** (OpenAI-compatible chat completions). Groq has a genuinely
free API tier — no billing/card required — which is why we use it here. (Gemini's
free tier is unavailable in some regions, e.g. India, where it returns
`limit: 0`.)

The chatbot **degrades gracefully**: if this function isn't deployed or errors,
the client falls back to retrieval-only results.

## Deploy (Supabase dashboard — no CLI needed)

1. **Apply the migration first** (if not already done). SQL Editor → run
   `supabase/migrations/026_search_quality_and_retrieve.sql` (adds `chat_retrieve`).

2. **Create / update the function.** Dashboard → **Edge Functions** → the
   `chat-answer` function → **Code** → replace `index.ts` with this file's
   contents → **Deploy**.

3. **Set the secret.** Edge Functions → **Secrets**:
   - `GROQ_API_KEY` = your `gsk_…` key from https://console.groq.com/keys
   - *(optional)* `GROQ_MODEL` = `llama-3.3-70b-versatile` (the default if unset)

   `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically —
   do **not** add them. A leftover `GEMINI_API_KEY` secret is harmless; ignore it.

4. **Test.** Ask the assistant in the app: *"How do I clean the pH probe?"*
   You should get a synthesized answer with numbered **Sources** beneath it.

## Notes

- `verify_jwt` is left on (default), so only signed-in users can call it.
- To change the model, set the `GROQ_MODEL` secret (e.g. `llama-3.1-8b-instant`
  for faster/cheaper, `llama-3.3-70b-versatile` for best quality). No code change.
- The client expects `{ answer, citations }` — provider swaps don't affect it.
