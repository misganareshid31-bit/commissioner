-- Commissioner B2B: secure accept + conversation opening for accepted connections.
-- Apply after the existing B2B and messaging migrations.

begin;

do $$
begin
  if to_regclass('public.b2b_connections') is null then
    raise exception 'public.b2b_connections is missing; apply the existing B2B migrations first.';
  end if;
  if to_regclass('public.conversations') is null
     or to_regclass('public.conversation_members') is null
     or to_regclass('public.messages') is null then
    raise exception 'Commissioner messaging tables are missing; apply the existing messaging migrations first.';
  end if;
end $$;

create or replace function public.open_b2b_conversation(
  p_other_user_id uuid,
  p_initial_message text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  v_conversation_id uuid;
begin
  if me is null then raise exception 'authentication required'; end if;
  if p_other_user_id is null or p_other_user_id = me then raise exception 'invalid recipient'; end if;
  if public.is_blocked(me, p_other_user_id) then raise exception 'You cannot message this person.'; end if;
  if not exists (
    select 1 from public.b2b_connections c
    where c.status = 'accepted'
      and ((c.requester_user_id = me and c.recipient_user_id = p_other_user_id)
        or (c.requester_user_id = p_other_user_id and c.recipient_user_id = me))
  ) then
    raise exception 'Accept the B2B connection before opening a direct conversation.';
  end if;
  if not exists (select 1 from auth.users where id = p_other_user_id) then
    raise exception 'recipient account not found';
  end if;

  select c.id into v_conversation_id
  from public.conversations c
  join public.conversation_members a on a.conversation_id = c.id and a.user_id = me
  join public.conversation_members b on b.conversation_id = c.id and b.user_id = p_other_user_id
  where (select count(*) from public.conversation_members x where x.conversation_id = c.id) = 2
  limit 1;

  if v_conversation_id is null then
    insert into public.conversations default values returning id into v_conversation_id;
    insert into public.conversation_members(conversation_id, user_id)
      values (v_conversation_id, me), (v_conversation_id, p_other_user_id);
  end if;

  if nullif(trim(coalesce(p_initial_message, '')), '') is not null then
    insert into public.messages(conversation_id, sender_id, body)
      values (v_conversation_id, me, left(trim(p_initial_message), 4000));
  end if;
  return v_conversation_id;
end;
$$;

create or replace function public.accept_b2b_connection(p_connection_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  v_requester uuid;
  v_recipient uuid;
  v_status text;
  v_conversation_id uuid;
begin
  if me is null then raise exception 'authentication required'; end if;
  select requester_user_id, recipient_user_id, status
    into v_requester, v_recipient, v_status
    from public.b2b_connections
    where id = p_connection_id
    for update;
  if not found then raise exception 'connection request not found'; end if;
  if v_recipient <> me then raise exception 'only the recipient can accept this request'; end if;
  if v_status <> 'pending' then raise exception 'this connection request is no longer pending'; end if;
  if public.is_blocked(v_requester, v_recipient) then raise exception 'This connection cannot be accepted because one account has blocked the other.'; end if;

  update public.b2b_connections
    set status = 'accepted', updated_at = now()
    where id = p_connection_id;

  v_conversation_id := public.open_b2b_conversation(
    v_requester,
    'I accepted your Commissioner connection request. Let’s continue the conversation here.'
  );
  return v_conversation_id;
end;
$$;

revoke all on function public.open_b2b_conversation(uuid, text) from public;
revoke all on function public.accept_b2b_connection(uuid) from public;
grant execute on function public.open_b2b_conversation(uuid, text) to authenticated;
grant execute on function public.accept_b2b_connection(uuid) to authenticated;

notify pgrst, 'reload schema';
commit;
