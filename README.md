# DP Internal Document Hub

One-stop document hub for Digital Paani's internal teams — manuals, datasheets,
certificates, I/O lists, P&IDs, and more — searchable across PDF contents.

**Live:** https://mihirsethidp.github.io/InternalTool/

## Stack

- React 18 + TypeScript + Vite, Tailwind, React Router (hash), TanStack Query
- Supabase: Postgres (schema + RLS + tsvector FTS), Auth (magic links), Storage (PDFs)
- PDF text extraction in-browser via `pdfjs-dist` at upload time
- Search behind a provider interface — swap keyword → hybrid AI without UI changes

## One-time setup

### 1. Run the migrations on Supabase

1. Open Supabase dashboard → SQL editor → "New query"
2. Paste the contents of [`supabase/migrations/001_init.sql`](supabase/migrations/001_init.sql) and **Run**.
3. Generate the seed locally (extracts the sensor catalog from the master xlsx):
   ```bash
   npm install
   npm run build-seed -- "D:/Downloads/Master Costing Database.xlsx"
   ```
   This writes `supabase/migrations/002_seed.sql`.
4. Paste that file into the Supabase SQL editor and **Run**.
5. Sign in to the deployed site once with `mihir.sethi@digitalpaani.com` to create your
   profile row, then re-run this line in the SQL editor (already included in the migration,
   but rerun is harmless):
   ```sql
   update public.profiles set role = 'admin' where email = 'mihir.sethi@digitalpaani.com';
   ```

### 2. Configure GitHub Pages secrets

In the GitHub repo → Settings → Secrets and variables → Actions, add:

- `VITE_SUPABASE_URL` = `https://hdbkmctvkpbfaaoojdud.supabase.co`
- `VITE_SUPABASE_ANON_KEY` = (your anon key)

Then in Settings → Pages, set source = **GitHub Actions**.

### 3. (Optional) Restrict sign-ups to your domain

Supabase dashboard → Authentication → Providers → Email → enable, then
Authentication → URL Configuration → add `https://mihirsethidp.github.io` to allowed redirect URLs.
For an extra hard guard, add a SQL trigger that rejects emails not ending in `@digitalpaani.com`.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in your Supabase URL + anon key
npm run dev
```

## Search behaviour

- **Today (keyword):** Postgres full-text search across PDF page-chunks, ranked by `ts_rank`,
  with `ts_headline` snippets and page-number deep links to the source PDF.
  Try queries like `"troubleshooting steps Brotek UT-116"` — the matching chunk surfaces with
  page number, and clicking opens the PDF at that page.
- **Tomorrow (AI):** flip `VITE_SEARCH_MODE=hybrid_ai`, add `pgvector`, backfill
  `document_chunks.embedding`, and the `hybridAIProvider` will (a) embed the query,
  (b) cosine-rank chunks alongside FTS, (c) ask Claude to synthesize. **Zero UI changes.**

## Permissions

- **viewer** (default): can read everything.
- **uploader**: can upload documents and edit the catalog.
- **admin**: can manage users, plants, document types, and delete files.

Roles are managed from the **Admin** page in the app.

## File storage

PDF files live in Supabase Storage bucket `documents` (private; access via signed URLs).
Document text is extracted at upload time and stored in `document_chunks` for search;
embeddings will live in the same table when AI is enabled.
