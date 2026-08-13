-- =====================================================================
-- 7. REAL-TIME MEMBER MESSAGING
-- Private 1-to-1 conversations for authenticated Commissioner users.
-- Run this section in Supabase SQL Editor after the earlier schema.
-- =====================================================================

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
create index if not exists messages_recipient_unread_idx on public.messages(sender_id, read_at) where read_at is null;

alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;

drop policy if exists "Members can view their conversations" on public.conversations;
create policy "Members can view their conversations"
  on public.conversations for select to authenticated
  using (exists (select 1 from public.conversation_members cm where cm.conversation_id = id and cm.user_id = auth.uid()));

drop policy if exists "Members can view conversation membership" on public.conversation_members;
create policy "Members can view conversation membership"
  on public.conversation_members for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "Members can view messages" on public.messages;
create policy "Members can view messages"
  on public.messages for select to authenticated
  using (exists (select 1 from public.conversation_members cm where cm.conversation_id = conversation_id and cm.user_id = auth.uid()));

drop policy if exists "Members can send messages" on public.messages;
create policy "Members can send messages"
  on public.messages for insert to authenticated
  with check (sender_id = auth.uid() and exists (select 1 from public.conversation_members cm where cm.conversation_id = conversation_id and cm.user_id = auth.uid()));

create or replace function public.touch_conversation_updated_at()
returns trigger as $$
begin
  update public.conversations set updated_at = now() where id = new.conversation_id;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists touch_conversation_on_message on public.messages;
create trigger touch_conversation_on_message
after insert on public.messages
for each row execute procedure public.touch_conversation_updated_at();

-- Start or reuse a private one-to-one conversation. Optionally sends the first message.
create or replace function public.start_conversation(p_other_user_id uuid, p_initial_message text default null)
returns uuid as $$
declare
  me uuid := auth.uid();
  conversation_id uuid;
begin
  if me is null then raise exception 'authentication required'; end if;
  if p_other_user_id is null or p_other_user_id = me then raise exception 'invalid recipient'; end if;
  if not exists (select 1 from auth.users where id = p_other_user_id) then raise exception 'recipient not found'; end if;

  select c.id into conversation_id
  from public.conversations c
  join public.conversation_members a on a.conversation_id = c.id and a.user_id = me
  join public.conversation_members b on b.conversation_id = c.id and b.user_id = p_other_user_id
  where (select count(*) from public.conversation_members x where x.conversation_id = c.id) = 2
  limit 1;

  if conversation_id is null then
    insert into public.conversations default values returning id into conversation_id;
    insert into public.conversation_members(conversation_id, user_id) values (conversation_id, me), (conversation_id, p_other_user_id);
  end if;

  if nullif(trim(coalesce(p_initial_message, '')), '') is not null then
    insert into public.messages(conversation_id, sender_id, body)
    values (conversation_id, me, left(trim(p_initial_message), 4000));
  end if;
  return conversation_id;
end;
$$ language plpgsql security definer set search_path = public;
grant execute on function public.start_conversation(uuid, text) to authenticated;

-- Return the signed-in user's conversation list with the other member and latest message.
create or replace function public.list_my_conversations()
returns jsonb as $$
declare
  me uuid := auth.uid();
  result jsonb;
begin
  if me is null then raise exception 'authentication required'; end if;
  select coalesce(jsonb_agg(row_to_json(x) order by x.last_message_at desc nulls last), '[]'::jsonb) into result
  from (
    select
      c.id,
      other.user_id as other_user_id,
      coalesce(cp.page_name, cp.username, bp.business_name, bp.username, u.email, 'Commissioner member') as other_name,
      case when bp.user_id is not null and cp.user_id is null then 'business' else 'creator' end as other_type,
      coalesce(cp.avatar_url, bp.avatar_url) as other_avatar_url,
      (select m.body from public.messages m where m.conversation_id = c.id order by m.created_at desc limit 1) as last_message,
      (select m.created_at from public.messages m where m.conversation_id = c.id order by m.created_at desc limit 1) as last_message_at,
      (select count(*) from public.messages m where m.conversation_id = c.id and m.sender_id <> me and m.read_at is null) as unread_count
    from public.conversations c
    join public.conversation_members mine on mine.conversation_id = c.id and mine.user_id = me
    join lateral (select cm.user_id from public.conversation_members cm where cm.conversation_id = c.id and cm.user_id <> me limit 1) other on true
    join auth.users u on u.id = other.user_id
    left join lateral (select cp.page_name, cp.username, cp.avatar_url, cp.auth_user_id as user_id from public.creator_profiles cp where cp.auth_user_id = other.user_id limit 1) cp on true
    left join lateral (select bp.business_name, bp.username, bp.avatar_url, bp.auth_user_id as user_id from public.business_profiles bp where bp.auth_user_id = other.user_id limit 1) bp on true
    order by c.updated_at desc
  ) x;
  return result;
end;
$$ language plpgsql security definer set search_path = public;
grant execute on function public.list_my_conversations() to authenticated;

create or replace function public.get_conversation_messages(p_conversation_id uuid)
returns setof public.messages as $$
begin
  if not exists (select 1 from public.conversation_members where conversation_id = p_conversation_id and user_id = auth.uid()) then
    raise exception 'not a conversation member';
  end if;
  return query select * from public.messages where conversation_id = p_conversation_id order by created_at asc;
end;
$$ language plpgsql security definer set search_path = public;
grant execute on function public.get_conversation_messages(uuid) to authenticated;

create or replace function public.send_message(p_conversation_id uuid, p_body text)
returns public.messages as $$
declare
  new_message public.messages;
  clean_body text := trim(coalesce(p_body, ''));
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if char_length(clean_body) = 0 then raise exception 'message cannot be empty'; end if;
  if char_length(clean_body) > 4000 then raise exception 'message is too long'; end if;
  if not exists (select 1 from public.conversation_members where conversation_id = p_conversation_id and user_id = auth.uid()) then
    raise exception 'not a conversation member';
  end if;
  insert into public.messages(conversation_id, sender_id, body)
  values (p_conversation_id, auth.uid(), clean_body)
  returning * into new_message;
  return new_message;
end;
$$ language plpgsql security definer set search_path = public;
grant execute on function public.send_message(uuid, text) to authenticated;

create or replace function public.mark_conversation_read(p_conversation_id uuid)
returns integer as $$
declare
  changed integer;
begin
  if not exists (select 1 from public.conversation_members where conversation_id = p_conversation_id and user_id = auth.uid()) then
    raise exception 'not a conversation member';
  end if;
  update public.messages set read_at = now()
  where conversation_id = p_conversation_id and sender_id <> auth.uid() and read_at is null;
  get diagnostics changed = row_count;
  return changed;
end;
$$ language plpgsql security definer set search_path = public;
grant execute on function public.mark_conversation_read(uuid) to authenticated;

-- Enable Supabase Realtime for new messages. Safe to run repeatedly.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;
