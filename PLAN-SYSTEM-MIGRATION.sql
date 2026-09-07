-- ============================================================
-- Plan / tier system (Basic-Pro-Elite for creators,
-- Starter-Growth-Enterprise for businesses).
--
-- Payments aren't wired up yet, so this migration only builds the
-- plumbing: a plan field, admin-only control over it (matching the
-- existing pattern used for approved/verified), and the one thing
-- that's actually live right now — priority ordering in Discover.
--
-- "Priority listing" / "Top placement" is enforced through ranked
-- VIEWS rather than a stored rank column, so a plan that expires
-- naturally drops back to normal ordering the moment it lapses —
-- no cron job or scheduled task needed, since the expiry check
-- (plan_expires_at > now()) is recalculated on every single read.
--
-- Run this once in the Supabase SQL editor.
-- ============================================================

-- --- 1. The plan fields themselves -----------------------------

alter table public.creator_profiles
  add column if not exists plan text not null default 'basic',
  add column if not exists plan_expires_at timestamptz;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'creator_profiles_plan_check') then
    alter table public.creator_profiles
      add constraint creator_profiles_plan_check check (plan in ('basic', 'pro', 'elite'));
  end if;
end $$;

alter table public.business_profiles
  add column if not exists plan text not null default 'starter',
  add column if not exists plan_expires_at timestamptz;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'business_profiles_plan_check') then
    alter table public.business_profiles
      add constraint business_profiles_plan_check check (plan in ('starter', 'growth', 'enterprise'));
  end if;
end $$;

-- --- 2. Lock plan changes to admin-only, same as approved/verified ---
--
-- This REPLACES the existing protect_admin_fields() function (defined
-- in supabase-schema.sql) so it also freezes plan and plan_expires_at
-- for anyone who isn't the admin account or a service-role key. Since
-- both tables already share this one trigger function, this single
-- change covers creator_profiles and business_profiles at once —
-- no new triggers needed.

create or replace function public.protect_admin_fields()
returns trigger as $$
begin
  if auth.role() <> 'service_role' and coalesce(auth.jwt()->>'email', '') <> 'misganareshid27@gmail.com' then
    new.approved = old.approved;
    new.verified = old.verified;
    new.plan = old.plan;
    new.plan_expires_at = old.plan_expires_at;
  end if;
  return new;
end;
$$ language plpgsql security definer;

-- --- 3. Ranked views for Discover ordering ----------------------
--
-- security_invoker means these views respect the querying user's own
-- RLS (same "onboarded + approved" visibility rules as the base
-- tables) rather than running with elevated privilege — they only
-- add one extra computed column on top of the normal, already-public
-- profile data.

create or replace view public.creator_profiles_ranked
with (security_invoker = true) as
select
  cp.*,
  case
    when cp.plan = 'elite' and (cp.plan_expires_at is null or cp.plan_expires_at > now()) then 2
    when cp.plan = 'pro' and (cp.plan_expires_at is null or cp.plan_expires_at > now()) then 1
    else 0
  end as effective_plan_rank
from public.creator_profiles cp;

grant select on public.creator_profiles_ranked to anon, authenticated;

create or replace view public.business_profiles_ranked
with (security_invoker = true) as
select
  bp.*,
  case
    when bp.plan = 'enterprise' and (bp.plan_expires_at is null or bp.plan_expires_at > now()) then 2
    when bp.plan = 'growth' and (bp.plan_expires_at is null or bp.plan_expires_at > now()) then 1
    else 0
  end as effective_plan_rank
from public.business_profiles bp;

grant select on public.business_profiles_ranked to anon, authenticated;

-- ============================================================
-- What this does NOT do (by design, for now):
--   - No payment processing — the admin sets `plan` and
--     `plan_expires_at` by hand until a payment provider is wired up
--   - No automatic email/notification when a plan expires
--   - No enforcement on Spotlight video upload counts — that
--     feature doesn't have an upload flow built yet, so there's
--     nothing to limit
-- ============================================================
