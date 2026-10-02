-- Commissioner: completed profiles are publicly discoverable; verification is separate.
-- Run after the existing profile/RLS migrations.

drop policy if exists "Public can view approved creator profiles" on public.creator_profiles;
drop policy if exists "Public can view published creator profiles" on public.creator_profiles;
drop policy if exists "Public can view registered creator profiles" on public.creator_profiles;
create policy "Public can view completed creator profiles"
  on public.creator_profiles for select
  using (auth_user_id is not null and onboarded = true);

drop policy if exists "Public can view approved business profiles" on public.business_profiles;
drop policy if exists "Public can view registered business profiles" on public.business_profiles;
create policy "Public can view completed business profiles"
  on public.business_profiles for select
  using (auth_user_id is not null and onboarded = true);

-- Keep the public ranking views subject to the same RLS rules.
create or replace view public.creator_profiles_ranked
with (security_invoker = true) as
select cp.*,
  case
    when cp.plan = 'elite' and (cp.plan_expires_at is null or cp.plan_expires_at > now()) then 2
    when cp.plan = 'pro' and (cp.plan_expires_at is null or cp.plan_expires_at > now()) then 1
    else 0
  end as effective_plan_rank
from public.creator_profiles cp;
grant select on public.creator_profiles_ranked to anon, authenticated;

create or replace view public.business_profiles_ranked
with (security_invoker = true) as
select bp.*,
  case
    when bp.plan = 'elite' and (bp.plan_expires_at is null or bp.plan_expires_at > now()) then 2
    when bp.plan = 'pro' and (bp.plan_expires_at is null or bp.plan_expires_at > now()) then 1
    else 0
  end as effective_plan_rank
from public.business_profiles bp;
grant select on public.business_profiles_ranked to anon, authenticated;

notify pgrst, 'reload schema';


-- Keep public marketplace/profile products on the same completed-profile rule.
drop policy if exists "Public can view active marketplace listings" on public.marketplace_listings;
create policy "Public can view active marketplace listings"
  on public.marketplace_listings for select
  using (
    active = true and (
      (owner_type = 'creator' and exists (select 1 from public.creator_profiles p where p.id = owner_id and p.auth_user_id is not null and p.onboarded = true)) or
      (owner_type = 'business' and exists (select 1 from public.business_profiles p where p.id = owner_id and p.auth_user_id is not null and p.onboarded = true))
    )
  );

drop policy if exists "Public can view active creator products" on public.creator_products;
create policy "Public can view active creator products"
  on public.creator_products for select
  using (
    active = true and exists (
      select 1 from public.creator_profiles p
      where p.id = creator_profile_id and p.auth_user_id is not null and p.onboarded = true
    )
  );
