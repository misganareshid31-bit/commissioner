-- ============================================================================
-- COMMISSIONER FINAL VERIFICATION HARDENING — 2026-09-27
-- Apply AFTER the existing 2026-09-26 Commissioner migrations.
-- Adds private evidence storage, strict verification gates, and admin evidence review.
-- ============================================================================

-- 1) Private evidence metadata
alter table if exists public.creator_verification_claims
  add column if not exists evidence_storage_path text;

alter table if exists public.business_verification_claims
  add column if not exists evidence_storage_path text;

-- 2) Private Storage bucket. Files must never be public.
insert into storage.buckets (id, name, public)
values ('verification-evidence', 'verification-evidence', false)
on conflict (id) do update set public = false;

drop policy if exists "Verification evidence owner upload" on storage.objects;
create policy "Verification evidence owner upload"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'verification-evidence'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Verification evidence owner view" on storage.objects;
create policy "Verification evidence owner view"
on storage.objects for select to authenticated
using (
  bucket_id = 'verification-evidence'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_admin()
  )
);

drop policy if exists "Verification evidence admin manage" on storage.objects;
create policy "Verification evidence admin manage"
on storage.objects for delete to authenticated
using (
  bucket_id = 'verification-evidence'
  and public.is_admin()
);

-- 3) Attach an uploaded evidence object only to the applicant's own claim or by admin.
create or replace function public.attach_verification_evidence(
  p_kind text,
  p_claim_id uuid,
  p_storage_path text
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid;
begin
  if nullif(trim(coalesce(p_storage_path,'')),'') is null then
    raise exception 'evidence path is required';
  end if;

  if lower(p_kind) = 'creator' then
    select cp.auth_user_id into owner_id
    from public.creator_verification_claims cvc
    join public.creator_profiles cp on cp.id = cvc.creator_profile_id
    where cvc.id = p_claim_id;
    if owner_id is null then raise exception 'verification request not found'; end if;
    if auth.uid() <> owner_id and not public.is_admin() then raise exception 'not authorized'; end if;

    update public.creator_verification_claims
      set evidence_storage_path = p_storage_path, updated_at = now()
      where id = p_claim_id;
  elsif lower(p_kind) = 'business' then
    select bp.auth_user_id into owner_id
    from public.business_verification_claims bvc
    join public.business_profiles bp on bp.id = bvc.business_profile_id
    where bvc.id = p_claim_id;
    if owner_id is null then raise exception 'verification request not found'; end if;
    if auth.uid() <> owner_id and not public.is_admin() then raise exception 'not authorized'; end if;

    update public.business_verification_claims
      set evidence_storage_path = p_storage_path, updated_at = now()
      where id = p_claim_id;
  else
    raise exception 'invalid profile kind';
  end if;

  return true;
end;
$$;

revoke all on function public.attach_verification_evidence(text,uuid,text) from public;
grant execute on function public.attach_verification_evidence(text,uuid,text) to authenticated;

-- 4) Strict automatic eligibility gate for admin verification.
-- 50K is an eligibility requirement, not a guarantee of identity.
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

  if lower(p_kind) = 'creator' then
    select creator_profile_id, coalesce(audience_count,0), ownership_method
      into profile_id, audience, ownership
      from public.creator_verification_claims
      where id = p_claim_id;

    if profile_id is null then raise exception 'creator verification request not found'; end if;
    if not public.creator_profile_complete(profile_id) then
      raise exception 'profile must be 100% complete before verification';
    end if;
    if audience < 50000 then
      raise exception 'creator must have at least 50,000 followers/subscribers on a qualifying platform';
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
      'Admin verification completed after ownership and 50K eligibility checks.'
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

-- 5) Keep owner evidence private. Public users should use summary RPCs.
drop policy if exists "Public can view creator verification claims" on public.creator_verification_claims;
drop policy if exists "Public can view business verification claims" on public.business_verification_claims;

-- 6) Clear admin-side decision helper for the review UI.
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

    if audience >= 50000
       and ownership in ('oauth','code','bio','manual')
       and exists(select 1 from public.creator_verification_claims
                  where id=p_claim_id
                    and (nullif(trim(platform_account_id),'') is not null
                         or nullif(trim(claimed_username),'') is not null))
    then
      ready := true;
      reason := 'Creator meets the 50K eligibility and account-evidence requirements. Confirm the evidence before approval.';
    else
      reason := 'Creator needs 50K+ audience and account-ownership evidence.';
    end if;

    return jsonb_build_object(
      'ready',ready,'kind','creator','audience_count',audience,
      'threshold',50000,'ownership_method',ownership,'reason',reason
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

-- End.
