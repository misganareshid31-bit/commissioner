-- Commissioner fix — 2026-09-17
-- Bug: on a creator's public page (e.g. an unclaimed/not-yet-approved
-- "Gifted profile"), filling out and submitting the "Work with <name>"
-- business inquiry form always failed with:
--   "creator profile is not available"
--
-- Cause: submit_creator_inquiry() required approved = true, but admin
-- approval only controls whether a page shows up in public search/
-- discovery. A page that is already live at its /creator/<id> URL
-- (onboarded = true) should still be able to receive a private inquiry
-- even before an admin has approved/verified it — that's exactly the
-- state every freshly gifted or freshly claimed profile is in.
--
-- Fix: drop the approved requirement from submit_creator_inquiry(),
-- keeping the onboarded check (a still-blank/unclaimed page still can't
-- receive inquiries) and all existing input validation.
--
-- Safe to run any number of times. Run this in Supabase → SQL Editor.

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
  if not exists (select 1 from public.creator_profiles where id=p_creator_profile_id and onboarded=true) then
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
