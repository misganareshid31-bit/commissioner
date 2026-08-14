-- Commissioner NFC + Admin repair migration
-- Run this AFTER supabase-schema.sql in Supabase SQL Editor.
-- Safe to run repeatedly.

create or replace function public.get_claim_any(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c jsonb;
  b jsonb;
begin
  if p_token is null or length(trim(p_token)) = 0 then
    return null;
  end if;

  select to_jsonb(cp) into c
  from public.creator_profiles cp
  where cp.claim_token = trim(p_token)
  limit 1;

  if c is not null then
    return jsonb_build_object(
      'kind', 'creator',
      'status', case
        when coalesce((c->>'approved')::boolean, false)
         and coalesce((c->>'onboarded')::boolean, false)
        then 'published' else 'claimable' end
    ) || c;
  end if;

  select to_jsonb(bp) into b
  from public.business_profiles bp
  where bp.claim_token = trim(p_token)
  limit 1;

  if b is not null then
    return jsonb_build_object(
      'kind', 'business',
      'status', case
        when coalesce((b->>'approved')::boolean, false)
         and coalesce((b->>'onboarded')::boolean, false)
        then 'published' else 'claimable' end
    ) || b;
  end if;

  return null;
end;
$$;
grant execute on function public.get_claim_any(text) to anon, authenticated;

-- Keep the same admin identities the UI recognizes.
create or replace function public.admin_check_setup()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  e text := lower(coalesce(auth.jwt()->>'email', ''));
  required_count integer;
  installed_count integer;
begin
  if e not in ('misganareshid27@gmail.com', 'admin@commissioner.app') then
    raise exception 'not authorized';
  end if;

  required_count := 5;
  select count(*) into installed_count
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in (
      'admin_check_setup',
      'admin_create_claim',
      'admin_create_business_claim',
      'admin_delete_page',
      'get_claim_any'
    );

  return jsonb_build_object('ready', installed_count >= required_count, 'installed', installed_count, 'required', required_count);
end;
$$;
grant execute on function public.admin_check_setup() to authenticated;

create or replace function public.admin_delete_page(p_kind text, p_page_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  e text := lower(coalesce(auth.jwt()->>'email', ''));
  deleted_id uuid;
begin
  if e not in ('misganareshid27@gmail.com', 'admin@commissioner.app') then
    raise exception 'not authorized';
  end if;

  if p_page_id is null then
    raise exception 'page id is required';
  end if;

  if lower(p_kind) = 'creator' then
    delete from public.creator_profiles where id = p_page_id returning id into deleted_id;
  elsif lower(p_kind) = 'business' then
    delete from public.business_profiles where id = p_page_id returning id into deleted_id;
  else
    raise exception 'invalid page kind';
  end if;

  return jsonb_build_object(
    'deleted', deleted_id is not null,
    'kind', lower(p_kind),
    'id', p_page_id
  );
end;
$$;
grant execute on function public.admin_delete_page(text, uuid) to authenticated;

-- Make approval work from the Admin UI for both profile tables.
-- These policies are only for the two admin identities above.
drop policy if exists "Admin can update all creator profiles" on public.creator_profiles;
create policy "Admin can update all creator profiles"
  on public.creator_profiles for update
  using (lower(coalesce(auth.jwt()->>'email','')) in ('misganareshid27@gmail.com','admin@commissioner.app'))
  with check (lower(coalesce(auth.jwt()->>'email','')) in ('misganareshid27@gmail.com','admin@commissioner.app'));

drop policy if exists "Admin can update all business profiles" on public.business_profiles;
create policy "Admin can update all business profiles"
  on public.business_profiles for update
  using (lower(coalesce(auth.jwt()->>'email','')) in ('misganareshid27@gmail.com','admin@commissioner.app'))
  with check (lower(coalesce(auth.jwt()->>'email','')) in ('misganareshid27@gmail.com','admin@commissioner.app'));
