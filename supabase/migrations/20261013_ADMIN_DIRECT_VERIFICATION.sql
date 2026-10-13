-- Commissioner — Admin direct verification — 2026-10-13
--
-- Lets an admin grant or remove the verified badge on any creator/business
-- page (including gifted pages) straight from the Admin gifted-pages list,
-- without a user-submitted verification request. Admin-only.
--
-- Granting verification also approves the page so it is publicly visible.
-- Removing it only clears `verified`; approval is left unchanged.
-- Safe to run more than once.

create or replace function public.admin_set_profile_verified(
  p_kind text,
  p_profile_id uuid,
  p_verified boolean default true
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  if lower(p_kind) = 'creator' then
    if p_verified then
      update public.creator_profiles set verified = true, approved = true, updated_at = now() where id = p_profile_id;
    else
      update public.creator_profiles set verified = false, updated_at = now() where id = p_profile_id;
    end if;
    get diagnostics affected = row_count;
  elsif lower(p_kind) = 'business' then
    if p_verified then
      update public.business_profiles set verified = true, approved = true, updated_at = now() where id = p_profile_id;
    else
      update public.business_profiles set verified = false, updated_at = now() where id = p_profile_id;
    end if;
    get diagnostics affected = row_count;
  else
    raise exception 'invalid profile kind';
  end if;

  if affected = 0 then
    raise exception 'page not found';
  end if;

  return jsonb_build_object('ok', true, 'kind', lower(p_kind), 'profile_id', p_profile_id, 'verified', p_verified);
end;
$$;
revoke all on function public.admin_set_profile_verified(text, uuid, boolean) from public;
grant execute on function public.admin_set_profile_verified(text, uuid, boolean) to authenticated;

notify pgrst, 'reload schema';
