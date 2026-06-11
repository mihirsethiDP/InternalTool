-- =============================================================
-- Migration 018: cached document translations
--
-- One row per (consolidated_doc, language). Content is translated ONCE
-- (by scripts/translate-docs.mjs using the Google Translate API, or by
-- Claude later) and cached here, so viewing costs nothing.
-- The viewer shows a language picker; missing translations fall back
-- to English with a notice.
-- =============================================================
begin;

create table if not exists public.consolidated_doc_translations (
  id uuid primary key default gen_random_uuid(),
  consolidated_doc_id uuid not null references public.consolidated_docs(id) on delete cascade,
  lang text not null,                       -- 'hi', 'bn', 'mr', 'te', 'ta', 'gu', 'kn'
  content_markdown text not null,
  source_updated_at timestamptz not null,   -- last_updated_at of the source at translation time
  translated_at timestamptz default now(),
  unique (consolidated_doc_id, lang)
);
create index if not exists cdt_doc_idx on public.consolidated_doc_translations(consolidated_doc_id);

alter table public.consolidated_doc_translations enable row level security;

drop policy if exists cdt_select on public.consolidated_doc_translations;
create policy cdt_select on public.consolidated_doc_translations for select to authenticated using (true);

drop policy if exists cdt_write on public.consolidated_doc_translations;
create policy cdt_write on public.consolidated_doc_translations for all to authenticated
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

commit;
