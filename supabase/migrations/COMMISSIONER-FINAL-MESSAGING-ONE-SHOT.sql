-- COMMISSIONER FINAL ONE-SHOT DATABASE FIX
-- Run once in Supabase SQL Editor after deploying the final ZIP.
-- This reconciles the messaging functions used by the frontend and
-- installs marketplace messaging without profile/network gates.

create extension if not exists pgcrypto;

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 4000),
  created_at timestamptz not null default now(),
  read_at timestamptz null
);

create index if not exists conversations_updated_at_idx on public.conversations(updated_at desc);
create index if not exists conversation_members_user_idx on public.conversation_members(user_id, conversation_id);
create index if not exists messages_conversation_created_idx on public.messages(conversation_id, created_at);

alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;

drop policy if exists "Members can view their conversations" on public.conversations;
create policy "Members can view their conversations" on public.conversations
for select to authenticated using (
  exists (select 1 from public.conversation_members cm where cm.conversation_id=id and cm.user_id=auth.uid())
);

drop policy if exists "Members can view conversation membership" on public.conversation_members;
create policy "Members can view conversation membership" on public.conversation_members
for select to authenticated using (user_id=auth.uid());

drop policy if exists "Members can view messages" on public.messages;
create policy "Members can view messages" on public.messages
for select to authenticated using (
  exists (select 1 from public.conversation_members cm where cm.conversation_id=conversation_id and cm.user_id=auth.uid())
);

drop policy if exists "Members can send messages" on public.messages;
create policy "Members can send messages" on public.messages
for insert to authenticated with check (
  sender_id=auth.uid() and exists (
    select 1 from public.conversation_members cm where cm.conversation_id=conversation_id and cm.user_id=auth.uid()
  )
);

create or replace function public.touch_conversation_updated_at()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  update public.conversations set updated_at=now() where id=new.conversation_id;
  return new;
end; $$;

drop trigger if exists touch_conversation_on_message on public.messages;
create trigger touch_conversation_on_message after insert on public.messages
for each row execute procedure public.touch_conversation_updated_at();

-- Normal 1-to-1 messaging. Exactly matches the frontend RPC call.
create or replace function public.start_conversation(p_other_user_id uuid, p_initial_message text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare
  me uuid := auth.uid();
  conversation_id uuid;
begin
  if me is null then raise exception 'authentication required'; end if;
  if p_other_user_id is null or p_other_user_id=me then raise exception 'invalid recipient'; end if;
  if not exists(select 1 from auth.users where id=p_other_user_id) then raise exception 'recipient not found'; end if;

  select c.id into conversation_id
  from public.conversations c
  join public.conversation_members a on a.conversation_id=c.id and a.user_id=me
  join public.conversation_members b on b.conversation_id=c.id and b.user_id=p_other_user_id
  where (select count(*) from public.conversation_members x where x.conversation_id=c.id)=2
  limit 1;

  if conversation_id is null then
    insert into public.conversations default values returning id into conversation_id;
    insert into public.conversation_members(conversation_id,user_id)
    values(conversation_id,me),(conversation_id,p_other_user_id);
  end if;

  if nullif(trim(coalesce(p_initial_message,'')),'') is not null then
    insert into public.messages(conversation_id,sender_id,body)
    values(conversation_id,me,left(trim(p_initial_message),4000));
  end if;
  return conversation_id;
end; $$;

grant execute on function public.start_conversation(uuid,text) to authenticated;

create or replace function public.list_my_conversations()
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  me uuid:=auth.uid(); result jsonb;
begin
  if me is null then raise exception 'authentication required'; end if;
  select coalesce(jsonb_agg(row_to_json(x) order by x.last_message_at desc nulls last),'[]'::jsonb)
  into result
  from (
    select c.id,
      other.user_id as other_user_id,
      coalesce(cp.page_name,cp.username,bp.business_name,bp.username,u.email,'Commissioner member') as other_name,
      case when bp.user_id is not null and cp.user_id is null then 'business' else 'creator' end as other_type,
      coalesce(cp.avatar_url,bp.avatar_url) as other_avatar_url,
      (select m.body from public.messages m where m.conversation_id=c.id order by m.created_at desc limit 1) as last_message,
      (select m.created_at from public.messages m where m.conversation_id=c.id order by m.created_at desc limit 1) as last_message_at,
      (select count(*) from public.messages m where m.conversation_id=c.id and m.sender_id<>me and m.read_at is null) as unread_count
    from public.conversations c
    join public.conversation_members mine on mine.conversation_id=c.id and mine.user_id=me
    join lateral (select cm.user_id from public.conversation_members cm where cm.conversation_id=c.id and cm.user_id<>me limit 1) other on true
    join auth.users u on u.id=other.user_id
    left join lateral (select cp.page_name,cp.username,cp.avatar_url,cp.auth_user_id as user_id from public.creator_profiles cp where cp.auth_user_id=other.user_id limit 1) cp on true
    left join lateral (select bp.business_name,bp.username,bp.avatar_url,bp.auth_user_id as user_id from public.business_profiles bp where bp.auth_user_id=other.user_id limit 1) bp on true
  ) x;
  return result;
end; $$;

grant execute on function public.list_my_conversations() to authenticated;

create or replace function public.get_conversation_messages(p_conversation_id uuid)
returns setof public.messages language plpgsql security definer set search_path=public as $$
begin
  if not exists(select 1 from public.conversation_members where conversation_id=p_conversation_id and user_id=auth.uid()) then
    raise exception 'not a conversation member';
  end if;
  return query select * from public.messages where conversation_id=p_conversation_id order by created_at asc;
end; $$;

grant execute on function public.get_conversation_messages(uuid) to authenticated;

create or replace function public.send_message(p_conversation_id uuid,p_body text)
returns public.messages language plpgsql security definer set search_path=public as $$
declare new_message public.messages; clean_body text:=trim(coalesce(p_body,''));
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if char_length(clean_body)=0 then raise exception 'message cannot be empty'; end if;
  if char_length(clean_body)>4000 then raise exception 'message is too long'; end if;
  if not exists(select 1 from public.conversation_members where conversation_id=p_conversation_id and user_id=auth.uid()) then
    raise exception 'not a conversation member';
  end if;
  insert into public.messages(conversation_id,sender_id,body) values(p_conversation_id,auth.uid(),clean_body) returning * into new_message;
  return new_message;
end; $$;

grant execute on function public.send_message(uuid,text) to authenticated;

create or replace function public.mark_conversation_read(p_conversation_id uuid)
returns integer language plpgsql security definer set search_path=public as $$
declare changed integer;
begin
  if not exists(select 1 from public.conversation_members where conversation_id=p_conversation_id and user_id=auth.uid()) then
    raise exception 'not a conversation member';
  end if;
  update public.messages set read_at=now() where conversation_id=p_conversation_id and sender_id<>auth.uid() and read_at is null;
  get diagnostics changed=row_count;
  return changed;
end; $$;

grant execute on function public.mark_conversation_read(uuid) to authenticated;

-- Marketplace inquiry tracking.
create table if not exists public.marketplace_inquiries (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.marketplace_listings(id) on delete cascade,
  seller_user_id uuid not null references auth.users(id) on delete cascade,
  buyer_user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(listing_id,buyer_user_id)
);
create index if not exists marketplace_inquiries_seller_idx on public.marketplace_inquiries(seller_user_id,created_at desc);

alter table public.marketplace_inquiries enable row level security;
drop policy if exists "Sellers view marketplace inquiries" on public.marketplace_inquiries;
create policy "Sellers view marketplace inquiries" on public.marketplace_inquiries
for select to authenticated using(seller_user_id=auth.uid());
drop policy if exists "Buyers create marketplace inquiries" on public.marketplace_inquiries;
create policy "Buyers create marketplace inquiries" on public.marketplace_inquiries
for insert to authenticated with check(buyer_user_id=auth.uid());

-- Marketplace messaging: authenticated users only; no profile-completion,
-- verification, connection, or launch-threshold gate.
create or replace function public.start_marketplace_inquiry(p_listing_id uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare
  me uuid:=auth.uid(); seller uuid; conv uuid; listing public.marketplace_listings%rowtype;
begin
  if me is null then raise exception 'authentication required'; end if;
  select * into listing from public.marketplace_listings where id=p_listing_id and active=true;
  if not found then raise exception 'listing not found'; end if;

  if listing.owner_type='creator' then
    select auth_user_id into seller from public.creator_profiles where id=listing.owner_id limit 1;
  elsif listing.owner_type='business' then
    select auth_user_id into seller from public.business_profiles where id=listing.owner_id limit 1;
  else
    raise exception 'invalid listing owner type';
  end if;

  if seller is null then raise exception 'seller messaging account not found'; end if;
  if seller=me then raise exception 'you cannot message your own listing'; end if;

  select mi.conversation_id into conv from public.marketplace_inquiries mi
  where mi.listing_id=listing.id and mi.buyer_user_id=me limit 1;

  if conv is null then
    select c.id into conv from public.conversations c
    join public.conversation_members a on a.conversation_id=c.id and a.user_id=me
    join public.conversation_members b on b.conversation_id=c.id and b.user_id=seller
    where (select count(*) from public.conversation_members x where x.conversation_id=c.id)=2 limit 1;
  end if;

  if conv is null then
    insert into public.conversations default values returning id into conv;
    insert into public.conversation_members(conversation_id,user_id) values(conv,me),(conv,seller);
  end if;

  insert into public.marketplace_inquiries(listing_id,seller_user_id,buyer_user_id,conversation_id)
  values(listing.id,seller,me,conv)
  on conflict(listing_id,buyer_user_id) do update set conversation_id=excluded.conversation_id;

  return conv;
end; $$;

grant execute on function public.start_marketplace_inquiry(uuid) to authenticated;

-- Marketplace media field used by the current UI.
alter table public.marketplace_listings add column if not exists media_url text;
alter table public.marketplace_listings add column if not exists media_type text not null default 'image';
alter table public.marketplace_listings drop constraint if exists marketplace_listings_media_type_check;
alter table public.marketplace_listings add constraint marketplace_listings_media_type_check check(media_type in ('image','video'));

-- Keep Realtime enabled for new messages.
do $$
begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='messages') then
    alter publication supabase_realtime add table public.messages;
  end if;
exception when insufficient_privilege then
  null;
end $$;

notify pgrst,'reload schema';
