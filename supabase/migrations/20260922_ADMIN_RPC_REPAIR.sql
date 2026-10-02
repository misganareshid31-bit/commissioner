-- Commissioner Admin RPC Repair — 2026-09-22
-- Run this AFTER the base Commissioner schema plus the campaign/marketplace tables exist.
-- Fixes PostgREST errors such as:
--   Could not find the function public.admin_list_campaigns without parameters in the schema cache
--   Could not find the function public.admin_list_marketplace without parameters in the schema cache

begin;

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
language sql
security definer
set search_path = public
as $$
  select
    c.id,
    c.business_profile_id,
    b.business_name,
    c.title,
    c.description,
    c.status,
    c.budget,
    c.deadline,
    c.created_at
  from public.campaigns c
  left join public.business_profiles b
    on b.id = c.business_profile_id
  where public.is_admin()
  order by c.created_at desc;
$$;

revoke all on function public.admin_list_campaigns() from public;
grant execute on function public.admin_list_campaigns() to authenticated;

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
language sql
security definer
set search_path = public
as $$
  select
    m.id,
    m.owner_type,
    m.owner_id,
    m.title,
    m.listing_type,
    m.category,
    m.price_display,
    m.active,
    m.created_at
  from public.marketplace_listings m
  where public.is_admin()
  order by m.created_at desc;
$$;

revoke all on function public.admin_list_marketplace() from public;
grant execute on function public.admin_list_marketplace() to authenticated;

notify pgrst, 'reload schema';

commit;
