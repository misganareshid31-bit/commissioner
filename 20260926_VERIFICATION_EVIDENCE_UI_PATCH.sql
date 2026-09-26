-- Commissioner 2026-09-26 verification evidence UI/RPC patch.
-- Apply after COMMISSIONER-REMAINING-BUILD-2026-09-26.sql.
-- Idempotent: updates the existing submit functions through dedicated detail RPCs.

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
declare v_id uuid;
begin
  if not exists(select 1 from public.creator_profiles where id=p_creator_profile_id and auth_user_id=auth.uid()) then
    raise exception 'not authorized';
  end if;
  if p_ownership_method not in ('oauth','code','bio','manual') then raise exception 'invalid ownership method'; end if;
  insert into public.creator_verification_claims(
    creator_profile_id,evidence_note,status,platform,platform_account_id,claimed_username,
    audience_count,engagement_rate,ownership_method,verification_source,eligibility_status
  ) values (
    p_creator_profile_id,trim(coalesce(p_evidence_note,'')),'pending',p_platform,p_platform_account_id,
    p_claimed_username,p_audience_count,p_engagement_rate,p_ownership_method,
    case when p_ownership_method='oauth' then 'oauth' else 'manual' end,
    case when coalesce(p_audience_count,0) >= 50000 then case when p_ownership_method='manual' then 'pending_review' else 'eligible' end else 'not_eligible' end
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
declare v_id uuid;
begin
  if not exists(select 1 from public.business_profiles where id=p_business_profile_id and auth_user_id=auth.uid()) then
    raise exception 'not authorized';
  end if;
  insert into public.business_verification_claims(
    business_profile_id,evidence_note,status,legal_business_name,trade_name,registration_reference,
    trade_license_reference,tin_reference,business_activity,representative_name,official_contact,official_website
  ) values (
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

-- Promotions can point to the promoted content without introducing a payment system.
alter table if exists public.promotions add column if not exists target_url text;

drop function if exists public.admin_create_promotion(text,text,text,timestamptz,timestamptz);
create or replace function public.admin_create_promotion(
  p_title text,
  p_description text default '',
  p_placement text default 'explore',
  p_start_at timestamptz default null,
  p_end_at timestamptz default null,
  p_target_url text default null
) returns uuid
language plpgsql security definer set search_path=public
as $$
declare v_id uuid;
begin
  if not public.is_admin() then raise exception 'admin access required'; end if;
  insert into public.promotions(title,description,placement,start_at,end_at,target_url,created_by)
  values(trim(p_title),coalesce(p_description,''),p_placement,p_start_at,p_end_at,nullif(trim(coalesce(p_target_url,'')),''),auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.admin_create_promotion(text,text,text,timestamptz,timestamptz,text) from public;
grant execute on function public.admin_create_promotion(text,text,text,timestamptz,timestamptz,text) to authenticated;
