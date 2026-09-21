-- Commissioner admin controls + feedback inbox
-- 2026-09-21

create table if not exists public.commissioner_site_controls (
  id boolean primary key default true,
  site_closed boolean not null default false,
  site_message text not null default 'Commissioner is temporarily under development. Please check back soon.',
  disabled_pages jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  constraint commissioner_site_controls_singleton check (id = true)
);

insert into public.commissioner_site_controls (id)
values (true)
on conflict (id) do nothing;

alter table public.commissioner_site_controls enable row level security;

drop policy if exists "Anyone can read site controls" on public.commissioner_site_controls;
create policy "Anyone can read site controls"
on public.commissioner_site_controls for select
using (true);

drop function if exists public.admin_update_site_controls(boolean,text,jsonb);
create or replace function public.admin_update_site_controls(
  p_site_closed boolean,
  p_site_message text,
  p_disabled_pages jsonb
)
returns public.commissioner_site_controls
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.commissioner_site_controls;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  update public.commissioner_site_controls
  set site_closed = coalesce(p_site_closed, false),
      site_message = coalesce(nullif(trim(p_site_message), ''), 'Commissioner is temporarily under development. Please check back soon.'),
      disabled_pages = case when jsonb_typeof(coalesce(p_disabled_pages, '[]'::jsonb)) = 'array' then p_disabled_pages else '[]'::jsonb end,
      updated_at = now()
  where id = true
  returning * into result;

  return result;
end;
$$;

revoke all on function public.admin_update_site_controls(boolean,text,jsonb) from public;
grant execute on function public.admin_update_site_controls(boolean,text,jsonb) to authenticated;

-- Feedback admin workflow. Existing feedback rows are preserved.
alter table public.commissioner_feedback
  add column if not exists status text not null default 'new',
  add column if not exists admin_note text,
  add column if not exists reviewed_at timestamptz;

update public.commissioner_feedback
set status = 'new'
where status is null or status not in ('new','reviewed','archived');

alter table public.commissioner_feedback
  drop constraint if exists commissioner_feedback_status_check;
alter table public.commissioner_feedback
  add constraint commissioner_feedback_status_check check (status in ('new','reviewed','archived'));

drop function if exists public.admin_list_feedback();
create or replace function public.admin_list_feedback()
returns table (
  id uuid,
  user_id uuid,
  user_email text,
  feedback_type text,
  message text,
  page text,
  page_url text,
  status text,
  admin_note text,
  created_at timestamptz,
  reviewed_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select f.id, f.user_id, u.email::text, f.feedback_type, f.message,
         coalesce(f.page, '')::text, coalesce(f.page_url, '')::text,
         coalesce(f.status, 'new')::text, f.admin_note, f.created_at, f.reviewed_at
  from public.commissioner_feedback f
  left join auth.users u on u.id = f.user_id
  where public.is_admin()
  order by f.created_at desc;
$$;

revoke all on function public.admin_list_feedback() from public;
grant execute on function public.admin_list_feedback() to authenticated;

drop function if exists public.admin_update_feedback(uuid,text);
create or replace function public.admin_update_feedback(p_feedback_id uuid, p_status text)
returns public.commissioner_feedback
language plpgsql
security definer
set search_path = public
as $$
declare result public.commissioner_feedback;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  if p_status not in ('new','reviewed','archived') then raise exception 'Invalid feedback status'; end if;
  update public.commissioner_feedback
  set status = p_status,
      reviewed_at = case when p_status = 'reviewed' then now() when p_status = 'new' then null else reviewed_at end
  where id = p_feedback_id
  returning * into result;
  return result;
end;
$$;

revoke all on function public.admin_update_feedback(uuid,text) from public;
grant execute on function public.admin_update_feedback(uuid,text) to authenticated;

notify pgrst, 'reload schema';

-- Admin campaign / marketplace moderation RPCs

drop function if exists public.admin_list_campaigns();
create or replace function public.admin_list_campaigns()
returns table (
  id uuid, business_profile_id uuid, business_name text, title text, description text,
  status text, budget text, deadline date, created_at timestamptz
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

drop function if exists public.admin_set_campaign_status(uuid,text);
create or replace function public.admin_set_campaign_status(p_campaign_id uuid, p_status text)
returns public.campaigns
language plpgsql security definer set search_path=public
as $$
declare result public.campaigns;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  if p_status not in ('draft','published','closed','archived') then raise exception 'Invalid campaign status'; end if;
  update public.campaigns set status=p_status where id=p_campaign_id returning * into result;
  return result;
end;
$$;
revoke all on function public.admin_set_campaign_status(uuid,text) from public;
grant execute on function public.admin_set_campaign_status(uuid,text) to authenticated;

drop function if exists public.admin_list_marketplace();
create or replace function public.admin_list_marketplace()
returns table (
  id uuid, owner_type text, owner_id uuid, title text, listing_type text,
  category text, price_display text, active boolean, created_at timestamptz
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

drop function if exists public.admin_set_marketplace_active(uuid,boolean);
create or replace function public.admin_set_marketplace_active(p_listing_id uuid, p_active boolean)
returns public.marketplace_listings
language plpgsql security definer set search_path=public
as $$
declare result public.marketplace_listings;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  update public.marketplace_listings set active=coalesce(p_active,false) where id=p_listing_id returning * into result;
  return result;
end;
$$;
revoke all on function public.admin_set_marketplace_active(uuid,boolean) from public;
grant execute on function public.admin_set_marketplace_active(uuid,boolean) to authenticated;

notify pgrst, 'reload schema';
