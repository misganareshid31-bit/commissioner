-- Commissioner: creator_profiles schema
-- Matches the field names actually used in Site.jsx (page_name, city, language,
-- primary_niche, secondary_niches, platforms, audience, services, portfolio_link,
-- professional_preferences, avatar_url, banner_url, onboarded, approved).
-- Run this in Supabase Dashboard → SQL Editor → New query.
--
-- HOW YOU APPROVE NEW CREATORS:
-- After someone finishes onboarding, their row has onboarded = true but
-- approved = false — they won't appear on the public site yet.
-- Go to Supabase Dashboard → Table Editor → creator_profiles, find their row,
-- review their info, and change the "approved" column to true. That's it —
-- they'll show up in Discover creators on your next page load.
-- (Table Editor uses your admin access, so it bypasses the safety trigger below
-- that blocks the app itself from setting this field.)

-- 1. Table
create table if not exists creator_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  page_name text,
  username text unique,
  avatar_url text,
  banner_url text,
  bio text,
  city text,
  language text,
  primary_niche text,
  secondary_niches text[] default '{}',
  platforms jsonb default '{}',        -- { "Instagram": { handle, followers, engagement }, ... }
  audience jsonb default '{}',         -- { age, gender, location, avg_views, avg_reach }
  services jsonb default '{}',         -- { tiktok, reel, story, youtube, monthly, ugc }
  portfolio_link text,
  availability text default 'Available now',
  professional_preferences text,
  verified boolean default false,
  onboarded boolean default false,     -- true once they finish the setup flow
  approved boolean default false,      -- you flip this to true after manually reviewing them
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. Row Level Security
alter table creator_profiles enable row level security;

-- Only shows up publicly once BOTH the creator has finished onboarding
-- AND you've manually approved them (see "reviewing new creators" below)
create policy "Public can view approved creator profiles"
  on creator_profiles for select
  using (onboarded = true and approved = true);

create policy "Users can view their own profile"
  on creator_profiles for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on creator_profiles for update
  using (auth.uid() = id);

-- Safety net: even though the policy above lets creators update their own
-- row, don't let them flip approved/verified on themselves through the app.
-- Only changes made from the Supabase dashboard (or service-role key) can
-- move these two fields — that's how you approve people.
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

create policy "Public read avatars"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "Users upload their own avatar"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users update their own avatar"
  on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Public read banners"
  on storage.objects for select
  using (bucket_id = 'banners');

create policy "Users upload their own banner"
  on storage.objects for insert
  with check (bucket_id = 'banners' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users update their own banner"
  on storage.objects for update
  using (bucket_id = 'banners' and (storage.foldername(name))[1] = auth.uid()::text);
