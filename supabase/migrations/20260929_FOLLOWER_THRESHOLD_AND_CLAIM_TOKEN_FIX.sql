-- Commissioner — follower threshold + claim_token exposure fix — 2026-09-29
-- Run this LAST, after 20260928_ADMIN_AUTH_CONSOLIDATION.sql.
-- Idempotent — safe to run more than once.
--
-- WHAT THIS DOES
-- 1) Lowers the creator verification eligibility bar from a hardcoded
--    50,000 followers/subscribers to 15,000 — and, like the existing
--    network launch threshold, makes it a live admin-editable setting
--    instead of a number buried in four different SQL functions.
-- 2) Fixes a real data-exposure bug: once a gifted/NFC profile is claimed,
--    it becomes publicly readable (see 20260924_PUBLIC_PROFILE_VISIBILITY_FIX.sql),
--    but claim_token was never cleared on claim, so every claimed profile's
--    claim_token has been sitting in a publicly-selectable row ever since.
--    It can't be reused to steal an already-claimed profile (claim_profile /
--    claim_business only ever match rows with auth_user_id null or equal to
--    the caller), but a secret token has no business being world-readable,
--    so this clears it the moment a profile is claimed.

-- ---------------------------------------------------------------------
-- 1. Add the follower threshold to the existing settings row.
-- ---------------------------------------------------------------------

alter table if exists public.platform_settings
  add column if not exists creator_follower_threshold int not null default 15000;

update public.platform_settings
  set creator_follower_threshold = 15000
  where id = true and creator_follower_threshold = 50000;

-- ---------------------------------------------------------------------
-- 2. Admin-only RPC to change it later — no redeploy, no SQL editor.
-- ---------------------------------------------------------------------

create or replace function public.admin_set_follower_threshold(p_threshold int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'admin access required'; end if;
  if p_threshold < 0 then raise exception 'threshold must be zero or greater'; end if;

  update public.platform_settings
  set creator_follower_threshold = p_threshold,
      updated_at = now(),
      updated_by = auth.uid()
  where id = true;

  return jsonb_build_object('ok', true, 'creator_follower_threshold', p_threshold);
end;
$$;

revoke all on function public.admin_set_follower_threshold(int) from public;
grant execute on function public.admin_set_follower_threshold(int) to authenticated;

-- ---------------------------------------------------------------------
-- 3. Surface the threshold through commissioner_launch_stats() so the
--    frontend can read it in the same round trip it already makes for
--    the network launch numbers (see CONFIGURABLE-NETWORK-THRESHOLD-2026-09-18.sql).
-- ---------------------------------------------------------------------

create or replace function public.commissioner_launch_stats()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'creator_threshold', s.network_creator_threshold,
    'business_threshold', s.network_business_threshold,
    'follower_threshold', s.creator_follower_threshold,
    'threshold', s.network_creator_threshold,
    'creator_count', (select count(*) from public.creator_profiles where approved=true and onboarded=true and verified=true),
    'business_count', (select count(*) from public.business_profiles where approved=true and onboarded=true and verified=true)
  )
  from public.platform_settings s
  where s.id = true;
$$;
revoke all on function public.commissioner_launch_stats() from public;
grant execute on function public.commissioner_launch_stats() to anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. Point every function that hardcoded 50000 at the live setting.
-- ---------------------------------------------------------------------

create or replace function public.evaluate_creator_50k_eligibility(p_creator_profile_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  claim public.creator_verification_claims;
  audience bigint := 0;
  eligible boolean := false;
  threshold int;
begin
  if not public.is_admin() and not exists (
    select 1 from public.creator_profiles
    where id = p_creator_profile_id and auth_user_id = auth.uid()
  ) then
    raise exception 'not authorized';
  end if;

  select creator_follower_threshold into threshold from public.platform_settings where id = true;
  threshold := coalesce(threshold, 15000);

  select * into claim
  from public.creator_verification_claims
  where creator_profile_id = p_creator_profile_id;

  if claim.id is null then
    return jsonb_build_object('eligible',false,'reason','verification request not submitted','threshold',threshold);
  end if;

  audience := greatest(coalesce(claim.audience_count,0),0);
  eligible := audience >= threshold;

  update public.creator_verification_claims
  set eligibility_status = case
        when eligible and ownership_method is not null then 'eligible'
        when eligible then 'pending_review'
        else 'not_eligible'
      end,
      updated_at = now()
  where id = claim.id;

  return jsonb_build_object(
    'eligible', eligible,
    'audience_count', audience,
    'threshold', threshold,
    'ownership_method', claim.ownership_method,
    'verification_source', coalesce(claim.verification_source,'manual')
  );
end;
$$;
revoke all on function public.evaluate_creator_50k_eligibility(uuid) from public;
grant execute on function public.evaluate_creator_50k_eligibility(uuid) to authenticated;

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
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  if lower(p_plan) not in ('basic','pro','premium') then raise exception 'invalid plan'; end if;

  select coalesce(creator_follower_threshold,15000) into threshold from public.platform_settings where id = true;
  threshold := coalesce(threshold, 15000);

  if lower(p_kind) = 'creator' then
    select creator_profile_id, coalesce(audience_count,0), ownership_method
      into profile_id, audience, ownership
      from public.creator_verification_claims
      where id = p_claim_id;

    if profile_id is null then raise exception 'creator verification request not found'; end if;
    if not public.creator_profile_complete(profile_id) then
      raise exception 'profile must be 100% complete before verification';
    end if;
    if audience < threshold then
      raise exception 'creator must have at least % followers/subscribers on a qualifying platform', threshold;
    end if;
    if ownership is null or ownership not in ('oauth','code','bio','manual') then
      raise exception 'creator account ownership evidence is required';
    end if;
    if not exists (
      select 1 from public.creator_verification_claims
      where id=p_claim_id
        and (nullif(trim(platform_account_id),'') is not null
             or nullif(trim(claimed_username),'') is not null)
    ) then
      raise exception 'creator platform account evidence is required';
    end if;

    update public.creator_verification_claims
      set identity_status='verified', account_status='verified',
          followers_status='verified', engagement_status='verified',
          status='verified', eligibility_status='verified',
          checked_at=now(), verification_expires_at=now()+interval '180 days',
          updated_at=now()
      where id=p_claim_id;

    update public.creator_profiles
      set verified=true, approved=true, plan=lower(p_plan), updated_at=now()
      where id=profile_id;

    insert into public.creator_verification_history
      (claim_id,action,previous_status,new_status,reviewer_id,note)
    select p_claim_id,'verify',status,'verified',auth.uid(),
      format('Admin verification completed after ownership and %s+ eligibility checks.', threshold)
    from public.creator_verification_claims where id=p_claim_id;

  elsif lower(p_kind) = 'business' then
    select business_profile_id into profile_id
      from public.business_verification_claims
      where id = p_claim_id;

    if profile_id is null then raise exception 'business verification request not found'; end if;
    if not public.business_profile_complete(profile_id) then
      raise exception 'profile must be 100% complete before verification';
    end if;

    if not exists (
      select 1 from public.business_verification_claims
      where id=p_claim_id
        and nullif(trim(legal_business_name),'') is not null
        and nullif(trim(representative_name),'') is not null
        and (
          nullif(trim(registration_reference),'') is not null
          or nullif(trim(trade_license_reference),'') is not null
        )
    ) then
      raise exception 'business registration/licensing and authorized representative evidence are required';
    end if;

    update public.business_verification_claims
      set registration_status='verified',
          representative_status='verified', status='verified',
          checked_at=now(), expires_at=now()+interval '365 days',
          updated_at=now()
      where id=p_claim_id;

    update public.business_profiles
      set verified=true, approved=true, plan=lower(p_plan), updated_at=now()
      where id=profile_id;

    insert into public.business_verification_history
      (claim_id,action,previous_status,new_status,reviewer_id,note)
    select p_claim_id,'verify',status,'verified',auth.uid(),
      'Admin verification completed after registration/licensing and representative checks.'
    from public.business_verification_claims where id=p_claim_id;

  else
    raise exception 'invalid profile kind';
  end if;

  return jsonb_build_object(
    'ok',true,'kind',lower(p_kind),'claim_id',p_claim_id,
    'profile_id',profile_id,'plan',lower(p_plan),'verified',true
  );
end;
$$;
revoke all on function public.admin_verify_with_plan(text,uuid,text) from public;
grant execute on function public.admin_verify_with_plan(text,uuid,text) to authenticated;

create or replace function public.admin_verification_readiness(
  p_kind text,
  p_claim_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ready boolean := false;
  reason text := 'More evidence is required.';
  audience bigint := 0;
  ownership text;
  threshold int;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;

  select coalesce(creator_follower_threshold,15000) into threshold from public.platform_settings where id = true;
  threshold := coalesce(threshold, 15000);

  if lower(p_kind)='creator' then
    select coalesce(audience_count,0), ownership_method
      into audience, ownership
      from public.creator_verification_claims where id=p_claim_id;

    if audience >= threshold
       and ownership in ('oauth','code','bio','manual')
       and exists(select 1 from public.creator_verification_claims
                  where id=p_claim_id
                    and (nullif(trim(platform_account_id),'') is not null
                         or nullif(trim(claimed_username),'') is not null))
    then
      ready := true;
      reason := format('Creator meets the %s+ eligibility and account-evidence requirements. Confirm the evidence before approval.', threshold);
    else
      reason := format('Creator needs %s+ audience and account-ownership evidence.', threshold);
    end if;

    return jsonb_build_object(
      'ready',ready,'kind','creator','audience_count',audience,
      'threshold',threshold,'ownership_method',ownership,'reason',reason
    );
  elsif lower(p_kind)='business' then
    ready := exists(
      select 1 from public.business_verification_claims
      where id=p_claim_id
        and nullif(trim(legal_business_name),'') is not null
        and nullif(trim(representative_name),'') is not null
        and (
          nullif(trim(registration_reference),'') is not null
          or nullif(trim(trade_license_reference),'') is not null
        )
    );
    if ready then reason := 'Business evidence fields are complete. Confirm the official registration/licensing information and representative before approval.';
    else reason := 'Business needs legal identity, registration/licensing evidence, and an authorized representative.';
    end if;

    return jsonb_build_object('ready',ready,'kind','business','reason',reason);
  else
    raise exception 'invalid profile kind';
  end if;
end;
$$;
revoke all on function public.admin_verification_readiness(text,uuid) from public;
grant execute on function public.admin_verification_readiness(text,uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 5. Claim_token exposure fix — clear the token the moment a profile is
--    claimed, since claimed+onboarded profiles are publicly readable.
-- ---------------------------------------------------------------------

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
    claimed = true,
    claim_token = null
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
    claimed = true,
    claim_token = null
  where claim_token = p_token
    and approved = false
    and (auth_user_id is null or auth_user_id = auth.uid());

  get diagnostics updated_rows = row_count;
  return updated_rows > 0;
end;
$$;
revoke execute on function public.claim_business(text,text,text,text,text,text,text,text,text,text[],text,text) from anon;
grant execute on function public.claim_business(text,text,text,text,text,text,text,text,text,text[],text,text) to authenticated;

-- One-time cleanup: null out claim_token for profiles that were already
-- claimed before this migration ran, so previously-exposed tokens stop
-- being publicly readable immediately (no need to wait for a re-claim).
update public.creator_profiles set claim_token = null where claimed = true and claim_token is not null;
update public.business_profiles set claim_token = null where claimed = true and claim_token is not null;

-- ---------------------------------------------------------------------
-- 6. Submit function: use the live follower threshold (it still had a
--    hardcoded 50000, which stamped eligibility_status at submit time) and
--    stop accepting "oauth" ownership unless that platform is genuinely
--    connected for the caller. Same signature as before, so the frontend
--    call is unchanged.
-- ---------------------------------------------------------------------

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
  if not exists(select 1 from public.creator_profiles where id=p_creator_profile_id and auth_user_id=auth.uid()) then
    raise exception 'not authorized';
  end if;
  if p_ownership_method not in ('oauth','code','bio','manual') then raise exception 'invalid ownership method'; end if;

  if nullif(trim(coalesce(p_platform_account_id,'')),'') is null
     and nullif(trim(coalesce(p_claimed_username,'')),'') is null then
    raise exception 'enter your username or account ID so the reviewer can find your account';
  end if;

  if p_ownership_method = 'oauth' and not exists (
    select 1 from public.social_oauth_connections
    where user_id = auth.uid()
      and lower(provider) = lower(coalesce(p_platform,''))
      and status = 'connected'
  ) then
    raise exception 'connect your % account first, or choose a code/manual ownership proof', coalesce(p_platform,'social');
  end if;

  select coalesce(creator_follower_threshold,15000) into threshold from public.platform_settings where id = true;
  threshold := coalesce(threshold, 15000);

  insert into public.creator_verification_claims(
    creator_profile_id,evidence_note,status,platform,platform_account_id,claimed_username,
    audience_count,engagement_rate,ownership_method,verification_source,eligibility_status
  ) values (
    p_creator_profile_id,trim(coalesce(p_evidence_note,'')),'pending',p_platform,p_platform_account_id,
    p_claimed_username,p_audience_count,p_engagement_rate,p_ownership_method,
    case when p_ownership_method='oauth' then 'oauth' else 'manual' end,
    case when coalesce(p_audience_count,0) >= threshold then case when p_ownership_method='manual' then 'pending_review' else 'eligible' end else 'not_eligible' end
  )
  on conflict (creator_profile_id) do update set
    evidence_note=excluded.evidence_note, status='pending', platform=excluded.platform,
    platform_account_id=excluded.platform_account_id, claimed_username=excluded.claimed_username,
    audience_count=excluded.audience_count, engagement_rate=excluded.engagement_rate,
    ownership_method=excluded.ownership_method, verification_source=excluded.verification_source,
    eligibility_status=excluded.eligibility_status, updated_at=now()
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.submit_creator_verification_details(uuid,text,text,text,text,bigint,numeric,text) from public;
grant execute on function public.submit_creator_verification_details(uuid,text,text,text,text,bigint,numeric,text) to authenticated;

-- Re-stamp eligibility on requests that were already submitted under the old
-- 50,000 bar, so people between 15,000 and 50,000 are no longer marked
-- not_eligible by stale data.
update public.creator_verification_claims c
set eligibility_status = case
      when coalesce(c.audience_count,0) >= (select creator_follower_threshold from public.platform_settings where id = true)
        then case when c.ownership_method = 'manual' then 'pending_review' else 'eligible' end
      else 'not_eligible' end,
    updated_at = now()
where c.status = 'pending';

-- ---------------------------------------------------------------------
-- Verify after running:
--   select public.admin_verification_readiness('creator', '<claim id>');
--   -- 'threshold' in the response should now read 15000 (or whatever
--   -- you set via admin_set_follower_threshold()).
-- ---------------------------------------------------------------------
