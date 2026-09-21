-- Commissioner: fix Admin Site Controls RPC signature and targeted Connect/Message support
-- 2026-09-22

-- Create the singleton table first. The RPC returns this table's composite type,
-- so PostgreSQL must know the type before the function is created.
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

-- The deployed database may contain an older overload whose argument order was:
--   (jsonb, boolean, text)
-- while the current UI calls:
--   (boolean, text, jsonb)
-- Remove both possible signatures before recreating one canonical function.
drop function if exists public.admin_update_site_controls(jsonb, boolean, text);
drop function if exists public.admin_update_site_controls(boolean, text, jsonb);

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
      site_message = coalesce(
        nullif(trim(coalesce(p_site_message, '')), ''),
        'Commissioner is temporarily under development. Please check back soon.'
      ),
      disabled_pages = case
        when jsonb_typeof(coalesce(p_disabled_pages, '[]'::jsonb)) = 'array'
          then p_disabled_pages
        else '[]'::jsonb
      end,
      updated_at = now()
  where id = true
  returning * into result;

  if result.id is null then
    raise exception 'Site controls row is missing';
  end if;

  return result;
end;
$$;

revoke all on function public.admin_update_site_controls(boolean, text, jsonb) from public;
grant execute on function public.admin_update_site_controls(boolean, text, jsonb) to authenticated;

-- Make the canonical signature visible immediately to PostgREST.
notify pgrst, 'reload schema';

-- Ensure the B2B connection table has the fields used by the targeted Connect action.
-- These statements are safe if the table/columns already exist.
alter table if exists public.b2b_connections
  add column if not exists message text;

notify pgrst, 'reload schema';
