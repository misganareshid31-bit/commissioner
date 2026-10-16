-- Commissioner deployment extension (2026-10-16)
-- Foundation only: adds preference storage and in-app notification records.
-- This migration does NOT by itself add frontend screens or notification triggers.
-- Run only after the existing Commissioner base migrations have been applied.

begin;

alter table if exists public.creator_profiles
  add column if not exists contact_preferences jsonb not null default
    '{"who_can_message":"members","accepts_collaboration":true,"accepts_campaigns":true}'::jsonb,
  add column if not exists public_profile_enabled boolean not null default true;

alter table if exists public.business_profiles
  add column if not exists contact_preferences jsonb not null default
    '{"who_can_message":"members","accepts_collaboration":true,"accepts_campaigns":true}'::jsonb,
  add column if not exists public_profile_enabled boolean not null default true;

create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  notification_type text not null check (notification_type in (
    'profile_completion','message','connection','campaign_match',
    'campaign_application','verification','plan','system'
  )),
  title text not null check (length(trim(title)) between 1 and 160),
  body text not null default '' check (length(body) <= 2000),
  target_url text,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists user_notifications_recipient_created_idx
  on public.user_notifications (recipient_user_id, created_at desc);
create index if not exists user_notifications_unread_idx
  on public.user_notifications (recipient_user_id, created_at desc)
  where read_at is null;

alter table public.user_notifications enable row level security;

drop policy if exists user_notifications_select_own on public.user_notifications;
create policy user_notifications_select_own
  on public.user_notifications for select
  to authenticated
  using (recipient_user_id = auth.uid());

drop policy if exists user_notifications_update_own on public.user_notifications;
create policy user_notifications_update_own
  on public.user_notifications for update
  to authenticated
  using (recipient_user_id = auth.uid())
  with check (recipient_user_id = auth.uid());

-- Clients cannot create arbitrary notifications. Trusted SQL triggers / server
-- functions may insert them using appropriately privileged execution.
revoke insert, delete on public.user_notifications from anon, authenticated;
grant select, update on public.user_notifications to authenticated;

commit;
