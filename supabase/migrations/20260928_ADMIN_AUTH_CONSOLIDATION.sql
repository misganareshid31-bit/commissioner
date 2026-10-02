-- Commissioner — admin auth consolidation — 2026-09-28
--
-- WHY THIS EXISTS
-- Several migrations over time (TRUST-SAFETY-MIGRATION.sql, supabase-schema.sql,
-- COMMISSIONER-TRUST-MARKETPLACE-B2B.sql, PLAN-SYSTEM-MIGRATION.sql,
-- NFC-ADMIN-FIX.sql) gated admin-only policies/functions with a hardcoded
-- email string instead of the public.is_admin() / public.admin_users
-- mechanism that COMMISSIONER-MASTER-MIGRATION.sql introduced. Depending on
-- which files were actually run against this database and in what order,
-- some of these objects may currently still be checking the hardcoded email
-- rather than admin_users.
--
-- This migration re-asserts every affected policy and function so that,
-- regardless of history, they all consistently check public.is_admin()
-- afterward. It is idempotent — safe to run more than once.
--
-- RUN THIS LAST, after all your existing migrations, in the Supabase SQL
-- Editor. It requires public.admin_users / public.is_admin() to already
-- exist (added by ADMIN-ROLE-MIGRATION.sql) and at least one row in
-- admin_users for your admin account — see DEPLOYMENT.md "Assign an admin".
--
-- The corresponding source .sql files in this project have also been
-- patched to use public.is_admin() going forward, so re-running an older
-- file will no longer reintroduce the hardcoded email.

-- Safety check: fail loudly instead of silently doing nothing if the
-- admin_users table doesn't exist yet, so this can't be run out of order
-- by accident.
do $$
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'admin_users'
  ) then
    raise exception 'public.admin_users does not exist yet — run ADMIN-ROLE-MIGRATION.sql first';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. creator_profiles / business_profiles admin policies
-- ---------------------------------------------------------------------

drop policy if exists "Admin can view all profiles" on public.creator_profiles;
create policy "Admin can view all profiles"
  on public.creator_profiles for select
  using (public.is_admin());

drop policy if exists "Admin can update all profiles" on public.creator_profiles;
create policy "Admin can update all profiles"
  on public.creator_profiles for update
  using (public.is_admin());

drop policy if exists "Admin can update all creator profiles" on public.creator_profiles;
create policy "Admin can update all creator profiles"
  on public.creator_profiles for update
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admin can view all business profiles" on public.business_profiles;
create policy "Admin can view all business profiles"
  on public.business_profiles for select
  using (public.is_admin());

drop policy if exists "Admin can update all business profiles" on public.business_profiles;
create policy "Admin can update all business profiles"
  on public.business_profiles for update
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------
-- 2. protect_admin_fields trigger function
--    (most complete version: freezes approved/verified/plan/plan_expires_at)
-- ---------------------------------------------------------------------

create or replace function public.protect_admin_fields()
returns trigger as $$
begin
  if auth.role() <> 'service_role' and not public.is_admin() then
    new.approved = old.approved;
    new.verified = old.verified;
    new.plan = old.plan;
    new.plan_expires_at = old.plan_expires_at;
  end if;
  return new;
end;
$$ language plpgsql security definer;

-- ---------------------------------------------------------------------
-- 3. Verification / report tables (Trust & Safety, marketplace claims)
-- ---------------------------------------------------------------------

drop policy if exists "Admin manages creator verification claims" on public.creator_verification_claims;
create policy "Admin manages creator verification claims" on public.creator_verification_claims
  for all using (public.is_admin());

drop policy if exists "Admin manages business verification claims" on public.business_verification_claims;
create policy "Admin manages business verification claims" on public.business_verification_claims
  for all using (public.is_admin());

drop policy if exists "Admins view reports" on public.profile_reports;
create policy "Admins view reports" on public.profile_reports
  for select using (public.is_admin());

drop policy if exists "Admins update reports" on public.profile_reports;
create policy "Admins update reports" on public.profile_reports
  for update using (public.is_admin());

drop policy if exists "Admin can view all reports" on public.user_reports;
create policy "Admin can view all reports"
  on public.user_reports for select
  using (public.is_admin());

drop policy if exists "Admin can update reports" on public.user_reports;
create policy "Admin can update reports"
  on public.user_reports for update
  using (public.is_admin());

drop policy if exists "Admin can view all deletion requests" on public.account_deletion_requests;
create policy "Admin can view all deletion requests"
  on public.account_deletion_requests for select
  using (public.is_admin());

-- ---------------------------------------------------------------------
-- 4. Admin utility RPCs (NFC / claim management — most complete versions)
-- ---------------------------------------------------------------------

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

create or replace function public.admin_create_claim(p_page_name text, p_primary_niche text, p_verified boolean default true)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  new_token text;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  new_token := encode(gen_random_bytes(16), 'hex');
  insert into public.creator_profiles (page_name, primary_niche, claim_token, verified)
  values (p_page_name, p_primary_niche, new_token, p_verified);
  return new_token;
end;
$$;
grant execute on function public.admin_create_claim(text, text, boolean) to authenticated;

create or replace function public.admin_create_business_claim(p_business_name text, p_industry text, p_verified boolean default true)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  new_token text;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  new_token := encode(gen_random_bytes(16), 'hex');
  insert into public.business_profiles (business_name, industry, claim_token, verified)
  values (p_business_name, p_industry, new_token, p_verified);
  return new_token;
end;
$$;
grant execute on function public.admin_create_business_claim(text, text, boolean) to authenticated;

-- ---------------------------------------------------------------------
-- 5. Make sure your admin account is actually in admin_users.
--    Edit the email below to your real admin account, then run just this
--    block (safe to leave in — on conflict it's a no-op on repeat runs).
-- ---------------------------------------------------------------------

insert into public.admin_users (user_id)
select id from auth.users
where lower(email) in ('misganareshid27@gmail.com', 'admin@commissioner.app')
on conflict (user_id) do nothing;

-- ---------------------------------------------------------------------
-- Verify after running (while signed in as your admin account):
--   select public.is_admin();   -- should return true
-- ---------------------------------------------------------------------
