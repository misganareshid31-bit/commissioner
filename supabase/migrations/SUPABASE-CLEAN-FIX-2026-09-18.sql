-- Commissioner: CLEAN SUPABASE ADMIN/AUTH FIX
-- 2026-09-18
-- Run this ONE file in Supabase SQL Editor AFTER supabase-schema.sql.
-- It is idempotent and fixes the admin RPC setup used by the current app.
--
-- IMPORTANT:
-- 1) This does not contain an admin email or secret.
-- 2) Add the intended admin by UUID at the bottom.
-- 3) Email/password authentication itself is configured in Supabase
--    Authentication; this SQL secures the app-side profile/admin layer.

create extension if not exists pgcrypto;

do $$
begin
  if to_regclass('public.creator_profiles') is null
     or to_regclass('public.business_profiles') is null then
    raise exception 'Commissioner base schema is missing. Run supabase-schema.sql first, then run this file.';
  end if;
end $$;

-- One real server-side admin role.
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admin_users enable row level security;

drop policy if exists "No direct client access to admin_users" on public.admin_users;
create policy "No direct client access to admin_users"
on public.admin_users for all to authenticated
using (false) with check (false);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_users where user_id = auth.uid()
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- Protect privileged profile fields from client-side changes.
create or replace function public.protect_admin_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' and not public.is_admin() then
    new.approved := old.approved;
    new.verified := old.verified;
    if to_jsonb(old) ? 'plan' then new.plan := old.plan; end if;
    if to_jsonb(old) ? 'plan_expires_at' then new.plan_expires_at := old.plan_expires_at; end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_admin_fields_trigger on public.creator_profiles;
create trigger protect_admin_fields_trigger
before update on public.creator_profiles
for each row execute procedure public.protect_admin_fields();

drop trigger if exists protect_admin_fields_trigger on public.business_profiles;
create trigger protect_admin_fields_trigger
before update on public.business_profiles
for each row execute procedure public.protect_admin_fields();

-- Admin: create a creator claim.
-- p_verified is intentionally respected (older versions silently ignored it).
create or replace function public.admin_create_claim(
  p_page_name text,
  p_primary_niche text,
  p_verified boolean default false
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  new_token text;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  new_token := encode(gen_random_bytes(16), 'hex');

  insert into public.creator_profiles
    (page_name, primary_niche, claim_token, verified, approved, onboarded, claimed)
  values
    (nullif(trim(p_page_name), ''),
     nullif(trim(p_primary_niche), ''),
     new_token,
     coalesce(p_verified, false),
     false, false, false);

  return new_token;
end;
$$;

-- Admin: create a business claim.
create or replace function public.admin_create_business_claim(
  p_business_name text,
  p_industry text,
  p_verified boolean default false
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  new_token text;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  new_token := encode(gen_random_bytes(16), 'hex');

  insert into public.business_profiles
    (business_name, industry, claim_token, verified, approved, onboarded, claimed)
  values
    (nullif(trim(p_business_name), ''),
     nullif(trim(p_industry), ''),
     new_token,
     coalesce(p_verified, false),
     false, false, false);

  return new_token;
end;
$$;

-- Admin: delete only the selected creator/business profile.
create or replace function public.admin_delete_page(
  p_kind text,
  p_page_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_id uuid;
  kind text := lower(trim(coalesce(p_kind, '')));
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  if p_page_id is null then raise exception 'page id is required'; end if;

  if kind = 'creator' then
    delete from public.creator_profiles
    where id = p_page_id
    returning id into deleted_id;
  elsif kind = 'business' then
    delete from public.business_profiles
    where id = p_page_id
    returning id into deleted_id;
  else
    raise exception 'invalid page kind: use creator or business';
  end if;

  return jsonb_build_object(
    'deleted', deleted_id is not null,
    'kind', kind,
    'id', p_page_id
  );
end;
$$;

revoke all on function public.admin_create_claim(text,text,boolean) from public;
revoke all on function public.admin_create_business_claim(text,text,boolean) from public;
revoke all on function public.admin_delete_page(text,uuid) from public;

grant execute on function public.admin_create_claim(text,text,boolean) to authenticated;
grant execute on function public.admin_create_business_claim(text,text,boolean) to authenticated;
grant execute on function public.admin_delete_page(text,uuid) to authenticated;

-- Setup check uses exact signatures, not a loose function-name count.
create or replace function public.admin_check_setup()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  missing text[] := array[]::text[];
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;

  if to_regprocedure('public.admin_check_setup()') is null then
    missing := array_append(missing, 'admin_check_setup');
  end if;
  if to_regprocedure('public.admin_create_claim(text,text,boolean)') is null then
    missing := array_append(missing, 'admin_create_claim');
  end if;
  if to_regprocedure('public.admin_create_business_claim(text,text,boolean)') is null then
    missing := array_append(missing, 'admin_create_business_claim');
  end if;
  if to_regprocedure('public.admin_delete_page(text,uuid)') is null then
    missing := array_append(missing, 'admin_delete_page');
  end if;

  return jsonb_build_object(
    'ready', cardinality(missing) = 0,
    'missing', missing,
    'installed', 4 - cardinality(missing),
    'required', 4
  );
end;
$$;

grant execute on function public.admin_check_setup() to authenticated;

-- Optional: add your own admin account by UUID.
-- Find it in Supabase Dashboard → Authentication → Users.
-- Replace YOUR_AUTH_USER_UUID before running:
--
-- insert into public.admin_users(user_id)
-- values ('YOUR_AUTH_USER_UUID')
-- on conflict do nothing;
