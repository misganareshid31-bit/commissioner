-- Commissioner — Create gift page fix — 2026-10-13
--
-- Root cause of "This feature is temporarily unavailable. The required server
-- configuration is missing or needs attention.":
--   admin_create_claim / admin_create_business_claim called gen_random_bytes()
--   while pinned to `set search_path = public`. On Supabase, pgcrypto lives in
--   the `extensions` schema, so the call failed with
--   "function gen_random_bytes(integer) does not exist".
--
-- This migration:
--   1. Generates claim tokens with gen_random_uuid() (built into Postgres 13+,
--      no extension or schema dependency).
--   2. Enforces "gift pages start unverified": new pages are ALWAYS created
--      with verified = false and approved = false. Verification happens only
--      through the admin review queue. p_verified is kept in the signature so
--      existing callers keep working, but it is ignored.
--
-- Safe to run more than once.

create or replace function public.admin_create_claim(p_page_name text, p_primary_niche text, p_verified boolean default false)
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
  new_token := replace(gen_random_uuid()::text, '-', '');
  insert into public.creator_profiles (page_name, primary_niche, claim_token, verified)
  values (p_page_name, p_primary_niche, new_token, false);
  return new_token;
end;
$$;
revoke all on function public.admin_create_claim(text, text, boolean) from public;
grant execute on function public.admin_create_claim(text, text, boolean) to authenticated;

create or replace function public.admin_create_business_claim(p_business_name text, p_industry text, p_verified boolean default false)
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
  new_token := replace(gen_random_uuid()::text, '-', '');
  insert into public.business_profiles (business_name, industry, claim_token, verified)
  values (p_business_name, p_industry, new_token, false);
  return new_token;
end;
$$;
revoke all on function public.admin_create_business_claim(text, text, boolean) from public;
grant execute on function public.admin_create_business_claim(text, text, boolean) to authenticated;

notify pgrst, 'reload schema';
