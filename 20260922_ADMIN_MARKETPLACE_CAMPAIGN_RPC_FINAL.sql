-- Commissioner: self-contained admin campaign + marketplace moderation repair
-- 2026-09-22
-- Run this AFTER the base Commissioner schema. It safely creates the campaign table
-- if the campaign migration was missed, then installs both zero-parameter admin RPCs.

create extension if not exists pgcrypto;

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  business_profile_id uuid not null references public.business_profiles(id) on delete cascade,
  title text not null,
  description text not null,
  niche text,
  budget text,
  deadline date,
  location text,
  requirements text,
  status text not null default 'published' check (status in ('draft','published','closed','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
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

-- Admin campaign listing.
drop function if exists public.admin_list_campaigns();
create or replace function public.admin_list_campaigns()
returns table (
  id uuid,
  business_profile_id uuid,
  business_name text,
  title text,
  description text,
  status text,
  budget text,
  deadline date,
  created_at timestamptz
)
language sql security definer set search_path=public
as $$
  select c.id, c.business_profile_id, b.business_name, c.title, c.description,
         c.status, c.budget, c.deadline, c.created_at
  from public.campaigns c
  left join public.business_profiles b on b.id=c.business_profile_id
  where public.is_admin()
  order by c.created_at desc;
$$;
revoke all on function public.admin_list_campaigns() from public;
grant execute on function public.admin_list_campaigns() to authenticated;

-- Admin campaign status update.
drop function if exists public.admin_set_campaign_status(uuid,text);
create or replace function public.admin_set_campaign_status(p_campaign_id uuid, p_status text)
returns public.campaigns
language plpgsql security definer set search_path=public
as $$
declare result public.campaigns;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  if p_status not in ('draft','published','closed','archived') then raise exception 'Invalid campaign status'; end if;
  update public.campaigns set status=p_status, updated_at=now() where id=p_campaign_id returning * into result;
  return result;
end;
$$;
revoke all on function public.admin_set_campaign_status(uuid,text) from public;
grant execute on function public.admin_set_campaign_status(uuid,text) to authenticated;

-- Admin marketplace listing.
-- marketplace_listings is part of the Commissioner marketplace schema.
drop function if exists public.admin_list_marketplace();
create or replace function public.admin_list_marketplace()
returns table (
  id uuid,
  owner_type text,
  owner_id uuid,
  title text,
  listing_type text,
  category text,
  price_display text,
  active boolean,
  created_at timestamptz
)
language sql security definer set search_path=public
as $$
  select m.id,m.owner_type,m.owner_id,m.title,m.listing_type,m.category,m.price_display,m.active,m.created_at
  from public.marketplace_listings m
  where public.is_admin()
  order by m.created_at desc;
$$;
revoke all on function public.admin_list_marketplace() from public;
grant execute on function public.admin_list_marketplace() to authenticated;

-- Admin marketplace active/inactive moderation.
drop function if exists public.admin_set_marketplace_active(uuid,boolean);
create or replace function public.admin_set_marketplace_active(p_listing_id uuid, p_active boolean)
returns public.marketplace_listings
language plpgsql security definer set search_path=public
as $$
declare result public.marketplace_listings;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  update public.marketplace_listings set active=coalesce(p_active,false), updated_at=now()
  where id=p_listing_id returning * into result;
  return result;
end;
$$;
revoke all on function public.admin_set_marketplace_active(uuid,boolean) from public;
grant execute on function public.admin_set_marketplace_active(uuid,boolean) to authenticated;

notify pgrst, 'reload schema';
