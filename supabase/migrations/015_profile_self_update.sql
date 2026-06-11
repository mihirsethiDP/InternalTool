-- =============================================================
-- Migration 015: users can edit their own profile (display name)
--
-- Adds an RLS UPDATE policy so a user can update their own profiles
-- row, plus a trigger that prevents non-admins from changing their
-- own `role` (so users can't self-promote to admin).
-- The existing admin update policy stays — admins can still change
-- anyone's role from Admin → Users.
-- =============================================================
begin;

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create or replace function public.protect_profile_role()
returns trigger language plpgsql as $$
begin
  if new.role is distinct from old.role and public.current_role() <> 'admin' then
    raise exception 'Only admins can change a profile role.';
  end if;
  return new;
end $$;

drop trigger if exists trg_protect_profile_role on public.profiles;
create trigger trg_protect_profile_role
  before update on public.profiles
  for each row execute function public.protect_profile_role();

commit;
