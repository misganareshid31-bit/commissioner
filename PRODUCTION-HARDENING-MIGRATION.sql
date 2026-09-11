-- ============================================================================
-- PRODUCTION HARDENING MIGRATION
-- Run this LAST, after every other migration in this repo (including
-- ADMIN-ROLE-MIGRATION.sql, PLAN-SYSTEM-MIGRATION.sql and
-- COMMISSIONER-TRUST-MARKETPLACE-B2B.sql). Safe to run repeatedly.
--
-- WHAT THIS FIXES
--
-- 1) REGRESSION: PLAN-SYSTEM-MIGRATION.sql's protect_admin_fields()
--    silently reverted admin checks back to a hardcoded email
--    ('misganareshid27@gmail.com'), undoing the is_admin()-based fix
--    from ADMIN-ROLE-MIGRATION.sql. Both functions use `create or
--    replace`, so whichever migration ran LAST wins — and since
--    PLAN-SYSTEM-MIGRATION.sql was written after ADMIN-ROLE-MIGRATION.sql,
--    it's the one currently live if you applied them in that order.
--    This matters because protect_admin_fields() is the actual
--    server-side guard that stops a normal user from setting
--    approved/verified/plan/plan_expires_at on their own profile — so
--    while it was never insecure for ordinary users, it silently
--    stopped recognizing any admin added via `admin_users` after the
--    fact, only trusting the one original hardcoded email again.
--
-- 2) MISSING: verification requests were only checked for 100% profile
--    completion in the React client (Site.jsx). Nothing stopped a
--    direct call to submit_creator_verification / submit_business_verification
--    (Supabase REST, curl, browser devtools) from submitting a request
--    below 100%. This adds the same completion calculation in SQL and
--    enforces it inside both RPCs.
--
-- 3) MISSING: the 50/50 launch gate (see Site.jsx LAUNCH_THRESHOLD) was
--    UI-only. A direct insert into b2b_connections would have worked
--    before 50 verified creators + 50 verified businesses were reached.
--    This adds a real launch_unlocked() check to the insert policy, so
--    it's enforced even outside the web UI. Admins bypass it.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Fix the protect_admin_fields() regression
-- ----------------------------------------------------------------------------
create or replace function public.protect_admin_fields()
returns trigger as $$
begin
  if auth.role() <> 'service_role' and not public.is_admin() then
    new.approved = old.approved;
    new.verified = old.verified;
    new.plan = old.plan;
    new.plan_expires_at = old.plan_expires_at;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- ----------------------------------------------------------------------------
-- 2. Server-side profile completion percentage
--    Mirrors creatorCompletionChecklist() / businessCompletionChecklist()
--    in src/components/Site.jsx exactly — keep both in sync if either
--    changes the required-field list.
-- ----------------------------------------------------------------------------
create or replace function public.creator_profile_completion_pct(p_creator_profile_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  r public.creator_profiles%rowtype;
  total integer := 11;
  filled integer := 0;
begin
  select * into r from public.creator_profiles where id = p_creator_profile_id;
  if not found then return 0; end if;

  if coalesce(trim(r.page_name), '') <> '' then filled := filled + 1; end if;
  if coalesce(trim(r.username), '') <> '' then filled := filled + 1; end if;
  if coalesce(trim(r.avatar_url), '') <> '' then filled := filled + 1; end if;
  if coalesce(trim(r.city), '') <> '' then filled := filled + 1; end if;
  if coalesce(trim(r.language), '') <> '' then filled := filled + 1; end if;
  if coalesce(trim(r.bio), '') <> '' then filled := filled + 1; end if;
  if coalesce(trim(r.primary_niche), '') <> '' then filled := filled + 1; end if;
  if coalesce(trim(r.availability), '') <> '' then filled := filled + 1; end if;

  -- at least one social/platform entry with a real value
  if r.platforms is not null and jsonb_typeof(r.platforms) = 'object'
     and exists (select 1 from jsonb_each_text(r.platforms) e where coalesce(e.value, '') <> '' and e.value <> '{}' and e.value <> 'null')
  then filled := filled + 1; end if;

  -- at least one service/rate with a real value
  if r.services is not null and jsonb_typeof(r.services) = 'object'
     and exists (select 1 from jsonb_each_text(r.services) e where coalesce(e.value, '') <> '' and e.value <> '{}' and e.value <> 'null')
  then filled := filled + 1; end if;

  -- audience: age + gender + location all present
  if r.audience is not null and jsonb_typeof(r.audience) = 'object'
     and coalesce(r.audience->>'age', '') <> ''
     and coalesce(r.audience->>'gender', '') <> ''
     and coalesce(r.audience->>'location', '') <> ''
  then filled := filled + 1; end if;

  return round((filled::numeric / total) * 100);
end;
$$;
grant execute on function public.creator_profile_completion_pct(uuid) to authenticated;

create or replace function public.business_profile_completion_pct(p_business_profile_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  r public.business_profiles%rowtype;
  total integer := 7;
  filled integer := 0;
begin
  select * into r from public.business_profiles where id = p_business_profile_id;
  if not found then return 0; end if;

  if coalesce(trim(r.business_name), '') <> '' then filled := filled + 1; end if;
  if coalesce(trim(r.username), '') <> '' then filled := filled + 1; end if;
  if coalesce(trim(r.avatar_url), '') <> '' then filled := filled + 1; end if;
  if coalesce(trim(r.city), '') <> '' then filled := filled + 1; end if;
  if coalesce(trim(r.language), '') <> '' then filled := filled + 1; end if;
  if coalesce(trim(r.industry), '') <> '' then filled := filled + 1; end if;
  if coalesce(trim(r.bio), '') <> '' then filled := filled + 1; end if;

  return round((filled::numeric / total) * 100);
end;
$$;
grant execute on function public.business_profile_completion_pct(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- Enforce 100% completion inside the verification-submission RPCs
-- themselves (not just the React client).
-- ----------------------------------------------------------------------------
create or replace function public.submit_creator_verification(p_creator_profile_id uuid, p_evidence_note text default '')
returns uuid as $$
declare
  v_id uuid;
  v_pct integer;
begin
  if not exists (select 1 from public.creator_profiles where id = p_creator_profile_id and auth_user_id = auth.uid()) then
    raise exception 'not authorized';
  end if;

  v_pct := public.creator_profile_completion_pct(p_creator_profile_id);
  if v_pct < 100 then
    raise exception 'Profile is only % percent complete. Complete your profile to 100%% before requesting verification.', v_pct;
  end if;

  insert into public.creator_verification_claims (creator_profile_id, evidence_note, status)
  values (p_creator_profile_id, trim(coalesce(p_evidence_note, '')), 'pending')
  on conflict (creator_profile_id) do update set evidence_note = excluded.evidence_note, status = 'pending', updated_at = now()
  returning id into v_id;
  return v_id;
end;
$$ language plpgsql security definer set search_path = public;
grant execute on function public.submit_creator_verification(uuid, text) to authenticated;

create or replace function public.submit_business_verification(p_business_profile_id uuid, p_evidence_note text default '')
returns uuid as $$
declare
  v_id uuid;
  v_pct integer;
begin
  if not exists (select 1 from public.business_profiles where id = p_business_profile_id and auth_user_id = auth.uid()) then
    raise exception 'not authorized';
  end if;

  v_pct := public.business_profile_completion_pct(p_business_profile_id);
  if v_pct < 100 then
    raise exception 'Profile is only % percent complete. Complete your profile to 100%% before requesting verification.', v_pct;
  end if;

  insert into public.business_verification_claims (business_profile_id, evidence_note, status)
  values (p_business_profile_id, trim(coalesce(p_evidence_note, '')), 'pending')
  on conflict (business_profile_id) do update set evidence_note = excluded.evidence_note, status = 'pending', updated_at = now()
  returning id into v_id;
  return v_id;
end;
$$ language plpgsql security definer set search_path = public;
grant execute on function public.submit_business_verification(uuid, text) to authenticated;

-- NOTE: the business setup flow in Site.jsx (the `save()` function in the
-- business onboarding component) currently calls submit_business_verification
-- automatically at the end of setup, before this migration guaranteed the
-- 100% check server-side. After this migration, that call will now
-- correctly fail with an exception if the checklist and this SQL function
-- ever disagree on what "100%" means — keep the two in sync (see the
-- comment above creator_profile_completion_pct).

-- ----------------------------------------------------------------------------
-- 3. Server-side 50/50 launch gate on B2B connection requests
-- ----------------------------------------------------------------------------
create or replace function public.launch_unlocked()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*) from public.creator_profiles where approved = true and onboarded = true and verified = true) >= 50
    and
    (select count(*) from public.business_profiles where approved = true and onboarded = true and verified = true) >= 50;
$$;
grant execute on function public.launch_unlocked() to authenticated, anon;

do $$
begin
  if to_regclass('public.b2b_connections') is not null then
    execute 'drop policy if exists "Users create B2B connection" on public.b2b_connections';
    execute 'create policy "Users create B2B connection" on public.b2b_connections for insert with check (requester_user_id = auth.uid() and (public.launch_unlocked() or public.is_admin()))';
  end if;
end $$;
