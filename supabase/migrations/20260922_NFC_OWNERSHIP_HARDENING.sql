-- Commissioner NFC ownership hardening — 2026-09-22
-- A gifted NFC claim must be attached to the authenticated recipient's account.
-- The physical NFC URL remains permanent, but the token alone is no longer enough
-- to take ownership of a gifted profile.

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
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_rows int;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to claim this Commissioner profile.';
  end if;

  update public.creator_profiles set
    auth_user_id = auth.uid(),
    page_name = nullif(trim(p_page_name), ''),
    username = nullif(trim(p_username), ''),
    city = nullif(trim(p_city), ''),
    language = nullif(trim(p_language), ''),
    bio = nullif(trim(p_bio), ''),
    avatar_url = nullif(trim(p_avatar_url), ''),
    banner_url = nullif(trim(p_banner_url), ''),
    platforms = coalesce(p_platforms, '{}'::jsonb),
    portfolio_link = nullif(trim(p_portfolio_link), ''),
    availability = nullif(trim(p_availability), ''),
    professional_preferences = nullif(trim(p_preferences), ''),
    onboarded = true,
    claimed = true
  where claim_token = p_token
    and approved = false
    and (auth_user_id is null or auth_user_id = auth.uid());

  get diagnostics updated_rows = row_count;
  return updated_rows > 0;
end;
$$;

revoke execute on function public.claim_profile(text,text,text,text,text,text,text,text,jsonb,text,text,text) from anon;
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
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_rows int;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to claim this Commissioner business profile.';
  end if;

  update public.business_profiles set
    auth_user_id = auth.uid(),
    business_name = nullif(trim(p_business_name), ''),
    username = nullif(trim(p_username), ''),
    city = nullif(trim(p_city), ''),
    language = nullif(trim(p_language), ''),
    bio = nullif(trim(p_bio), ''),
    avatar_url = nullif(trim(p_avatar_url), ''),
    banner_url = nullif(trim(p_banner_url), ''),
    website = nullif(trim(p_website), ''),
    looking_for = coalesce(p_looking_for, '{}'::text[]),
    budget_range = nullif(trim(p_budget_range), ''),
    preferences = nullif(trim(p_preferences), ''),
    onboarded = true,
    claimed = true
  where claim_token = p_token
    and approved = false
    and (auth_user_id is null or auth_user_id = auth.uid());

  get diagnostics updated_rows = row_count;
  return updated_rows > 0;
end;
$$;

revoke execute on function public.claim_business(text,text,text,text,text,text,text,text,text,text[],text,text) from anon;
grant execute on function public.claim_business(text,text,text,text,text,text,text,text,text,text[],text,text) to authenticated;

-- Public NFC resolution returns only fields needed to render a public page.
-- Do not expose claim_token or auth_user_id through the anonymous lookup.
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
      'status',case when coalesce(r.approved,false) and coalesce(r.onboarded,false) then 'published' else 'claimable' end,
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
      'status',case when coalesce(r.approved,false) and coalesce(r.onboarded,false) then 'published' else 'claimable' end,
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

-- The claim-edit lookup is now authenticated too; the public NFC resolver above
-- is the only anonymous lookup needed for the physical card URL.
revoke execute on function public.get_claim_profile(text) from anon;
grant execute on function public.get_claim_profile(text) to authenticated;
revoke execute on function public.get_claim_business(text) from anon;
grant execute on function public.get_claim_business(text) to authenticated;
