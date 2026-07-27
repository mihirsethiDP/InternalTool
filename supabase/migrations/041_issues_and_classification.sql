-- =============================================================
-- Migration 041: issue taxonomy + flow queue + classification matrix
--
-- Supervisor direction (2026-07-27 voice notes):
--  1. ISSUES are the vocabulary of what users actually say ("reading
--     fluctuating", "value stuck"). Curated by admins, seeded by AI and
--     CustomerHub knowledge. One issue maps to SEVERAL diagnostic flows,
--     tried in order — completing one flow without resolution offers the
--     next ("flow queue").
--  2. CLASSIFICATION matrix on every flow (visit needed? / skill needed?)
--     with AI-proposed per-step tags stored inside the definition jsonb.
--     Flow-level values are confirmed by a human at approval.
--  3. Users get a technical level so step depth can adapt (P3).
-- =============================================================
begin;

-- ---------- 1. issues ----------
create table if not exists public.issues (
  id uuid primary key default gen_random_uuid(),
  sensor_category_id uuid references public.sensor_categories(id) on delete cascade,
  label text not null,                          -- "Reading fluctuating"
  aliases text[] not null default '{}',         -- "value jumping", "unstable", …
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (sensor_category_id, label)
);

create index if not exists issues_category_idx on public.issues (sensor_category_id);

alter table public.issues enable row level security;
drop policy if exists issues_select on public.issues;
create policy issues_select on public.issues for select to authenticated using (true);
drop policy if exists issues_write on public.issues;
create policy issues_write on public.issues for all to authenticated
  using (public.current_role() = 'admin') with check (public.current_role() = 'admin');

-- ---------- 2. issue → flow mapping (ordered) ----------
create table if not exists public.issue_flows (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references public.issues(id) on delete cascade,
  flow_id uuid not null references public.diagnostic_flows(id) on delete cascade,
  rank int not null default 1,                  -- try order: 1 first
  unique (issue_id, flow_id)
);

create index if not exists issue_flows_issue_idx on public.issue_flows (issue_id, rank);
create index if not exists issue_flows_flow_idx on public.issue_flows (flow_id);

alter table public.issue_flows enable row level security;
drop policy if exists issue_flows_select on public.issue_flows;
create policy issue_flows_select on public.issue_flows for select to authenticated using (true);
drop policy if exists issue_flows_write on public.issue_flows;
create policy issue_flows_write on public.issue_flows for all to authenticated
  using (public.current_role() = 'admin') with check (public.current_role() = 'admin');

-- ---------- 3. flow classification (the 2×2, flow level) ----------
-- Per-step tags live inside definition jsonb nodes as {visit, skill};
-- these flow-level values are the human-confirmed rollup. NULL = not yet
-- confirmed; the app blocks approval until both are set.
alter table public.diagnostic_flows
  add column if not exists visit_required boolean,
  add column if not exists skill_required text
    check (skill_required in ('anyone', 'specialist'));

-- ---------- 4. user capability ----------
alter table public.profiles
  add column if not exists technical_level text not null default 'non_technical'
    check (technical_level in ('non_technical', 'technical'));

commit;
