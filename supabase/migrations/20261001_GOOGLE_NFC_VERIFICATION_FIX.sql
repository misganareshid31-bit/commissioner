-- Commissioner production repair — 2026-10-01
-- Run this AFTER the existing Commissioner migrations.
-- This migration aligns NFC/profile visibility with the current product rules
-- and makes YouTube verification use the dedicated 1,000-subscriber setting.

-- 1) Dedicated YouTube verification threshold. Do not change the 30/30
-- network launch thresholds in platform_settings.
create table if not exists public.verification_settings (
  id boolean primary key default true,
  youtube_subscriber_threshold integer not null default 1000,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  constraint verification_settings_single_row check (id = true)
);

insert into public.verification_settings(id, youtube_subscriber_threshold)
values (true, 1000)
on conflict (id) do update
set youtube_subscriber_threshold = 1000,
    updated_at = now();

-- 2) NFC claim resolver: a completed profile is published when it is owned
-- and onboarded. approved is NOT the public-discovery gate anymore.
create or replace function public.get_claim_any(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  select 'creator'::text as kind, cp.* into r
  from public.creator_profiles cp
  where cp.claim_token = p_token
  limit 1;

  if found then
    return jsonb_build_object(
      'kind','creator',
      'status',case when r.auth_user_id is not null and coalesce(r.onboarded,false) then 'published' else 'claimable' end,
      'id',r.id,
      'page_name',r.page_name,
      'username',r.username,
      'avatar_url',r.avatar_url,
      'banner_url',r.banner_url,
      'city',r.city,
      'language',r.language,
      'bio',r.bio,
      'verified',r.verified,
      'primary_niche',r.primary_niche,
      'availability',r.availability,
      'platforms',r.platforms,
      'services',r.services,
      'portfolio_link',r.portfolio_link,
      'approved',r.approved,
      'onboarded',r.onboarded
    );
  end if;

  select 'business'::text as kind, bp.* into r
  from public.business_profiles bp
  where bp.claim_token = p_token
  limit 1;

  if found then
    return jsonb_build_object(
      'kind','business',
      'status',case when r.auth_user_id is not null and coalesce(r.onboarded,false) then 'published' else 'claimable' end,
      'id',r.id,
      'business_name',r.business_name,
      'username',r.username,
      'avatar_url',r.avatar_url,
      'banner_url',r.banner_url,
      'city',r.city,
      'language',r.language,
      'bio',r.bio,
      'verified',r.verified,
      'industry',r.industry,
      'website',r.website,
      'approved',r.approved,
      'onboarded',r.onboarded
    );
  end if;

  return null;
end;
$$;
revoke all on function public.get_claim_any(text) from public;
grant execute on function public.get_claim_any(text) to anon, authenticated;

-- 3) Keep the NFC claim token after setup. The token is never returned by
-- get_claim_any and claim mutations still require the authenticated owner.
-- Keeping it allows the physical NFC setup URL to resolve to the same
-- permanent profile after the first setup instead of becoming a dead link.
create or replace function public.claim_profile(
  p_token text,
  p_page_name text,
  p_username text,
  p_city text,
  p_language text,
  p_bio text,
  p_avatar_url text,
  p_banner_url text,
  p_platforms jsonb,
  p_portfolio_link text,
  p_availability text,
  p_preferences text
) returns boolean
language plpgsql security definer set search_path=public
as $$
declare updated_rows int;
begin
  if auth.uid() is null then raise exception 'You must be signed in to claim this Commissioner profile.'; end if;
  update public.creator_profiles set
    auth_user_id=auth.uid(),
    page_name=nullif(trim(p_page_name),''),
    username=nullif(trim(p_username),''),
    city=nullif(trim(p_city),''),
    language=nullif(trim(p_language),''),
    bio=nullif(trim(p_bio),''),
    avatar_url=nullif(trim(p_avatar_url),''),
    banner_url=nullif(trim(p_banner_url),''),
    platforms=coalesce(p_platforms,'{}'::jsonb),
    portfolio_link=nullif(trim(p_portfolio_link),''),
    availability=nullif(trim(p_availability),''),
    professional_preferences=nullif(trim(p_preferences),''),
    onboarded=true,
    claimed=true
  where claim_token=p_token and (auth_user_id is null or auth_user_id=auth.uid());
  get diagnostics updated_rows=row_count;
  return updated_rows>0;
end;
$$;
revoke all on function public.claim_profile(text,text,text,text,text,text,text,text,jsonb,text,text,text) from public;
grant execute on function public.claim_profile(text,text,text,text,text,text,text,text,jsonb,text,text,text) to authenticated;

create or replace function public.claim_business(
  p_token text,
  p_business_name text,
  p_username text,
  p_city text,
  p_language text,
  p_bio text,
  p_avatar_url text,
  p_banner_url text,
  p_website text,
  p_looking_for text[],
  p_budget_range text,
  p_preferences text
) returns boolean
language plpgsql security definer set search_path=public
as $$
declare updated_rows int;
begin
  if auth.uid() is null then raise exception 'You must be signed in to claim this Commissioner business profile.'; end if;
  update public.business_profiles set
    auth_user_id=auth.uid(),
    business_name=nullif(trim(p_business_name),''),
    username=nullif(trim(p_username),''),
    city=nullif(trim(p_city),''),
    language=nullif(trim(p_language),''),
    bio=nullif(trim(p_bio),''),
    avatar_url=nullif(trim(p_avatar_url),''),
    banner_url=nullif(trim(p_banner_url),''),
    website=nullif(trim(p_website),''),
    looking_for=coalesce(p_looking_for,'{}'::text[]),
    budget_range=nullif(trim(p_budget_range),''),
    preferences=nullif(trim(p_preferences),''),
    onboarded=true,
    claimed=true
  where claim_token=p_token and (auth_user_id is null or auth_user_id=auth.uid());
  get diagnostics updated_rows=row_count;
  return updated_rows>0;
end;
$$;
revoke all on function public.claim_business(text,text,text,text,text,text,text,text,text,text[],text,text) from public;
grant execute on function public.claim_business(text,text,text,text,text,text,text,text,text,text[],text,text) to authenticated;

-- 4) Verification UI/admin can read the dedicated threshold without touching
-- network thresholds. YouTube is 1,000; other qualifying platforms retain the
-- existing platform_settings creator threshold.
create or replace function public.get_creator_verification_threshold(p_platform text default null)
returns integer
language plpgsql
security definer
set search_path=public
as $$
declare yt int; general int;
begin
  select youtube_subscriber_threshold into yt from public.verification_settings where id=true;
  select creator_follower_threshold into general from public.platform_settings where id=true;
  if lower(coalesce(p_platform,''))='youtube' then return coalesce(yt,1000); end if;
  return coalesce(general,15000);
end;
$$;
revoke all on function public.get_creator_verification_threshold(text) from public;
grant execute on function public.get_creator_verification_threshold(text) to authenticated;
