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
--   values ('Sunrise Kitchen', 'Food & Restaurants', encode(gen_random_bytes(16), 'hex'));
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

-- Lightweight health check used by the Admin UI. It is intentionally safe: it
-- does not create or modify any profile. If this function is callable, the UI
-- can distinguish an installed migration from a missing Supabase function.
create or replace function public.admin_check_setup()
returns jsonb as $$
begin
  if coalesce(auth.jwt()->>'email', '') <> 'misganareshid27@gmail.com' then
    raise exception 'not authorized';
  end if;
  return jsonb_build_object(
    'ready', true,
    'version', 'admin-gift-nfc-2026-08-13'
  );
end;
$$ language plpgsql security definer;
grant execute on function public.admin_check_setup() to authenticated;

-- Creates a new claimable profile and returns its claim token. The name/niche may be null for an open-ended gift profile.
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

-- =====================================================================
-- 6. business_profiles — same pattern as creator_profiles, so businesses
--    can also get a public page, claimed via an NFC card the same way.
-- =====================================================================

create table if not exists business_profiles (
  id uuid primary key default gen_random_uuid()
);

alter table business_profiles add column if not exists auth_user_id uuid references auth.users(id) on delete cascade;
alter table business_profiles add column if not exists claim_token text;
alter table business_profiles add column if not exists claimed boolean default false;
alter table business_profiles add column if not exists business_name text;
alter table business_profiles add column if not exists username text;
alter table business_profiles add column if not exists avatar_url text;
alter table business_profiles add column if not exists banner_url text;
alter table business_profiles add column if not exists bio text;
alter table business_profiles add column if not exists city text;
alter table business_profiles add column if not exists language text;
alter table business_profiles add column if not exists industry text;
alter table business_profiles add column if not exists website text;
alter table business_profiles add column if not exists looking_for text[] default '{}';
alter table business_profiles add column if not exists budget_range text;
alter table business_profiles add column if not exists preferences text;
alter table business_profiles add column if not exists verified boolean default false;
alter table business_profiles add column if not exists onboarded boolean default false;
alter table business_profiles add column if not exists approved boolean default false;
alter table business_profiles add column if not exists created_at timestamptz default now();
alter table business_profiles add column if not exists updated_at timestamptz default now();

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'business_profiles_auth_user_id_key') then
    alter table business_profiles add constraint business_profiles_auth_user_id_key unique (auth_user_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'business_profiles_username_key') then
    alter table business_profiles add constraint business_profiles_username_key unique (username);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'business_profiles_claim_token_key') then
    alter table business_profiles add constraint business_profiles_claim_token_key unique (claim_token);
  end if;
end $$;

alter table business_profiles enable row level security;

drop policy if exists "Public can view approved business profiles" on business_profiles;
create policy "Public can view approved business profiles"
  on business_profiles for select
  using (onboarded = true and approved = true);

drop policy if exists "Businesses can view their own profile" on business_profiles;
create policy "Businesses can view their own profile"
  on business_profiles for select
  using (auth.uid() = auth_user_id);

drop policy if exists "Businesses can update their own profile" on business_profiles;
create policy "Businesses can update their own profile"
  on business_profiles for update
  using (auth.uid() = auth_user_id);

drop policy if exists "Admin can view all business profiles" on business_profiles;
create policy "Admin can view all business profiles"
  on business_profiles for select
  using (coalesce(auth.jwt()->>'email', '') = 'misganareshid27@gmail.com');

drop policy if exists "Admin can update all business profiles" on business_profiles;
create policy "Admin can update all business profiles"
  on business_profiles for update
  using (coalesce(auth.jwt()->>'email', '') = 'misganareshid27@gmail.com');

-- Same protection as creator_profiles — reuses the same trigger function,
-- since it works generically off NEW/OLD approved+verified.
drop trigger if exists protect_admin_fields_trigger on business_profiles;
create trigger protect_admin_fields_trigger
  before update on business_profiles
  for each row execute procedure public.protect_admin_fields();

drop trigger if exists touch_business_profiles on business_profiles;
create trigger touch_business_profiles
  before update on business_profiles
  for each row execute procedure public.touch_updated_at();

-- Auto-create a blank business row when someone signs up choosing "Business"
create or replace function public.handle_new_business()
returns trigger as $$
begin
  if (new.raw_user_meta_data->>'role') = 'business' then
    insert into public.business_profiles (auth_user_id, claimed) values (new.id, true)
    on conflict (auth_user_id) do nothing;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created_business on auth.users;
create trigger on_auth_user_created_business
  after insert on auth.users
  for each row execute procedure public.handle_new_business();

-- Claim-link lookup + save for businesses (mirrors get_claim_profile / claim_profile)
create or replace function public.get_claim_business(p_token text)
returns setof business_profiles as $$
  select * from business_profiles
  where claim_token = p_token and approved = false;
$$ language sql security definer;
grant execute on function public.get_claim_business(text) to anon, authenticated;

create or replace function public.claim_business(
  p_token text,
  p_business_name text,
  p_username text,
  p_city text,
  p_language text,
  p_bio text,
  p_avatar_url text,
  p_banner_url text,
  p_website text,
  p_looking_for text[],
  p_budget_range text,
  p_preferences text
)
returns boolean as $$
declare
  updated_rows int;
begin
  update business_profiles set
    business_name = p_business_name,
    username = p_username,
    city = p_city,
    language = p_language,
    bio = p_bio,
    avatar_url = p_avatar_url,
    banner_url = p_banner_url,
    website = p_website,
    looking_for = p_looking_for,
    budget_range = p_budget_range,
    preferences = p_preferences,
    onboarded = true,
    claimed = true
  where claim_token = p_token and approved = false;
  get diagnostics updated_rows = row_count;
  return updated_rows > 0;
end;
$$ language plpgsql security definer;
grant execute on function public.claim_business(text, text, text, text, text, text, text, text, text, text[], text, text) to anon, authenticated;

-- One combined lookup so the claim page (and NFC link) doesn't need to
-- know in advance whether a token belongs to a creator or a business —
-- it just asks this, and gets back whichever one matches (or neither).
create or replace function public.get_claim_any(p_token text)
returns jsonb as $$
declare
  c jsonb;
  b jsonb;
begin
  select to_jsonb(cp) into c from creator_profiles cp where claim_token = p_token and approved = false;
  if c is not null then
    return jsonb_build_object('kind', 'creator') || c;
  end if;
  select to_jsonb(bp) into b from business_profiles bp where claim_token = p_token and approved = false;
  if b is not null then
    return jsonb_build_object('kind', 'business') || b;
  end if;
  return null;
end;
$$ language plpgsql security definer;
grant execute on function public.get_claim_any(text) to anon, authenticated;

-- Admin-only: create a new claimable business page. Same authorization
-- pattern as admin_create_claim — checked here, not just in the UI.
create or replace function public.admin_create_business_claim(p_business_name text, p_industry text, p_verified boolean default true)
returns text as $$
declare
  new_token text;
begin
  if coalesce(auth.jwt()->>'email', '') <> 'misganareshid27@gmail.com' then
    raise exception 'not authorized';
  end if;
  new_token := encode(gen_random_bytes(16), 'hex');
  insert into business_profiles (business_name, industry, claim_token, verified)
  values (p_business_name, p_industry, new_token, p_verified);
  return new_token;
end;
$$ language plpgsql security definer;
grant execute on function public.admin_create_business_claim(text, text, boolean) to authenticated;

-- Storage: businesses upload logos/banners under the same buckets, scoped
-- the same two ways creators are — by their own auth.uid() once signed up
-- normally, or by claim-token folder when claimed via an NFC card. Both
-- policies already exist from the creator setup above and are bucket-wide,
-- not creator-specific, so no new storage policies are needed here.

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
