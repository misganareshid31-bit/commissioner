-- ============================================================================
-- COMMISSIONER MASTER FORWARD MIGRATION
-- Apply this AFTER the existing Commissioner migrations in this project.
--
-- Purpose:
--   * replace hardcoded admin identity checks with admin_users/is_admin()
--   * enforce verification approval through secure admin RPCs
--   * enforce the 50/50 launch gate server-side
--   * make NFC card registration/assignment admin-only
--   * preserve the existing profile/messaging/marketplace schema
--
-- This file is forward-only and safe to re-run.
-- It does NOT contain a personal admin email. Add the intended admin user
-- separately with the SQL shown in the deployment guide.
-- ============================================================================

-- 1. Secure admin role -------------------------------------------------------

-- The master migration can be run after the existing project migrations. Keep
-- the privileged columns present before installing the shared protection trigger.
alter table if exists public.creator_profiles
  add column if not exists plan text not null default 'basic',
  add column if not exists plan_expires_at timestamptz;

alter table if exists public.business_profiles
  add column if not exists plan text not null default 'starter',
  add column if not exists plan_expires_at timestamptz;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  message text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;
drop policy if exists "Users see only their own notifications" on public.notifications;
create policy "Users see only their own notifications"
on public.notifications for select using (auth.uid() = user_id);
drop policy if exists "Users can mark their own notifications read" on public.notifications;
create policy "Users can mark their own notifications read"
on public.notifications for update using (auth.uid() = user_id);

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

drop policy if exists "No direct client access to admin_users" on public.admin_users;
create policy "No direct client access to admin_users"
  on public.admin_users for all
  using (false)
  with check (false);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_users where user_id = auth.uid()
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- Freeze privileged profile fields for ordinary users.
create or replace function public.protect_admin_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' and not public.is_admin() then
    new.approved = old.approved;
    new.verified = old.verified;
    new.plan = old.plan;
    new.plan_expires_at = old.plan_expires_at;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_admin_fields_trigger on public.creator_profiles;
create trigger protect_admin_fields_trigger
before update on public.creator_profiles
for each row execute procedure public.protect_admin_fields();

drop trigger if exists protect_admin_fields_trigger on public.business_profiles;
create trigger protect_admin_fields_trigger
before update on public.business_profiles
for each row execute procedure public.protect_admin_fields();

-- Recreate all existing admin RPCs so the last migration wins even if an
-- earlier deployment still has email-based versions installed.
create or replace function public.admin_create_claim(
  p_page_name text,
  p_primary_niche text,
  p_verified boolean default false
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  new_token text;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  new_token := encode(gen_random_bytes(16), 'hex');
  insert into public.creator_profiles(page_name, primary_niche, claim_token, verified, approved, onboarded, claimed)
  values (nullif(trim(p_page_name), ''), nullif(trim(p_primary_niche), ''), new_token, false, false, false, false);
  return new_token;
end;
$$;

create or replace function public.admin_create_business_claim(
  p_business_name text,
  p_industry text,
  p_verified boolean default false
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  new_token text;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  new_token := encode(gen_random_bytes(16), 'hex');
  insert into public.business_profiles(business_name, industry, claim_token, verified, approved, onboarded, claimed)
  values (nullif(trim(p_business_name), ''), nullif(trim(p_industry), ''), new_token, false, false, false, false);
  return new_token;
end;
$$;

create or replace function public.admin_delete_page(p_kind text, p_page_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_id uuid;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  if p_page_id is null then raise exception 'page id is required'; end if;

  if lower(p_kind)='creator' then
    delete from public.creator_profiles where id=p_page_id returning id into deleted_id;
  elsif lower(p_kind)='business' then
    delete from public.business_profiles where id=p_page_id returning id into deleted_id;
  else
    raise exception 'invalid page kind';
  end if;

  return jsonb_build_object('deleted', deleted_id is not null, 'kind', lower(p_kind), 'id', p_page_id);
end;
$$;

revoke all on function public.admin_create_claim(text,text,boolean) from public;
revoke all on function public.admin_create_business_claim(text,text,boolean) from public;
revoke all on function public.admin_delete_page(text,uuid) from public;
grant execute on function public.admin_create_claim(text,text,boolean) to authenticated;
grant execute on function public.admin_create_business_claim(text,text,boolean) to authenticated;
grant execute on function public.admin_delete_page(text,uuid) to authenticated;

-- 2. Admin policies ----------------------------------------------------------

do $$
begin
  if to_regclass('public.creator_profiles') is not null then
    execute 'drop policy if exists "Admin can view all profiles" on public.creator_profiles';
    execute 'create policy "Admin can view all profiles" on public.creator_profiles for select using (public.is_admin())';
    execute 'drop policy if exists "Admin can update all profiles" on public.creator_profiles';
    execute 'create policy "Admin can update all profiles" on public.creator_profiles for update using (public.is_admin()) with check (public.is_admin())';
    execute 'drop policy if exists "Admin can update all creator profiles" on public.creator_profiles';
    execute 'create policy "Admin can update all creator profiles" on public.creator_profiles for update using (public.is_admin()) with check (public.is_admin())';
  end if;

  if to_regclass('public.business_profiles') is not null then
    execute 'drop policy if exists "Admin can view all business profiles" on public.business_profiles';
    execute 'create policy "Admin can view all business profiles" on public.business_profiles for select using (public.is_admin())';
    execute 'drop policy if exists "Admin can update all business profiles" on public.business_profiles';
    execute 'create policy "Admin can update all business profiles" on public.business_profiles for update using (public.is_admin()) with check (public.is_admin())';
  end if;

  if to_regclass('public.creator_verification_claims') is not null then
    execute 'drop policy if exists "Admin manages creator verification claims" on public.creator_verification_claims';
    execute 'create policy "Admin manages creator verification claims" on public.creator_verification_claims for all using (public.is_admin()) with check (public.is_admin())';
  end if;

  if to_regclass('public.business_verification_claims') is not null then
    execute 'drop policy if exists "Admin manages business verification claims" on public.business_verification_claims';
    execute 'create policy "Admin manages business verification claims" on public.business_verification_claims for all using (public.is_admin()) with check (public.is_admin())';
  end if;

  if to_regclass('public.profile_reports') is not null then
    execute 'drop policy if exists "Admins view reports" on public.profile_reports';
    execute 'create policy "Admins view reports" on public.profile_reports for select using (public.is_admin())';
    execute 'drop policy if exists "Admins update reports" on public.profile_reports';
    execute 'create policy "Admins update reports" on public.profile_reports for update using (public.is_admin()) with check (public.is_admin())';
  end if;

  if to_regclass('public.user_reports') is not null then
    execute 'drop policy if exists "Admin can view all reports" on public.user_reports';
    execute 'create policy "Admin can view all reports" on public.user_reports for select using (public.is_admin())';
    execute 'drop policy if exists "Admin can update reports" on public.user_reports';
    execute 'create policy "Admin can update reports" on public.user_reports for update using (public.is_admin()) with check (public.is_admin())';
  end if;
end $$;

-- 3. Server-side 100% completion checks --------------------------------------

create or replace function public.creator_profile_complete(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.creator_profiles p
    where p.id = p_profile_id
      and nullif(trim(coalesce(p.page_name, '')), '') is not null
      and nullif(trim(coalesce(p.bio, '')), '') is not null
      and nullif(trim(coalesce(p.avatar_url, '')), '') is not null
      and nullif(trim(coalesce(p.city, '')), '') is not null
      and nullif(trim(coalesce(p.primary_niche, '')), '') is not null
      and p.platforms is not null
      and jsonb_typeof(p.platforms) = 'object'
      and exists (
        select 1
        from jsonb_each(coalesce(p.platforms, '{}'::jsonb)) x
        where nullif(trim(coalesce(x.value->>'handle', '')), '') is not null
      )
  );
$$;

create or replace function public.business_profile_complete(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.business_profiles p
    where p.id = p_profile_id
      and nullif(trim(coalesce(p.business_name, '')), '') is not null
      and nullif(trim(coalesce(p.bio, '')), '') is not null
      and nullif(trim(coalesce(p.avatar_url, '')), '') is not null
      and nullif(trim(coalesce(p.city, '')), '') is not null
      and nullif(trim(coalesce(p.industry, '')), '') is not null
  );
$$;

revoke all on function public.creator_profile_complete(uuid) from public;
revoke all on function public.business_profile_complete(uuid) from public;
grant execute on function public.creator_profile_complete(uuid) to anon, authenticated;
grant execute on function public.business_profile_complete(uuid) to anon, authenticated;

-- 4. Secure verification review ---------------------------------------------

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
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  if p_claim_id is null then
    raise exception 'claim id is required';
  end if;

  if lower(p_kind) = 'creator' then
    select creator_profile_id into profile_id
    from public.creator_verification_claims
    where id = p_claim_id;

    if profile_id is null then
      raise exception 'creator verification request not found';
    end if;

    if lower(p_action) = 'verify' then
      if not public.creator_profile_complete(profile_id) then
        raise exception 'profile must be 100%% complete before verification';
      end if;
      update public.creator_verification_claims
      set identity_status='verified',
          account_status='verified',
          followers_status='verified',
          engagement_status='verified',
          status='verified',
          checked_at=now(),
          updated_at=now()
      where id=p_claim_id;
    elsif lower(p_action) = 'approve' then
      select public.creator_profile_complete(profile_id) into complete;
      if not complete then
        raise exception 'profile must be 100%% complete before approval';
      end if;
      if not exists (
        select 1 from public.creator_verification_claims
        where id=p_claim_id and status='verified'
      ) then
        raise exception 'verification claims must be verified before approval';
      end if;
      update public.creator_profiles
      set approved=true, verified=true, updated_at=now()
      where id=profile_id;
    elsif lower(p_action) = 'reject' then
      update public.creator_verification_claims
      set status='rejected', updated_at=now()
      where id=p_claim_id;
      update public.creator_profiles
      set approved=false, verified=false, updated_at=now()
      where id=profile_id;
    else
      raise exception 'invalid review action';
    end if;

  elsif lower(p_kind) = 'business' then
    select business_profile_id into profile_id
    from public.business_verification_claims
    where id = p_claim_id;

    if profile_id is null then
      raise exception 'business verification request not found';
    end if;

    if lower(p_action) = 'verify' then
      if not public.business_profile_complete(profile_id) then
        raise exception 'profile must be 100%% complete before verification';
      end if;
      update public.business_verification_claims
      set registration_status='verified',
          license_status='verified',
          representative_status='verified',
          status='verified',
          checked_at=now(),
          updated_at=now()
      where id=p_claim_id;
    elsif lower(p_action) = 'approve' then
      select public.business_profile_complete(profile_id) into complete;
      if not complete then
        raise exception 'profile must be 100%% complete before approval';
      end if;
      if not exists (
        select 1 from public.business_verification_claims
        where id=p_claim_id and status='verified'
      ) then
        raise exception 'verification claims must be verified before approval';
      end if;
      update public.business_profiles
      set approved=true, verified=true, updated_at=now()
      where id=profile_id;
    elsif lower(p_action) = 'reject' then
      update public.business_verification_claims
      set status='rejected', updated_at=now()
      where id=p_claim_id;
      update public.business_profiles
      set approved=false, verified=false, updated_at=now()
      where id=profile_id;
    else
      raise exception 'invalid review action';
    end if;
  else
    raise exception 'invalid profile kind';
  end if;

  return jsonb_build_object('ok', true, 'kind', lower(p_kind), 'action', lower(p_action), 'profile_id', profile_id);
end;
$$;

revoke all on function public.admin_review_verification(text, uuid, text) from public;
grant execute on function public.admin_review_verification(text, uuid, text) to authenticated;

-- 5. 50/50 launch gate ------------------------------------------------------

create or replace function public.commissioner_launch_stats()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'threshold', 50,
    'creator_count', (select count(*) from public.creator_profiles where approved=true and onboarded=true and verified=true),
    'business_count', (select count(*) from public.business_profiles where approved=true and onboarded=true and verified=true)
  );
$$;

create or replace function public.commissioner_network_unlocked()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin() or (
    (select count(*) from public.creator_profiles where approved=true and onboarded=true and verified=true) >= 50
    and
    (select count(*) from public.business_profiles where approved=true and onboarded=true and verified=true) >= 50
  );
$$;

revoke all on function public.commissioner_launch_stats() from public;
revoke all on function public.commissioner_network_unlocked() from public;
grant execute on function public.commissioner_launch_stats() to anon, authenticated;
grant execute on function public.commissioner_network_unlocked() to authenticated;

-- Gate new connection requests at the database boundary.
drop policy if exists "Users create B2B connection" on public.b2b_connections;
create policy "Users create B2B connection"
on public.b2b_connections for insert
with check (
  requester_user_id = auth.uid()
  and requester_user_id <> recipient_user_id
  and public.commissioner_network_unlocked()
  and not public.is_blocked(requester_user_id, recipient_user_id)
);

-- Gate creation of new conversations while preserving existing threads.
create or replace function public.start_conversation(
  p_other_user_id uuid,
  p_initial_message text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  conversation_id uuid;
  other_messaging_visibility text;
begin
  if me is null then raise exception 'authentication required'; end if;
  if p_other_user_id is null or p_other_user_id = me then raise exception 'invalid recipient'; end if;
  if not exists (select 1 from auth.users where id = p_other_user_id) then raise exception 'recipient not found'; end if;
  if public.is_blocked(me, p_other_user_id) then raise exception 'You can''t message this person.'; end if;

  select c.id into conversation_id
  from public.conversations c
  join public.conversation_members a on a.conversation_id = c.id and a.user_id = me
  join public.conversation_members b on b.conversation_id = c.id and b.user_id = p_other_user_id
  where (select count(*) from public.conversation_members x where x.conversation_id = c.id) = 2
  limit 1;

  if conversation_id is null then
    if not public.commissioner_network_unlocked() then
      raise exception 'Commissioner networking is not unlocked yet. It opens at 50 verified creators and 50 verified businesses.';
    end if;

    begin
      select messaging_visibility into other_messaging_visibility
      from public.creator_profiles where auth_user_id = p_other_user_id
      union all
      select messaging_visibility
      from public.business_profiles where auth_user_id = p_other_user_id
      limit 1;
    exception when undefined_column then
      other_messaging_visibility := 'everyone';
    end;

    if other_messaging_visibility is not null and other_messaging_visibility <> 'everyone' then
      if other_messaging_visibility = 'nobody' then
        raise exception 'This person isn''t accepting new messages right now.';
      elsif other_messaging_visibility = 'verified_only' and not exists (
        select 1 from public.creator_profiles where auth_user_id = me and verified = true
        union all
        select 1 from public.business_profiles where auth_user_id = me and verified = true
      ) then
        raise exception 'This person only accepts messages from verified Commissioner accounts.';
      elsif other_messaging_visibility = 'premium_only' and not exists (
        select 1 from public.creator_profiles where auth_user_id = me and is_premium = true
        union all
        select 1 from public.business_profiles where auth_user_id = me and is_premium = true
      ) then
        raise exception 'This person only accepts messages from premium Commissioner accounts.';
      end if;
    end if;

    insert into public.conversations default values returning id into conversation_id;
    insert into public.conversation_members(conversation_id, user_id)
    values (conversation_id, me), (conversation_id, p_other_user_id);
  end if;

  if nullif(trim(coalesce(p_initial_message, '')), '') is not null then
    insert into public.messages(conversation_id, sender_id, body)
    values (conversation_id, me, left(trim(p_initial_message), 4000));
  end if;

  return conversation_id;
end;
$$;

revoke all on function public.start_conversation(uuid, text) from public;
grant execute on function public.start_conversation(uuid, text) to authenticated;

-- 6. Admin NFC card registry -----------------------------------------------

create table if not exists public.nfc_cards (
  id uuid primary key default gen_random_uuid(),
  card_code text unique,
  creator_id uuid references public.creator_profiles(id) on delete set null,
  business_id uuid references public.business_profiles(id) on delete set null,
  status text not null default 'unassigned'
    check (status in ('unassigned','assigned','active','inactive','revoked')),
  assigned_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nfc_cards_one_destination check (
    not (creator_id is not null and business_id is not null)
  )
);

alter table public.nfc_cards add column if not exists business_id uuid references public.business_profiles(id) on delete set null;
alter table public.nfc_cards add column if not exists updated_at timestamptz not null default now();

alter table public.nfc_cards enable row level security;

drop policy if exists "Only admins manage NFC cards" on public.nfc_cards;
create policy "Only admins manage NFC cards"
on public.nfc_cards for all
using (public.is_admin())
with check (public.is_admin());

create or replace function public.admin_register_nfc_card(
  p_card_code text,
  p_kind text default null,
  p_profile_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  card_id uuid;
  destination text;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  if nullif(trim(coalesce(p_card_code,'')), '') is null then raise exception 'card code is required'; end if;

  if lower(coalesce(p_kind,'')) = 'creator' then
    if not exists (select 1 from public.creator_profiles where id=p_profile_id) then raise exception 'creator profile not found'; end if;
    destination := '/creator/' || p_profile_id::text;
    insert into public.nfc_cards(card_code,creator_id,business_id,status,assigned_at,updated_at)
    values(trim(p_card_code),p_profile_id,null,'assigned',now(),now())
    on conflict(card_code) do update set creator_id=excluded.creator_id,business_id=null,status='assigned',assigned_at=now(),updated_at=now()
    returning id into card_id;
  elsif lower(coalesce(p_kind,'')) = 'business' then
    if not exists (select 1 from public.business_profiles where id=p_profile_id) then raise exception 'business profile not found'; end if;
    destination := '/business/' || p_profile_id::text;
    insert into public.nfc_cards(card_code,creator_id,business_id,status,assigned_at,updated_at)
    values(trim(p_card_code),null,p_profile_id,'assigned',now(),now())
    on conflict(card_code) do update set creator_id=null,business_id=excluded.business_id,status='assigned',assigned_at=now(),updated_at=now()
    returning id into card_id;
  else
    insert into public.nfc_cards(card_code,status,updated_at)
    values(trim(p_card_code),'unassigned',now())
    on conflict(card_code) do update set updated_at=now()
    returning id into card_id;
  end if;

  return jsonb_build_object('id',card_id,'card_code',trim(p_card_code),'destination',destination,'status',
    case when p_profile_id is null then 'unassigned' else 'assigned' end);
end;
$$;

create or replace function public.admin_set_nfc_status(p_card_id uuid, p_status text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  if p_status not in ('unassigned','assigned','active','inactive','revoked') then raise exception 'invalid NFC status'; end if;
  update public.nfc_cards set status=p_status, updated_at=now() where id=p_card_id;
  return found;
end;
$$;

revoke all on function public.admin_register_nfc_card(text,text,uuid) from public;
revoke all on function public.admin_set_nfc_status(uuid,text) from public;
grant execute on function public.admin_register_nfc_card(text,text,uuid) to authenticated;
grant execute on function public.admin_set_nfc_status(uuid,text) to authenticated;

-- 7. Admin setup health check ----------------------------------------------

create or replace function public.admin_check_setup()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  installed_count integer;
  required_count integer := 8;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;

  select count(*) into installed_count
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname='public'
    and p.proname in (
      'admin_check_setup',
      'admin_create_claim',
      'admin_create_business_claim',
      'admin_delete_page',
      'get_claim_any',
      'admin_review_verification',
      'admin_register_nfc_card',
      'admin_set_nfc_status'
    );

  return jsonb_build_object(
    'ready', installed_count >= required_count,
    'installed', installed_count,
    'required', required_count
  );
end;
$$;

revoke all on function public.admin_check_setup() from public;
grant execute on function public.admin_check_setup() to authenticated;

-- 8. Notifications: safe insert helper -------------------------------------

create or replace function public.create_notification(
  p_user_id uuid,
  p_message text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  notification_id uuid;
begin
  if not public.is_admin() and auth.uid() <> p_user_id then
    raise exception 'not authorized';
  end if;
  if p_user_id is null or nullif(trim(coalesce(p_message,'')), '') is null then
    raise exception 'invalid notification';
  end if;
  insert into public.notifications(user_id,message)
  values(p_user_id,left(trim(p_message),500))
  returning id into notification_id;
  return notification_id;
end;
$$;

revoke all on function public.create_notification(uuid,text) from public;
grant execute on function public.create_notification(uuid,text) to authenticated;

-- ============================================================================
-- End master migration
-- ============================================================================
