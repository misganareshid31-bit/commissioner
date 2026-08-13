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

-- Un-tie the primary key from auth.users so a profile can be pre-created
-- (for an NFC "claim link") before anyone has actually signed up for it.
-- auth_user_id is the new nullable link to a real logged-in account —
-- it's set immediately for normal signups, and stays null for profiles
-- waiting to be claimed via a card.
do $$
begin
  if exists (
    select 1 from information_schema.table_constraints
    where table_name = 'creator_profiles' and constraint_name = 'creator_profiles_id_fkey'
  ) then
    alter table creator_profiles drop constraint creator_profiles_id_fkey;
  end if;
end $$;
alter table creator_profiles alter column id set default gen_random_uuid();
alter table creator_profiles add column if not exists auth_user_id uuid references auth.users(id) on delete cascade;
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'creator_profiles_auth_user_id_key'
  ) then
    alter table creator_profiles add constraint creator_profiles_auth_user_id_key unique (auth_user_id);
  end if;
end $$;
alter table creator_profiles add column if not exists claim_token text;
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'creator_profiles_claim_token_key'
  ) then
    alter table creator_profiles add constraint creator_profiles_claim_token_key unique (claim_token);
  end if;
end $$;
alter table creator_profiles add column if not exists claimed boolean default false;

-- One-time backfill: any row created before this migration had id = the
-- signed-up user's auth id directly. Copy that into auth_user_id so those
-- existing accounts keep working, and mark them claimed.
update creator_profiles set auth_user_id = id where auth_user_id is null and id in (select id from auth.users);
update creator_profiles set claimed = true where auth_user_id is not null;

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

-- This is the ONE account allowed to see every profile, create claim
-- links, and approve/verify people. Everything below checks against it —
-- change this if the admin's login email ever changes.
-- ADMIN EMAIL: misganareshid27@gmail.com

drop policy if exists "Public can view approved creator profiles" on creator_profiles;
create policy "Public can view approved creator profiles"
  on creator_profiles for select
  using (onboarded = true and approved = true);

drop policy if exists "Public can view published creator profiles" on creator_profiles;

drop policy if exists "Users can view their own profile" on creator_profiles;
create policy "Users can view their own profile"
  on creator_profiles for select
  using (auth.uid() = auth_user_id);

drop policy if exists "Users can update their own profile" on creator_profiles;
create policy "Users can update their own profile"
  on creator_profiles for update
  using (auth.uid() = auth_user_id);

drop policy if exists "Admin can view all profiles" on creator_profiles;
create policy "Admin can view all profiles"
  on creator_profiles for select
  using (coalesce(auth.jwt()->>'email', '') = 'misganareshid27@gmail.com');

drop policy if exists "Admin can update all profiles" on creator_profiles;
create policy "Admin can update all profiles"
  on creator_profiles for update
  using (coalesce(auth.jwt()->>'email', '') = 'misganareshid27@gmail.com');

-- Safety net: don't let creators flip approved/verified on themselves
-- through the app. Only the admin account, the Supabase dashboard, or a
-- service-role key can move these two fields.
create or replace function public.protect_admin_fields()
returns trigger as $$
begin
  if auth.role() <> 'service_role' and coalesce(auth.jwt()->>'email', '') <> 'misganareshid27@gmail.com' then
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
    insert into public.creator_profiles (auth_user_id, claimed) values (new.id, true)
    on conflict (auth_user_id) do nothing;
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

-- 6. Claim-link functions (power the NFC card flow — no login required).
-- To create a card: insert a row yourself with page_name/primary_niche set
-- and a random claim_token, e.g.:
--   insert into creator_profiles (page_name, primary_niche, claim_token)
--   values ('Amara Eats', 'Food & Restaurants', encode(gen_random_bytes(16), 'hex'));
-- Then program the NFC card with:
--   https://commissioner-dusky.vercel.app/?claim=<that token>

-- Lets the claim page look up (and re-open, if they come back before
-- approval) the profile tied to a token — without any login.
create or replace function public.get_claim_profile(p_token text)
returns setof creator_profiles as $$
  select * from creator_profiles
  where claim_token = p_token and approved = false;
$$ language sql security definer;
grant execute on function public.get_claim_profile(text) to anon, authenticated;

-- Lets the claim page save the creator's own details against their token.
-- Stays open to edits until you approve the profile — after that this
-- silently does nothing (approved = false guards every field this touches).
create or replace function public.claim_profile(
  p_token text,
  p_page_name text,
  p_username text,
  p_city text,
  p_language text,
  p_bio text,
  p_avatar_url text,
  p_banner_url text,
  p_platforms jsonb,
  p_portfolio_link text,
  p_availability text,
  p_preferences text
)
returns boolean as $$
declare
  updated_rows int;
begin
  update creator_profiles set
    page_name = p_page_name,
    username = p_username,
    city = p_city,
    language = p_language,
    bio = p_bio,
    avatar_url = p_avatar_url,
    banner_url = p_banner_url,
    platforms = p_platforms,
    portfolio_link = p_portfolio_link,
    availability = p_availability,
    professional_preferences = p_preferences,
    onboarded = true,
    claimed = true
  where claim_token = p_token and approved = false;
  get diagnostics updated_rows = row_count;
  return updated_rows > 0;
end;
$$ language plpgsql security definer;
grant execute on function public.claim_profile(text, text, text, text, text, text, text, text, jsonb, text, text, text) to anon, authenticated;

-- Creates a new pre-filled, unclaimed profile and returns its claim token.
-- This is what the in-app admin page calls. Enforced here, not just in the
-- UI — anyone else who tries calling this directly gets rejected even if
-- they somehow found the function name.
create or replace function public.admin_create_claim(p_page_name text, p_primary_niche text, p_verified boolean default true)
returns text as $$
declare
  new_token text;
begin
  if coalesce(auth.jwt()->>'email', '') <> 'misganareshid27@gmail.com' then
    raise exception 'not authorized';
  end if;
  new_token := encode(gen_random_bytes(16), 'hex');
  insert into creator_profiles (page_name, primary_niche, claim_token, verified)
  values (p_page_name, p_primary_niche, new_token, p_verified);
  return new_token;
end;
$$ language plpgsql security definer;
grant execute on function public.admin_create_claim(text, text, boolean) to authenticated;

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

-- Claim-link visitors aren't logged in, so they can't be scoped by
-- auth.uid() like normal uploads — instead they're scoped to the
-- 'claim/' prefix, which is only reachable if you know a real token
-- (enforced by the app, which builds the path as claim/<token>/...).
drop policy if exists "Anyone can upload under a claim token - avatars" on storage.objects;
create policy "Anyone can upload under a claim token - avatars"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = 'claim');

drop policy if exists "Anyone can upload under a claim token - banners" on storage.objects;
create policy "Anyone can upload under a claim token - banners"
  on storage.objects for insert
  with check (bucket_id = 'banners' and (storage.foldername(name))[1] = 'claim');

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
