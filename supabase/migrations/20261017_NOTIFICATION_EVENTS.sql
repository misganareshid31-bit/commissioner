-- Commissioner in-app notifications: real event creation for messages,
-- connection requests, campaign applications, and verification updates.
-- Apply AFTER 20261016_PROFILE_PREFERENCES_NOTIFICATIONS_FOUNDATION.sql and
-- after the messaging / B2B / campaign / verification tables exist.

begin;

-- Keep notification content server-controlled: users may only mark rows read.
revoke update on public.user_notifications from authenticated;
grant update (read_at) on public.user_notifications to authenticated;

create or replace function public._commissioner_notify(
  p_recipient uuid,
  p_type text,
  p_title text,
  p_body text default '',
  p_target text default null,
  p_metadata jsonb default '{}'::jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_recipient is null or p_recipient = '00000000-0000-0000-0000-000000000000'::uuid then
    return;
  end if;
  insert into public.user_notifications(recipient_user_id, notification_type, title, body, target_url, metadata)
  values (p_recipient, p_type, left(trim(p_title),160), left(coalesce(p_body,''),2000), p_target, coalesce(p_metadata,'{}'::jsonb));
end;
$$;
revoke all on function public._commissioner_notify(uuid,text,text,text,text,jsonb) from public, anon, authenticated;

-- A new message notifies every other member of the conversation.
create or replace function public._notify_message_recipients()
returns trigger language plpgsql security definer set search_path=public as $$
declare member record;
begin
  for member in
    select cm.user_id from public.conversation_members cm
    where cm.conversation_id = new.conversation_id and cm.user_id <> new.sender_id
  loop
    perform public._commissioner_notify(
      member.user_id, 'message', 'New message',
      'You received a new message on Commissioner.', 'messages',
      jsonb_build_object('conversation_id', new.conversation_id, 'message_id', new.id)
    );
  end loop;
  return new;
end; $$;
drop trigger if exists commissioner_notify_new_message on public.messages;
create trigger commissioner_notify_new_message after insert on public.messages
for each row execute function public._notify_message_recipients();

-- Notify the recipient when a connection request arrives, and the requester
-- when the recipient accepts or declines it.
create or replace function public._notify_connection_change()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if tg_op = 'INSERT' and new.status = 'pending' then
    perform public._commissioner_notify(new.recipient_user_id, 'connection', 'New connection request',
      'Someone wants to connect with you on Commissioner.', 'network', jsonb_build_object('connection_id', new.id, 'status', new.status));
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status and new.status in ('accepted','declined') then
    perform public._commissioner_notify(new.requester_user_id, 'connection',
      case when new.status = 'accepted' then 'Connection request accepted' else 'Connection request declined' end,
      case when new.status = 'accepted' then 'Your connection request was accepted.' else 'Your connection request was declined.' end,
      'network', jsonb_build_object('connection_id', new.id, 'status', new.status));
  end if;
  return new;
end; $$;
drop trigger if exists commissioner_notify_connection_change on public.b2b_connections;
create trigger commissioner_notify_connection_change after insert or update on public.b2b_connections
for each row execute function public._notify_connection_change();

-- A new application notifies the campaign-owning business. A decision notifies
-- the creator who applied.
create or replace function public._notify_campaign_application_change()
returns trigger language plpgsql security definer set search_path=public as $$
declare business_user uuid; creator_user uuid; campaign_title text;
begin
  select b.auth_user_id, c.title into business_user, campaign_title
  from public.campaigns c join public.business_profiles b on b.id=c.business_profile_id
  where c.id=new.campaign_id;
  select p.auth_user_id into creator_user from public.creator_profiles p where p.id=new.creator_profile_id;

  if tg_op = 'INSERT' then
    perform public._commissioner_notify(business_user, 'campaign_application', 'New campaign application',
      coalesce(campaign_title,'Your campaign') || ' received a new creator application.', 'campaigns',
      jsonb_build_object('application_id',new.id,'campaign_id',new.campaign_id,'status',new.status));
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status and new.status in ('accepted','declined') then
    perform public._commissioner_notify(creator_user, 'campaign_application',
      case when new.status='accepted' then 'Campaign application accepted' else 'Campaign application declined' end,
      'Your application for ' || coalesce(campaign_title,'a campaign') || case when new.status='accepted' then ' was accepted.' else ' was declined.' end,
      'campaigns', jsonb_build_object('application_id',new.id,'campaign_id',new.campaign_id,'status',new.status));
  end if;
  return new;
end; $$;
drop trigger if exists commissioner_notify_campaign_application on public.campaign_applications;
create trigger commissioner_notify_campaign_application after insert or update on public.campaign_applications
for each row execute function public._notify_campaign_application_change();

-- Notify a profile owner when their verification request is submitted or its
-- status changes. Admin users are alerted to new pending requests.
create or replace function public._notify_verification_change()
returns trigger language plpgsql security definer set search_path=public as $$
declare owner_user uuid; kind text; status_label text; admin_row record;
begin
  if tg_table_name = 'creator_verification_claims' then
    kind := 'Creator';
    select auth_user_id into owner_user from public.creator_profiles where id=new.creator_profile_id;
  else
    kind := 'Business';
    select auth_user_id into owner_user from public.business_profiles where id=new.business_profile_id;
  end if;
  status_label := lower(coalesce(new.status,'pending'));
  if tg_op = 'INSERT' then
    if status_label = 'pending' then
      perform public._commissioner_notify(owner_user, 'verification', kind || ' verification submitted',
        'Your verification request is awaiting review.', 'verification', jsonb_build_object('kind',kind,'request_id',new.id,'status',status_label));
      if to_regclass('public.admin_users') is not null then
        for admin_row in select user_id from public.admin_users loop
          perform public._commissioner_notify(admin_row.user_id, 'verification', 'Verification request needs review',
            'A ' || lower(kind) || ' verification request was submitted.', 'verification', jsonb_build_object('kind',kind,'request_id',new.id));
        end loop;
      end if;
    end if;
  elsif new.status is distinct from old.status then
    if status_label in ('verified','rejected','needs_recheck') then
      perform public._commissioner_notify(owner_user, 'verification',
        case status_label when 'verified' then kind || ' verification approved' when 'rejected' then kind || ' verification rejected' else kind || ' verification needs more review' end,
        case status_label when 'verified' then 'Your profile verification has been approved.' when 'rejected' then 'Your verification request was rejected. Review your account for details.' else 'Your verification request needs further review.' end,
        'verification', jsonb_build_object('kind',kind,'request_id',new.id,'status',status_label));
    end if;
  end if;
  return new;
end; $$;

-- Create verification triggers only when each optional table exists in this schema.
do $$ begin
  if to_regclass('public.creator_verification_claims') is not null then
    execute 'drop trigger if exists commissioner_notify_creator_verification on public.creator_verification_claims';
    execute 'create trigger commissioner_notify_creator_verification after insert or update on public.creator_verification_claims for each row execute function public._notify_verification_change()';
  end if;
  if to_regclass('public.business_verification_claims') is not null then
    execute 'drop trigger if exists commissioner_notify_business_verification on public.business_verification_claims';
    execute 'create trigger commissioner_notify_business_verification after insert or update on public.business_verification_claims for each row execute function public._notify_verification_change()';
  end if;
end $$;

-- Enable realtime for notification rows if Supabase's standard publication exists.
do $$ begin
  if exists (select 1 from pg_publication where pubname='supabase_realtime') then
    begin alter publication supabase_realtime add table public.user_notifications;
    exception when duplicate_object then null;
    end;
  end if;
end $$;

notify pgrst, 'reload schema';
commit;
