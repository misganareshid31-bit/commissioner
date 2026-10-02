-- Commissioner forward-only migration: dual identity, reliable completion,
-- and secure admin enforcement.

-- One login may own one creator profile and one business profile. They remain
-- separate rows/tables and can never be substituted for one another.
alter table public.creator_profiles add column if not exists auth_user_id uuid references auth.users(id) on delete cascade;
alter table public.business_profiles add column if not exists auth_user_id uuid references auth.users(id) on delete cascade;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'creator_profiles_auth_user_id_key') then
    alter table public.creator_profiles add constraint creator_profiles_auth_user_id_key unique (auth_user_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'business_profiles_auth_user_id_key') then
    alter table public.business_profiles add constraint business_profiles_auth_user_id_key unique (auth_user_id);
  end if;
end $$;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admin_users enable row level security;
drop policy if exists "No direct client access to admin_users" on public.admin_users;
create policy "No direct client access to admin_users" on public.admin_users for all using (false);

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.admin_users where user_id=auth.uid());
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

create or replace function public.protect_admin_fields()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if auth.role() <> 'service_role' and not public.is_admin() then
    new.approved := old.approved;
    new.verified := old.verified;
    if to_jsonb(old) ? 'plan' then new.plan := old.plan; end if;
    if to_jsonb(old) ? 'plan_expires_at' then new.plan_expires_at := old.plan_expires_at; end if;
  end if;
  return new;
end;
$$;

-- Reliable, schema-backed completion percentages. The frontend uses these as
-- the source of truth while retaining its human-readable missing-item list.
create or replace function public.creator_profile_completion_percent(p_profile_id uuid)
returns integer language sql stable security definer set search_path=public as $$
  select case when p.id is null then 0 else round((
    (case when nullif(trim(coalesce(p.page_name,'')),'') is not null then 1 else 0 end) +
    (case when nullif(trim(coalesce(p.username,'')),'') is not null then 1 else 0 end) +
    (case when nullif(trim(coalesce(p.avatar_url,'')),'') is not null then 1 else 0 end) +
    (case when nullif(trim(coalesce(p.city,'')),'') is not null then 1 else 0 end) +
    (case when nullif(trim(coalesce(p.language,'')),'') is not null then 1 else 0 end) +
    (case when nullif(trim(coalesce(p.bio,'')),'') is not null then 1 else 0 end) +
    (case when jsonb_typeof(coalesce(p.platforms,'{}'::jsonb))='object' and exists(select 1 from jsonb_each(coalesce(p.platforms,'{}'::jsonb)) x where nullif(trim(coalesce(x.value->>'handle','')),'') is not null) then 1 else 0 end) +
    (case when nullif(trim(coalesce(p.primary_niche,'')),'') is not null then 1 else 0 end) +
    (case when jsonb_typeof(coalesce(p.audience,'{}'::jsonb))='object' and nullif(trim(coalesce(p.audience->>'age','')),'') is not null and nullif(trim(coalesce(p.audience->>'gender','')),'') is not null and nullif(trim(coalesce(p.audience->>'location','')),'') is not null then 1 else 0 end) +
    (case when jsonb_typeof(coalesce(p.services,'{}'::jsonb))='object' and exists(select 1 from jsonb_each_text(coalesce(p.services,'{}'::jsonb)) x where nullif(trim(coalesce(x.value,'')),'') is not null) then 1 else 0 end) +
    (case when nullif(trim(coalesce(p.availability,'')),'') is not null then 1 else 0 end)
  ) * 100.0 / 11)::integer end
  from public.creator_profiles p where p.id=p_profile_id;
$$;

create or replace function public.business_profile_completion_percent(p_profile_id uuid)
returns integer language sql stable security definer set search_path=public as $$
  select case when p.id is null then 0 else round((
    (case when nullif(trim(coalesce(p.business_name,'')),'') is not null then 1 else 0 end) +
    (case when nullif(trim(coalesce(p.username,'')),'') is not null then 1 else 0 end) +
    (case when nullif(trim(coalesce(p.avatar_url,'')),'') is not null then 1 else 0 end) +
    (case when nullif(trim(coalesce(p.city,'')),'') is not null then 1 else 0 end) +
    (case when nullif(trim(coalesce(p.language,'')),'') is not null then 1 else 0 end) +
    (case when nullif(trim(coalesce(p.industry,'')),'') is not null then 1 else 0 end) +
    (case when nullif(trim(coalesce(p.bio,'')),'') is not null then 1 else 0 end)
  ) * 100.0 / 7)::integer end
  from public.business_profiles p where p.id=p_profile_id;
$$;
revoke all on function public.creator_profile_completion_percent(uuid) from public;
revoke all on function public.business_profile_completion_percent(uuid) from public;
grant execute on function public.creator_profile_completion_percent(uuid) to anon, authenticated;
grant execute on function public.business_profile_completion_percent(uuid) to anon, authenticated;

create or replace function public.get_my_profile_types()
returns table(has_creator boolean, has_business boolean)
language sql security definer set search_path=public as $$
  select exists(select 1 from public.creator_profiles where auth_user_id=auth.uid()),
         exists(select 1 from public.business_profiles where auth_user_id=auth.uid());
$$;
revoke all on function public.get_my_profile_types() from public;
grant execute on function public.get_my_profile_types() to authenticated;

-- Replace legacy hardcoded-admin policies with role-table policies.
drop policy if exists "Admin can view all profiles" on public.creator_profiles;
drop policy if exists "Admin can update all profiles" on public.creator_profiles;
create policy "Admin can view all creator profiles" on public.creator_profiles for select using (public.is_admin());
create policy "Admin can update all creator profiles" on public.creator_profiles for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admin can view all business profiles" on public.business_profiles;
drop policy if exists "Admin can update all business profiles" on public.business_profiles;
create policy "Admin can view all business profiles" on public.business_profiles for select using (public.is_admin());
create policy "Admin can update all business profiles" on public.business_profiles for update using (public.is_admin()) with check (public.is_admin());

-- Keep approved/verified/plan fields protected on both independent profile tables.
drop trigger if exists protect_admin_fields_trigger on public.creator_profiles;
create trigger protect_admin_fields_trigger before update on public.creator_profiles for each row execute procedure public.protect_admin_fields();
drop trigger if exists protect_admin_fields_trigger on public.business_profiles;
create trigger protect_admin_fields_trigger before update on public.business_profiles for each row execute procedure public.protect_admin_fields();
