-- =====================================================================
-- Commissioner: Trust & Safety layer
-- Adds: user reporting, reviews/ratings, blocking, and a self-service
-- account-deletion request. Run in Supabase Dashboard → SQL Editor,
-- after supabase-schema.sql, supabase-messaging.sql, and
-- PRIVACY-VISIBILITY-MIGRATION.sql. Safe to run more than once.
--
-- NOTE ON ACCOUNT DELETION: a client can never fully delete an
-- auth.users row (that needs the service-role key), so
-- request_account_deletion() does the part the app CAN do safely —
-- wipes personal fields, unpublishes the profile, and flags it — and
-- logs a request row so you (the admin) can finish removing the login
-- itself from the Supabase dashboard when you see it.
-- =====================================================================

-- 1. Reports ------------------------------------------------------------

create table if not exists public.user_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reported_user_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (reason in ('scam_or_fraud','fake_profile_or_stats','no_show_after_agreement','harassment_or_abuse','inappropriate_content','other')),
  details text,
  conversation_id uuid references public.conversations(id) on delete set null,
  status text not null default 'open' check (status in ('open','reviewed','dismissed')),
  created_at timestamptz not null default now()
);

alter table public.user_reports enable row level security;

drop policy if exists "Reporters can view their own reports" on public.user_reports;
create policy "Reporters can view their own reports"
  on public.user_reports for select
  using (auth.uid() = reporter_id);

drop policy if exists "Admin can view all reports" on public.user_reports;
create policy "Admin can view all reports"
  on public.user_reports for select
  using (coalesce(auth.jwt()->>'email', '') = 'misganareshid27@gmail.com');

drop policy if exists "Admin can update reports" on public.user_reports;
create policy "Admin can update reports"
  on public.user_reports for update
  using (coalesce(auth.jwt()->>'email', '') = 'misganareshid27@gmail.com');

create or replace function public.submit_report(
  p_reported_user_id uuid,
  p_reason text,
  p_details text default null,
  p_conversation_id uuid default null
) returns uuid as $$
declare
  me uuid := auth.uid();
  new_id uuid;
begin
  if me is null then raise exception 'authentication required'; end if;
  if p_reported_user_id is null or p_reported_user_id = me then raise exception 'invalid report target'; end if;
  insert into public.user_reports (reporter_id, reported_user_id, reason, details, conversation_id)
  values (me, p_reported_user_id, p_reason, nullif(trim(coalesce(p_details, '')), ''), p_conversation_id)
  returning id into new_id;
  return new_id;
end;
$$ language plpgsql security definer set search_path = public;
grant execute on function public.submit_report(uuid, text, text, uuid) to authenticated;

-- 2. Reviews & ratings ---------------------------------------------------

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  reviewer_id uuid not null references auth.users(id) on delete cascade,
  reviewee_id uuid not null references auth.users(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (reviewer_id, reviewee_id)
);

alter table public.reviews enable row level security;

drop policy if exists "Reviews are publicly viewable" on public.reviews;
create policy "Reviews are publicly viewable"
  on public.reviews for select
  using (true);

drop policy if exists "Users can leave reviews for others" on public.reviews;
create policy "Users can leave reviews for others"
  on public.reviews for insert
  with check (auth.uid() = reviewer_id and reviewer_id <> reviewee_id);

drop policy if exists "Users can edit their own review" on public.reviews;
create policy "Users can edit their own review"
  on public.reviews for update
  using (auth.uid() = reviewer_id);

drop policy if exists "Users can delete their own review" on public.reviews;
create policy "Users can delete their own review"
  on public.reviews for delete
  using (auth.uid() = reviewer_id);

create or replace function public.upsert_review(p_reviewee_id uuid, p_rating smallint, p_comment text default null)
returns public.reviews as $$
declare
  me uuid := auth.uid();
  row_out public.reviews;
begin
  if me is null then raise exception 'authentication required'; end if;
  if p_reviewee_id is null or p_reviewee_id = me then raise exception 'invalid review target'; end if;
  if p_rating < 1 or p_rating > 5 then raise exception 'rating must be between 1 and 5'; end if;
  insert into public.reviews (reviewer_id, reviewee_id, rating, comment)
  values (me, p_reviewee_id, p_rating, nullif(trim(coalesce(p_comment, '')), ''))
  on conflict (reviewer_id, reviewee_id)
  do update set rating = excluded.rating, comment = excluded.comment, updated_at = now()
  returning * into row_out;
  return row_out;
end;
$$ language plpgsql security definer set search_path = public;
grant execute on function public.upsert_review(uuid, smallint, text) to authenticated;

create or replace function public.get_rating_summary(p_user_id uuid)
returns jsonb as $$
  select jsonb_build_object(
    'average', coalesce(round(avg(rating)::numeric, 2), 0),
    'count', count(*)
  )
  from public.reviews where reviewee_id = p_user_id;
$$ language sql stable security definer set search_path = public;
grant execute on function public.get_rating_summary(uuid) to anon, authenticated;

create or replace function public.get_reviews_for_user(p_user_id uuid, p_limit integer default 20)
returns jsonb as $$
  select coalesce(jsonb_agg(row_to_json(x) order by x.created_at desc), '[]'::jsonb)
  from (
    select r.id, r.rating, r.comment, r.created_at,
      coalesce(cp.page_name, cp.username, bp.business_name, bp.username, 'Commissioner member') as reviewer_name,
      coalesce(cp.avatar_url, bp.avatar_url) as reviewer_avatar_url
    from public.reviews r
    left join public.creator_profiles cp on cp.auth_user_id = r.reviewer_id
    left join public.business_profiles bp on bp.auth_user_id = r.reviewer_id
    where r.reviewee_id = p_user_id
    order by r.created_at desc
    limit greatest(p_limit, 1)
  ) x;
$$ language sql stable security definer set search_path = public;
grant execute on function public.get_reviews_for_user(uuid, integer) to anon, authenticated;

-- 3. Blocking -------------------------------------------------------------

create table if not exists public.blocked_users (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);

alter table public.blocked_users enable row level security;

drop policy if exists "Users manage their own block list" on public.blocked_users;
create policy "Users manage their own block list"
  on public.blocked_users for all
  using (auth.uid() = blocker_id)
  with check (auth.uid() = blocker_id);

create or replace function public.block_user(p_user_id uuid)
returns void as $$
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if p_user_id is null or p_user_id = auth.uid() then raise exception 'invalid block target'; end if;
  insert into public.blocked_users (blocker_id, blocked_id) values (auth.uid(), p_user_id)
  on conflict do nothing;
end;
$$ language plpgsql security definer set search_path = public;
grant execute on function public.block_user(uuid) to authenticated;

create or replace function public.unblock_user(p_user_id uuid)
returns void as $$
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  delete from public.blocked_users where blocker_id = auth.uid() and blocked_id = p_user_id;
end;
$$ language plpgsql security definer set search_path = public;
grant execute on function public.unblock_user(uuid) to authenticated;

create or replace function public.is_blocked(p_a uuid, p_b uuid)
returns boolean as $$
  select exists (
    select 1 from public.blocked_users
    where (blocker_id = p_a and blocked_id = p_b) or (blocker_id = p_b and blocked_id = p_a)
  );
$$ language sql stable security definer set search_path = public;
grant execute on function public.is_blocked(uuid, uuid) to authenticated;

-- Re-create send_message so blocked members can no longer message each
-- other, even inside an existing conversation thread.
create or replace function public.send_message(p_conversation_id uuid, p_body text)
returns public.messages as $$
declare
  new_message public.messages;
  clean_body text := trim(coalesce(p_body, ''));
  me uuid := auth.uid();
  other uuid;
begin
  if me is null then raise exception 'authentication required'; end if;
  if char_length(clean_body) = 0 then raise exception 'message cannot be empty'; end if;
  if char_length(clean_body) > 4000 then raise exception 'message is too long'; end if;
  if not exists (select 1 from public.conversation_members where conversation_id = p_conversation_id and user_id = me) then
    raise exception 'not a conversation member';
  end if;
  select cm.user_id into other from public.conversation_members cm where cm.conversation_id = p_conversation_id and cm.user_id <> me limit 1;
  if other is not null and public.is_blocked(me, other) then
    raise exception 'You can''t message this person.';
  end if;
  insert into public.messages(conversation_id, sender_id, body)
  values (p_conversation_id, me, clean_body)
  returning * into new_message;
  return new_message;
end;
$$ language plpgsql security definer set search_path = public;
grant execute on function public.send_message(uuid, text) to authenticated;

-- Re-create start_conversation (from PRIVACY-VISIBILITY-MIGRATION.sql) to
-- also refuse opening a brand-new thread with someone who blocked you
-- (or whom you've blocked).
create or replace function public.start_conversation(p_other_user_id uuid, p_initial_message text default null)
returns uuid as $$
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
    select messaging_visibility into other_messaging_visibility from creator_profiles where auth_user_id = p_other_user_id
    union all
    select messaging_visibility from business_profiles where auth_user_id = p_other_user_id
    limit 1;

    if other_messaging_visibility is not null and other_messaging_visibility <> 'everyone' then
      if other_messaging_visibility = 'nobody' then
        raise exception 'This person isn''t accepting new messages right now.';
      elsif other_messaging_visibility = 'verified_only' and not exists (
        select 1 from creator_profiles where auth_user_id = me and verified = true
        union all
        select 1 from business_profiles where auth_user_id = me and verified = true
      ) then
        raise exception 'This person only accepts messages from verified Commissioner accounts.';
      elsif other_messaging_visibility = 'premium_only' and not exists (
        select 1 from creator_profiles where auth_user_id = me and is_premium = true
        union all
        select 1 from business_profiles where auth_user_id = me and is_premium = true
      ) then
        raise exception 'This person only accepts messages from premium Commissioner accounts.';
      end if;
    end if;

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

-- 4. Self-service account deletion request --------------------------------

create table if not exists public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  requested_at timestamptz not null default now(),
  note text
);
alter table public.account_deletion_requests enable row level security;

drop policy if exists "Users can view their own deletion requests" on public.account_deletion_requests;
create policy "Users can view their own deletion requests"
  on public.account_deletion_requests for select
  using (auth.uid() = user_id);

drop policy if exists "Admin can view all deletion requests" on public.account_deletion_requests;
create policy "Admin can view all deletion requests"
  on public.account_deletion_requests for select
  using (coalesce(auth.jwt()->>'email', '') = 'misganareshid27@gmail.com');

create or replace function public.request_account_deletion()
returns void as $$
declare
  me uuid := auth.uid();
begin
  if me is null then raise exception 'authentication required'; end if;

  insert into public.account_deletion_requests (user_id) values (me);

  update public.creator_profiles set
    approved = false, onboarded = false,
    page_name = 'Deleted user', bio = null, avatar_url = null, banner_url = null,
    platforms = '{}'::jsonb, services = '{}'::jsonb, portfolio_link = null,
    details_visibility = 'nobody', messaging_visibility = 'nobody'
  where auth_user_id = me;

  update public.business_profiles set
    approved = false, onboarded = false,
    business_name = 'Deleted user', bio = null, avatar_url = null, banner_url = null,
    website = null,
    details_visibility = 'nobody', messaging_visibility = 'nobody'
  where auth_user_id = me;
end;
$$ language plpgsql security definer set search_path = public;
grant execute on function public.request_account_deletion() to authenticated;
