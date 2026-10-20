-- Commissioner public profile privacy hardening — 2026-10-15
-- Run AFTER 20261014_NFC_CLAIM_EDIT_VISIBILITY.sql.
-- Public profile routes must use these filtered RPCs instead of selecting raw rows.
-- Contact details and claim_token are intentionally never returned.

create or replace function public.get_public_creator_profile(p_profile_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare r public.creator_profiles; s jsonb; o jsonb;
begin
  select * into r from public.creator_profiles where id = p_profile_id and auth_user_id is not null and onboarded = true;
  if not found then return null; end if;
  s := case when jsonb_typeof(r.nfc_display_settings)='object' then r.nfc_display_settings else '{}'::jsonb end;
  o := jsonb_build_object('id',r.id,'auth_user_id',r.auth_user_id,'onboarded',r.onboarded,
    'verified',coalesce(r.verified,false),'nfc_display_settings',s);
  if public._nfc_flag(s,'name',true) then o := o || jsonb_build_object('page_name',r.page_name,'username',r.username); end if;
  if public._nfc_flag(s,'photo',true) then o := o || jsonb_build_object('avatar_url',r.avatar_url,'banner_url',r.banner_url); end if;
  if public._nfc_flag(s,'location',true) then o := o || jsonb_build_object('city',r.city); end if;
  if public._nfc_flag(s,'language',true) then o := o || jsonb_build_object('language',r.language); end if;
  if public._nfc_flag(s,'bio',true) then o := o || jsonb_build_object('bio',r.bio); end if;
  if public._nfc_flag(s,'role',true) then o := o || jsonb_build_object('primary_niche',r.primary_niche); end if;
  if public._nfc_flag(s,'availability',true) then o := o || jsonb_build_object('availability',r.availability); end if;
  if public._nfc_flag(s,'socials',true) then o := o || jsonb_build_object('platforms',coalesce(r.platforms,'{}'::jsonb)); end if;
  if public._nfc_flag(s,'services',true) then o := o || jsonb_build_object('services',coalesce(r.services,'[]'::jsonb)); end if;
  if public._nfc_flag(s,'portfolio',true) then o := o || jsonb_build_object('portfolio_link',r.portfolio_link,'portfolio_media',coalesce(r.portfolio_media,'[]'::jsonb)); end if;
  return o;
end $$;

create or replace function public.get_public_business_profile(p_profile_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare r public.business_profiles; s jsonb; o jsonb;
begin
  select * into r from public.business_profiles where id = p_profile_id and auth_user_id is not null and onboarded = true;
  if not found then return null; end if;
  s := case when jsonb_typeof(r.nfc_display_settings)='object' then r.nfc_display_settings else '{}'::jsonb end;
  o := jsonb_build_object('id',r.id,'auth_user_id',r.auth_user_id,'onboarded',r.onboarded,
    'verified',coalesce(r.verified,false),'nfc_display_settings',s);
  if public._nfc_flag(s,'name',true) then o := o || jsonb_build_object('business_name',r.business_name,'username',r.username); end if;
  if public._nfc_flag(s,'photo',true) then o := o || jsonb_build_object('avatar_url',r.avatar_url,'banner_url',r.banner_url); end if;
  if public._nfc_flag(s,'location',true) then o := o || jsonb_build_object('city',r.city); end if;
  if public._nfc_flag(s,'language',true) then o := o || jsonb_build_object('language',r.language); end if;
  if public._nfc_flag(s,'bio',true) then o := o || jsonb_build_object('bio',r.bio); end if;
  if public._nfc_flag(s,'role',true) then o := o || jsonb_build_object('industry',r.industry); end if;
  if public._nfc_flag(s,'website',true) then o := o || jsonb_build_object('website',r.website); end if;
  return o;
end $$;

revoke all on function public.get_public_creator_profile(uuid) from public;
revoke all on function public.get_public_business_profile(uuid) from public;
grant execute on function public.get_public_creator_profile(uuid) to anon, authenticated;
grant execute on function public.get_public_business_profile(uuid) to anon, authenticated;

-- Remove duplicated contact data from publicly selectable profile rows. The
-- private copy was migrated by 20261014_NFC_CLAIM_EDIT_VISIBILITY.sql.
update public.creator_profiles set contact_email = null where contact_email is not null;
update public.business_profiles set contact_email = null where contact_email is not null;
