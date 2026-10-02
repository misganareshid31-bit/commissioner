-- Commissioner verification policy update — 2026-09-24
-- Business verification does NOT check a license.
-- It checks business information and authorized representative information only.

-- Remove the old license field after replacing the functions that referenced it.
alter table if exists public.business_verification_claims
  drop constraint if exists business_verification_claims_license_status_check;

alter table if exists public.business_verification_claims
  drop column if exists license_status;

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
  complete boolean := false;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  if p_claim_id is null then raise exception 'claim id is required'; end if;

  if lower(p_kind) = 'creator' then
    select creator_profile_id into profile_id
    from public.creator_verification_claims where id=p_claim_id;
    if profile_id is null then raise exception 'creator verification request not found'; end if;

    if lower(p_action) = 'verify' then
      if not public.creator_profile_complete(profile_id) then raise exception 'profile must be 100%% complete before verification'; end if;
      update public.creator_verification_claims
      set identity_status='verified', account_status='verified', followers_status='verified',
          engagement_status='verified', status='verified', checked_at=now(), updated_at=now()
      where id=p_claim_id;
    elsif lower(p_action) = 'approve' then
      select public.creator_profile_complete(profile_id) into complete;
      if not complete then raise exception 'profile must be 100%% complete before approval'; end if;
      if not exists (select 1 from public.creator_verification_claims where id=p_claim_id and status='verified') then
        raise exception 'verification claims must be verified before approval';
      end if;
      update public.creator_profiles set approved=true, verified=true, updated_at=now() where id=profile_id;
    elsif lower(p_action) = 'reject' then
      update public.creator_verification_claims set status='rejected', updated_at=now() where id=p_claim_id;
      update public.creator_profiles set approved=false, verified=false, updated_at=now() where id=profile_id;
    else raise exception 'invalid review action'; end if;

  elsif lower(p_kind) = 'business' then
    select business_profile_id into profile_id
    from public.business_verification_claims where id=p_claim_id;
    if profile_id is null then raise exception 'business verification request not found'; end if;

    if lower(p_action) = 'verify' then
      if not public.business_profile_complete(profile_id) then raise exception 'profile must be 100%% complete before verification'; end if;
      update public.business_verification_claims
      set registration_status='verified', representative_status='verified',
          status='verified', checked_at=now(), updated_at=now()
      where id=p_claim_id;
    elsif lower(p_action) = 'approve' then
      select public.business_profile_complete(profile_id) into complete;
      if not complete then raise exception 'profile must be 100%% complete before approval'; end if;
      if not exists (select 1 from public.business_verification_claims where id=p_claim_id and status='verified') then
        raise exception 'verification claims must be verified before approval';
      end if;
      update public.business_profiles set approved=true, verified=true, updated_at=now() where id=profile_id;
    elsif lower(p_action) = 'reject' then
      update public.business_verification_claims set status='rejected', updated_at=now() where id=p_claim_id;
      update public.business_profiles set approved=false, verified=false, updated_at=now() where id=profile_id;
    else raise exception 'invalid review action'; end if;
  else
    raise exception 'invalid profile kind';
  end if;

  return jsonb_build_object('ok',true,'kind',lower(p_kind),'action',lower(p_action),'profile_id',profile_id);
end;
$$;

grant execute on function public.admin_review_verification(text,uuid,text) to authenticated;

-- Replace the public business verification summary so no license field is exposed.
drop function if exists public.get_business_verification_summary(uuid);
create or replace function public.get_business_verification_summary(p_business_profile_id uuid)
returns table(registration_status text, representative_status text, checked_at timestamptz)
language sql
security definer
set search_path=public
as $$
  select registration_status, representative_status, checked_at
  from public.business_verification_claims
  where business_profile_id=p_business_profile_id
    and status in ('pending','verified','needs_recheck')
  limit 1;
$$;

grant execute on function public.get_business_verification_summary(uuid) to anon, authenticated;
