-- =============================================================
-- DP Internal Document Hub — initial schema
-- Run this in the Supabase SQL editor (https://supabase.com/dashboard
-- → your project → SQL editor → New query → paste & RUN).
-- =============================================================

-- ---------- Extensions ----------
create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";
-- pgvector is optional today; uncomment when you turn on AI search.
-- create extension if not exists "vector";

-- ---------- Profiles (links auth.users → role) ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  role text not null default 'viewer' check (role in ('viewer','uploader','admin')),
  created_at timestamptz default now()
);

-- Auto-create a profile when someone signs up (default viewer).
create or replace function public.handle_new_user() returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ---------- Catalog ----------
create table if not exists public.sensor_categories (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  "group" text
);

create table if not exists public.sensor_makes (
  id uuid primary key default gen_random_uuid(),
  name text unique not null
);

create table if not exists public.sensor_models (
  id uuid primary key default gen_random_uuid(),
  make_id uuid references public.sensor_makes(id) on delete set null,
  category_id uuid references public.sensor_categories(id) on delete set null,
  model_no text,
  name text,
  specs text,
  technical_details text,
  suitability text,
  vendor_url text,
  datasheet_url text,
  list_price numeric,
  created_at timestamptz default now()
);
create index if not exists sensor_models_model_no_trgm on public.sensor_models using gin (model_no gin_trgm_ops);
create index if not exists sensor_models_name_trgm on public.sensor_models using gin (name gin_trgm_ops);

create table if not exists public.plcs (
  id uuid primary key default gen_random_uuid(),
  make text,
  model_no text,
  name text,
  specs text,
  technical_details text,
  suitability text,
  vendor_url text,
  list_price numeric,
  created_at timestamptz default now()
);

-- ---------- Plants ----------
create table if not exists public.plants (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  location text,
  notes text,
  created_at timestamptz default now()
);

create table if not exists public.plant_sensors (
  id uuid primary key default gen_random_uuid(),
  plant_id uuid not null references public.plants(id) on delete cascade,
  sensor_model_id uuid not null references public.sensor_models(id) on delete cascade,
  tag_no text,
  location_on_plant text
);
create index if not exists plant_sensors_plant_idx on public.plant_sensors(plant_id);
create index if not exists plant_sensors_model_idx on public.plant_sensors(sensor_model_id);

create table if not exists public.plant_plcs (
  id uuid primary key default gen_random_uuid(),
  plant_id uuid not null references public.plants(id) on delete cascade,
  plc_id uuid not null references public.plcs(id) on delete cascade,
  tag_no text
);

-- ---------- Document taxonomy ----------
create table if not exists public.document_types (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  label text not null,
  sort_order int not null default 100
);

-- ---------- Documents ----------
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  type_id uuid references public.document_types(id) on delete set null,
  plant_id uuid references public.plants(id) on delete set null,
  sensor_model_id uuid references public.sensor_models(id) on delete set null,
  plc_id uuid references public.plcs(id) on delete set null,
  storage_path text,        -- key inside the `documents` storage bucket
  vendor_url text,          -- if the doc lives at a vendor URL (no file)
  uploaded_by uuid references auth.users(id) on delete set null,
  uploaded_at timestamptz default now(),
  page_count int,
  size_bytes bigint
);
create index if not exists documents_plant_idx on public.documents(plant_id);
create index if not exists documents_sensor_idx on public.documents(sensor_model_id);
create index if not exists documents_plc_idx on public.documents(plc_id);
create index if not exists documents_type_idx on public.documents(type_id);
create index if not exists documents_title_trgm on public.documents using gin (title gin_trgm_ops);

-- Auto-stamp uploader.
create or replace function public.set_uploaded_by() returns trigger language plpgsql as $$
begin new.uploaded_by := coalesce(new.uploaded_by, auth.uid()); return new; end $$;
drop trigger if exists trg_set_uploaded_by on public.documents;
create trigger trg_set_uploaded_by before insert on public.documents
for each row execute function public.set_uploaded_by();

-- ---------- Document chunks (full-text + future embeddings) ----------
create table if not exists public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  page_number int,
  chunk_text text not null,
  tsv tsvector generated always as (to_tsvector('english', coalesce(chunk_text, ''))) stored
  -- AI swap-in: uncomment when you enable AI search.
  -- , embedding vector(1536)
);
create index if not exists document_chunks_doc_idx on public.document_chunks(document_id);
create index if not exists document_chunks_tsv_idx on public.document_chunks using gin (tsv);
-- create index if not exists document_chunks_embedding_idx on public.document_chunks using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- ============================================================
-- Search RPC: ranked keyword search across PDF chunks + filters.
-- Returns one row per matching chunk. The frontend can collapse by document if desired.
-- ============================================================
create or replace function public.search_documents(
  q text,
  p_plant_id uuid default null,
  p_sensor_model_id uuid default null,
  p_plc_id uuid default null,
  p_type_key text default null,
  p_category_id uuid default null,
  p_make_id uuid default null,
  p_limit int default 50
)
returns table (
  document_id uuid,
  document_title text,
  type_label text,
  plant_name text,
  sensor_model_no text,
  sensor_make text,
  page_number int,
  snippet text,
  rank real
)
language sql
stable
as $$
  with base as (
    select d.id as document_id,
           d.title as document_title,
           dt.label as type_label,
           pl.name as plant_name,
           sm.model_no as sensor_model_no,
           mk.name as sensor_make,
           sm.category_id,
           sm.make_id
    from public.documents d
    left join public.document_types dt on dt.id = d.type_id
    left join public.plants pl on pl.id = d.plant_id
    left join public.sensor_models sm on sm.id = d.sensor_model_id
    left join public.sensor_makes mk on mk.id = sm.make_id
    where (p_plant_id is null or d.plant_id = p_plant_id)
      and (p_sensor_model_id is null or d.sensor_model_id = p_sensor_model_id)
      and (p_plc_id is null or d.plc_id = p_plc_id)
      and (p_type_key is null or dt.key = p_type_key)
      and (p_category_id is null or sm.category_id = p_category_id)
      and (p_make_id is null or sm.make_id = p_make_id)
  ),
  -- if q is empty, list documents (one row per doc, no snippet)
  no_q as (
    select b.document_id, b.document_title, b.type_label, b.plant_name,
           b.sensor_model_no, b.sensor_make,
           null::int as page_number, ''::text as snippet, 0::real as rank
    from base b
    where coalesce(trim(q), '') = ''
    limit p_limit
  ),
  -- otherwise rank chunks
  with_q as (
    select b.document_id, b.document_title, b.type_label, b.plant_name,
           b.sensor_model_no, b.sensor_make,
           c.page_number,
           ts_headline('english', c.chunk_text, websearch_to_tsquery('english', q),
                       'MaxFragments=1,MinWords=10,MaxWords=30,ShortWord=2') as snippet,
           ts_rank(c.tsv, websearch_to_tsquery('english', q)) as rank
    from base b
    join public.document_chunks c on c.document_id = b.document_id
    where coalesce(trim(q), '') <> ''
      and c.tsv @@ websearch_to_tsquery('english', q)
    order by rank desc
    limit p_limit
  ),
  -- also match doc titles / plant names / sensor model when text is small
  with_q_titles as (
    select b.document_id, b.document_title, b.type_label, b.plant_name,
           b.sensor_model_no, b.sensor_make,
           null::int as page_number,
           ''::text as snippet,
           0.05::real as rank
    from base b
    where coalesce(trim(q), '') <> ''
      and (
        b.document_title ilike '%' || q || '%'
        or coalesce(b.plant_name, '') ilike '%' || q || '%'
        or coalesce(b.sensor_model_no, '') ilike '%' || q || '%'
        or coalesce(b.sensor_make, '') ilike '%' || q || '%'
      )
      and not exists (
        select 1 from public.document_chunks c
        where c.document_id = b.document_id
          and c.tsv @@ websearch_to_tsquery('english', q)
      )
    limit p_limit
  )
  select * from no_q
  union all
  select * from with_q
  union all
  select * from with_q_titles
  order by rank desc nulls last
  limit p_limit;
$$;

-- ============================================================
-- Storage bucket for document files
-- ============================================================
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

-- ============================================================
-- Row-Level Security
-- Read: any authenticated user. Write: uploader/admin role on profiles.
-- ============================================================
alter table public.profiles enable row level security;
alter table public.sensor_categories enable row level security;
alter table public.sensor_makes enable row level security;
alter table public.sensor_models enable row level security;
alter table public.plcs enable row level security;
alter table public.plants enable row level security;
alter table public.plant_sensors enable row level security;
alter table public.plant_plcs enable row level security;
alter table public.document_types enable row level security;
alter table public.documents enable row level security;
alter table public.document_chunks enable row level security;

-- helper: current user's role
create or replace function public.current_role() returns text language sql stable as $$
  select role from public.profiles where id = auth.uid()
$$;

-- profiles: each user reads all (so Admin page works) but updates only by admin.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated using (true);
drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin on public.profiles for update to authenticated
  using (public.current_role() = 'admin') with check (public.current_role() = 'admin');

-- read-only catalog/plants/types: any authenticated user can SELECT
do $$ declare t text;
begin
  foreach t in array array[
    'sensor_categories','sensor_makes','sensor_models','plcs',
    'plants','plant_sensors','plant_plcs','document_types',
    'documents','document_chunks'
  ] loop
    execute format('drop policy if exists %I_select on public.%I', t, t);
    execute format('create policy %I_select on public.%I for select to authenticated using (true)', t, t);
  end loop;
end $$;

-- write policies: uploader or admin can insert/update/delete
do $$ declare t text;
begin
  foreach t in array array[
    'sensor_categories','sensor_makes','sensor_models','plcs',
    'plants','plant_sensors','plant_plcs','document_types',
    'documents','document_chunks'
  ] loop
    execute format('drop policy if exists %I_write on public.%I', t, t);
    execute format($p$create policy %I_write on public.%I for all to authenticated
                     using (public.current_role() in ('uploader','admin'))
                     with check (public.current_role() in ('uploader','admin'))$p$, t, t);
  end loop;
end $$;

-- storage policies: read for authed, write for uploader/admin
drop policy if exists "documents-read" on storage.objects;
create policy "documents-read" on storage.objects for select to authenticated
  using (bucket_id = 'documents');

drop policy if exists "documents-write" on storage.objects;
create policy "documents-write" on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and public.current_role() in ('uploader','admin'));

drop policy if exists "documents-update" on storage.objects;
create policy "documents-update" on storage.objects for update to authenticated
  using (bucket_id = 'documents' and public.current_role() in ('uploader','admin'));

drop policy if exists "documents-delete" on storage.objects;
create policy "documents-delete" on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and public.current_role() = 'admin');

-- ============================================================
-- Seed: document types + first admin
-- ============================================================
insert into public.document_types (key, label, sort_order) values
  ('sensor_manual', 'Sensor Manual', 10),
  ('installation_guide', 'Installation Guide', 20),
  ('troubleshooting', 'Troubleshooting Steps', 30),
  ('datasheet', 'Technical Data Sheet', 40),
  ('test_certificate', 'Test Certificate', 50),
  ('handover', 'Handover Document', 60),
  ('calibration_certificate', 'Calibration Certificate', 70),
  ('io_list', 'I/O List', 80),
  ('p_and_id', 'P&ID', 90),
  ('warranty_certificate', 'Warranty Certificate', 100),
  ('onboarding', 'Onboarding Document', 110),
  ('design_data_sheet', 'Design Data Sheet', 120)
on conflict (key) do nothing;

-- Grant the founder admin role once they sign in.
-- (The profile row is created by the trigger on first sign-in.)
update public.profiles set role = 'admin' where email = 'mihir.sethi@digitalpaani.com';
-- If the user hasn't signed in yet, we'll handle promotion in a "fix-me-up" line you can run after first login:
--   update public.profiles set role = 'admin' where email = 'mihir.sethi@digitalpaani.com';
