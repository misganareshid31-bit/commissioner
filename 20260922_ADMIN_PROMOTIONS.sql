-- Commissioner: admin-only paid promotions
-- Apply this migration in Supabase SQL Editor after the existing Commissioner migrations.

create table if not exists public.commissioner_promotions (
  id uuid primary key default gen_random_uuid(),
  advertiser_name text not null,
  headline text not null,
  description text,
  image_url text,
  button_text text not null default 'Learn more',
  destination_url text not null,
  placement text not null default 'all' check (placement in ('all','home','creators','businesses','marketplace','campaigns')),
  audience text not null default 'everyone' check (audience in ('everyone','creators','businesses')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  status text not null default 'draft' check (status in ('draft','active','paused','ended')),
  impressions bigint not null default 0,
  clicks bigint not null default 0,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists commissioner_promotions_public_idx
  on public.commissioner_promotions (status, placement, starts_at, ends_at);

alter table public.commissioner_promotions enable row level security;

-- Public users can only read currently active promotions. Admins can read all rows.
drop policy if exists commissioner_promotions_public_read on public.commissioner_promotions;
create policy commissioner_promotions_public_read
on public.commissioner_promotions
for select
using (
  (status = 'active' and starts_at <= now() and (ends_at is null or ends_at > now()))
  or public.is_admin()
);

-- No direct client writes. All admin changes go through SECURITY DEFINER RPCs.
drop policy if exists commissioner_promotions_admin_write on public.commissioner_promotions;

create or replace function public.admin_list_promotions()
returns setof public.commissioner_promotions
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorized';
  end if;
  return query
    select * from public.commissioner_promotions
    order by created_at desc;
end;
$$;

create or replace function public.admin_create_promotion(
  p_advertiser_name text,
  p_headline text,
  p_description text,
  p_image_url text,
  p_button_text text,
  p_destination_url text,
  p_placement text,
  p_audience text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_status text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.is_admin() then raise exception 'Not authorized'; end if;
  if nullif(trim(p_advertiser_name), '') is null then raise exception 'Advertiser name is required'; end if;
  if nullif(trim(p_headline), '') is null then raise exception 'Headline is required'; end if;
  if nullif(trim(p_destination_url), '') is null then raise exception 'Destination URL is required'; end if;
  if p_placement not in ('all','home','creators','businesses','marketplace','campaigns') then raise exception 'Invalid placement'; end if;
  if p_audience not in ('everyone','creators','businesses') then raise exception 'Invalid audience'; end if;
  if p_status not in ('draft','active','paused','ended') then raise exception 'Invalid status'; end if;
  if p_ends_at is not null and p_ends_at <= p_starts_at then raise exception 'End date must be after start date'; end if;

  insert into public.commissioner_promotions
    (advertiser_name, headline, description, image_url, button_text, destination_url, placement, audience, starts_at, ends_at, status, created_by)
  values
    (trim(p_advertiser_name), trim(p_headline), nullif(trim(p_description), ''), nullif(trim(p_image_url), ''),
     coalesce(nullif(trim(p_button_text), ''), 'Learn more'), trim(p_destination_url), p_placement, p_audience,
     coalesce(p_starts_at, now()), p_ends_at, p_status, auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.admin_update_promotion(
  p_id uuid,
  p_advertiser_name text,
  p_headline text,
  p_description text,
  p_image_url text,
  p_button_text text,
  p_destination_url text,
  p_placement text,
  p_audience text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_status text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Not authorized'; end if;
  update public.commissioner_promotions
  set advertiser_name=trim(p_advertiser_name), headline=trim(p_headline), description=nullif(trim(p_description), ''),
      image_url=nullif(trim(p_image_url), ''), button_text=coalesce(nullif(trim(p_button_text), ''),'Learn more'),
      destination_url=trim(p_destination_url), placement=p_placement, audience=p_audience, starts_at=coalesce(p_starts_at,now()),
      ends_at=p_ends_at, status=p_status, updated_at=now()
  where id=p_id;
  return found;
end;
$$;

create or replace function public.admin_set_promotion_status(p_id uuid, p_status text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Not authorized'; end if;
  if p_status not in ('draft','active','paused','ended') then raise exception 'Invalid status'; end if;
  update public.commissioner_promotions set status=p_status, updated_at=now() where id=p_id;
  return found;
end;
$$;

create or replace function public.admin_delete_promotion(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Not authorized'; end if;
  delete from public.commissioner_promotions where id=p_id;
  return found;
end;
$$;

create or replace function public.track_promotion_impression(p_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  update public.commissioner_promotions
  set impressions = impressions + 1
  where id = p_id
    and status = 'active'
    and starts_at <= now()
    and (ends_at is null or ends_at > now());
  select found;
$$;

create or replace function public.track_promotion_click(p_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  update public.commissioner_promotions
  set clicks = clicks + 1
  where id = p_id
    and status = 'active'
    and starts_at <= now()
    and (ends_at is null or ends_at > now());
  select found;
$$;

grant execute on function public.admin_list_promotions() to authenticated;
grant execute on function public.admin_create_promotion(text,text,text,text,text,text,text,text,timestamptz,timestamptz,text) to authenticated;
grant execute on function public.admin_update_promotion(uuid,text,text,text,text,text,text,text,text,timestamptz,timestamptz,text) to authenticated;
grant execute on function public.admin_set_promotion_status(uuid,text) to authenticated;
grant execute on function public.admin_delete_promotion(uuid) to authenticated;
grant execute on function public.track_promotion_impression(uuid) to anon, authenticated;
grant execute on function public.track_promotion_click(uuid) to anon, authenticated;
