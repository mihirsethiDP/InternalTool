-- =============================================================
-- Migration 044: round-3 feedback batch
--
-- 1. Viewers see APPROVED submissions. The reference page's "Documents"
--    sidebar reads document_submissions, but submissions_select only let
--    the uploader or an admin see rows — so every other signed-in user got
--    an empty list while the consolidated view worked. Approved submissions
--    are the sources of published references; they are not private.
-- 2. Superadmin: profiles.is_super. Admins keep all their powers (invites
--    included) but cannot modify or delete the superadmin's account.
--    Role stays 'admin' so every existing current_role()='admin' check
--    keeps working unchanged.
-- 3. Vendor-scoped escalation: vendor support varies by sensor make/model,
--    so escalation_contacts gains optional make/model scope. Resolution at
--    escalation time is model-specific → make-level → generic (null scope).
-- =============================================================
begin;

-- ---------- 1. viewer access to approved sources ----------
drop policy if exists submissions_select on public.document_submissions;
create policy submissions_select on public.document_submissions for select to authenticated
  using (
    (deleted_at is null or public.current_role() = 'admin')
    and (
      uploaded_by = auth.uid()
      or public.current_role() = 'admin'
      or status = 'approved'
    )
  );

-- ---------- 2. superadmin ----------
alter table public.profiles add column if not exists is_super boolean not null default false;
update public.profiles set is_super = true where email = 'mihir.sethi@digitalpaani.com';

create or replace function public.is_superadmin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_super from public.profiles where id = auth.uid()), false)
$$;

-- Admins can update any profile EXCEPT a superadmin's (only they edit their own).
drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin on public.profiles for update to authenticated
  using (public.current_role() = 'admin' and (not is_super or id = auth.uid()))
  with check (public.current_role() = 'admin');

-- Trigger belt on top of the policy: covers role changes, is_super flips and
-- deletes, and also guards paths that run with elevated rights. auth.uid() is
-- null for service-role maintenance scripts — those stay unrestricted.
create or replace function public.protect_profile_role()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    if old.is_super and auth.uid() is not null and auth.uid() <> old.id then
      raise exception 'This account is protected.';
    end if;
    return old;
  end if;
  if new.role is distinct from old.role and public.current_role() <> 'admin' then
    raise exception 'Only admins can change a profile role.';
  end if;
  if old.is_super and auth.uid() is not null and auth.uid() <> old.id then
    raise exception 'This account is protected.';
  end if;
  if new.is_super is distinct from old.is_super
     and auth.uid() is not null and not public.is_superadmin() then
    raise exception 'Only the superadmin can grant or remove superadmin.';
  end if;
  return new;
end $$;

drop trigger if exists trg_protect_profile_role on public.profiles;
create trigger trg_protect_profile_role
  before update on public.profiles
  for each row execute function public.protect_profile_role();

drop trigger if exists trg_protect_profile_delete on public.profiles;
create trigger trg_protect_profile_delete
  before delete on public.profiles
  for each row execute function public.protect_profile_role();

-- ---------- 3. vendor contacts scoped down to the model ----------
-- 035 already scoped contacts by make and plant (multiple rows per skill are
-- deliberate). Vendor support numbers can differ per MODEL of the same make,
-- so add the finer scope. Resolution: model → make → global → plant.
alter table public.escalation_contacts
  add column if not exists sensor_model_id uuid references public.sensor_models(id) on delete cascade;

commit;
