-- Commissioner final verification/admin repair.
-- Run this AFTER the existing Commissioner migrations, especially
-- 20260911_ADMIN_VERIFICATION_PLAN_FINAL.sql.
-- Fixes the account_status check error and makes Approve/Reject/Delete reversible.

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

create or replace function public.admin_review_verification(p_kind text,p_claim_id uuid,p_action text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare profile_id uuid; action text:=lower(trim(coalesce(p_action,'')));
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  if p_claim_id is null then raise exception 'claim id is required'; end if;
  if lower(p_kind)='creator' then
    select creator_profile_id into profile_id from public.creator_verification_claims where id=p_claim_id;
    if profile_id is null then raise exception 'creator verification request not found'; end if;
    if action='approve' then
      update public.creator_verification_claims set status='verified',checked_at=coalesce(checked_at,now()),updated_at=now() where id=p_claim_id and status<>'deleted';
      update public.creator_profiles set approved=true,updated_at=now() where id=profile_id;
    elsif action in ('unapprove','un-approve') then
      update public.creator_profiles set approved=false,updated_at=now() where id=profile_id;
    elsif action='reject' then
      update public.creator_verification_claims set status='rejected',identity_status='rejected',account_status='rejected',followers_status='rejected',engagement_status='rejected',updated_at=now() where id=p_claim_id and status<>'deleted';
      update public.creator_profiles set approved=false,verified=false,updated_at=now() where id=profile_id;
    elsif action in ('unreject','un-reject') then
      update public.creator_verification_claims set status='pending',identity_status='pending',account_status='pending',followers_status='pending',engagement_status='pending',updated_at=now() where id=p_claim_id and status='rejected';
    elsif action='delete' then
      update public.creator_verification_claims set status='deleted',updated_at=now() where id=p_claim_id;
      update public.creator_profiles set approved=false,verified=false,updated_at=now() where id=profile_id;
    elsif action='restore' then
      update public.creator_verification_claims set status='pending',identity_status='pending',account_status='pending',followers_status='pending',engagement_status='pending',updated_at=now() where id=p_claim_id and status='deleted';
    else raise exception 'invalid review action'; end if;
  elsif lower(p_kind)='business' then
    select business_profile_id into profile_id from public.business_verification_claims where id=p_claim_id;
    if profile_id is null then raise exception 'business verification request not found'; end if;
    if action='approve' then
      update public.business_verification_claims set status='verified',checked_at=coalesce(checked_at,now()),updated_at=now() where id=p_claim_id and status<>'deleted';
      update public.business_profiles set approved=true,updated_at=now() where id=profile_id;
    elsif action in ('unapprove','un-approve') then
      update public.business_profiles set approved=false,updated_at=now() where id=profile_id;
    elsif action='reject' then
      update public.business_verification_claims set status='rejected',registration_status='rejected',license_status='rejected',representative_status='rejected',updated_at=now() where id=p_claim_id and status<>'deleted';
      update public.business_profiles set approved=false,verified=false,updated_at=now() where id=profile_id;
    elsif action in ('unreject','un-reject') then
      update public.business_verification_claims set status='pending',registration_status='pending',license_status='pending',representative_status='pending',updated_at=now() where id=p_claim_id and status='rejected';
    elsif action='delete' then
      update public.business_verification_claims set status='deleted',updated_at=now() where id=p_claim_id;
      update public.business_profiles set approved=false,verified=false,updated_at=now() where id=profile_id;
    elsif action='restore' then
      update public.business_verification_claims set status='pending',registration_status='pending',license_status='pending',representative_status='pending',updated_at=now() where id=p_claim_id and status='deleted';
    else raise exception 'invalid review action'; end if;
  else raise exception 'invalid profile kind'; end if;
  return jsonb_build_object('ok',true,'kind',lower(p_kind),'action',action,'profile_id',profile_id);
end; $$;
revoke all on function public.admin_review_verification(text,uuid,text) from public;
grant execute on function public.admin_review_verification(text,uuid,text) to authenticated;
