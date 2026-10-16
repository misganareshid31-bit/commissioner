-- Commissioner: show every completed, owned profile in public discovery.
-- Verification and admin approval are not requirements for Explore visibility.
-- Apply in Supabase SQL Editor after backing up the database.

begin;

-- Drop legacy permissive policies whose names were used by previous migrations.
-- The new completed-profile policies below define the intended public gate.
drop policy if exists "Public can view approved creator profiles" on public.creator_profiles;
drop policy if exists "Public can view published creator profiles" on public.creator_profiles;
drop policy if exists "Public can view registered creator profiles" on public.creator_profiles;
drop policy if exists "Public can view completed creator profiles" on public.creator_profiles;
drop policy if exists "Public can view approved business profiles" on public.business_profiles;
drop policy if exists "Public can view registered business profiles" on public.business_profiles;
drop policy if exists "Public can view completed business profiles" on public.business_profiles;

create policy "Public can view completed creator profiles"
  on public.creator_profiles for select
  to anon, authenticated
  using (auth_user_id is not null and coalesce(onboarded, false) = true);

create policy "Public can view completed business profiles"
  on public.business_profiles for select
  to anon, authenticated
  using (auth_user_id is not null and coalesce(onboarded, false) = true);

-- Security-invoker views respect the table's RLS policies. Do not filter by
-- approved or verified: paid plan rank only affects ordering, not eligibility.
create or replace view public.creator_profiles_ranked
with (security_invoker = true) as
select cp.*,
  case
    when lower(coalesce(cp.plan, 'basic')) = 'premium'
      and (cp.plan_expires_at is null or cp.plan_expires_at > now()) then 2
    when lower(coalesce(cp.plan, 'basic')) = 'pro'
      and (cp.plan_expires_at is null or cp.plan_expires_at > now()) then 1
    else 0
  end as effective_plan_rank
from public.creator_profiles cp;

grant select on public.creator_profiles_ranked to anon, authenticated;

create or replace view public.business_profiles_ranked
with (security_invoker = true) as
select bp.*,
  case
    when lower(coalesce(bp.plan, 'basic')) = 'premium'
      and (bp.plan_expires_at is null or bp.plan_expires_at > now()) then 2
    when lower(coalesce(bp.plan, 'basic')) = 'pro'
      and (bp.plan_expires_at is null or bp.plan_expires_at > now()) then 1
    else 0
  end as effective_plan_rank
from public.business_profiles bp;

grant select on public.business_profiles_ranked to anon, authenticated;

notify pgrst, 'reload schema';
commit;
