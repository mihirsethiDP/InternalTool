-- =============================================================
-- Migration 011: maker-checker workflow + consolidated docs
--
-- ⚠️ DRAFT — review before running. This is a big change.
--
-- Adds:
--   - document_submissions       (pending uploads from makers)
--   - consolidated_docs          (one per sensor_model_id)
--   - consolidated_doc_chunks    (search target)
--   - notifications              (in-app + email triggers)
--   - duplicate_flags helper view
--   - search_documents RPC repointed to consolidated chunks
--
-- Does NOT touch:
--   - documents (still holds the approved source PDFs;
--     "Open original PDF" still works from the consolidated viewer)
-- =============================================================
begin;

-- ---------- 1. Submissions ----------
create table if not exists public.document_submissions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  type_id uuid references public.document_types(id) on delete set null,
  sensor_model_id uuid references public.sensor_models(id) on delete set null,
  storage_path text,                       -- PDF in the documents bucket
  vendor_url text,
  size_bytes bigint,
  page_count int,
  extracted_text text,                     -- editable preview for the checker
  uploaded_by uuid references auth.users(id) on delete set null,
  uploaded_at timestamptz default now(),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  reviewer_notes text,
  decision text
    check (decision in ('replace_section', 'append_section', 'rejected') or decision is null),
  target_section text                      -- which section the content goes into
    check (target_section in ('manual', 'install', 'troubleshooting', 'datasheet', 'other') or target_section is null)
);
create index if not exists doc_submissions_status_idx on public.document_submissions(status);
create index if not exists doc_submissions_sensor_idx on public.document_submissions(sensor_model_id);
create index if not exists doc_submissions_uploader_idx on public.document_submissions(uploaded_by);

alter table public.document_submissions enable row level security;

-- Maker can see their own; checker (admin) sees all
drop policy if exists submissions_select on public.document_submissions;
create policy submissions_select on public.document_submissions for select to authenticated
  using (
    uploaded_by = auth.uid()
    or public.current_role() = 'admin'
  );

-- Uploader/admin can insert (only as themselves)
drop policy if exists submissions_insert on public.document_submissions;
create policy submissions_insert on public.document_submissions for insert to authenticated
  with check (
    public.current_role() in ('uploader','admin')
    and uploaded_by = auth.uid()
  );

-- Only admin can update (review / approve / reject / edit text)
drop policy if exists submissions_update on public.document_submissions;
create policy submissions_update on public.document_submissions for update to authenticated
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

-- Hard delete only from server-side flow on rejection (not user-driven)
drop policy if exists submissions_delete on public.document_submissions;
create policy submissions_delete on public.document_submissions for delete to authenticated
  using (public.current_role() = 'admin');

-- Auto-stamp uploaded_by
create or replace function public.set_submission_uploader() returns trigger language plpgsql as $$
begin new.uploaded_by := coalesce(new.uploaded_by, auth.uid()); return new; end $$;
drop trigger if exists trg_set_submission_uploader on public.document_submissions;
create trigger trg_set_submission_uploader before insert on public.document_submissions
  for each row execute function public.set_submission_uploader();


-- ---------- 2. Consolidated docs ----------
create table if not exists public.consolidated_docs (
  id uuid primary key default gen_random_uuid(),
  sensor_model_id uuid unique not null references public.sensor_models(id) on delete cascade,
  -- Markdown content with section markers like ## manual / ## install / etc.
  -- The WYSIWYG editor reads/writes this.
  content_markdown text not null default '',
  last_updated_at timestamptz default now(),
  last_updated_by uuid references auth.users(id) on delete set null
);
create index if not exists consolidated_docs_sensor_idx on public.consolidated_docs(sensor_model_id);

alter table public.consolidated_docs enable row level security;

drop policy if exists consolidated_select on public.consolidated_docs;
create policy consolidated_select on public.consolidated_docs for select to authenticated using (true);

drop policy if exists consolidated_write on public.consolidated_docs;
create policy consolidated_write on public.consolidated_docs for all to authenticated
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');


-- ---------- 3. Consolidated doc chunks (search target) ----------
create table if not exists public.consolidated_doc_chunks (
  id uuid primary key default gen_random_uuid(),
  consolidated_doc_id uuid not null references public.consolidated_docs(id) on delete cascade,
  sensor_model_id uuid not null references public.sensor_models(id) on delete cascade,
  section text not null check (section in ('manual','install','troubleshooting','datasheet','other')),
  chunk_text text not null,
  tsv tsvector generated always as (to_tsvector('english', coalesce(chunk_text, ''))) stored,
  -- Reserved for v0.3 AI search + chatbot RAG
  -- embedding vector(1536),
  created_at timestamptz default now()
);
create index if not exists cdc_doc_idx on public.consolidated_doc_chunks(consolidated_doc_id);
create index if not exists cdc_sensor_idx on public.consolidated_doc_chunks(sensor_model_id);
create index if not exists cdc_tsv_idx on public.consolidated_doc_chunks using gin (tsv);
create index if not exists cdc_section_idx on public.consolidated_doc_chunks(section);

alter table public.consolidated_doc_chunks enable row level security;

drop policy if exists cdc_select on public.consolidated_doc_chunks;
create policy cdc_select on public.consolidated_doc_chunks for select to authenticated using (true);

drop policy if exists cdc_write on public.consolidated_doc_chunks;
create policy cdc_write on public.consolidated_doc_chunks for all to authenticated
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');


-- ---------- 4. Notifications ----------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('submission_created','submission_approved','submission_rejected')),
  submission_id uuid references public.document_submissions(id) on delete cascade,
  message text not null,
  read_at timestamptz,
  created_at timestamptz default now()
);
create index if not exists notifications_recipient_idx on public.notifications(recipient_id, read_at);
create index if not exists notifications_created_idx on public.notifications(created_at desc);

alter table public.notifications enable row level security;

drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications for select to authenticated
  using (recipient_id = auth.uid());

drop policy if exists notifications_update on public.notifications;
create policy notifications_update on public.notifications for update to authenticated
  using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());

-- Inserts go through a SECURITY DEFINER function (server-side flow only)


-- ---------- 5. Duplicate-flag helper ----------
-- Uses pg_trgm. Given a submission's text, returns chunks of the sensor's
-- existing consolidated doc with similarity ≥ threshold.
create or replace function public.flag_duplicates(p_submission_id uuid, p_threshold real default 0.6)
returns table (chunk_id uuid, section text, similarity real, chunk_preview text)
language sql stable as $$
  with sub as (
    select extracted_text, sensor_model_id
    from public.document_submissions
    where id = p_submission_id
  ),
  windows as (
    -- Break submission text into ~500-char windows for fairer comparison
    select unnest(regexp_split_to_array(left(sub.extracted_text, 20000), E'\\s{2,}|\\n+')) as win,
           sub.sensor_model_id
    from sub
    where coalesce(length(sub.extracted_text), 0) > 50
  )
  select c.id as chunk_id,
         c.section,
         max(similarity(w.win, c.chunk_text))::real as similarity,
         left(c.chunk_text, 220) as chunk_preview
  from windows w
  join public.consolidated_doc_chunks c on c.sensor_model_id = w.sensor_model_id
  where length(w.win) > 80
  group by c.id, c.section, c.chunk_text
  having max(similarity(w.win, c.chunk_text)) >= p_threshold
  order by similarity desc
  limit 10;
$$;


-- ---------- 6. Re-point search to consolidated chunks ----------
-- Search now returns one row per consolidated doc (one per sensor),
-- with the matching section and snippet. UI changes minimal:
-- the returned columns keep the same names.
drop function if exists public.search_documents(text, uuid, uuid, uuid, text, uuid, uuid, uuid, int);

create or replace function public.search_documents(
  q text,
  p_plant_id uuid default null,            -- ignored (kept for API compat)
  p_sensor_model_id uuid default null,
  p_plc_id uuid default null,              -- ignored
  p_type_key text default null,            -- now means: section filter
  p_category_id uuid default null,
  p_make_id uuid default null,
  p_equipment_id uuid default null,        -- ignored
  p_limit int default 50
)
returns table (
  document_id uuid,                        -- now consolidated_doc_id
  document_title text,                     -- "Make Model — Consolidated reference"
  type_label text,                         -- section label
  plant_name text,                         -- null
  equipment_name text,                     -- null
  sensor_model_no text,
  sensor_make text,
  page_number int,                         -- null (sections, not pages)
  snippet text,
  rank real
)
language sql stable as $$
  with base as (
    select cd.id as consolidated_doc_id,
           sm.id as sensor_model_id,
           (mk.name || ' ' || sm.model_no || ' — Consolidated reference') as document_title,
           sm.model_no as sensor_model_no,
           mk.name as sensor_make,
           sm.category_id, sm.make_id
    from public.consolidated_docs cd
    join public.sensor_models sm on sm.id = cd.sensor_model_id
    left join public.sensor_makes mk on mk.id = sm.make_id
    where (p_sensor_model_id is null or sm.id = p_sensor_model_id)
      and (p_category_id is null or sm.category_id = p_category_id)
      and (p_make_id is null or sm.make_id = p_make_id)
  ),
  q_parsed as (
    select public.q_to_prefix_tsquery(q) as tsq,
           coalesce(trim(q), '') as q_trim,
           split_part(trim(regexp_replace(lower(coalesce(q,'')), '[^a-z0-9 ]+', ' ', 'g')), ' ', 1) as first_term
  ),
  chunk_matches as (
    select b.consolidated_doc_id, b.document_title, b.sensor_model_no, b.sensor_make,
           c.id as chunk_id, c.section,
           c.chunk_text,
           ts_rank(c.tsv, q_parsed.tsq) as rank,
           case when q_parsed.first_term <> ''
                 and position(q_parsed.first_term in lower(c.chunk_text)) > 0
                then 0 else 1
           end as literal_priority
    from base b
    join public.consolidated_doc_chunks c on c.consolidated_doc_id = b.consolidated_doc_id
    cross join q_parsed
    where q_parsed.q_trim <> ''
      and q_parsed.tsq <> ''::tsquery
      and c.tsv @@ q_parsed.tsq
      and (p_type_key is null or c.section = p_type_key)
  ),
  best_per_doc as (
    select distinct on (cm.consolidated_doc_id)
      cm.consolidated_doc_id, cm.document_title, cm.sensor_model_no, cm.sensor_make,
      cm.section, cm.chunk_text, cm.rank
    from chunk_matches cm
    order by cm.consolidated_doc_id, cm.literal_priority asc, cm.rank desc, cm.chunk_id asc
  ),
  no_q as (
    select b.consolidated_doc_id, b.document_title, null::text as type_label,
           null::text, null::text,
           b.sensor_model_no, b.sensor_make,
           null::int as page_number, ''::text as snippet, 0::real as rank
    from base b, q_parsed
    where q_parsed.q_trim = ''
    limit p_limit
  ),
  with_q as (
    select bpd.consolidated_doc_id, bpd.document_title, bpd.section as type_label,
           null::text, null::text,
           bpd.sensor_model_no, bpd.sensor_make,
           null::int as page_number,
           public.match_snippet(bpd.chunk_text, q_parsed.q_trim) as snippet,
           bpd.rank
    from best_per_doc bpd, q_parsed
    limit p_limit
  )
  select * from no_q
  union all
  select * from with_q
  order by rank desc nulls last, document_title
  limit p_limit;
$$;

commit;

-- Verify shape
select 'submissions' as t, count(*) from public.document_submissions
union all select 'consolidated_docs', count(*) from public.consolidated_docs
union all select 'consolidated_doc_chunks', count(*) from public.consolidated_doc_chunks
union all select 'notifications', count(*) from public.notifications;
