-- Commissioner campaign applications: persist the application conversation,
-- make Accept/Decline transactional, and expose a secure thread opener.
-- Apply AFTER campaign_applications and the existing messaging tables exist.

begin;

do $$
begin
  if to_regclass('public.campaign_applications') is null
     or to_regclass('public.campaigns') is null
     or to_regclass('public.creator_profiles') is null
     or to_regclass('public.business_profiles') is null then
    raise exception 'Campaign application/profile tables are missing. Apply the existing campaign migrations first.';
  end if;
  if to_regclass('public.conversations') is null
     or to_regclass('public.conversation_members') is null
     or to_regclass('public.messages') is null then
    raise exception 'Messaging tables are missing. Apply the existing messaging migration first.';
  end if;
end $$;

create table if not exists public.campaign_application_threads (
  application_id uuid primary key references public.campaign_applications(id) on delete cascade,
  conversation_id uuid not null unique references public.conversations(id) on delete cascade,
  creator_user_id uuid not null references auth.users(id) on delete cascade,
  business_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists campaign_application_threads_creator_idx
  on public.campaign_application_threads(creator_user_id, created_at desc);
create index if not exists campaign_application_threads_business_idx
  on public.campaign_application_threads(business_user_id, created_at desc);
alter table public.campaign_application_threads enable row level security;
revoke all on public.campaign_application_threads from anon, authenticated;

-- Keep application writes behind the security-definer RPCs below. Direct table
-- writes could otherwise bypass duplicate prevention and the Pending-only decision rule.
drop policy if exists "Creators apply to published campaigns" on public.campaign_applications;
drop policy if exists "Business owners review campaign applications" on public.campaign_applications;
revoke insert, update on public.campaign_applications from anon, authenticated;

-- An application creates one persistent conversation and a message for both sides.
-- Duplicate applications are rejected instead of silently resetting Accepted to Pending.
create or replace function public.apply_to_campaign(p_campaign_id uuid, p_message text default '')
returns uuid
language plpgsql security definer set search_path=public
as $$
declare
  me uuid := auth.uid();
  v_creator_id uuid;
  v_business_user_id uuid;
  v_campaign_title text;
  v_application_id uuid;
  v_conversation_id uuid;
  v_message text := left(trim(coalesce(p_message, '')), 4000);
begin
  if me is null then raise exception 'Sign in before applying to a campaign.'; end if;
  select id into v_creator_id from public.creator_profiles
    where auth_user_id=me and onboarded=true limit 1;
  if v_creator_id is null then
    raise exception 'Complete your Creator profile setup before applying to a campaign.';
  end if;
  select c.title, b.auth_user_id into v_campaign_title, v_business_user_id
    from public.campaigns c
    join public.business_profiles b on b.id=c.business_profile_id
    where c.id=p_campaign_id and c.status='published';
  if not found then raise exception 'This campaign is not open for applications.'; end if;
  if v_business_user_id is null then raise exception 'The campaign owner has not linked a user account yet.'; end if;
  if v_business_user_id=me then raise exception 'You cannot apply to your own campaign.'; end if;
  if exists(select 1 from public.campaign_applications where campaign_id=p_campaign_id and creator_profile_id=v_creator_id) then
    raise exception 'You have already applied to this campaign. Open your existing application to continue.';
  end if;

  insert into public.campaign_applications(campaign_id, creator_profile_id, message, status)
    values(p_campaign_id, v_creator_id, coalesce(nullif(v_message,''), 'I would like to apply for this campaign.'), 'pending')
    returning id into v_application_id;

  insert into public.conversations default values returning id into v_conversation_id;
  insert into public.conversation_members(conversation_id,user_id)
    values(v_conversation_id,me),(v_conversation_id,v_business_user_id);
  insert into public.campaign_application_threads(application_id,conversation_id,creator_user_id,business_user_id)
    values(v_application_id,v_conversation_id,me,v_business_user_id);
  insert into public.messages(conversation_id,sender_id,body)
    values(v_conversation_id,me,
      left('Campaign application: ' || coalesce(v_campaign_title,'Campaign') || E'\n\n' ||
        coalesce(nullif(v_message,''),'I would like to apply for this campaign.'),4000));
  return v_application_id;
end;
$$;

-- Only the campaign owner may accept/decline; only Pending can be decided.
create or replace function public.review_campaign_application(p_application_id uuid, p_status text)
returns boolean
language plpgsql security definer set search_path=public
as $$
declare v_rows integer; v_status text := lower(trim(coalesce(p_status,'')));
begin
  if auth.uid() is null then raise exception 'Sign in to review applications.'; end if;
  if v_status not in ('accepted','declined') then raise exception 'Choose Accepted or Declined.'; end if;
  update public.campaign_applications a
    set status=v_status, updated_at=now()
    from public.campaigns c
    join public.business_profiles b on b.id=c.business_profile_id
    where a.id=p_application_id and a.campaign_id=c.id
      and b.auth_user_id=auth.uid() and a.status='pending';
  get diagnostics v_rows = row_count;
  if v_rows=0 then
    if exists(select 1 from public.campaign_applications a join public.campaigns c on c.id=a.campaign_id join public.business_profiles b on b.id=c.business_profile_id where a.id=p_application_id and b.auth_user_id=auth.uid() and a.status=v_status) then
      return true;
    end if;
    raise exception 'Application not found, not pending, or not owned by your business.';
  end if;
  return true;
end;
$$;

-- Securely open the conversation tied to a Pending or Accepted application.
-- This also backfills a thread for older applications that predate this migration.
create or replace function public.open_campaign_application_conversation(p_application_id uuid)
returns uuid
language plpgsql security definer set search_path=public
as $$
declare
  me uuid := auth.uid();
  v_creator_user_id uuid;
  v_business_user_id uuid;
  v_status text;
  v_title text;
  v_conversation_id uuid;
  v_creator_profile_id uuid;
begin
  if me is null then raise exception 'Sign in to open this application conversation.'; end if;
  select cp.auth_user_id, bp.auth_user_id, a.status, c.title, cp.id
    into v_creator_user_id, v_business_user_id, v_status, v_title, v_creator_profile_id
    from public.campaign_applications a
    join public.campaigns c on c.id=a.campaign_id
    join public.creator_profiles cp on cp.id=a.creator_profile_id
    join public.business_profiles bp on bp.id=c.business_profile_id
    where a.id=p_application_id;
  if not found then raise exception 'Campaign application not found.'; end if;
  if me is distinct from v_creator_user_id and me is distinct from v_business_user_id then raise exception 'You are not a participant in this application.'; end if;
  if v_status not in ('pending','accepted') then raise exception 'This application is declined or closed; messaging through this application is unavailable.'; end if;
  select conversation_id into v_conversation_id
    from public.campaign_application_threads where application_id=p_application_id;
  if v_conversation_id is null then
    insert into public.conversations default values returning id into v_conversation_id;
    -- Associate both participants with the new application conversation.
    insert into public.conversation_members(conversation_id,user_id)
      values(v_conversation_id,v_creator_user_id),(v_conversation_id,v_business_user_id)
      on conflict do nothing;
    insert into public.campaign_application_threads(application_id,conversation_id,creator_user_id,business_user_id)
      values(p_application_id,v_conversation_id,v_creator_user_id,v_business_user_id)
      on conflict(application_id) do update set conversation_id=excluded.conversation_id
      returning conversation_id into v_conversation_id;
    insert into public.messages(conversation_id,sender_id,body)
      values(v_conversation_id,me,left('Continuing the campaign application: '||coalesce(v_title,'Campaign')||'.',4000));
  end if;
  if not exists(select 1 from public.conversation_members where conversation_id=v_conversation_id and user_id=me) then
    raise exception 'Conversation membership is missing. Contact support rather than opening an unrelated thread.';
  end if;
  return v_conversation_id;
end;
$$;

revoke all on function public.apply_to_campaign(uuid,text) from public, anon;
revoke all on function public.review_campaign_application(uuid,text) from public, anon;
revoke all on function public.open_campaign_application_conversation(uuid) from public, anon;
grant execute on function public.apply_to_campaign(uuid,text) to authenticated;
grant execute on function public.review_campaign_application(uuid,text) to authenticated;
grant execute on function public.open_campaign_application_conversation(uuid) to authenticated;

notify pgrst, 'reload schema';
commit;
