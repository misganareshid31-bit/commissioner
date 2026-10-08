-- Commissioner V1 verification policy — manual review, no follower thresholds,
-- no payment requirement, one request per profile with editable pending state.
-- Run after the existing verification migrations.

-- Creator request: no audience/follower threshold. A completed profile may
-- request once; an existing pending/needs_recheck request may be edited.
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
  v_status text;
begin
  if not exists(select 1 from public.creator_profiles where id=p_creator_profile_id and auth_user_id=auth.uid() and onboarded=true) then
    raise exception 'profile must be completed before verification';
  end if;
  if p_ownership_method not in ('oauth','code','bio','manual') then raise exception 'invalid ownership method'; end if;
  if nullif(trim(coalesce(p_platform_account_id,'')),'') is null and nullif(trim(coalesce(p_claimed_username,'')),'') is null then
    raise exception 'enter your username or account ID so the reviewer can find your account';
  end if;
  if p_ownership_method='oauth' and not exists(
    select 1 from public.social_oauth_connections
    where user_id=auth.uid() and lower(provider)=lower(coalesce(p_platform,'')) and status='connected'
  ) then
    raise exception 'connect the selected account first, or choose a manual ownership proof';
  end if;

  select status into v_status from public.creator_verification_claims where creator_profile_id=p_creator_profile_id for update;
  if v_status is not null and v_status not in ('pending','needs_recheck') then
    raise exception 'this verification request has already reached a final review state';
  end if;

  insert into public.creator_verification_claims(
    creator_profile_id,evidence_note,status,platform,platform_account_id,claimed_username,
    audience_count,engagement_rate,ownership_method,verification_source,eligibility_status
  ) values (
    p_creator_profile_id,trim(coalesce(p_evidence_note,'')),'pending',p_platform,p_platform_account_id,
    p_claimed_username,p_audience_count,p_engagement_rate,p_ownership_method,
    case when p_ownership_method='oauth' then 'oauth' else 'manual' end,'pending_review'
  )
  on conflict (creator_profile_id) do update set
    evidence_note=excluded.evidence_note,status='pending',platform=excluded.platform,
    platform_account_id=excluded.platform_account_id,claimed_username=excluded.claimed_username,
    audience_count=excluded.audience_count,engagement_rate=excluded.engagement_rate,
    ownership_method=excluded.ownership_method,verification_source=excluded.verification_source,
    eligibility_status='pending_review',updated_at=now()
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.submit_creator_verification_details(uuid,text,text,text,text,bigint,numeric,text) from public;
grant execute on function public.submit_creator_verification_details(uuid,text,text,text,text,bigint,numeric,text) to authenticated;

-- Business request: same one-request/edit-while-pending policy.
create or replace function public.submit_business_verification_details(
  p_business_profile_id uuid,
  p_evidence_note text default '',
  p_legal_business_name text default null,
  p_trade_name text default null,
  p_registration_reference text default null,
  p_trade_license_reference text default null,
  p_tin_reference text default null,
  p_business_activity text default null,
  p_representative_name text default null,
  p_official_contact text default null,
  p_official_website text default null
) returns uuid
language plpgsql security definer set search_path=public
as $$
declare
  v_id uuid;
  v_status text;
begin
  if not exists(select 1 from public.business_profiles where id=p_business_profile_id and auth_user_id=auth.uid() and onboarded=true) then
    raise exception 'profile must be completed before verification';
  end if;
  if nullif(trim(coalesce(p_legal_business_name,'')),'') is null or nullif(trim(coalesce(p_representative_name,'')),'') is null then
    raise exception 'business name and authorized representative are required';
  end if;
  select status into v_status from public.business_verification_claims where business_profile_id=p_business_profile_id for update;
  if v_status is not null and v_status not in ('pending','needs_recheck') then
    raise exception 'this verification request has already reached a final review state';
  end if;
  insert into public.business_verification_claims(
    business_profile_id,evidence_note,status,legal_business_name,trade_name,registration_reference,
    trade_license_reference,tin_reference,business_activity,representative_name,official_contact,official_website
  ) values(
    p_business_profile_id,trim(coalesce(p_evidence_note,'')),'pending',p_legal_business_name,p_trade_name,
    p_registration_reference,p_trade_license_reference,p_tin_reference,p_business_activity,
    p_representative_name,p_official_contact,p_official_website
  )
  on conflict (business_profile_id) do update set
    evidence_note=excluded.evidence_note,status='pending',legal_business_name=excluded.legal_business_name,
    trade_name=excluded.trade_name,registration_reference=excluded.registration_reference,
    trade_license_reference=excluded.trade_license_reference,tin_reference=excluded.tin_reference,
    business_activity=excluded.business_activity,representative_name=excluded.representative_name,
    official_contact=excluded.official_contact,official_website=excluded.official_website,updated_at=now()
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.submit_business_verification_details(uuid,text,text,text,text,text,text,text,text,text,text) from public;
grant execute on function public.submit_business_verification_details(uuid,text,text,text,text,text,text,text,text,text,text) to authenticated;

-- Admin verification: manual approval only. The plan argument is retained for
-- API compatibility but verification never depends on payment or a plan.
create or replace function public.admin_verify_with_plan(
  p_kind text,
  p_claim_id uuid,
  p_plan text default 'basic'
) returns jsonb
language plpgsql security definer set search_path=public
as $$
declare
  profile_id uuid;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  if lower(p_kind)='creator' then
    select creator_profile_id into profile_id from public.creator_verification_claims where id=p_claim_id;
    if profile_id is null then raise exception 'creator verification request not found'; end if;
    if not public.creator_profile_complete(profile_id) then raise exception 'profile must be 100% complete before verification'; end if;
    if not exists(select 1 from public.creator_verification_claims where id=p_claim_id and nullif(trim(coalesce(ownership_method,'')),'') is not null and (nullif(trim(coalesce(platform_account_id,'')),'') is not null or nullif(trim(coalesce(claimed_username,'')),'') is not null)) then
      raise exception 'creator ownership evidence is required';
    end if;
    update public.creator_verification_claims set identity_status='verified',account_status='verified',followers_status='unverified',engagement_status=case when audience_count is not null and engagement_rate is not null then 'verified' else 'unverified' end,status='verified',eligibility_status='verified',checked_at=now(),verification_expires_at=now()+interval '180 days',updated_at=now() where id=p_claim_id;
    update public.creator_profiles set verified=true,approved=true,updated_at=now() where id=profile_id;
  elsif lower(p_kind)='business' then
    select business_profile_id into profile_id from public.business_verification_claims where id=p_claim_id;
    if profile_id is null then raise exception 'business verification request not found'; end if;
    if not public.business_profile_complete(profile_id) then raise exception 'profile must be 100% complete before verification'; end if;
    if not exists(select 1 from public.business_verification_claims where id=p_claim_id and nullif(trim(coalesce(legal_business_name,'')),'') is not null and nullif(trim(coalesce(representative_name,'')),'') is not null) then raise exception 'business information and authorized representative evidence are required'; end if;
    update public.business_verification_claims set registration_status='verified',representative_status='verified',status='verified',checked_at=now(),expires_at=now()+interval '365 days',updated_at=now() where id=p_claim_id;
    update public.business_profiles set verified=true,approved=true,updated_at=now() where id=profile_id;
  else raise exception 'invalid profile kind'; end if;
  return jsonb_build_object('ok',true,'kind',lower(p_kind),'claim_id',p_claim_id,'profile_id',profile_id,'verified',true,'payment_required',false,'follower_threshold',null);
end;
$$;
revoke all on function public.admin_verify_with_plan(text,uuid,text) from public;
grant execute on function public.admin_verify_with_plan(text,uuid,text) to authenticated;
