-- Commissioner Professional V1 migration
-- Adds creator commerce, business inquiries, and privacy-conscious analytics.
-- Run AFTER the latest supabase-schema.sql / NFC-ADMIN-FIX.sql.

create table if not exists public.creator_products (
  id uuid primary key default gen_random_uuid(),
  creator_profile_id uuid not null references public.creator_profiles(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  description text default '',
  image_url text,
  price numeric(12,2),
  currency text not null default 'ETB' check (currency in ('ETB','USD')),
  type text not null default 'product' check (type in ('product','service')),
  purchase_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists creator_products_profile_idx on public.creator_products(creator_profile_id, active);

alter table public.creator_products enable row level security;
drop policy if exists "Public can view active creator products" on public.creator_products;
create policy "Public can view active creator products" on public.creator_products
  for select using (
    active = true and exists (
      select 1 from public.creator_profiles p
      where p.id = creator_profile_id and p.onboarded = true and p.approved = true
    )
  );
drop policy if exists "Owners manage creator products" on public.creator_products;
create policy "Owners manage creator products" on public.creator_products
  for all using (
    exists (select 1 from public.creator_profiles p where p.id = creator_profile_id and p.auth_user_id = auth.uid())
  ) with check (
    exists (select 1 from public.creator_profiles p where p.id = creator_profile_id and p.auth_user_id = auth.uid())
  );

create table if not exists public.creator_inquiries (
  id uuid primary key default gen_random_uuid(),
  creator_profile_id uuid not null references public.creator_profiles(id) on delete cascade,
  sender_user_id uuid references auth.users(id) on delete set null,
  name text not null check (char_length(trim(name)) between 1 and 100),
  email text not null check (char_length(trim(email)) between 3 and 254),
  company text default '',
  budget text default '',
  message text not null check (char_length(trim(message)) between 1 and 4000),
  status text not null default 'new' check (status in ('new','read','replied','closed')),
  created_at timestamptz not null default now()
);
create index if not exists creator_inquiries_profile_idx on public.creator_inquiries(creator_profile_id, created_at desc);

alter table public.creator_inquiries enable row level security;
drop policy if exists "Owners view creator inquiries" on public.creator_inquiries;
create policy "Owners view creator inquiries" on public.creator_inquiries
  for select using (
    exists (select 1 from public.creator_profiles p where p.id = creator_profile_id and p.auth_user_id = auth.uid())
  );
drop policy if exists "Owners update creator inquiries" on public.creator_inquiries;
create policy "Owners update creator inquiries" on public.creator_inquiries
  for update using (
    exists (select 1 from public.creator_profiles p where p.id = creator_profile_id and p.auth_user_id = auth.uid())
  );

create or replace function public.submit_creator_inquiry(
  p_creator_profile_id uuid,
  p_name text,
  p_email text,
  p_company text,
  p_budget text,
  p_message text
) returns uuid as $$
declare new_id uuid;
begin
  if not exists (select 1 from public.creator_profiles where id=p_creator_profile_id and onboarded=true and approved=true) then
    raise exception 'creator profile is not available';
  end if;
  if length(trim(coalesce(p_name,''))) < 1 or length(trim(coalesce(p_name,''))) > 100 then raise exception 'invalid name'; end if;
  if length(trim(coalesce(p_email,''))) < 3 or length(trim(coalesce(p_email,''))) > 254 then raise exception 'invalid email'; end if;
  if length(trim(coalesce(p_message,''))) < 1 or length(trim(coalesce(p_message,''))) > 4000 then raise exception 'invalid message'; end if;
  insert into public.creator_inquiries(creator_profile_id,sender_user_id,name,email,company,budget,message)
  values(p_creator_profile_id,auth.uid(),trim(p_name),trim(p_email),trim(coalesce(p_company,'')),trim(coalesce(p_budget,'')),trim(p_message))
  returning id into new_id;
  return new_id;
end;
$$ language plpgsql security definer set search_path=public;
grant execute on function public.submit_creator_inquiry(uuid,text,text,text,text,text) to anon, authenticated;

create table if not exists public.profile_events (
  id bigint generated always as identity primary key,
  creator_profile_id uuid not null references public.creator_profiles(id) on delete cascade,
  event_type text not null check (event_type in ('profile_view','nfc_tap','product_view','social_click','inquiry_created')),
  created_at timestamptz not null default now()
);
create index if not exists profile_events_profile_time_idx on public.profile_events(creator_profile_id, created_at desc);
alter table public.profile_events enable row level security;
-- No direct table access for visitors. Analytics writes/reads happen through RPCs.

drop function if exists public.track_profile_event(uuid,text);
create or replace function public.track_profile_event(p_creator_profile_id uuid, p_event_type text)
returns void as $$
begin
  if p_event_type not in ('profile_view','nfc_tap','product_view','social_click','inquiry_created') then raise exception 'invalid event'; end if;
  if exists (select 1 from public.creator_profiles where id=p_creator_profile_id and onboarded=true and approved=true) then
    insert into public.profile_events(creator_profile_id,event_type) values(p_creator_profile_id,p_event_type);
  end if;
end;
$$ language plpgsql security definer set search_path=public;
grant execute on function public.track_profile_event(uuid,text) to anon, authenticated;

create or replace function public.creator_analytics(p_creator_profile_id uuid)
returns table(event_type text, event_count bigint) as $$
begin
  if not exists (select 1 from public.creator_profiles where id=p_creator_profile_id and auth_user_id=auth.uid()) then raise exception 'not authorized'; end if;
  return query select e.event_type, count(*) from public.profile_events e where e.creator_profile_id=p_creator_profile_id group by e.event_type order by e.event_type;
end;
$$ language plpgsql security definer set search_path=public;
grant execute on function public.creator_analytics(uuid) to authenticated;

-- Product timestamps
create or replace function public.touch_creator_products() returns trigger as $$ begin new.updated_at=now(); return new; end; $$ language plpgsql;
drop trigger if exists touch_creator_products on public.creator_products;
create trigger touch_creator_products before update on public.creator_products for each row execute procedure public.touch_creator_products();

-- Harden search_path on existing security-definer functions used by the app.
alter function public.admin_check_setup() set search_path=public;
alter function public.admin_create_claim(text,text,boolean) set search_path=public;
alter function public.admin_delete_page(text,uuid) set search_path=public;
