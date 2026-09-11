-- Commissioner: verification independence + marketplace messaging/inquiries
-- Run this AFTER the existing Commissioner migrations.

-- Verification applications are independent identities. The Creator checklist
-- applies only to Creator verification; the Business checklist applies only to
-- Business verification. No cross-profile completion requirement is intended.

-- Marketplace is intentionally limited to products and services.
update public.marketplace_listings
set listing_type = case
  when listing_type in ('merch','collaboration') then 'product'
  else listing_type
end
where listing_type not in ('product','service');

alter table public.marketplace_listings
  drop constraint if exists marketplace_listings_listing_type_check;
alter table public.marketplace_listings
  add constraint marketplace_listings_listing_type_check
  check (listing_type in ('product','service'));

-- Listing-specific inquiry records let sellers see how many people contacted
-- them from their marketplace listings.
create table if not exists public.marketplace_inquiries (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.marketplace_listings(id) on delete cascade,
  seller_user_id uuid not null references auth.users(id) on delete cascade,
  buyer_user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(listing_id, buyer_user_id)
);

create index if not exists marketplace_inquiries_seller_idx
  on public.marketplace_inquiries(seller_user_id, created_at desc);

alter table public.marketplace_inquiries enable row level security;

drop policy if exists "Sellers view marketplace inquiries" on public.marketplace_inquiries;
create policy "Sellers view marketplace inquiries"
  on public.marketplace_inquiries for select
  using (seller_user_id = auth.uid());

drop policy if exists "Buyers create marketplace inquiries" on public.marketplace_inquiries;
create policy "Buyers create marketplace inquiries"
  on public.marketplace_inquiries for insert
  with check (buyer_user_id = auth.uid());

-- Marketplace contact is available to any authenticated Commissioner account.
-- Other non-marketplace messaging keeps its existing completion/network gates.
create or replace function public.start_conversation(
  p_other_user_id uuid,
  p_initial_message text default null,
  p_marketplace boolean default false
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
  if not p_marketplace and not public.can_current_user_interact() then
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
    if not p_marketplace and not public.commissioner_network_unlocked() then
      raise exception 'Commissioner networking is not unlocked yet. It opens at 50 verified creators and 50 verified businesses.';
    end if;

    if not p_marketplace then
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

revoke all on function public.start_conversation(uuid,text,boolean) from public;
grant execute on function public.start_conversation(uuid,text,boolean) to authenticated;

create or replace function public.start_marketplace_inquiry(
  p_listing_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  seller uuid;
  conv uuid;
  listing public.marketplace_listings%rowtype;
begin
  if me is null then raise exception 'authentication required'; end if;

  select * into listing
  from public.marketplace_listings
  where id = p_listing_id and active = true;

  if not found then raise exception 'listing not found'; end if;

  if listing.owner_type = 'creator' then
    select auth_user_id into seller from public.creator_profiles where id = listing.owner_id;
  else
    select auth_user_id into seller from public.business_profiles where id = listing.owner_id;
  end if;

  if seller is null then raise exception 'seller messaging account not found'; end if;
  if seller = me then raise exception 'you cannot contact your own listing'; end if;

  conv := public.start_conversation(seller, null, true);

  insert into public.marketplace_inquiries(listing_id, seller_user_id, buyer_user_id, conversation_id)
  values (listing.id, seller, me, conv)
  on conflict (listing_id, buyer_user_id)
  do update set conversation_id = excluded.conversation_id;

  return conv;
end;
$$;

revoke all on function public.start_marketplace_inquiry(uuid) from public;
grant execute on function public.start_marketplace_inquiry(uuid) to authenticated;
