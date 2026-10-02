-- Commissioner — automatic creator verification — 2026-09-30
-- Run AFTER 20260929_FOLLOWER_THRESHOLD_AND_CLAIM_TOKEN_FIX.sql. Idempotent.
--
-- WHAT THIS DOES
-- Lets the `auto-verify` Edge Function verify a creator with no admin step when
-- the SERVER has confirmed all of these itself (nothing here trusts numbers the
-- creator typed in):
--   1. the follower/subscriber count read from the platform is >= the live
--      threshold in platform_settings.creator_follower_threshold (15,000),
--   2. the creator's Commissioner ownership code (CMS-XXXXXX) is present in the
--      platform account's public description/bio,
--   3. the creator's Commissioner profile is 100% complete,
--   4. that platform account is not already verified for another profile.
-- Anything short of that leaves the request pending for a human reviewer.

alter table public.creator_verification_claims
  add column if not exists auto_verified boolean not null default false,
  add column if not exists auto_check_status text,
  add column if not exists auto_check_message text,
  add column if not exists auto_checked_at timestamptz,
  add column if not exists measured_followers bigint;

create or replace function public.service_auto_verify_creator(
  p_claim_id uuid,
  p_followers bigint,
  p_code_found boolean,
  p_channel_id text default null,
  p_handle text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.creator_verification_claims;
  threshold int;
  pid uuid;
  reason text;
  prev text;
begin
  -- Only the Edge Function (service role key) may call this. Never a browser.
  if auth.role() is distinct from 'service_role' then
    raise exception 'not authorized';
  end if;

  select * into c from public.creator_verification_claims where id = p_claim_id for update;
  if c.id is null then raise exception 'verification request not found'; end if;
  pid := c.creator_profile_id;
  prev := c.status;

  select coalesce(creator_follower_threshold, 15000) into threshold
    from public.platform_settings where id = true;
  threshold := coalesce(threshold, 15000);

  if c.status = 'verified' then
    return jsonb_build_object('status','verified','message','Already verified.','threshold',threshold);
  end if;

  -- Always store the measured (server-read) numbers next to the claim.
  update public.creator_verification_claims
     set measured_followers = p_followers,
         audience_count = coalesce(p_followers, audience_count),
         platform_account_id = coalesce(nullif(trim(p_channel_id),''), platform_account_id),
         claimed_username = coalesce(nullif(trim(p_handle),''), claimed_username),
         auto_checked_at = now()
   where id = p_claim_id;

  if not public.creator_profile_complete(pid) then
    reason := 'profile_incomplete';
  elsif p_followers is null then
    reason := 'followers_hidden';
  elsif p_followers < threshold then
    reason := 'below_threshold';
  elsif not coalesce(p_code_found, false) then
    reason := 'code_not_found';
  elsif exists (
    select 1 from public.creator_verification_claims o
     where o.id <> p_claim_id
       and o.status = 'verified'
       and lower(coalesce(o.platform,'')) = lower(coalesce(c.platform,''))
       and o.platform_account_id is not null
       and o.platform_account_id = nullif(trim(p_channel_id),'')
  ) then
    reason := 'account_already_verified';
  end if;

  if reason is not null then
    update public.creator_verification_claims
       set auto_check_status = reason,
           auto_check_message = case reason
             when 'profile_incomplete' then 'Complete your profile to 100% first.'
             when 'followers_hidden' then 'Your subscriber count is hidden. Make it public on your channel, then run the check again.'
             when 'below_threshold' then format('Your account has %s followers; verification needs %s or more.', p_followers, threshold)
             when 'code_not_found' then 'We could not find your ownership code in the channel description yet. Add it, save, wait a minute, then run the check again.'
             when 'account_already_verified' then 'This account is already verified for another Commissioner profile. An admin will review your request.'
             else reason end
     where id = p_claim_id;
    return jsonb_build_object('status','pending','reason',reason,'followers',p_followers,'threshold',threshold);
  end if;

  update public.creator_verification_claims
     set identity_status='verified', account_status='verified',
         followers_status='verified', engagement_status=coalesce(engagement_status,'unverified'),
         status='verified', eligibility_status='verified',
         auto_verified=true, auto_check_status='verified',
         auto_check_message=format('Verified automatically: %s followers and your ownership code were confirmed.', p_followers),
         checked_at=now(), verification_expires_at=now()+interval '180 days', updated_at=now()
   where id = p_claim_id;

  update public.creator_profiles
     set verified = true, approved = true, updated_at = now()
   where id = pid;

  insert into public.creator_verification_history(claim_id, action, previous_status, new_status, reviewer_id, note)
  values (p_claim_id, 'auto_verify', prev, 'verified', null,
          format('Automatic verification: %s followers read from the platform (threshold %s) and ownership code found.', p_followers, threshold));

  return jsonb_build_object('status','verified','followers',p_followers,'threshold',threshold);
end;
$$;

revoke all on function public.service_auto_verify_creator(uuid,bigint,boolean,text,text) from public, anon, authenticated;
grant execute on function public.service_auto_verify_creator(uuid,bigint,boolean,text,text) to service_role;
