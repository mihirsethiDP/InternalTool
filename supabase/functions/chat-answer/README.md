# chat-answer — Gemini RAG for the troubleshooting assistant

Grounded answers: retrieves verified content (`chat_retrieve` RPC), asks Gemini
to answer **only** from that content, returns answer + citations. The Gemini
key lives only as a secret on this function — never in the browser bundle.

The chatbot **degrades gracefully**: if this function isn't deployed or errors,
the client falls back to retrieval-only results. So you can merge the branch
first and turn on AI answers whenever the function + secret are in place.

## Deploy (Supabase dashboard — no CLI needed)

1. **Apply the migration first.** SQL Editor → run
   `supabase/migrations/026_search_quality_and_retrieve.sql`.
   (Adds `chat_retrieve`, fixes search relevance.)

2. **Create the function.** Dashboard → **Edge Functions** → **Create a function**
   → name it exactly `chat-answer` → paste the contents of `index.ts` → **Deploy**.

3. **Add the secret.** Edge Functions → **Manage secrets** (or Settings → Edge
   Functions → Secrets) → add:
   - `GEMINI_API_KEY` = your `AIza…` key from https://aistudio.google.com/apikey
   - *(optional)* `GEMINI_MODEL` = `gemini-2.0-flash` (the default if unset)

   `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically —
   do **not** add them yourself.

4. **Test.** Ask the assistant in the app: *"How do I clean the pH probe?"*
   You should get a synthesized answer with numbered **Sources** beneath it.

## Notes

- `verify_jwt` is left on (default), so only signed-in users can call it.
- Free-tier Gemini may use prompts to improve Google's products. Enable billing
  on the Google Cloud project for the paid tier if that matters for your content.
- To change the model, set the `GEMINI_MODEL` secret — no redeploy of code needed.
