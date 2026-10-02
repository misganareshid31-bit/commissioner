-- Commissioner — Master Prompt Final Hardening
-- Date: 2026-10-01
-- Apply AFTER the existing Commissioner migrations.
-- Idempotent where practical. This migration aligns the live schema with the
-- current product specification without deleting existing production data.

begin;

-- -------------------------------------------------------------------------
-- 1. Dedicated verification configuration
-- -------------------------------------------------------------------------
create table if not exists public.verification_settings (
  id boolean primary key default true,
  youtube_subscriber_threshold integer not null default 1000,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  constraint verification_settings_single_row check (id = true),
  constraint verification_settings_youtube_nonnegative check (youtube_subscriber_threshold >= 0)
);

insert into public.verification_settings(id, youtube_subscriber_threshold)
values (true, 1000)
on conflict (id) do update
set youtube_subscriber_threshold = 1000,
    updated_at = now();

alter table public.verification_settings enable row level security;
drop policy if exists "Anyone can read verification settings" on public.verification_settings;
create policy "Anyone can read verification settings"
  on public.verification_settings for select using (true);

create or replace function public.admin_set_youtube_threshold(p_threshold integer)
returns jsonb
language plpgsql security definer set search_path=public
as $$
begin
  if not public.is_admin() then raise exception 'admin access required'; end if;
  if p_threshold < 0 then raise exception 'threshold must be zero or greater'; end if;
  update public.verification_settings
    set youtube_subscriber_threshold=p_threshold, updated_at=now(), updated_by=auth.uid()
  where id=true;
  return jsonb_build_object('ok',true,'youtube_subscriber_threshold',p_threshold);
end;
$$;
revoke all on function public.admin_set_youtube_threshold(integer) from public;
grant execute on function public.admin_set_youtube_threshold(integer) to authenticated;

-- -------------------------------------------------------------------------
-- 2. Creator YouTube eligibility: 1,000 subscribers by default.
-- -------------------------------------------------------------------------
create or replace function public.evaluate_creator_youtube_eligibility(p_creator_profile_id uuid)
returns jsonb
language plpgsql stable security definer set search_path=public
as $$
declare
  threshold integer;
  subscribers numeric := 0;
  platform_row jsonb;
  youtube_row jsonb;
begin
  select youtube_subscriber_threshold into threshold
  from public.verification_settings where id=true;
  threshold := coalesce(threshold,1000);

  select platforms into platform_row
  from public.creator_profiles where id=p_creator_profile_id;

  if jsonb_typeof(platform_row)='object' then
    youtube_row := platform_row -> 'YouTube';
    if youtube_row is null then youtube_row := platform_row -> 'youtube'; end if;
    if youtube_row is not null then
      subscribers := coalesce(nullif(regexp_replace(coalesce(youtube_row->>'followers',''),'[^0-9.]','','g'),'')::numeric,0);
    end if;
  end if;

  return jsonb_build_object(
    'eligible', subscribers >= threshold,
    'threshold', threshold,
    'subscriber_count', subscribers,
    'platform', 'YouTube'
  );
exception when others then
  return jsonb_build_object('eligible',false,'threshold',threshold,'subscriber_count',0,'platform','YouTube');
end;
$$;
revoke all on function public.evaluate_creator_youtube_eligibility(uuid) from public;
grant execute on function public.evaluate_creator_youtube_eligibility(uuid) to authenticated;

-- -------------------------------------------------------------------------
-- 3. Public visibility: completed profiles, not approved profiles.
-- -------------------------------------------------------------------------
drop policy if exists "Public can view approved creator profiles" on public.creator_profiles;
drop policy if exists "Public can view published creator profiles" on public.creator_profiles;
drop policy if exists "Public can view registered creator profiles" on public.creator_profiles;
drop policy if exists "Public can view completed creator profiles" on public.creator_profiles;
create policy "Public can view completed creator profiles"
  on public.creator_profiles for select
  using (auth_user_id is not null and onboarded = true);

drop policy if exists "Public can view approved business profiles" on public.business_profiles;
drop policy if exists "Public can view published business profiles" on public.business_profiles;
drop policy if exists "Public can view registered business profiles" on public.business_profiles;
drop policy if exists "Public can view completed business profiles" on public.business_profiles;
create policy "Public can view completed business profiles"
  on public.business_profiles for select
  using (auth_user_id is not null and onboarded = true);

create or replace view public.creator_profiles_ranked
with (security_invoker=true) as
select cp.*,
  case
    when cp.plan = 'premium' and (cp.plan_expires_at is null or cp.plan_expires_at > now()) then 2
    when cp.plan = 'pro' and (cp.plan_expires_at is null or cp.plan_expires_at > now()) then 1
    else 0
  end as effective_plan_rank
from public.creator_profiles cp;
grant select on public.creator_profiles_ranked to anon, authenticated;

create or replace view public.business_profiles_ranked
with (security_invoker=true) as
select bp.*,
  case
    when bp.plan = 'premium' and (bp.plan_expires_at is null or bp.plan_expires_at > now()) then 2
    when bp.plan = 'pro' and (bp.plan_expires_at is null or bp.plan_expires_at > now()) then 1
    else 0
  end as effective_plan_rank
from public.business_profiles bp;
grant select on public.business_profiles_ranked to anon, authenticated;

-- Marketplace visibility follows the same completed-profile rule.
drop policy if exists "Public can view active marketplace listings" on public.marketplace_listings;
create policy "Public can view active marketplace listings"
  on public.marketplace_listings for select
  using (
    active=true and (
      (owner_type='creator' and exists(select 1 from public.creator_profiles p where p.id=owner_id and p.auth_user_id is not null and p.onboarded=true))
      or
      (owner_type='business' and exists(select 1 from public.business_profiles p where p.id=owner_id and p.auth_user_id is not null and p.onboarded=true))
    )
  );

drop policy if exists "Public can view active creator products" on public.creator_products;
create policy "Public can view active creator products"
  on public.creator_products for select
  using (active=true and exists(select 1 from public.creator_profiles p where p.id=creator_profile_id and p.auth_user_id is not null and p.onboarded=true));

-- -------------------------------------------------------------------------
-- 4. Feature gates: real registered profiles, exact product thresholds.
-- -------------------------------------------------------------------------
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
  select count(*) into creator_count from public.creator_profiles where auth_user_id is not null and onboarded=true;
  select count(*) into business_count from public.business_profiles where auth_user_id is not null and onboarded=true;

  if to_regclass('public.marketplace_listings') is not null then
    execute 'select count(*) from public.marketplace_listings where active=true' into marketplace_count;
  end if;
  if to_regclass('public.creator_products') is not null then
    execute 'select count(*) from public.creator_products where active=true' into product_count;
  end if;

  return jsonb_build_object(
    'promotions_unlocked', creator_count >= 50 and business_count >= 25,
    'b2b_unlocked', business_count >= 50,
    'marketplace_unlocked', (marketplace_count + product_count) >= 5,
    'creator_count', creator_count,
    'business_count', business_count,
    'marketplace_count', marketplace_count + product_count
  );
end;
$$;
revoke all on function public.commissioner_feature_gates() from public;
grant execute on function public.commissioner_feature_gates() to anon, authenticated;

-- Existing network thresholds remain in platform_settings and are not overwritten.
-- Public visibility and the explicit B2B/Promotion/Marketplace feature gates are separate.
create or replace function public.commissioner_launch_stats()
returns jsonb
language sql stable security definer set search_path=public
as $$
  select jsonb_build_object(
    'creator_threshold', s.network_creator_threshold,
    'business_threshold', s.network_business_threshold,
    'threshold', s.network_creator_threshold,
    'creator_count', (select count(*) from public.creator_profiles where auth_user_id is not null and onboarded=true and verified=true),
    'business_count', (select count(*) from public.business_profiles where auth_user_id is not null and onboarded=true and verified=true)
  )
  from public.platform_settings s where s.id=true;
$$;
revoke all on function public.commissioner_launch_stats() from public;
grant execute on function public.commissioner_launch_stats() to anon, authenticated;

-- -------------------------------------------------------------------------
-- 5. NFC customization fields.
-- -------------------------------------------------------------------------
alter table public.creator_profiles add column if not exists nfc_display_settings jsonb not null default '{}'::jsonb;
alter table public.business_profiles add column if not exists nfc_display_settings jsonb not null default '{}'::jsonb;

create or replace function public.update_my_nfc_display_settings(p_kind text, p_settings jsonb)
returns jsonb
language plpgsql security definer set search_path=public
as $$
declare
  cleaned jsonb := coalesce(p_settings,'{}'::jsonb);
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if jsonb_typeof(cleaned) <> 'object' then raise exception 'invalid NFC display settings'; end if;
  if lower(p_kind)='creator' then
    update public.creator_profiles set nfc_display_settings=cleaned, updated_at=now() where auth_user_id=auth.uid();
  elsif lower(p_kind)='business' then
    update public.business_profiles set nfc_display_settings=cleaned, updated_at=now() where auth_user_id=auth.uid();
  else raise exception 'invalid profile kind'; end if;
  if not found then raise exception 'profile not found'; end if;
  return cleaned;
end;
$$;
revoke all on function public.update_my_nfc_display_settings(text,jsonb) from public;
grant execute on function public.update_my_nfc_display_settings(text,jsonb) to authenticated;

create or replace function public.get_nfc_card_public(p_card_id uuid)
returns jsonb
language plpgsql security definer set search_path=public
as $$
declare c record; p record; kind text;
begin
  select * into c from public.nfc_cards where id=p_card_id and status in ('assigned','active') limit 1;
  if not found then return null; end if;
  if c.creator_id is not null then
    kind := 'creator';
    select * into p from public.creator_profiles where id=c.creator_id;
    if not found then return null; end if;
    return jsonb_build_object('kind',kind,'status',case when p.auth_user_id is not null and p.onboarded then 'published' else 'claimable' end,'id',p.id,'claim_token',p.claim_token,'nfc_display_settings',p.nfc_display_settings);
  elsif c.business_id is not null then
    kind := 'business';
    select * into p from public.business_profiles where id=c.business_id;
    if not found then return null; end if;
    return jsonb_build_object('kind',kind,'status',case when p.auth_user_id is not null and p.onboarded then 'published' else 'claimable' end,'id',p.id,'claim_token',p.claim_token,'nfc_display_settings',p.nfc_display_settings);
  end if;
  return jsonb_build_object('kind',null,'status','unassigned');
end;
$$;
revoke all on function public.get_nfc_card_public(uuid) from public;
grant execute on function public.get_nfc_card_public(uuid) to anon, authenticated;

-- Public NFC resolver: onboarded is the publication condition; verification is separate.
create or replace function public.get_claim_any(p_token text)
returns jsonb
language plpgsql security definer set search_path=public
as $$
declare r record;
begin
  select 'creator'::text as kind, cp.* into r from public.creator_profiles cp where cp.claim_token=p_token limit 1;
  if found then
    return jsonb_build_object(
      'kind','creator','status',case when coalesce(r.auth_user_id is not null,false) and coalesce(r.onboarded,false) then 'published' else 'claimable' end,
      'id',r.id,'page_name',r.page_name,'username',r.username,'avatar_url',r.avatar_url,'banner_url',r.banner_url,
      'city',r.city,'language',r.language,'bio',r.bio,'verified',r.verified,'primary_niche',r.primary_niche,
      'availability',r.availability,'platforms',r.platforms,'services',r.services,'portfolio_link',r.portfolio_link,
      'onboarded',r.onboarded,'nfc_display_settings',r.nfc_display_settings
    );
  end if;
  select 'business'::text as kind, bp.* into r from public.business_profiles bp where bp.claim_token=p_token limit 1;
  if found then
    return jsonb_build_object(
      'kind','business','status',case when coalesce(r.auth_user_id is not null,false) and coalesce(r.onboarded,false) then 'published' else 'claimable' end,
      'id',r.id,'business_name',r.business_name,'username',r.username,'avatar_url',r.avatar_url,'banner_url',r.banner_url,
      'city',r.city,'language',r.language,'bio',r.bio,'verified',r.verified,'industry',r.industry,'website',r.website,
      'onboarded',r.onboarded,'nfc_display_settings',r.nfc_display_settings
    );
  end if;
  return null;
end;
$$;
revoke all on function public.get_claim_any(text) from public;
grant execute on function public.get_claim_any(text) to anon, authenticated;

-- -------------------------------------------------------------------------
-- 6. Business verification: business information + authorized representative.
-- Legacy evidence columns are retained for data compatibility, but are not
-- required or surfaced as current verification requirements.
-- -------------------------------------------------------------------------
create or replace function public.admin_verification_readiness(p_kind text, p_claim_id uuid)
returns jsonb
language plpgsql security definer set search_path=public
as $$
declare ready boolean := false; reason text := '';
begin
  if not public.is_admin() then raise exception 'admin access required'; end if;
  if lower(p_kind)='creator' then
    ready := exists(select 1 from public.creator_verification_claims where id=p_claim_id and nullif(trim(claimed_username),'') is not null and nullif(trim(ownership_method),'') is not null and coalesce(audience_count,0) >= coalesce((select youtube_subscriber_threshold from public.verification_settings where id=true),1000));
    reason := case when ready then 'Creator identity, ownership and YouTube audience evidence are present.' else 'Creator needs ownership evidence and at least the configured YouTube subscriber threshold.' end;
  elsif lower(p_kind)='business' then
    ready := exists(select 1 from public.business_verification_claims where id=p_claim_id and nullif(trim(legal_business_name),'') is not null and nullif(trim(representative_name),'') is not null);
    reason := case when ready then 'Business information and authorized representative information are present.' else 'Business information and authorized representative information are required.' end;
  else raise exception 'invalid profile kind'; end if;
  return jsonb_build_object('ready',ready,'kind',lower(p_kind),'reason',reason);
end;
$$;
revoke all on function public.admin_verification_readiness(text,uuid) from public;
grant execute on function public.admin_verification_readiness(text,uuid) to authenticated;

-- -------------------------------------------------------------------------
-- 7. Promotions: admin-only control plus creative/audience/status/metrics.
-- -------------------------------------------------------------------------
alter table if exists public.promotions add column if not exists creative_url text;
alter table if exists public.promotions add column if not exists cta_label text default 'Learn more';
alter table if exists public.promotions add column if not exists audience jsonb not null default '{}'::jsonb;
alter table if exists public.promotions add column if not exists impressions bigint not null default 0;
alter table if exists public.promotions add column if not exists clicks bigint not null default 0;
alter table if exists public.promotions add column if not exists status text not null default 'draft';

create or replace function public.admin_record_promotion_impression(p_promotion_id uuid)
returns boolean language plpgsql security definer set search_path=public as $$
begin
  update public.promotions set impressions=impressions+1, updated_at=now() where id=p_promotion_id and active=true;
  return found;
end; $$;
revoke all on function public.admin_record_promotion_impression(uuid) from public;
grant execute on function public.admin_record_promotion_impression(uuid) to anon, authenticated;

create or replace function public.admin_record_promotion_click(p_promotion_id uuid)
returns boolean language plpgsql security definer set search_path=public as $$
begin
  update public.promotions set clicks=clicks+1, updated_at=now() where id=p_promotion_id and active=true;
  return found;
end; $$;
revoke all on function public.admin_record_promotion_click(uuid) from public;
grant execute on function public.admin_record_promotion_click(uuid) to anon, authenticated;

-- -------------------------------------------------------------------------
-- 8. Schema reload
-- -------------------------------------------------------------------------
notify pgrst, 'reload schema';


-- -------------------------------------------------------------------------
-- 9. Full admin promotion creation contract (creative, CTA, audience).
-- -------------------------------------------------------------------------
create or replace function public.admin_create_promotion(
  p_title text,
  p_description text default '',
  p_placement text default 'explore',
  p_start_at timestamptz default null,
  p_end_at timestamptz default null,
  p_target_url text default null,
  p_creative_url text default null,
  p_cta_label text default 'Learn more',
  p_audience jsonb default '{}'::jsonb
) returns uuid
language plpgsql security definer set search_path=public
as $$
declare v_id uuid;
begin
  if not public.is_admin() then raise exception 'admin access required'; end if;
  if nullif(trim(p_title),'') is null then raise exception 'promotion title is required'; end if;
  insert into public.promotions(title,description,placement,start_at,end_at,target_url,creative_url,cta_label,audience,active,status,created_by)
  values(trim(p_title),coalesce(p_description,''),p_placement,p_start_at,p_end_at,nullif(trim(coalesce(p_target_url,'')),''),nullif(trim(coalesce(p_creative_url,'')),''),coalesce(nullif(trim(p_cta_label),''),'Learn more'),coalesce(p_audience,'{}'::jsonb),false,'draft',auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.admin_create_promotion(text,text,text,timestamptz,timestamptz,text,text,text,jsonb) from public;
grant execute on function public.admin_create_promotion(text,text,text,timestamptz,timestamptz,text,text,text,jsonb) to authenticated;

create or replace function public.admin_set_promotion_active(p_promotion_id uuid, p_active boolean)
returns boolean language plpgsql security definer set search_path=public as $$
begin
  if not public.is_admin() then raise exception 'admin access required'; end if;
  update public.promotions
  set active=p_active,
      status=case when p_active then 'active' else case when end_at is not null and end_at <= now() then 'ended' else 'paused' end end,
      updated_at=now()
  where id=p_promotion_id;
  return found;
end; $$;
revoke all on function public.admin_set_promotion_active(uuid,boolean) from public;
grant execute on function public.admin_set_promotion_active(uuid,boolean) to authenticated;

commit;
