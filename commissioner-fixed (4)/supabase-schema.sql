-- Commissioner: creator_profiles schema
-- Matches the field names actually used in Site.jsx (page_name, city, language,
-- primary_niche, secondary_niches, platforms, audience, services, portfolio_link,
-- professional_preferences, avatar_url, banner_url, onboarded, approved).
-- Run this in Supabase Dashboard → SQL Editor → New query.
-- Safe to run more than once — every step below either creates-if-missing
-- or drops-then-recreates, so re-running this after a partial/earlier
-- attempt won't error out.
--
-- HOW YOU APPROVE NEW CREATORS:
-- After someone finishes onboarding, their row has onboarded = true but
-- approved = false — they won't appear on the public site yet.
-- Go to Supabase Dashboard → Table Editor → creator_profiles, find their row,
-- review their info, and change the "approved" column to true. That's it —
-- they'll show up in Discover creators on your next page load.
-- (Table Editor uses your admin access, so it bypasses the safety trigger below
-- that blocks the app itself from setting this field.)

-- 1. Table — create if missing, then add any columns that aren't there yet.
create table if not exists creator_profiles (
  id uuid primary key references auth.users(id) on delete cascade
);

alter table creator_profiles add column if not exists page_name text;
alter table creator_profiles add column if not exists username text;
alter table creator_profiles add column if not exists avatar_url text;
alter table creator_profiles add column if not exists banner_url text;
alter table creator_profiles add column if not exists bio text;
alter table creator_profiles add column if not exists city text;
alter table creator_profiles add column if not exists language text;
alter table creator_profiles add column if not exists primary_niche text;
alter table creator_profiles add column if not exists secondary_niches text[] default '{}';
alter table creator_profiles add column if not exists platforms jsonb default '{}';
alter table creator_profiles add column if not exists audience jsonb default '{}';
alter table creator_profiles add column if not exists services jsonb default '{}';
alter table creator_profiles add column if not exists portfolio_link text;
alter table creator_profiles add column if not exists availability text default 'Available now';
alter table creator_profiles add column if not exists professional_preferences text;
alter table creator_profiles add column if not exists verified boolean default false;
alter table creator_profiles add column if not exists onboarded boolean default false;
alter table creator_profiles add column if not exists approved boolean default false;
alter table creator_profiles add column if not exists created_at timestamptz default now();
alter table creator_profiles add column if not exists updated_at timestamptz default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'creator_profiles_username_key'
  ) then
    alter table creator_profiles add constraint creator_profiles_username_key unique (username);
  end if;
end $$;

-- 2. Row Level Security
alter table creator_profiles enable row level security;

drop policy if exists "Public can view approved creator profiles" on creator_profiles;
create policy "Public can view approved creator profiles"
  on creator_profiles for select
  using (onboarded = true and approved = true);

drop policy if exists "Public can view published creator profiles" on creator_profiles;

drop policy if exists "Users can view their own profile" on creator_profiles;
create policy "Users can view their own profile"
  on creator_profiles for select
  using (auth.uid() = id);

drop policy if exists "Users can update their own profile" on creator_profiles;
create policy "Users can update their own profile"
  on creator_profiles for update
  using (auth.uid() = id);

-- Safety net: don't let creators flip approved/verified on themselves
-- through the app. Only changes made from the Supabase dashboard (or a
-- service-role key) can move these two fields — that's how you approve people.
create or replace function public.protect_admin_fields()
returns trigger as $$
begin
  if auth.role() <> 'service_role' then
    new.approved = old.approved;
    new.verified = old.verified;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists protect_admin_fields_trigger on creator_profiles;
create trigger protect_admin_fields_trigger
  before update on creator_profiles
  for each row execute procedure public.protect_admin_fields();

-- 3. Auto-create a blank profile row when someone signs up as a creator
create or replace function public.handle_new_creator()
returns trigger as $$
begin
  if (new.raw_user_meta_data->>'role') = 'creator' then
    insert into public.creator_profiles (id) values (new.id)
    on conflict (id) do nothing;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created_creator on auth.users;
create trigger on_auth_user_created_creator
  after insert on auth.users
  for each row execute procedure public.handle_new_creator();

-- 4. updated_at auto-touch
create or replace function public.touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists touch_creator_profiles on creator_profiles;
create trigger touch_creator_profiles
  before update on creator_profiles
  for each row execute procedure public.touch_updated_at();

-- 5. Storage buckets for profile photo + banner (public read, owner write)
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('banners', 'banners', true)
on conflict (id) do nothing;

drop policy if exists "Public read avatars" on storage.objects;
create policy "Public read avatars"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "Users upload their own avatar" on storage.objects;
create policy "Users upload their own avatar"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users update their own avatar" on storage.objects;
create policy "Users update their own avatar"
  on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Public read banners" on storage.objects;
create policy "Public read banners"
  on storage.objects for select
  using (bucket_id = 'banners');

drop policy if exists "Users upload their own banner" on storage.objects;
create policy "Users upload their own banner"
  on storage.objects for insert
  with check (bucket_id = 'banners' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users update their own banner" on storage.objects;
create policy "Users update their own banner"
  on storage.objects for update
  using (bucket_id = 'banners' and (storage.foldername(name))[1] = auth.uid()::text);
