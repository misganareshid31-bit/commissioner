-- Commissioner final admin verification controls.
-- Run this AFTER all earlier Commissioner migrations.
-- Adds exactly three admin-assigned plans: Basic, Pro, Premium.

-- Normalize legacy plan names so both identity types use the same three tiers.
update public.creator_profiles set plan='premium' where plan in ('elite','enterprise') and plan is not null;
update public.business_profiles set plan='premium' where plan in ('enterprise','elite') and plan is not null;
update public.business_profiles set plan='pro' where plan='growth';
update public.business_profiles set plan='basic' where plan='starter';
update public.creator_profiles set plan='basic' where plan is null or plan not in ('basic','pro','premium');
update public.business_profiles set plan='basic' where plan is null or plan not in ('basic','pro','premium');

alter table public.creator_profiles drop constraint if exists creator_profiles_plan_check;
alter table public.business_profiles drop constraint if exists business_profiles_plan_check;
alter table public.creator_profiles add constraint creator_profiles_plan_check check (plan in ('basic','pro','premium'));
alter table public.business_profiles add constraint business_profiles_plan_check check (plan in ('basic','pro','premium'));

-- Admin-only plan assignment. The trigger on the profile tables also protects
-- the field from ordinary authenticated users.
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
  if lower(p_kind)='creator' then
    update public.creator_profiles set plan=lower(p_plan), updated_at=now() where id=p_profile_id;
  elsif lower(p_kind)='business' then
    update public.business_profiles set plan=lower(p_plan), updated_at=now() where id=p_profile_id;
  else
    raise exception 'invalid profile kind';
  end if;
  if not found then raise exception 'profile not found'; end if;
  return jsonb_build_object('ok',true,'kind',lower(p_kind),'profile_id',p_profile_id,'plan',lower(p_plan));
end;
$$;
revoke all on function public.admin_set_profile_plan(text,uuid,text) from public;
grant execute on function public.admin_set_profile_plan(text,uuid,text) to authenticated;

-- Verify + assign plan in one transaction. This is the button's primary path.
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

  if lower(p_kind)='creator' then
    select creator_profile_id into profile_id from public.creator_verification_claims where id=p_claim_id;
    if profile_id is null then raise exception 'creator verification request not found'; end if;
    if not public.creator_profile_complete(profile_id) then raise exception 'profile must be 100%% complete before verification'; end if;
    update public.creator_verification_claims
      set identity_status='verified', account_status='verified', followers_status='verified',
          engagement_status='verified', status='verified', checked_at=now(), updated_at=now()
      where id=p_claim_id;
    update public.creator_profiles set verified=true, plan=lower(p_plan), updated_at=now() where id=profile_id;
  elsif lower(p_kind)='business' then
    select business_profile_id into profile_id from public.business_verification_claims where id=p_claim_id;
    if profile_id is null then raise exception 'business verification request not found'; end if;
    if not public.business_profile_complete(profile_id) then raise exception 'profile must be 100%% complete before verification'; end if;
    update public.business_verification_claims
      set registration_status='verified', license_status='verified', representative_status='verified',
          status='verified', checked_at=now(), updated_at=now()
      where id=p_claim_id;
    update public.business_profiles set verified=true, plan=lower(p_plan), updated_at=now() where id=profile_id;
  else
    raise exception 'invalid profile kind';
  end if;

  return jsonb_build_object('ok',true,'kind',lower(p_kind),'claim_id',p_claim_id,'profile_id',profile_id,'plan',lower(p_plan),'verified',true);
end;
$$;
revoke all on function public.admin_verify_with_plan(text,uuid,text) from public;
grant execute on function public.admin_verify_with_plan(text,uuid,text) to authenticated;

-- Reverses verification safely. The profile is also removed from the approved
-- launch population so an accidental verification can be fully undone.
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
  if lower(p_kind)='creator' then
    select creator_profile_id into profile_id from public.creator_verification_claims where id=p_claim_id;
    if profile_id is null then raise exception 'creator verification request not found'; end if;
    update public.creator_verification_claims
      set identity_status='needs_recheck', account_status='needs_recheck', followers_status='needs_recheck',
          engagement_status='needs_recheck', status='needs_recheck', updated_at=now()
      where id=p_claim_id;
    update public.creator_profiles set verified=false, approved=false, updated_at=now() where id=profile_id;
  elsif lower(p_kind)='business' then
    select business_profile_id into profile_id from public.business_verification_claims where id=p_claim_id;
    if profile_id is null then raise exception 'business verification request not found'; end if;
    update public.business_verification_claims
      set registration_status='needs_recheck', license_status='needs_recheck', representative_status='needs_recheck',
          status='needs_recheck', updated_at=now()
      where id=p_claim_id;
    update public.business_profiles set verified=false, approved=false, updated_at=now() where id=profile_id;
  else
    raise exception 'invalid profile kind';
  end if;
  return jsonb_build_object('ok',true,'kind',lower(p_kind),'claim_id',p_claim_id,'profile_id',profile_id,'verified',false);
end;
$$;
revoke all on function public.admin_unverify(text,uuid) from public;
grant execute on function public.admin_unverify(text,uuid) to authenticated;
