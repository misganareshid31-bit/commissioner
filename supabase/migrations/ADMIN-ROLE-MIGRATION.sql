-- ============================================================================
-- ADMIN ROLE MIGRATION
-- Run this in the Supabase SQL editor after your other migrations.
-- Safe to run repeatedly — and safe even if some optional migrations
-- (TRUST-SAFETY-MIGRATION.sql, COMMISSIONER-TRUST-MARKETPLACE-B2B.sql)
-- haven't been applied to this project yet: any policy on a table that
-- doesn't exist is skipped automatically instead of erroring. Re-run this
-- file again later if you add those migrations afterward, so their
-- tables get the admin policy too.
--
-- WHAT THIS FIXES
-- Every admin check in this project was previously done by comparing the
-- logged-in user's email against a hardcoded personal address
-- ('misganareshid27@gmail.com') — both in the SQL policies/functions below
-- AND in the client (src/components/Site.jsx). That means:
--   - admin status could never be granted/revoked without editing code
--   - a real personal email address was committed to source control
--   - the client-side copy of that check was cosmetic only (real
--     enforcement was always server-side, in RLS/functions — but it's
--     still bad practice to duplicate identity logic in two places)
--
-- This migration replaces all of that with a real `admin_users` table.
-- To add or remove an admin going forward, run:
--   insert into public.admin_users (user_id)
--   select id from auth.users where email = 'someone@example.com';
--   -- or: delete from public.admin_users where user_id = '<uuid>';
-- No code changes needed for that going forward.
-- ============================================================================

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admin_users enable row level security;

-- Nobody can read/write this table directly from the client — only
-- is_admin() (below, security definer) can see it.
drop policy if exists "No direct client access to admin_users" on public.admin_users;
create policy "No direct client access to admin_users" on public.admin_users for all using (false);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admin_users where user_id = auth.uid());
$$;
grant execute on function public.is_admin() to authenticated;

-- Seed the two identities that previously had hardcoded access, so nobody
-- loses admin access when this migration runs. Remove/replace as needed.
insert into public.admin_users (user_id)
select id from auth.users
where lower(email) in ('misganareshid27@gmail.com', 'admin@commissioner.app')
on conflict do nothing;

-- ----------------------------------------------------------------------------
-- Functions (from supabase-schema.sql / NFC-ADMIN-FIX.sql) — recreated with
-- the same behavior, only the authorization check has changed.
-- ----------------------------------------------------------------------------

create or replace function public.protect_admin_fields()
returns trigger as $$
begin
  if auth.role() <> 'service_role' and not public.is_admin() then
    new.approved = old.approved;
    new.verified = old.verified;
  end if;
  return new;
end;
$$ language plpgsql security definer;

create or replace function public.admin_check_setup()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  required_count integer;
  installed_count integer;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  required_count := 5;
  select count(*) into installed_count
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in (
      'admin_check_setup',
      'admin_create_claim',
      'admin_create_business_claim',
      'admin_delete_page',
      'get_claim_any'
    );

  return jsonb_build_object('ready', installed_count >= required_count, 'installed', installed_count, 'required', required_count);
end;
$$;
grant execute on function public.admin_check_setup() to authenticated;

create or replace function public.admin_create_claim(p_page_name text, p_primary_niche text, p_verified boolean default true)
returns text as $$
declare
  new_token text;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  new_token := encode(gen_random_bytes(16), 'hex');
  insert into creator_profiles (page_name, primary_niche, claim_token, verified)
  values (p_page_name, p_primary_niche, new_token, p_verified);
  return new_token;
end;
$$ language plpgsql security definer;

create or replace function public.admin_create_business_claim(p_business_name text, p_industry text, p_verified boolean default true)
returns text as $$
declare
  new_token text;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  new_token := encode(gen_random_bytes(16), 'hex');
  insert into business_profiles (business_name, industry, claim_token, verified)
  values (p_business_name, p_industry, new_token, p_verified);
  return new_token;
end;
$$ language plpgsql security definer;

create or replace function public.admin_delete_page(p_kind text, p_page_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_id uuid;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  if p_page_id is null then
    raise exception 'page id is required';
  end if;

  if lower(p_kind) = 'creator' then
    delete from public.creator_profiles where id = p_page_id returning id into deleted_id;
  elsif lower(p_kind) = 'business' then
    delete from public.business_profiles where id = p_page_id returning id into deleted_id;
  else
    raise exception 'invalid page kind';
  end if;

  return jsonb_build_object(
    'deleted', deleted_id is not null,
    'kind', lower(p_kind),
    'id', p_page_id
  );
end;
$$;
grant execute on function public.admin_delete_page(text, uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- Policies — recreated with the same table/action, only the check changed.
-- Each block is wrapped in a table-existence check, because not every
-- optional migration (TRUST-SAFETY-MIGRATION.sql,
-- COMMISSIONER-TRUST-MARKETPLACE-B2B.sql) may have been run on every
-- project. Tables that don't exist yet are silently skipped instead of
-- erroring — run this again later if you add those migrations afterward.
-- ----------------------------------------------------------------------------

do $$
begin
  if to_regclass('public.creator_profiles') is not null then
    execute 'drop policy if exists "Admin can view all profiles" on public.creator_profiles';
    execute 'create policy "Admin can view all profiles" on public.creator_profiles for select using (public.is_admin())';

    execute 'drop policy if exists "Admin can update all profiles" on public.creator_profiles';
    execute 'create policy "Admin can update all profiles" on public.creator_profiles for update using (public.is_admin())';

    execute 'drop policy if exists "Admin can update all creator profiles" on public.creator_profiles';
    execute 'create policy "Admin can update all creator profiles" on public.creator_profiles for update using (public.is_admin()) with check (public.is_admin())';
  end if;

  if to_regclass('public.business_profiles') is not null then
    execute 'drop policy if exists "Admin can view all business profiles" on public.business_profiles';
    execute 'create policy "Admin can view all business profiles" on public.business_profiles for select using (public.is_admin())';

    execute 'drop policy if exists "Admin can update all business profiles" on public.business_profiles';
    execute 'create policy "Admin can update all business profiles" on public.business_profiles for update using (public.is_admin()) with check (public.is_admin())';
  end if;

  if to_regclass('public.creator_verification_claims') is not null then
    execute 'drop policy if exists "Admin manages creator verification claims" on public.creator_verification_claims';
    execute 'create policy "Admin manages creator verification claims" on public.creator_verification_claims for all using (public.is_admin())';
  end if;

  if to_regclass('public.business_verification_claims') is not null then
    execute 'drop policy if exists "Admin manages business verification claims" on public.business_verification_claims';
    execute 'create policy "Admin manages business verification claims" on public.business_verification_claims for all using (public.is_admin())';
  end if;

  if to_regclass('public.profile_reports') is not null then
    execute 'drop policy if exists "Admins view reports" on public.profile_reports';
    execute 'create policy "Admins view reports" on public.profile_reports for select using (public.is_admin())';

    execute 'drop policy if exists "Admins update reports" on public.profile_reports';
    execute 'create policy "Admins update reports" on public.profile_reports for update using (public.is_admin())';
  end if;

  if to_regclass('public.user_reports') is not null then
    execute 'drop policy if exists "Admin can view all reports" on public.user_reports';
    execute 'create policy "Admin can view all reports" on public.user_reports for select using (public.is_admin())';

    execute 'drop policy if exists "Admin can update reports" on public.user_reports';
    execute 'create policy "Admin can update reports" on public.user_reports for update using (public.is_admin())';
  end if;

  if to_regclass('public.account_deletion_requests') is not null then
    execute 'drop policy if exists "Admin can view all deletion requests" on public.account_deletion_requests';
    execute 'create policy "Admin can view all deletion requests" on public.account_deletion_requests for select using (public.is_admin())';
  end if;
end $$;
