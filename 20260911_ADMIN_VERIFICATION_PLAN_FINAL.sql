-- Commissioner final admin verification/plan migration.
-- Safe to run after the other Commissioner migrations.
-- This version is intentionally self-contained: older installations may not
-- have a `plan` column yet.

-- 1) Ensure both profile tables have the common three-tier plan field.
alter table public.creator_profiles
  add column if not exists plan text not null default 'basic',
  add column if not exists plan_expires_at timestamptz;

alter table public.business_profiles
  add column if not exists plan text not null default 'basic',
  add column if not exists plan_expires_at timestamptz;

-- Remove old tier constraints BEFORE normalizing legacy values.
alter table public.creator_profiles drop constraint if exists creator_profiles_plan_check;
alter table public.business_profiles drop constraint if exists business_profiles_plan_check;

-- Normalize any legacy names. Unknown/null values become Basic.
update public.creator_profiles
set plan = case
  when lower(coalesce(plan,'')) in ('premium','elite','enterprise') then 'premium'
  when lower(coalesce(plan,'')) = 'pro' then 'pro'
  else 'basic'
end;

update public.business_profiles
set plan = case
  when lower(coalesce(plan,'')) in ('premium','elite','enterprise') then 'premium'
  when lower(coalesce(plan,'')) in ('pro','growth') then 'pro'
  else 'basic'
end;

alter table public.creator_profiles
  add constraint creator_profiles_plan_check check (plan in ('basic','pro','premium'));
alter table public.business_profiles
  add constraint business_profiles_plan_check check (plan in ('basic','pro','premium'));

-- 2) Admin-only direct plan assignment.
create or replace function public.admin_set_profile_plan(
  p_kind text,
  p_profile_id uuid,
  p_plan text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  if lower(p_plan) not in ('basic','pro','premium') then raise exception 'invalid plan'; end if;

  if lower(p_kind) = 'creator' then
    update public.creator_profiles
      set plan = lower(p_plan), updated_at = now()
      where id = p_profile_id;
  elsif lower(p_kind) = 'business' then
    update public.business_profiles
      set plan = lower(p_plan), updated_at = now()
      where id = p_profile_id;
  else
    raise exception 'invalid profile kind';
  end if;

  if not found then raise exception 'profile not found'; end if;
  return jsonb_build_object('ok',true,'kind',lower(p_kind),'profile_id',p_profile_id,'plan',lower(p_plan));
end;
$$;
revoke all on function public.admin_set_profile_plan(text,uuid,text) from public;
grant execute on function public.admin_set_profile_plan(text,uuid,text) to authenticated;

-- 3) Verify + assign the chosen plan atomically.
create or replace function public.admin_verify_with_plan(
  p_kind text,
  p_claim_id uuid,
  p_plan text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_id uuid;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  if lower(p_plan) not in ('basic','pro','premium') then raise exception 'invalid plan'; end if;

  if lower(p_kind) = 'creator' then
    select creator_profile_id into profile_id
      from public.creator_verification_claims where id = p_claim_id;
    if profile_id is null then raise exception 'creator verification request not found'; end if;
    if not public.creator_profile_complete(profile_id) then
      raise exception 'profile must be 100%% complete before verification';
    end if;
    update public.creator_verification_claims
      set identity_status='verified', account_status='verified',
          followers_status='verified', engagement_status='verified',
          status='verified', checked_at=now(), updated_at=now()
      where id=p_claim_id;
    update public.creator_profiles
      set verified=true, approved=true, plan=lower(p_plan), updated_at=now()
      where id=profile_id;
  elsif lower(p_kind) = 'business' then
    select business_profile_id into profile_id
      from public.business_verification_claims where id = p_claim_id;
    if profile_id is null then raise exception 'business verification request not found'; end if;
    if not public.business_profile_complete(profile_id) then
      raise exception 'profile must be 100%% complete before verification';
    end if;
    update public.business_verification_claims
      set registration_status='verified', license_status='verified',
          representative_status='verified', status='verified',
          checked_at=now(), updated_at=now()
      where id=p_claim_id;
    update public.business_profiles
      set verified=true, approved=true, plan=lower(p_plan), updated_at=now()
      where id=profile_id;
  else
    raise exception 'invalid profile kind';
  end if;

  return jsonb_build_object('ok',true,'kind',lower(p_kind),'claim_id',p_claim_id,
    'profile_id',profile_id,'plan',lower(p_plan),'verified',true);
end;
$$;
revoke all on function public.admin_verify_with_plan(text,uuid,text) from public;
grant execute on function public.admin_verify_with_plan(text,uuid,text) to authenticated;

-- 4) Verify button flips to Unverify and can be safely reversed.
create or replace function public.admin_unverify(
  p_kind text,
  p_claim_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_id uuid;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;

  if lower(p_kind) = 'creator' then
    select creator_profile_id into profile_id
      from public.creator_verification_claims where id=p_claim_id;
    if profile_id is null then raise exception 'creator verification request not found'; end if;
    update public.creator_verification_claims
      set identity_status='needs_recheck', account_status='needs_recheck',
          followers_status='needs_recheck', engagement_status='needs_recheck',
          status='needs_recheck', updated_at=now()
      where id=p_claim_id;
    update public.creator_profiles
      set verified=false, approved=false, updated_at=now()
      where id=profile_id;
  elsif lower(p_kind) = 'business' then
    select business_profile_id into profile_id
      from public.business_verification_claims where id=p_claim_id;
    if profile_id is null then raise exception 'business verification request not found'; end if;
    update public.business_verification_claims
      set registration_status='needs_recheck', license_status='needs_recheck',
          representative_status='needs_recheck', status='needs_recheck',
          updated_at=now()
      where id=p_claim_id;
    update public.business_profiles
      set verified=false, approved=false, updated_at=now()
      where id=profile_id;
  else
    raise exception 'invalid profile kind';
  end if;

  return jsonb_build_object('ok',true,'kind',lower(p_kind),'claim_id',p_claim_id,
    'profile_id',profile_id,'verified',false);
end;
$$;
revoke all on function public.admin_unverify(text,uuid) from public;
grant execute on function public.admin_unverify(text,uuid) to authenticated;

-- 5) Final compatibility + reversible admin actions.
-- Some earlier schema versions only allowed pending/verified/rejected on the
-- individual creator claim fields. The admin Unverify action uses needs_recheck,
-- so normalize those checks before using it.
alter table public.creator_verification_claims
  drop constraint if exists creator_verification_claims_identity_status_check,
  drop constraint if exists creator_verification_claims_account_status_check,
  drop constraint if exists creator_verification_claims_followers_status_check,
  drop constraint if exists creator_verification_claims_engagement_status_check,
  drop constraint if exists creator_verification_claims_status_check;

alter table public.creator_verification_claims
  add constraint creator_verification_claims_identity_status_check check (identity_status in ('not_submitted','pending','verified','rejected','needs_recheck')),
  add constraint creator_verification_claims_account_status_check check (account_status in ('not_submitted','pending','verified','rejected','needs_recheck')),
  add constraint creator_verification_claims_followers_status_check check (followers_status in ('not_submitted','pending','verified','rejected','needs_recheck')),
  add constraint creator_verification_claims_engagement_status_check check (engagement_status in ('not_submitted','pending','verified','rejected','needs_recheck')),
  add constraint creator_verification_claims_status_check check (status in ('pending','verified','rejected','needs_recheck','deleted'));

alter table public.business_verification_claims
  drop constraint if exists business_verification_claims_registration_status_check,
  drop constraint if exists business_verification_claims_license_status_check,
  drop constraint if exists business_verification_claims_representative_status_check,
  drop constraint if exists business_verification_claims_status_check;

alter table public.business_verification_claims
  add constraint business_verification_claims_registration_status_check check (registration_status in ('not_submitted','pending','verified','rejected','needs_recheck')),
  add constraint business_verification_claims_license_status_check check (license_status in ('not_submitted','pending','verified','rejected','needs_recheck')),
  add constraint business_verification_claims_representative_status_check check (representative_status in ('not_submitted','pending','verified','rejected','needs_recheck')),
  add constraint business_verification_claims_status_check check (status in ('pending','verified','rejected','needs_recheck','deleted'));

-- Reversible admin review controls:
-- approve -> unapprove, reject -> unreject, delete -> restore.
-- "Delete" in this admin queue is deliberately a reversible archive of the
-- verification request, not a permanent profile deletion.
create or replace function public.admin_review_verification(
  p_kind text,
  p_claim_id uuid,
  p_action text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_id uuid;
  action text := lower(trim(coalesce(p_action,'')));
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  if p_claim_id is null then raise exception 'claim id is required'; end if;

  if lower(p_kind) = 'creator' then
    select creator_profile_id into profile_id
      from public.creator_verification_claims where id=p_claim_id;
    if profile_id is null then raise exception 'creator verification request not found'; end if;

    if action='approve' then
      update public.creator_verification_claims
        set status='verified', checked_at=coalesce(checked_at,now()), updated_at=now()
        where id=p_claim_id and status <> 'deleted';
      update public.creator_profiles set approved=true, updated_at=now() where id=profile_id;
    elsif action in ('unapprove','un-approve') then
      update public.creator_profiles set approved=false, updated_at=now() where id=profile_id;
    elsif action='reject' then
      update public.creator_verification_claims
        set status='rejected', identity_status='rejected', account_status='rejected', followers_status='rejected', engagement_status='rejected', updated_at=now()
        where id=p_claim_id and status <> 'deleted';
      update public.creator_profiles set approved=false, verified=false, updated_at=now() where id=profile_id;
    elsif action in ('unreject','un-reject') then
      update public.creator_verification_claims
        set status='pending', identity_status='pending', account_status='pending', followers_status='pending', engagement_status='pending', updated_at=now()
        where id=p_claim_id and status='rejected';
    elsif action='delete' then
      update public.creator_verification_claims
        set status='deleted', updated_at=now()
        where id=p_claim_id;
      update public.creator_profiles set approved=false, verified=false, updated_at=now() where id=profile_id;
    elsif action='restore' then
      update public.creator_verification_claims
        set status='pending', identity_status='pending', account_status='pending', followers_status='pending', engagement_status='pending', updated_at=now()
        where id=p_claim_id and status='deleted';
    else
      raise exception 'invalid review action';
    end if;

  elsif lower(p_kind) = 'business' then
    select business_profile_id into profile_id
      from public.business_verification_claims where id=p_claim_id;
    if profile_id is null then raise exception 'business verification request not found'; end if;

    if action='approve' then
      update public.business_verification_claims
        set status='verified', checked_at=coalesce(checked_at,now()), updated_at=now()
        where id=p_claim_id and status <> 'deleted';
      update public.business_profiles set approved=true, updated_at=now() where id=profile_id;
    elsif action in ('unapprove','un-approve') then
      update public.business_profiles set approved=false, updated_at=now() where id=profile_id;
    elsif action='reject' then
      update public.business_verification_claims
        set status='rejected', registration_status='rejected', license_status='rejected', representative_status='rejected', updated_at=now()
        where id=p_claim_id and status <> 'deleted';
      update public.business_profiles set approved=false, verified=false, updated_at=now() where id=profile_id;
    elsif action in ('unreject','un-reject') then
      update public.business_verification_claims
        set status='pending', registration_status='pending', license_status='pending', representative_status='pending', updated_at=now()
        where id=p_claim_id and status='rejected';
    elsif action='delete' then
      update public.business_verification_claims
        set status='deleted', updated_at=now()
        where id=p_claim_id;
      update public.business_profiles set approved=false, verified=false, updated_at=now() where id=profile_id;
    elsif action='restore' then
      update public.business_verification_claims
        set status='pending', registration_status='pending', license_status='pending', representative_status='pending', updated_at=now()
        where id=p_claim_id and status='deleted';
    else
      raise exception 'invalid review action';
    end if;
  else
    raise exception 'invalid profile kind';
  end if;

  return jsonb_build_object('ok',true,'kind',lower(p_kind),'action',action,'profile_id',profile_id);
end;
$$;
revoke all on function public.admin_review_verification(text,uuid,text) from public;
grant execute on function public.admin_review_verification(text,uuid,text) to authenticated;
