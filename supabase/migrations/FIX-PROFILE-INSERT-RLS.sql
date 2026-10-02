-- Commissioner profile INSERT RLS fix
-- Run once in Supabase SQL Editor after the existing profile migrations.
-- This allows an authenticated user to create only their own profile row.
-- It does not allow a business user to insert into another user's profile.

alter table public.creator_profiles enable row level security;
alter table public.business_profiles enable row level security;

drop policy if exists "Users can insert their own creator profile" on public.creator_profiles;
create policy "Users can insert their own creator profile"
on public.creator_profiles
for insert
to authenticated
with check (auth.uid() = auth_user_id);

drop policy if exists "Users can insert their own business profile" on public.business_profiles;
create policy "Users can insert their own business profile"
on public.business_profiles
for insert
to authenticated
with check (auth.uid() = auth_user_id);
