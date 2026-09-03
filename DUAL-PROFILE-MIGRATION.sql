-- ============================================================
-- Dual-profile support: let one account be BOTH a Creator and
-- a Business, switchable in the app.
--
-- The schema already allows this — creator_profiles and
-- business_profiles each only enforce ONE row per auth_user_id
-- *within that table*, nothing stops the same auth_user_id from
-- having a row in both tables. The only thing missing was a way
-- for an already-signed-up user to create the second row, since
-- the existing signup trigger only ever creates one (based on
-- the role chosen at signup).
--
-- Run this once in the Supabase SQL editor.
-- ============================================================

-- Let the currently logged-in user add a Creator profile,
-- if they don't already have one.
create or replace function public.add_creator_profile()
returns creator_profiles as $$
declare
  result creator_profiles;
begin
  if auth.uid() is null then
    raise exception 'Not signed in.';
  end if;

  select * into result from creator_profiles where auth_user_id = auth.uid();
  if found then
    return result;
  end if;

  insert into creator_profiles (auth_user_id, claimed)
  values (auth.uid(), true)
  returning * into result;

  return result;
end;
$$ language plpgsql security definer;

-- Let the currently logged-in user add a Business profile,
-- if they don't already have one.
create or replace function public.add_business_profile()
returns business_profiles as $$
declare
  result business_profiles;
begin
  if auth.uid() is null then
    raise exception 'Not signed in.';
  end if;

  select * into result from business_profiles where auth_user_id = auth.uid();
  if found then
    return result;
  end if;

  insert into business_profiles (auth_user_id, claimed)
  values (auth.uid(), true)
  returning * into result;

  return result;
end;
$$ language plpgsql security definer;

-- Convenience RPC the app calls once on load to find out which
-- of the two profile types the current user already has, in a
-- single round trip instead of two separate table queries.
create or replace function public.get_my_profile_types()
returns table(has_creator boolean, has_business boolean) as $$
begin
  return query select
    exists(select 1 from creator_profiles where auth_user_id = auth.uid()),
    exists(select 1 from business_profiles where auth_user_id = auth.uid());
end;
$$ language plpgsql security definer;
