-- Commissioner: make the 50/50 network launch-gate configurable.
-- Run this AFTER COMMISSIONER-MASTER-MIGRATION.sql. Safe to run on an
-- already-live database — it does not touch existing data, and the
-- default values (50/50) keep current behavior identical until someone
-- deliberately changes them.
--
-- Why: commissioner_launch_stats() and commissioner_network_unlocked()
-- previously had "50" hardcoded twice. Changing the threshold meant
-- editing SQL and redeploying. Now it lives in one settings row that an
-- admin can update with a single RPC call — no redeploy needed.

-- 1. Settings table (single row, admin-only writes) --------------------

create table if not exists public.platform_settings (
  id boolean primary key default true,       -- enforces exactly one row
  network_creator_threshold int not null default 50,
  network_business_threshold int not null default 50,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  constraint platform_settings_singleton check (id)
);

insert into public.platform_settings (id, network_creator_threshold, network_business_threshold)
values (true, 50, 50)
on conflict (id) do nothing;

alter table public.platform_settings enable row level security;

drop policy if exists "Anyone can read platform settings" on public.platform_settings;
create policy "Anyone can read platform settings"
on public.platform_settings for select
using (true);

-- No insert/update/delete policies are created for regular users —
-- writes only happen through the security-definer RPC below, which
-- checks public.is_admin() itself.

-- 2. Admin-only RPC to change the threshold -----------------------------

create or replace function public.admin_set_network_threshold(
  p_creator_threshold int,
  p_business_threshold int
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admin access required';
  end if;
  if p_creator_threshold < 0 or p_business_threshold < 0 then
    raise exception 'thresholds must be zero or greater';
  end if;

  update public.platform_settings
  set network_creator_threshold = p_creator_threshold,
      network_business_threshold = p_business_threshold,
      updated_at = now(),
      updated_by = auth.uid()
  where id = true;

  return jsonb_build_object(
    'ok', true,
    'network_creator_threshold', p_creator_threshold,
    'network_business_threshold', p_business_threshold
  );
end;
$$;

revoke all on function public.admin_set_network_threshold(int, int) from public;
grant execute on function public.admin_set_network_threshold(int, int) to authenticated;

-- 3. Point the existing launch-gate functions at the settings row -------

create or replace function public.commissioner_launch_stats()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'creator_threshold', s.network_creator_threshold,
    'business_threshold', s.network_business_threshold,
    -- kept for any existing caller still reading a single "threshold" key;
    -- shows the creator threshold, which matches prior 50/50 behavior
    'threshold', s.network_creator_threshold,
    'creator_count', (select count(*) from public.creator_profiles where approved=true and onboarded=true and verified=true),
    'business_count', (select count(*) from public.business_profiles where approved=true and onboarded=true and verified=true)
  )
  from public.platform_settings s
  where s.id = true;
$$;

create or replace function public.commissioner_network_unlocked()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin() or (
    (select count(*) from public.creator_profiles where approved=true and onboarded=true and verified=true)
      >= (select network_creator_threshold from public.platform_settings where id = true)
    and
    (select count(*) from public.business_profiles where approved=true and onboarded=true and verified=true)
      >= (select network_business_threshold from public.platform_settings where id = true)
  );
$$;

revoke all on function public.commissioner_launch_stats() from public;
revoke all on function public.commissioner_network_unlocked() from public;
grant execute on function public.commissioner_launch_stats() to anon, authenticated;
grant execute on function public.commissioner_network_unlocked() to authenticated;

-- Done. To change the threshold later, run as an authenticated admin:
--   select public.admin_set_network_threshold(20, 20);

-- 4. Redefine start_conversation() with a dynamic gate message ----------
-- Identical to the version in COMMISSIONER-MASTER-MIGRATION.sql except the
-- exception text below no longer hardcodes "50 / 50" — it now reads
-- whatever the current threshold actually is, so the message stays
-- accurate after admin_set_network_threshold() changes it.

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
  creator_threshold int;
  business_threshold int;
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
      select network_creator_threshold, network_business_threshold
        into creator_threshold, business_threshold
        from public.platform_settings where id = true;
      raise exception 'Commissioner networking is not unlocked yet. It opens at % verified creators and % verified businesses.',
        coalesce(creator_threshold, 50), coalesce(business_threshold, 50);
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
