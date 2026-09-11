-- Commissioner: public discovery + marketplace posts + interaction gating
-- Run AFTER COMMISSIONER-MASTER-MIGRATION.sql and 20260911_DUAL_IDENTITY_COMPLETION_SECURITY.sql.

-- Public discovery: a registered profile can be viewed even while its owner is
-- still finishing setup. Sensitive interaction remains separately gated.
drop policy if exists "Public can view approved creator profiles" on public.creator_profiles;
drop policy if exists "Public can view published creator profiles" on public.creator_profiles;
create policy "Public can view registered creator profiles"
  on public.creator_profiles for select
  using (auth_user_id is not null);

drop policy if exists "Public can view approved business profiles" on public.business_profiles;
create policy "Public can view registered business profiles"
  on public.business_profiles for select
  using (auth_user_id is not null);

-- Rich media for marketplace posts.
alter table public.marketplace_listings add column if not exists media_url text;
alter table public.marketplace_listings add column if not exists media_type text not null default 'image';
alter table public.marketplace_listings drop constraint if exists marketplace_listings_media_type_check;
alter table public.marketplace_listings add constraint marketplace_listings_media_type_check
  check (media_type in ('image','video'));

alter table public.creator_products add column if not exists media_url text;
alter table public.creator_products add column if not exists media_type text not null default 'image';
alter table public.creator_products drop constraint if exists creator_products_media_type_check;
alter table public.creator_products add constraint creator_products_media_type_check
  check (media_type in ('image','video'));

-- Marketplace posts from registered creators/businesses are publicly viewable.
drop policy if exists "Public can view active marketplace listings" on public.marketplace_listings;
create policy "Public can view active marketplace listings"
  on public.marketplace_listings for select
  using (
    active = true and (
      (owner_type='creator' and exists(select 1 from public.creator_profiles p where p.id=owner_id and p.auth_user_id is not null)) or
      (owner_type='business' and exists(select 1 from public.business_profiles p where p.id=owner_id and p.auth_user_id is not null))
    )
  );

drop policy if exists "Public can view active creator products" on public.creator_products;
create policy "Public can view active creator products"
  on public.creator_products for select
  using (
    active = true and exists (
      select 1 from public.creator_profiles p
      where p.id = creator_profile_id and p.auth_user_id is not null
    )
  );

-- A member may connect/message only after completing at least one active
-- Creator or Business identity to 100%. The function is server-side so this
-- cannot be bypassed by calling Supabase directly.
create or replace function public.can_current_user_interact()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.creator_profiles p
    where p.auth_user_id = auth.uid()
      and public.creator_profile_completion_percent(p.id) = 100
  )
  or exists (
    select 1 from public.business_profiles p
    where p.auth_user_id = auth.uid()
      and public.business_profile_completion_percent(p.id) = 100
  );
$$;
revoke all on function public.can_current_user_interact() from public;
grant execute on function public.can_current_user_interact() to authenticated;

-- Strengthen the connection insert policy with the setup-completion gate.
drop policy if exists "Users create B2B connection" on public.b2b_connections;
create policy "Users create B2B connection"
  on public.b2b_connections for insert
  with check (
    requester_user_id = auth.uid()
    and requester_user_id <> recipient_user_id
    and public.can_current_user_interact()
    and public.commissioner_network_unlocked()
    and not public.is_blocked(requester_user_id, recipient_user_id)
  );

-- Gate conversation creation too, while leaving existing threads readable.
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
  if not public.can_current_user_interact() then
    raise exception 'Complete your active Creator or Business profile setup to 100% before messaging.';
  end if;
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

revoke all on function public.start_conversation(uuid,text) from public;
grant execute on function public.start_conversation(uuid,text) to authenticated;
