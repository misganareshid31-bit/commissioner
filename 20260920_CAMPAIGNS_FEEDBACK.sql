create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  business_profile_id uuid not null references public.business_profiles(id) on delete cascade,
  title text not null, description text not null, niche text, budget text, deadline date,
  location text, requirements text,
  status text not null default 'published' check (status in ('draft','published','closed','archived')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists campaigns_status_created_idx on public.campaigns(status, created_at desc);
create index if not exists campaigns_business_idx on public.campaigns(business_profile_id);
alter table public.campaigns enable row level security;
drop policy if exists "Published campaigns are public" on public.campaigns;
create policy "Published campaigns are public" on public.campaigns for select using (status='published');
drop policy if exists "Business owners can manage campaigns" on public.campaigns;
create policy "Business owners can manage campaigns" on public.campaigns for all to authenticated
using (exists (select 1 from public.business_profiles b where b.id=business_profile_id and b.auth_user_id=auth.uid()))
with check (exists (select 1 from public.business_profiles b where b.id=business_profile_id and b.auth_user_id=auth.uid()));

create table if not exists public.commissioner_feedback (
  id uuid primary key default gen_random_uuid(), user_id uuid null references auth.users(id) on delete set null,
  feedback_type text not null default 'general', message text not null check (char_length(message) between 1 and 1500),
  page text, created_at timestamptz not null default now()
);
create index if not exists commissioner_feedback_created_idx on public.commissioner_feedback(created_at desc);
alter table public.commissioner_feedback enable row level security;
drop policy if exists "Anyone can send feedback" on public.commissioner_feedback;
create policy "Anyone can send feedback" on public.commissioner_feedback for insert to anon, authenticated
with check (user_id is null or user_id=auth.uid());
