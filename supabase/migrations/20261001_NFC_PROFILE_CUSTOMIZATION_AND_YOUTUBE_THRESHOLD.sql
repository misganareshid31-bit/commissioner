-- Commissioner — NFC profile customization + YouTube 1,000-subscriber threshold
-- Run after the existing Commissioner migrations, especially the 20260929
-- follower-threshold/claim-token migration.

-- 1) Store the recipient's account email and their NFC display preferences.
alter table public.creator_profiles add column if not exists contact_email text;
alter table public.business_profiles add column if not exists contact_email text;
alter table public.creator_profiles add column if not exists nfc_visibility jsonb not null default '{"bio":true,"location":true,"language":true,"socials":true,"services":true,"portfolio":true,"website":true,"contact":true,"verification":true}'::jsonb;
alter table public.business_profiles add column if not exists nfc_visibility jsonb not null default '{"bio":true,"location":true,"language":true,"socials":true,"services":true,"portfolio":true,"website":true,"contact":true,"verification":true}'::jsonb;

-- 2) Keep the general creator threshold at 15,000 while YouTube has its own
-- lower documented requirement of 1,000 subscribers.
insert into public.platform_settings (id, creator_follower_threshold)
values (true, 15000)
on conflict (id) do update set creator_follower_threshold = 15000;

create or replace function public.commissioner_creator_threshold(p_platform text)
returns int
language sql
stable
as $$
  select case when lower(coalesce(p_platform,'')) in ('youtube','youtube.com') then 1000 else coalesce((select creator_follower_threshold from public.platform_settings where id=true),15000) end;
$$;
revoke all on function public.commissioner_creator_threshold(text) from public;
grant execute on function public.commissioner_creator_threshold(text) to authenticated;

-- 3) Eligibility check: YouTube = 1,000 subscribers; other platforms use the
-- configured general creator threshold.
create or replace function public.evaluate_creator_50k_eligibility(p_creator_profile_id uuid)
returns jsonb
language plpgsql security definer set search_path=public
as $$
declare
  claim public.creator_verification_claims;
  audience bigint := 0;
  eligible boolean := false;
  threshold int;
  platform_name text;
begin
  if not public.is_admin() and not exists(select 1 from public.creator_profiles where id=p_creator_profile_id and auth_user_id=auth.uid()) then raise exception 'not authorized'; end if;
  select * into claim from public.creator_verification_claims where creator_profile_id=p_creator_profile_id;
  if claim.id is null then return jsonb_build_object('eligible',false,'reason','verification request not submitted','threshold',15000); end if;
  platform_name := lower(coalesce(claim.platform,''));
  threshold := public.commissioner_creator_threshold(platform_name);
  audience := greatest(coalesce(claim.audience_count,0),0);
  eligible := audience >= threshold;
  update public.creator_verification_claims set eligibility_status=case when eligible and ownership_method is not null then 'eligible' when eligible then 'pending_review' else 'not_eligible' end, updated_at=now() where id=claim.id;
  return jsonb_build_object('eligible',eligible,'audience_count',audience,'threshold',threshold,'platform',claim.platform,'ownership_method',claim.ownership_method,'verification_source',coalesce(claim.verification_source,'manual'));
end;
$$;
revoke all on function public.evaluate_creator_50k_eligibility(uuid) from public;
grant execute on function public.evaluate_creator_50k_eligibility(uuid) to authenticated;

-- 4) Submission uses the platform-specific threshold at the time of request.
create or replace function public.submit_creator_verification_details(
  p_creator_profile_id uuid,
  p_evidence_note text default '',
  p_platform text default null,
  p_platform_account_id text default null,
  p_claimed_username text default null,
  p_audience_count bigint default null,
  p_engagement_rate numeric default null,
  p_ownership_method text default 'manual'
) returns uuid
language plpgsql security definer set search_path=public
as $$
declare
  v_id uuid;
  threshold int;
begin
  if not exists(select 1 from public.creator_profiles where id=p_creator_profile_id and auth_user_id=auth.uid()) then raise exception 'not authorized'; end if;
  if p_ownership_method not in ('oauth','code','bio','manual') then raise exception 'invalid ownership method'; end if;
  if nullif(trim(coalesce(p_platform_account_id,'')),'') is null and nullif(trim(coalesce(p_claimed_username,'')),'') is null then raise exception 'enter your username or account ID so the reviewer can find your account'; end if;
  if p_ownership_method='oauth' and not exists(select 1 from public.social_oauth_connections where user_id=auth.uid() and lower(provider)=lower(coalesce(p_platform,'')) and status='connected') then raise exception 'connect your % account first, or choose a code/manual ownership proof', coalesce(p_platform,'social'); end if;
  threshold := public.commissioner_creator_threshold(p_platform);
  insert into public.creator_verification_claims(creator_profile_id,evidence_note,status,platform,platform_account_id,claimed_username,audience_count,engagement_rate,ownership_method,verification_source,eligibility_status)
  values(p_creator_profile_id,trim(coalesce(p_evidence_note,'')),'pending',p_platform,p_platform_account_id,p_claimed_username,p_audience_count,p_engagement_rate,p_ownership_method,case when p_ownership_method='oauth' then 'oauth' else 'manual' end,case when coalesce(p_audience_count,0)>=threshold then case when p_ownership_method='manual' then 'pending_review' else 'eligible' end else 'not_eligible' end)
  on conflict (creator_profile_id) do update set evidence_note=excluded.evidence_note,status='pending',platform=excluded.platform,platform_account_id=excluded.platform_account_id,claimed_username=excluded.claimed_username,audience_count=excluded.audience_count,engagement_rate=excluded.engagement_rate,ownership_method=excluded.ownership_method,verification_source=excluded.verification_source,eligibility_status=excluded.eligibility_status,updated_at=now()
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.submit_creator_verification_details(uuid,text,text,text,text,bigint,numeric,text) from public;
grant execute on function public.submit_creator_verification_details(uuid,text,text,text,text,bigint,numeric,text) to authenticated;

-- 5) Admin verification gate uses the same platform-specific threshold.
create or replace function public.admin_verify_with_plan(
  p_kind text,
  p_claim_id uuid,
  p_plan text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_id uuid;
  audience bigint;
  ownership text;
  threshold int;
  platform_name text;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  if lower(p_plan) not in ('basic','pro','premium') then raise exception 'invalid plan'; end if;

  if lower(p_kind) = 'creator' then
    select creator_profile_id, coalesce(audience_count,0), ownership_method, lower(coalesce(platform,''))
      into profile_id, audience, ownership, platform_name
      from public.creator_verification_claims where id = p_claim_id;
    if profile_id is null then raise exception 'creator verification request not found'; end if;
    if not public.creator_profile_complete(profile_id) then raise exception 'profile must be 100% complete before verification'; end if;
    threshold := public.commissioner_creator_threshold(platform_name);
    if audience < threshold then raise exception 'creator must have at least % followers/subscribers on the selected platform', threshold; end if;
    if ownership is null or ownership not in ('oauth','code','bio','manual') then raise exception 'creator account ownership evidence is required'; end if;
    if not exists (select 1 from public.creator_verification_claims where id=p_claim_id and (nullif(trim(platform_account_id),'') is not null or nullif(trim(claimed_username),'') is not null)) then raise exception 'creator platform account evidence is required'; end if;

    update public.creator_verification_claims
      set identity_status='verified', account_status='verified', followers_status='verified', engagement_status='verified',
          status='verified', eligibility_status='verified', checked_at=now(), verification_expires_at=now()+interval '180 days', updated_at=now()
      where id=p_claim_id;
    update public.creator_profiles set verified=true, approved=true, plan=lower(p_plan), updated_at=now() where id=profile_id;
    insert into public.creator_verification_history(claim_id,action,previous_status,new_status,reviewer_id,note)
      select p_claim_id,'verify',status,'verified',auth.uid(), format('Admin verification completed after ownership and %s+ eligibility checks on %s.', threshold, coalesce(platform_name,'the selected platform'))
      from public.creator_verification_claims where id=p_claim_id;

  elsif lower(p_kind) = 'business' then
    select business_profile_id into profile_id from public.business_verification_claims where id = p_claim_id;
    if profile_id is null then raise exception 'business verification request not found'; end if;
    if not public.business_profile_complete(profile_id) then raise exception 'profile must be 100% complete before verification'; end if;
    if not exists (select 1 from public.business_verification_claims where id=p_claim_id and nullif(trim(legal_business_name),'') is not null and nullif(trim(representative_name),'') is not null) then
      raise exception 'business information and authorized representative evidence are required';
    end if;
    update public.business_verification_claims
      set registration_status='verified', representative_status='verified', status='verified', checked_at=now(), expires_at=now()+interval '365 days', updated_at=now()
      where id=p_claim_id;
    update public.business_profiles set verified=true, approved=true, plan=lower(p_plan), updated_at=now() where id=profile_id;
    insert into public.business_verification_history(claim_id,action,previous_status,new_status,reviewer_id,note)
      select p_claim_id,'verify',status,'verified',auth.uid(),'Admin verification completed after business information and authorized representative checks.'
      from public.business_verification_claims where id=p_claim_id;
  else
    raise exception 'invalid profile kind';
  end if;

  return jsonb_build_object('ok',true,'kind',lower(p_kind),'claim_id',p_claim_id,'profile_id',profile_id,'plan',lower(p_plan),'verified',true,'threshold',coalesce(threshold,0),'platform',platform_name);
end;
$$;
revoke all on function public.admin_verify_with_plan(text,uuid,text) from public;
grant execute on function public.admin_verify_with_plan(text,uuid,text) to authenticated;

-- 6) Refresh existing pending claims with the new platform-aware threshold.
update public.creator_verification_claims c
set eligibility_status = case when coalesce(c.audience_count,0) >= public.commissioner_creator_threshold(c.platform) then case when c.ownership_method='manual' then 'pending_review' else 'eligible' end else 'not_eligible' end,
    updated_at=now()
where c.status='pending';

-- 7) NFC claim RPCs remain authenticated. The frontend collects the signed-in
-- account email and stores it in contact_email after ownership is established.

-- 8) Once the recipient has finished setup, the same NFC token becomes an
-- information-only resolver. Approval is not required for this transition;
-- completed means an authenticated owner exists and onboarding is finished.
create or replace function public.get_claim_any(p_token text)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare r record;
begin
  select 'creator'::text as kind, cp.* into r from public.creator_profiles cp where cp.claim_token=p_token limit 1;
  if found then
    return jsonb_build_object('kind','creator','status',case when r.auth_user_id is not null and coalesce(r.onboarded,false) then 'published' else 'claimable' end,'id',r.id,'page_name',r.page_name,'username',r.username,'avatar_url',r.avatar_url,'banner_url',r.banner_url,'city',r.city,'language',r.language,'bio',r.bio,'verified',r.verified,'primary_niche',r.primary_niche,'availability',r.availability,'platforms',r.platforms,'services',r.services,'portfolio_link',r.portfolio_link,'portfolio_media',r.portfolio_media,'nfc_visibility',r.nfc_visibility,'contact_email',r.contact_email,'approved',r.approved,'onboarded',r.onboarded);
  end if;
  select 'business'::text as kind, bp.* into r from public.business_profiles bp where bp.claim_token=p_token limit 1;
  if found then
    return jsonb_build_object('kind','business','status',case when r.auth_user_id is not null and coalesce(r.onboarded,false) then 'published' else 'claimable' end,'id',r.id,'business_name',r.business_name,'username',r.username,'avatar_url',r.avatar_url,'banner_url',r.banner_url,'city',r.city,'language',r.language,'bio',r.bio,'verified',r.verified,'industry',r.industry,'website',r.website,'nfc_visibility',r.nfc_visibility,'contact_email',r.contact_email,'approved',r.approved,'onboarded',r.onboarded);
  end if;
  return null;
end;
$$;
revoke all on function public.get_claim_any(text) from public;
grant execute on function public.get_claim_any(text) to anon, authenticated;

-- 9) Preserve the physical card token after setup. The same NFC URL therefore
-- changes from setup mode to information mode without reprogramming the card.
create or replace function public.claim_profile(
  p_token text,p_page_name text,p_username text,p_city text,p_language text,p_bio text,
  p_avatar_url text,p_banner_url text,p_platforms jsonb,p_portfolio_link text,p_availability text,p_preferences text
) returns boolean language plpgsql security definer set search_path=public as $$
declare updated_rows int;
begin
  if auth.uid() is null then raise exception 'You must be signed in to claim this Commissioner profile.'; end if;
  update public.creator_profiles set
    auth_user_id=auth.uid(), page_name=nullif(trim(p_page_name),''), username=nullif(trim(p_username),''), city=nullif(trim(p_city),''),
    language=nullif(trim(p_language),''), bio=nullif(trim(p_bio),''), avatar_url=nullif(trim(p_avatar_url),''), banner_url=nullif(trim(p_banner_url),''),
    platforms=coalesce(p_platforms,'{}'::jsonb), portfolio_link=nullif(trim(p_portfolio_link),''), availability=nullif(trim(p_availability),''),
    professional_preferences=nullif(trim(p_preferences),''), onboarded=true, claimed=true
  where claim_token=p_token and approved=false and (auth_user_id is null or auth_user_id=auth.uid());
  get diagnostics updated_rows=row_count; return updated_rows>0;
end; $$;
revoke execute on function public.claim_profile(text,text,text,text,text,text,text,text,jsonb,text,text,text) from anon;
grant execute on function public.claim_profile(text,text,text,text,text,text,text,text,jsonb,text,text,text) to authenticated;

create or replace function public.claim_business(
  p_token text,p_business_name text,p_username text,p_city text,p_language text,p_bio text,
  p_avatar_url text,p_banner_url text,p_website text,p_looking_for text[],p_budget_range text,p_preferences text
) returns boolean language plpgsql security definer set search_path=public as $$
declare updated_rows int;
begin
  if auth.uid() is null then raise exception 'You must be signed in to claim this Commissioner business profile.'; end if;
  update public.business_profiles set
    auth_user_id=auth.uid(), business_name=nullif(trim(p_business_name),''), username=nullif(trim(p_username),''), city=nullif(trim(p_city),''),
    language=nullif(trim(p_language),''), bio=nullif(trim(p_bio),''), avatar_url=nullif(trim(p_avatar_url),''), banner_url=nullif(trim(p_banner_url),''),
    website=nullif(trim(p_website),''), looking_for=coalesce(p_looking_for,'{}'::text[]), budget_range=nullif(trim(p_budget_range),''),
    preferences=nullif(trim(p_preferences),''), onboarded=true, claimed=true
  where claim_token=p_token and approved=false and (auth_user_id is null or auth_user_id=auth.uid());
  get diagnostics updated_rows=row_count; return updated_rows>0;
end; $$;
revoke execute on function public.claim_business(text,text,text,text,text,text,text,text,text,text[],text,text) from anon;
grant execute on function public.claim_business(text,text,text,text,text,text,text,text,text,text[],text,text) to authenticated;
