-- Commissioner verification flow final fix — 2026-09-28
-- Apply after the existing verification migrations.
-- Keeps business verification based on business information + authorized
-- representative information. A trade-license field is not required.

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
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  if lower(p_plan) not in ('basic','pro','premium') then raise exception 'invalid plan'; end if;

  if lower(p_kind)='creator' then
    select creator_profile_id, coalesce(audience_count,0), ownership_method
      into profile_id, audience, ownership
      from public.creator_verification_claims where id=p_claim_id;

    if profile_id is null then raise exception 'creator verification request not found'; end if;
    if not public.creator_profile_complete(profile_id) then
      raise exception 'profile must be 100% complete before verification';
    end if;
    if audience < 50000 then
      raise exception 'creator must have at least 50,000 followers/subscribers on a qualifying platform';
    end if;
    if ownership not in ('oauth','code','bio','manual') then
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

  elsif lower(p_kind)='business' then
    select business_profile_id into profile_id
      from public.business_verification_claims where id=p_claim_id;

    if profile_id is null then raise exception 'business verification request not found'; end if;
    if not public.business_profile_complete(profile_id) then
      raise exception 'profile must be 100% complete before verification';
    end if;

    if not exists (
      select 1 from public.business_verification_claims
      where id=p_claim_id
        and nullif(trim(legal_business_name),'') is not null
        and nullif(trim(representative_name),'') is not null
        and nullif(trim(registration_reference),'') is not null
    ) then
      raise exception 'business information, commercial registration reference, and authorized representative evidence are required';
    end if;

    update public.business_verification_claims
      set registration_status='verified',
          representative_status='verified', status='verified',
          checked_at=now(), expires_at=now()+interval '365 days'
      where id=p_claim_id;

    update public.business_profiles
      set verified=true, approved=true, plan=lower(p_plan), updated_at=now()
      where id=profile_id;
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
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;

  if lower(p_kind)='creator' then
    select coalesce(audience_count,0), ownership_method
      into audience, ownership
      from public.creator_verification_claims where id=p_claim_id;

    ready := audience >= 50000
      and ownership in ('oauth','code','bio','manual')
      and exists (
        select 1 from public.creator_verification_claims
        where id=p_claim_id
          and (nullif(trim(platform_account_id),'') is not null
               or nullif(trim(claimed_username),'') is not null)
      );
    if ready then
      reason := 'Creator meets the audience and account-ownership evidence requirements. Confirm the evidence before approval.';
    else
      reason := 'Creator needs 50K+ audience and account-ownership evidence.';
    end if;

    return jsonb_build_object(
      'ready',ready,'kind','creator','audience_count',audience,
      'threshold',50000,'ownership_method',ownership,'reason',reason
    );

  elsif lower(p_kind)='business' then
    ready := exists (
      select 1 from public.business_verification_claims
      where id=p_claim_id
        and nullif(trim(legal_business_name),'') is not null
        and nullif(trim(representative_name),'') is not null
        and nullif(trim(registration_reference),'') is not null
    );
    if ready then
      reason := 'Business information, commercial registration reference, and authorized representative information are present. Confirm the official evidence before approval.';
    else
      reason := 'Business needs legal identity, commercial registration information, and an authorized representative.';
    end if;

    return jsonb_build_object('ready',ready,'kind','business','reason',reason);
  else
    raise exception 'invalid profile kind';
  end if;
end;
$$;

revoke all on function public.admin_verification_readiness(text,uuid) from public;
grant execute on function public.admin_verification_readiness(text,uuid) to authenticated;
