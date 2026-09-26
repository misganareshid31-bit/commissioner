-- ============================================================================
-- COMMISSIONER REMAINING BUILD + PRODUCTION HARDENING
-- 2026-09-26
-- Run AFTER the existing Commissioner migrations.
--
-- Idempotent forward migration. It adds only missing production-hardening
-- structures and keeps OAuth credentials/tokens outside the client database.
-- ============================================================================

-- 1. Creator verification production metadata --------------------------------

alter table if exists public.creator_verification_claims
  add column if not exists platform text,
  add column if not exists platform_account_id text,
  add column if not exists claimed_username text,
  add column if not exists audience_count bigint,
  add column if not exists engagement_rate numeric,
  add column if not exists ownership_method text,
  add column if not exists eligibility_status text default 'not_eligible',
  add column if not exists verification_source text default 'manual',
  add column if not exists verification_expires_at timestamptz;

alter table if exists public.creator_verification_claims
  drop constraint if exists creator_verification_claims_ownership_method_check;
alter table if exists public.creator_verification_claims
  add constraint creator_verification_claims_ownership_method_check
  check (ownership_method is null or ownership_method in ('oauth','code','bio','manual'));

alter table if exists public.creator_verification_claims
  drop constraint if exists creator_verification_claims_eligibility_status_check;
alter table if exists public.creator_verification_claims
  add constraint creator_verification_claims_eligibility_status_check
  check (eligibility_status is null or eligibility_status in ('not_eligible','eligible','pending_review','verified','rejected'));

-- A separate history table prevents admin changes from erasing the audit trail.
create table if not exists public.creator_verification_history (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.creator_verification_claims(id) on delete cascade,
  action text not null,
  previous_status text,
  new_status text,
  reviewer_id uuid references auth.users(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);
alter table public.creator_verification_history enable row level security;
drop policy if exists "Creator verification history admin only" on public.creator_verification_history;
create policy "Creator verification history admin only"
on public.creator_verification_history for all
using (public.is_admin())
with check (public.is_admin());

create table if not exists public.business_verification_history (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.business_verification_claims(id) on delete cascade,
  action text not null,
  previous_status text,
  new_status text,
  reviewer_id uuid references auth.users(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);
alter table public.business_verification_history enable row level security;
drop policy if exists "Business verification history admin only" on public.business_verification_history;
create policy "Business verification history admin only"
on public.business_verification_history for all
using (public.is_admin())
with check (public.is_admin());

-- OAuth connection metadata only. Tokens/secrets belong in a server-side secret
-- store/Edge Function and are never exposed to the React client.
create table if not exists public.social_oauth_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('instagram','tiktok','youtube')),
  provider_account_id text not null,
  username text,
  scopes text[] default '{}',
  connected_at timestamptz not null default now(),
  expires_at timestamptz,
  last_checked_at timestamptz,
  status text not null default 'connected' check (status in ('connected','expired','revoked','error')),
  unique (user_id, provider)
);
alter table public.social_oauth_connections enable row level security;
drop policy if exists "Users view own social connections" on public.social_oauth_connections;
create policy "Users view own social connections"
on public.social_oauth_connections for select to authenticated
using (user_id = auth.uid());
drop policy if exists "Users cannot write social connections from client" on public.social_oauth_connections;
create policy "Users cannot write social connections from client"
on public.social_oauth_connections for all to authenticated
using (false) with check (false);
drop policy if exists "Admins manage social connections" on public.social_oauth_connections;
create policy "Admins manage social connections"
on public.social_oauth_connections for all to authenticated
using (public.is_admin()) with check (public.is_admin());

-- 2. Safe 50K eligibility evaluation -----------------------------------------

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
begin
  if not public.is_admin() and not exists (
    select 1 from public.creator_profiles
    where id = p_creator_profile_id and auth_user_id = auth.uid()
  ) then
    raise exception 'not authorized';
  end if;

  select * into claim
  from public.creator_verification_claims
  where creator_profile_id = p_creator_profile_id;

  if claim.id is null then
    return jsonb_build_object('eligible',false,'reason','verification request not submitted');
  end if;

  audience := greatest(coalesce(claim.audience_count,0),0);
  eligible := audience >= 50000;

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
    'threshold', 50000,
    'ownership_method', claim.ownership_method,
    'verification_source', coalesce(claim.verification_source,'manual')
  );
end;
$$;
revoke all on function public.evaluate_creator_50k_eligibility(uuid) from public;
grant execute on function public.evaluate_creator_50k_eligibility(uuid) to authenticated;

-- 3. Business verification evidence metadata ---------------------------------

alter table if exists public.business_verification_claims
  add column if not exists legal_business_name text,
  add column if not exists trade_name text,
  add column if not exists registration_reference text,
  add column if not exists trade_license_reference text,
  add column if not exists tin_reference text,
  add column if not exists business_activity text,
  add column if not exists representative_name text,
  add column if not exists official_contact text,
  add column if not exists official_website text,
  add column if not exists evidence_storage_path text;

-- evidence_storage_path is metadata only; the referenced object must live in a
-- private storage bucket protected by Storage RLS.

-- 4. Promotions ---------------------------------------------------------------

create table if not exists public.promotions (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 1 and 140),
  description text default '',
  placement text not null default 'explore'
    check (placement in ('home','explore','marketplace','campaigns')),
  start_at timestamptz,
  end_at timestamptz,
  active boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_at is null or start_at is null or end_at > start_at)
);
alter table public.promotions enable row level security;
drop policy if exists "Public sees active scheduled promotions" on public.promotions;
create policy "Public sees active scheduled promotions"
on public.promotions for select
using (
  active = true
  and (start_at is null or start_at <= now())
  and (end_at is null or end_at > now())
);
drop policy if exists "Admins manage promotions" on public.promotions;
create policy "Admins manage promotions"
on public.promotions for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create or replace function public.admin_create_promotion(
  p_title text,
  p_description text default '',
  p_placement text default 'explore',
  p_start_at timestamptz default null,
  p_end_at timestamptz default null
) returns uuid
language plpgsql security definer set search_path=public
as $$
declare v_id uuid;
begin
  if not public.is_admin() then raise exception 'admin access required'; end if;
  insert into public.promotions(title,description,placement,start_at,end_at,created_by)
  values(trim(p_title),coalesce(p_description,''),p_placement,p_start_at,p_end_at,auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;
grant execute on function public.admin_create_promotion(text,text,text,timestamptz,timestamptz) to authenticated;

create or replace function public.admin_list_promotions()
returns setof public.promotions
language sql security definer set search_path=public
as $$
  select * from public.promotions
  where public.is_admin()
  order by created_at desc
$$;
grant execute on function public.admin_list_promotions() to authenticated;

create or replace function public.admin_set_promotion_active(p_promotion_id uuid, p_active boolean)
returns boolean
language plpgsql security definer set search_path=public
as $$
begin
  if not public.is_admin() then raise exception 'admin access required'; end if;
  update public.promotions set active=p_active, updated_at=now() where id=p_promotion_id;
  return found;
end;
$$;
grant execute on function public.admin_set_promotion_active(uuid,boolean) to authenticated;

-- 5. Explicit launch gates ----------------------------------------------------

create or replace function public.commissioner_feature_gates()
returns jsonb
language plpgsql stable security definer set search_path=public
as $$
declare
  creator_count bigint := 0;
  business_count bigint := 0;
  marketplace_count bigint := 0;
  product_count bigint := 0;
begin
  select count(*) into creator_count from public.creator_profiles where onboarded=true;
  select count(*) into business_count from public.business_profiles where onboarded=true;

  if to_regclass('public.marketplace_listings') is not null then
    execute 'select count(*) from public.marketplace_listings where active=true' into marketplace_count;
  end if;
  if to_regclass('public.creator_products') is not null then
    execute 'select count(*) from public.creator_products where active=true' into product_count;
  end if;

  return jsonb_build_object(
    'promotions_unlocked', creator_count >= 50 and business_count >= 25,
    'b2b_unlocked', business_count >= 50,
    'marketplace_unlocked', (marketplace_count + product_count) >= 5
  );
end;
$$;
grant execute on function public.commissioner_feature_gates() to anon, authenticated;

-- 6. Admin verification action audit -----------------------------------------

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
  old_status text;
  new_status text;
begin
  if not public.is_admin() then raise exception 'admin access required'; end if;

  if lower(p_kind) = 'creator' then
    select creator_profile_id, status into profile_id, old_status
    from public.creator_verification_claims where id=p_claim_id for update;
    if profile_id is null then raise exception 'verification request not found'; end if;

    if lower(p_action)='verify' then
      update public.creator_verification_claims
      set status='verified', identity_status='verified', account_status='verified',
          followers_status='verified', engagement_status='verified', checked_at=now(),
          verification_expires_at=now()+interval '180 days', updated_at=now()
      where id=p_claim_id;
      update public.creator_profiles set verified=true, updated_at=now() where id=profile_id;
      new_status='verified';
    elsif lower(p_action)='approve' then
      if not exists (select 1 from public.creator_verification_claims where id=p_claim_id and status='verified') then
        raise exception 'verification claims must be verified before approval';
      end if;
      update public.creator_profiles set approved=true, verified=true, updated_at=now() where id=profile_id;
      new_status='verified';
    elsif lower(p_action)='unapprove' then
      update public.creator_profiles set approved=false, updated_at=now() where id=profile_id;
      new_status=old_status;
    elsif lower(p_action)='reject' then
      update public.creator_verification_claims set status='rejected', updated_at=now() where id=p_claim_id;
      update public.creator_profiles set approved=false, verified=false, updated_at=now() where id=profile_id;
      new_status='rejected';
    elsif lower(p_action)='unreject' then
      update public.creator_verification_claims set status='pending', updated_at=now() where id=p_claim_id;
      new_status='pending';
    elsif lower(p_action)='needs_recheck' then
      update public.creator_verification_claims set status='needs_recheck', updated_at=now() where id=p_claim_id;
      new_status='needs_recheck';
    else raise exception 'invalid review action'; end if;

    insert into public.creator_verification_history(claim_id,action,previous_status,new_status,reviewer_id)
    values(p_claim_id,lower(p_action),old_status,new_status,auth.uid());

  elsif lower(p_kind)='business' then
    select business_profile_id, status into profile_id, old_status
    from public.business_verification_claims where id=p_claim_id for update;
    if profile_id is null then raise exception 'verification request not found'; end if;

    if lower(p_action)='verify' then
      update public.business_verification_claims
      set status='verified', registration_status='verified', representative_status='verified',
          checked_at=now(), expires_at=now()+interval '365 days', updated_at=now()
      where id=p_claim_id;
      update public.business_profiles set verified=true, updated_at=now() where id=profile_id;
      new_status='verified';
    elsif lower(p_action)='approve' then
      if not exists (select 1 from public.business_verification_claims where id=p_claim_id and status='verified') then
        raise exception 'verification claims must be verified before approval';
      end if;
      update public.business_profiles set approved=true, verified=true, updated_at=now() where id=profile_id;
      new_status='verified';
    elsif lower(p_action)='unapprove' then
      update public.business_profiles set approved=false, updated_at=now() where id=profile_id;
      new_status=old_status;
    elsif lower(p_action)='reject' then
      update public.business_verification_claims set status='rejected', updated_at=now() where id=p_claim_id;
      update public.business_profiles set approved=false, verified=false, updated_at=now() where id=profile_id;
      new_status='rejected';
    elsif lower(p_action)='unreject' then
      update public.business_verification_claims set status='pending', updated_at=now() where id=p_claim_id;
      new_status='pending';
    elsif lower(p_action)='needs_recheck' then
      update public.business_verification_claims set status='needs_recheck', updated_at=now() where id=p_claim_id;
      new_status='needs_recheck';
    else raise exception 'invalid review action'; end if;
  else
    raise exception 'invalid profile kind';
  end if;

  if lower(p_kind)='business' then
    insert into public.business_verification_history(claim_id,action,previous_status,new_status,reviewer_id)
    values(p_claim_id,lower(p_action),old_status,new_status,auth.uid());
  end if;

  return jsonb_build_object('ok',true,'profile_id',profile_id,'status',new_status);
end;
$$;
grant execute on function public.admin_review_verification(text,uuid,text) to authenticated;

-- 7. Public business verification wording helper -----------------------------

drop function if exists public.get_business_verification_summary(uuid);

create or replace function public.get_business_verification_summary(p_business_profile_id uuid)
returns table(
  registration_status text,
  representative_status text,
  checked_at timestamptz,
  public_label text
)
language sql security definer set search_path=public
as $$
  select registration_status, representative_status, checked_at,
    'Business verified by Commissioner'::text
  from public.business_verification_claims
  where business_profile_id=p_business_profile_id
    and status='verified'
  limit 1;
$$;
grant execute on function public.get_business_verification_summary(uuid) to anon, authenticated;

-- 8. Automatic timestamps -----------------------------------------------------

drop trigger if exists touch_promotions on public.promotions;
create trigger touch_promotions before update on public.promotions
for each row execute procedure public.touch_commissioner_updated_at();

-- End. OAuth callback/Edge Function deployment remains environment-specific:
-- configure provider client IDs/secrets in Supabase/Vercel secrets, never in
-- the React bundle. If a provider is not configured, UI must offer manual review.

-- 9. Lock verification evidence behind owner/admin access ---------------------
-- Public users must use the summary RPC; they must not SELECT the claim row,
-- because that row contains private evidence metadata and admin notes.
drop policy if exists "Public can view creator verification summary" on public.creator_verification_claims;
drop policy if exists "Public can view business verification summary" on public.business_verification_claims;

drop policy if exists "Admin manages creator verification claims" on public.creator_verification_claims;
create policy "Admin manages creator verification claims"
on public.creator_verification_claims for all to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admin manages business verification claims" on public.business_verification_claims;
create policy "Admin manages business verification claims"
on public.business_verification_claims for all to authenticated
using (public.is_admin()) with check (public.is_admin());

-- Owner policies remain intentionally private: owners can manage their own
-- request/evidence, while normal public visitors cannot query the row.

-- 10. Expired verification becomes re-checkable without changing visibility.
create or replace function public.refresh_expired_verification(p_kind text, p_claim_id uuid)
returns boolean
language plpgsql security definer set search_path=public
as $$
declare changed boolean := false;
begin
  if not public.is_admin() then raise exception 'admin access required'; end if;
  if lower(p_kind)='creator' then
    update public.creator_verification_claims
      set status='needs_recheck', eligibility_status=case when coalesce(audience_count,0) >= 50000 then 'pending_review' else 'not_eligible' end,
          updated_at=now()
    where id=p_claim_id and status='verified'
      and verification_expires_at is not null and verification_expires_at <= now();
    changed := found;
  elsif lower(p_kind)='business' then
    update public.business_verification_claims
      set status='needs_recheck', updated_at=now()
    where id=p_claim_id and status='verified'
      and expires_at is not null and expires_at <= now();
    changed := found;
  end if;
  return changed;
end;
$$;
grant execute on function public.refresh_expired_verification(text,uuid) to authenticated;

-- 11. Populate eligibility metadata from the creator's existing profile data.
-- This is intentionally an eligibility calculation, not automatic verification.
create or replace function public.commissioner_parse_audience(p_value text)
returns bigint
language plpgsql immutable
as $$
declare
  s text := upper(trim(coalesce(p_value,'')));
  n numeric;
begin
  if s = '' then return 0; end if;
  s := replace(s, ',', '');
  begin
    if right(s,1)='K' then n := regexp_replace(left(s,length(s)-1),'[^0-9.]','','g')::numeric * 1000;
    elsif right(s,1)='M' then n := regexp_replace(left(s,length(s)-1),'[^0-9.]','','g')::numeric * 1000000;
    elsif right(s,1)='B' then n := regexp_replace(left(s,length(s)-1),'[^0-9.]','','g')::numeric * 1000000000;
    else n := regexp_replace(s,'[^0-9.]','','g')::numeric;
    end if;
  exception when others then return 0; end;
  return greatest(coalesce(round(n),0)::bigint,0);
end;
$$;

create or replace function public.submit_creator_verification(
  p_creator_profile_id uuid,
  p_evidence_note text default ''
) returns uuid
language plpgsql security definer set search_path=public
as $$
declare
  v_id uuid;
  p jsonb;
  first_key text;
  first_value jsonb;
  audience_text text;
  audience_count bigint;
begin
  if not exists(select 1 from public.creator_profiles where id=p_creator_profile_id and auth_user_id=auth.uid()) then
    raise exception 'not authorized';
  end if;

  select platforms into p from public.creator_profiles where id=p_creator_profile_id;
  select key, value into first_key, first_value from jsonb_each(coalesce(p,'{}'::jsonb)) limit 1;
  audience_text := coalesce(first_value->>'followers', first_value->>'subscribers', '0');
  audience_count := public.commissioner_parse_audience(audience_text);

  insert into public.creator_verification_claims(
    creator_profile_id,evidence_note,status,platform,claimed_username,audience_count,
    ownership_method,verification_source,eligibility_status
  ) values (
    p_creator_profile_id,trim(coalesce(p_evidence_note,'')),'pending',
    nullif(first_key,''), nullif(first_value->>'handle',''), audience_count,
    'manual','manual',case when audience_count >= 50000 then 'pending_review' else 'not_eligible' end
  )
  on conflict (creator_profile_id) do update set
    evidence_note=excluded.evidence_note,
    platform=coalesce(excluded.platform,public.creator_verification_claims.platform),
    claimed_username=coalesce(excluded.claimed_username,public.creator_verification_claims.claimed_username),
    audience_count=excluded.audience_count,
    ownership_method=coalesce(public.creator_verification_claims.ownership_method,'manual'),
    verification_source=coalesce(public.creator_verification_claims.verification_source,'manual'),
    eligibility_status=case when excluded.audience_count >= 50000 then 'pending_review' else 'not_eligible' end,
    status='pending', updated_at=now()
  returning id into v_id;
  return v_id;
end;
$$;
grant execute on function public.submit_creator_verification(uuid,text) to authenticated;
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
