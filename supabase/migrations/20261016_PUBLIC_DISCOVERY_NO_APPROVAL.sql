-- Commissioner: allow completed Creator and Business profiles to be discovered
-- without requiring admin approval or verification.
-- This version deliberately does NOT replace the existing ranked views.
-- The existing views use cp.* / bp.* and can break when table columns change.
-- Apply in Supabase SQL Editor after backing up the database.

begin;

-- Remove known legacy policies with overlapping purposes so this migration
-- can be safely re-run. Other policies are left untouched.
drop policy if exists "Public can view approved creator profiles" on public.creator_profiles;
drop policy if exists "Public can view published creator profiles" on public.creator_profiles;
drop policy if exists "Public can view registered creator profiles" on public.creator_profiles;
drop policy if exists "Public can view completed creator profiles" on public.creator_profiles;
drop policy if exists "Public can view approved business profiles" on public.business_profiles;
drop policy if exists "Public can view registered business profiles" on public.business_profiles;
drop policy if exists "Public can view completed business profiles" on public.business_profiles;

-- A profile is publicly discoverable when it belongs to an authenticated
-- account and onboarding is complete. Verification/approval is not required.
create policy "Public can view completed creator profiles"
  on public.creator_profiles
  for select
  to anon, authenticated
  using (
    auth_user_id is not null
    and coalesce(onboarded, false) = true
  );

create policy "Public can view completed business profiles"
  on public.business_profiles
  for select
  to anon, authenticated
  using (
    auth_user_id is not null
    and coalesce(onboarded, false) = true
  );

notify pgrst, 'reload schema';
commit;
