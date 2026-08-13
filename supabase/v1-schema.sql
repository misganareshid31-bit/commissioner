-- Commissioner V1.0 — full schema
-- Run this in Supabase: Dashboard -> SQL Editor -> New query
-- Safe to run on top of the existing creator_profiles/business_profiles
-- tables from earlier — it only adds what's missing.

-- ============================================================
-- 1. Core profiles table (role + admin flag, one row per user)
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('creator', 'business')),
  is_admin boolean default false,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Profiles are publicly viewable" on public.profiles;
create policy "Profiles are publicly viewable"
  on public.profiles for select using (true);

drop policy if exists "Users can update their own profile row" on public.profiles;
create policy "Users can update their own profile row"
  on public.profiles for update using (auth.uid() = id);

-- ============================================================
-- 2. Creator profiles (extends the existing table from earlier)
-- ============================================================
create table if not exists public.creator_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  city text,
  country text,
  bio text,
  verified boolean default false,
  created_at timestamptz default now()
);

alter table public.creator_profiles
  add column if not exists username text unique,
  add column if not exists page_name text,
  add column if not exists language text,
  add column if not exists primary_niche text,
  add column if not exists secondary_niches text[] default '{}',
  add column if not exists platforms jsonb default '{}',
  add column if not exists audience jsonb default '{}',
  add column if not exists services jsonb default '{}',
  add column if not exists portfolio_link text,
  add column if not exists portfolio_images text[] default '{}',
  add column if not exists portfolio_videos text[] default '{}',
  add column if not exists availability text default 'Available now',
  add column if not exists professional_preferences text,
  add column if not exists profile_photo_url text,
  add column if not exists cover_image_url text,
  add column if not exists follower_count int default 0,
  add column if not exists nfc_card_id uuid;

alter table public.creator_profiles enable row level security;

drop policy if exists "Creator profiles are publicly viewable" on public.creator_profiles;
create policy "Creator profiles are publicly viewable"
  on public.creator_profiles for select using (true);

drop policy if exists "Users can update their own creator profile" on public.creator_profiles;
create policy "Users can update their own creator profile"
  on public.creator_profiles for update using (auth.uid() = id);

drop policy if exists "Admins can update any creator profile" on public.creator_profiles;
create policy "Admins can update any creator profile"
  on public.creator_profiles for update
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

drop policy if exists "Admins can delete creator profiles" on public.creator_profiles;
create policy "Admins can delete creator profiles"
  on public.creator_profiles for delete
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

-- ============================================================
-- 3. Business profiles (extends the existing table from earlier)
-- ============================================================
create table if not exists public.business_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  company_name text,
  industry text,
  city text,
  verified boolean default false,
  created_at timestamptz default now()
);

alter table public.business_profiles
  add column if not exists slug text unique,
  add column if not exists logo_url text,
  add column if not exists website text,
  add column if not exists description text,
  add column if not exists social_links jsonb default '{}';

alter table public.business_profiles enable row level security;

drop policy if exists "Business profiles are publicly viewable" on public.business_profiles;
create policy "Business profiles are publicly viewable"
  on public.business_profiles for select using (true);

drop policy if exists "Users can update their own business profile" on public.business_profiles;
create policy "Users can update their own business profile"
  on public.business_profiles for update using (auth.uid() = id);

drop policy if exists "Admins can update any business profile" on public.business_profiles;
create policy "Admins can update any business profile"
  on public.business_profiles for update
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

drop policy if exists "Admins can delete business profiles" on public.business_profiles;
create policy "Admins can delete business profiles"
  on public.business_profiles for delete
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

-- ============================================================
-- 4. Social accounts (normalized, one row per platform per creator)
-- ============================================================
create table if not exists public.social_accounts (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid references public.creator_profiles(id) on delete cascade,
  platform text not null,
  handle text,
  url text,
  followers int,
  engagement numeric,
  created_at timestamptz default now()
);

alter table public.social_accounts enable row level security;

drop policy if exists "Social accounts are publicly viewable" on public.social_accounts;
create policy "Social accounts are publicly viewable"
  on public.social_accounts for select using (true);

drop policy if exists "Users manage their own social accounts" on public.social_accounts;
create policy "Users manage their own social accounts"
  on public.social_accounts for all
  using (auth.uid() = creator_id) with check (auth.uid() = creator_id);

-- ============================================================
-- 5. NFC cards
-- ============================================================
create table if not exists public.nfc_cards (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid references public.creator_profiles(id) on delete set null,
  status text default 'unassigned' check (status in ('unassigned', 'assigned', 'active', 'inactive')),
  card_code text unique,
  assigned_at timestamptz,
  created_at timestamptz default now()
);

alter table public.nfc_cards enable row level security;

drop policy if exists "NFC card status is publicly viewable" on public.nfc_cards;
create policy "NFC card status is publicly viewable"
  on public.nfc_cards for select using (true);

drop policy if exists "Only admins manage NFC cards" on public.nfc_cards;
create policy "Only admins manage NFC cards"
  on public.nfc_cards for all
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true))
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

-- ============================================================
-- 6. Notifications
-- ============================================================
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  message text not null,
  read boolean default false,
  created_at timestamptz default now()
);

alter table public.notifications enable row level security;

drop policy if exists "Users see only their own notifications" on public.notifications;
create policy "Users see only their own notifications"
  on public.notifications for select using (auth.uid() = user_id);

drop policy if exists "Users can mark their own notifications read" on public.notifications;
create policy "Users can mark their own notifications read"
  on public.notifications for update using (auth.uid() = user_id);

-- ============================================================
-- 7. Auto-create profile rows on sign-up (role-aware)
-- ============================================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, role) values (new.id, coalesce(new.raw_user_meta_data->>'role', 'creator'));
  if coalesce(new.raw_user_meta_data->>'role', 'creator') = 'business' then
    insert into public.business_profiles (id) values (new.id);
  else
    insert into public.creator_profiles (id) values (new.id);
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- 8. Storage buckets for images/videos
-- ============================================================
insert into storage.buckets (id, name, public)
values
  ('profile-photos', 'profile-photos', true),
  ('business-logos', 'business-logos', true),
  ('portfolio', 'portfolio', true)
on conflict (id) do nothing;

drop policy if exists "Public read access to profile photos" on storage.objects;
create policy "Public read access to profile photos"
  on storage.objects for select using (bucket_id = 'profile-photos');
drop policy if exists "Authenticated users can upload their own profile photo" on storage.objects;
create policy "Authenticated users can upload their own profile photo"
  on storage.objects for insert with check (bucket_id = 'profile-photos' and auth.role() = 'authenticated');

drop policy if exists "Public read access to business logos" on storage.objects;
create policy "Public read access to business logos"
  on storage.objects for select using (bucket_id = 'business-logos');
drop policy if exists "Authenticated users can upload their own logo" on storage.objects;
create policy "Authenticated users can upload their own logo"
  on storage.objects for insert with check (bucket_id = 'business-logos' and auth.role() = 'authenticated');

drop policy if exists "Public read access to portfolio" on storage.objects;
create policy "Public read access to portfolio"
  on storage.objects for select using (bucket_id = 'portfolio');
drop policy if exists "Authenticated users can upload portfolio items" on storage.objects;
create policy "Authenticated users can upload portfolio items"
  on storage.objects for insert with check (bucket_id = 'portfolio' and auth.role() = 'authenticated');

-- ============================================================
-- 9. Make yourself an admin (run this LAST, after you sign up)
-- Replace the email below with your own account's email.
-- ============================================================
-- update public.profiles set is_admin = true
-- where id = (select id from auth.users where email = 'YOUR_EMAIL_HERE');
