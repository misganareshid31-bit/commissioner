-- Commissioner V1: safely include gifted/unclaimed profiles in public discovery.
-- Apply this migration in Supabase SQL Editor AFTER the existing 20261015_PUBLIC_PROFILE_VISIBILITY_HARDENING.sql.
-- This adds limited-field discovery RPCs. It does not change existing views or broadly open table SELECT policies.

begin;

create or replace function public.list_public_creator_discovery(p_limit integer default 48)
returns table (
  id uuid,
  auth_user_id uuid,
  page_name text,
  username text,
  avatar_url text,
  city text,
  primary_niche text,
  platforms jsonb,
  services jsonb,
  verified boolean,
  plan text,
  onboarded boolean,
  created_at timestamptz,
  claimed boolean
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    cp.id,
    case when cp.auth_user_id is not null and coalesce(cp.onboarded, false) then cp.auth_user_id else null end,
    cp.page_name,
    cp.username,
    cp.avatar_url,
    cp.city,
    cp.primary_niche,
    coalesce(cp.platforms, '{}'::jsonb),
    coalesce(cp.services, '{}'::jsonb),
    case when cp.auth_user_id is not null and coalesce(cp.onboarded, false) then coalesce(cp.verified, false) else false end,
    coalesce(cp.plan, 'basic'),
    coalesce(cp.onboarded, false),
    cp.created_at,
    (cp.auth_user_id is not null and coalesce(cp.onboarded, false))
  from public.creator_profiles cp
  where
    (cp.auth_user_id is not null and coalesce(cp.onboarded, false) = true)
    or
    (coalesce(cp.claimed, false) = false and cp.auth_user_id is null
      and cp.claim_token is not null and nullif(trim(cp.page_name), '') is not null)
  order by
    case lower(coalesce(cp.plan, 'basic')) when 'premium' then 3 when 'elite' then 3 when 'pro' then 2 when 'basic' then 1 else 0 end desc,
    cp.created_at desc nulls last
  limit greatest(1, least(coalesce(p_limit, 48), 100));
$$;

create or replace function public.list_public_business_discovery(p_limit integer default 48)
returns table (
  id uuid,
  auth_user_id uuid,
  business_name text,
  username text,
  avatar_url text,
  city text,
  industry text,
  bio text,
  website text,
  verified boolean,
  onboarded boolean,
  plan text,
  created_at timestamptz,
  claimed boolean
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    bp.id,
    case when bp.auth_user_id is not null and coalesce(bp.onboarded, false) then bp.auth_user_id else null end,
    bp.business_name,
    bp.username,
    bp.avatar_url,
    bp.city,
    bp.industry,
    bp.bio,
    case when public._nfc_flag(bp.nfc_display_settings, 'website', true) then bp.website else null end,
    case when bp.auth_user_id is not null and coalesce(bp.onboarded, false) then coalesce(bp.verified, false) else false end,
    coalesce(bp.onboarded, false),
    coalesce(bp.plan, 'basic'),
    bp.created_at,
    (bp.auth_user_id is not null and coalesce(bp.onboarded, false))
  from public.business_profiles bp
  where
    (bp.auth_user_id is not null and coalesce(bp.onboarded, false) = true)
    or
    (coalesce(bp.claimed, false) = false and bp.auth_user_id is null
      and bp.claim_token is not null and nullif(trim(bp.business_name), '') is not null)
  order by
    case lower(coalesce(bp.plan, 'basic')) when 'premium' then 3 when 'elite' then 3 when 'pro' then 2 when 'basic' then 1 else 0 end desc,
    bp.created_at desc nulls last
  limit greatest(1, least(coalesce(p_limit, 48), 100));
$$;

-- Public profile RPCs also return a safe, limited preview for an unclaimed gifted profile.
-- Never return claim_token or private contact fields from these functions.
create or replace function public.get_public_creator_profile(p_profile_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  r public.creator_profiles;
  s jsonb;
  o jsonb;
  v_claimed boolean;
begin
  select * into r
  from public.creator_profiles cp
  where cp.id = p_profile_id
    and (
      (cp.auth_user_id is not null and coalesce(cp.onboarded, false) = true)
      or (coalesce(cp.claimed, false) = false and cp.auth_user_id is null and cp.claim_token is not null and nullif(trim(cp.page_name), '') is not null)
    );
  if not found then return null; end if;

  v_claimed := r.auth_user_id is not null and coalesce(r.onboarded, false);
  s := case when jsonb_typeof(r.nfc_display_settings) = 'object' then r.nfc_display_settings else '{}'::jsonb end;
  o := jsonb_build_object(
    'id', r.id,
    'claimed', v_claimed,
    'status', case when v_claimed then 'published' else 'unclaimed' end,
    'onboarded', coalesce(r.onboarded, false),
    'verified', case when v_claimed then coalesce(r.verified, false) else false end,
    'nfc_display_settings', s
  );
  if v_claimed then o := o || jsonb_build_object('auth_user_id', r.auth_user_id); end if;
  if public._nfc_flag(s, 'name', true) then o := o || jsonb_build_object('page_name', r.page_name, 'username', r.username); end if;
  if public._nfc_flag(s, 'photo', true) then o := o || jsonb_build_object('avatar_url', r.avatar_url, 'banner_url', r.banner_url); end if;
  if public._nfc_flag(s, 'location', true) then o := o || jsonb_build_object('city', r.city); end if;
  if public._nfc_flag(s, 'language', true) then o := o || jsonb_build_object('language', r.language); end if;
  if public._nfc_flag(s, 'bio', true) then o := o || jsonb_build_object('bio', r.bio); end if;
  if public._nfc_flag(s, 'role', true) then o := o || jsonb_build_object('primary_niche', r.primary_niche); end if;
  if public._nfc_flag(s, 'availability', true) then o := o || jsonb_build_object('availability', r.availability); end if;
  if public._nfc_flag(s, 'socials', true) then o := o || jsonb_build_object('platforms', coalesce(r.platforms, '{}'::jsonb)); end if;
  if public._nfc_flag(s, 'services', true) then o := o || jsonb_build_object('services', coalesce(r.services, '{}'::jsonb)); end if;
  if public._nfc_flag(s, 'portfolio', true) then o := o || jsonb_build_object('portfolio_link', r.portfolio_link, 'portfolio_media', coalesce(r.portfolio_media, '[]'::jsonb)); end if;
  return o;
end;
$$;

create or replace function public.get_public_business_profile(p_profile_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  r public.business_profiles;
  s jsonb;
  o jsonb;
  v_claimed boolean;
begin
  select * into r
  from public.business_profiles bp
  where bp.id = p_profile_id
    and (
      (bp.auth_user_id is not null and coalesce(bp.onboarded, false) = true)
      or (coalesce(bp.claimed, false) = false and bp.auth_user_id is null and bp.claim_token is not null and nullif(trim(bp.business_name), '') is not null)
    );
  if not found then return null; end if;

  v_claimed := r.auth_user_id is not null and coalesce(r.onboarded, false);
  s := case when jsonb_typeof(r.nfc_display_settings) = 'object' then r.nfc_display_settings else '{}'::jsonb end;
  o := jsonb_build_object(
    'id', r.id,
    'claimed', v_claimed,
    'status', case when v_claimed then 'published' else 'unclaimed' end,
    'onboarded', coalesce(r.onboarded, false),
    'verified', case when v_claimed then coalesce(r.verified, false) else false end,
    'nfc_display_settings', s
  );
  if v_claimed then o := o || jsonb_build_object('auth_user_id', r.auth_user_id); end if;
  if public._nfc_flag(s, 'name', true) then o := o || jsonb_build_object('business_name', r.business_name, 'username', r.username); end if;
  if public._nfc_flag(s, 'photo', true) then o := o || jsonb_build_object('avatar_url', r.avatar_url, 'banner_url', r.banner_url); end if;
  if public._nfc_flag(s, 'location', true) then o := o || jsonb_build_object('city', r.city); end if;
  if public._nfc_flag(s, 'language', true) then o := o || jsonb_build_object('language', r.language); end if;
  if public._nfc_flag(s, 'bio', true) then o := o || jsonb_build_object('bio', r.bio); end if;
  if public._nfc_flag(s, 'role', true) then o := o || jsonb_build_object('industry', r.industry); end if;
  if public._nfc_flag(s, 'website', true) then o := o || jsonb_build_object('website', r.website); end if;
  return o;
end;
$$;

revoke all on function public.list_public_creator_discovery(integer) from public;
revoke all on function public.list_public_business_discovery(integer) from public;
revoke all on function public.get_public_creator_profile(uuid) from public;
revoke all on function public.get_public_business_profile(uuid) from public;
grant execute on function public.list_public_creator_discovery(integer) to anon, authenticated;
grant execute on function public.list_public_business_discovery(integer) to anon, authenticated;
grant execute on function public.get_public_creator_profile(uuid) to anon, authenticated;
grant execute on function public.get_public_business_profile(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
commit;
