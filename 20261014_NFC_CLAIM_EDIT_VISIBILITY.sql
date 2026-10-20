-- Commissioner — NFC claim / edit / owner-controlled visibility — 2026-10-14
--
-- Run AFTER every earlier migration (it must sort last).
--
-- What this adds
--   1. profile_contact_private: contact email/phone live in a table with NO public
--      select policy. They only reach a visitor through get_nfc_public_profile(),
--      and only when the owner switched "contact" on.
--   2. get_nfc_public_profile(token): the ONE public read for a tapped card. Fields
--      are filtered on the SERVER by the owner's nfc_display_settings. It never
--      returns claim_token, auth_user_id (except messaging recipient), or contact
--      details unless the owner allowed them.
--   3. get_my_nfc_profile(token): owner-only read of everything editable.
--   4. claim_nfc_profile(token): signed-in user claims an UNCLAIMED card. Atomic,
--      first-claim-wins, no takeover of a claimed profile, no admin side effects.
--   5. update_my_nfc_profile(token, fields): owner-only, whitelisted columns,
--      validated (http/https links only, email/phone/username formats).
--      It cannot touch approved, verified, plan, claim_token, auth_user_id or any
--      admin table, so a claimant never gains admin or verified status.
--
-- Nothing here touches public.admin_users / public.is_admin().

-- ---------------------------------------------------------------- 1. storage
create table if not exists public.profile_contact_private (
  kind text not null check (kind in ('creator','business')),
  profile_id uuid not null,
  email text,
  phone text,
  updated_at timestamptz not null default now(),
  primary key (kind, profile_id)
);
alter table public.profile_contact_private enable row level security;
-- Deliberately no policies for anon/authenticated: only the SECURITY DEFINER
-- functions below (and service_role) can read or write this table.
revoke all on public.profile_contact_private from anon, authenticated;

-- One-time copy of contact_email values collected by older NFC claim code.
insert into public.profile_contact_private(kind, profile_id, email)
select 'creator', id, contact_email from public.creator_profiles
 where nullif(trim(coalesce(contact_email,'')),'') is not null
on conflict do nothing;
insert into public.profile_contact_private(kind, profile_id, email)
select 'business', id, contact_email from public.business_profiles
 where nullif(trim(coalesce(contact_email,'')),'') is not null
on conflict do nothing;

-- ----------------------------------------------------------------- helpers
create or replace function public._nfc_flag(s jsonb, k text, dflt boolean)
returns boolean language sql immutable as $$
  select case when jsonb_typeof(s->k) = 'boolean' then (s->k)::boolean else dflt end
$$;

-- Returns the url when it is a plain http(s) link, null for blank, raises otherwise.
create or replace function public._nfc_safe_url(u text)
returns text language plpgsql immutable as $$
declare v text := nullif(trim(coalesce(u,'')),'');
begin
  if v is null then return null; end if;
  if length(v) > 500 or v !~* '^https?://[^\s<>"'']+$' then
    raise exception 'Links must start with http:// or https:// and contain no spaces.';
  end if;
  return v;
end $$;

create or replace function public._nfc_clean_settings(s jsonb)
returns jsonb language sql immutable as $$
  select coalesce(jsonb_object_agg(k, (s->k)::boolean), '{}'::jsonb)
  from unnest(array['name','photo','bio','role','location','language','availability',
                    'website','socials','services','portfolio','contact','messaging']) k
  where jsonb_typeof(s->k) = 'boolean'
$$;

create or replace function public._nfc_clean_platforms(existing jsonb, incoming jsonb)
returns jsonb language plpgsql immutable as $$
declare
  result jsonb := case when jsonb_typeof(existing)='object' then existing else '{}'::jsonb end;
  p text; v jsonb; h text; u text;
begin
  if incoming is null or jsonb_typeof(incoming) <> 'object' then return result; end if;
  for p, v in select key, value from jsonb_each(incoming) loop
    if lower(p) not in ('instagram','tiktok','youtube','facebook','telegram') then continue; end if;
    h := left(trim(coalesce(v->>'handle','')), 60);
    if h ~ '[\s<>"'']' then raise exception 'Social handles cannot contain spaces or special characters.'; end if;
    u := public._nfc_safe_url(v->>'url');
    if h = '' and u is null then
      result := result - p;
    else
      result := jsonb_set(result, array[p],
        coalesce(result->p,'{}'::jsonb) || jsonb_build_object('handle', h, 'url', u), true);
    end if;
  end loop;
  return result;
end $$;

-- ------------------------------------------------- 2. public, filtered preview
-- NOTE: rows are read through to_jsonb() because creator and business rows have
-- different columns; touching r.page_name on a business record would error.
create or replace function public.get_nfc_public_profile(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  r record; j jsonb; s jsonb; k text; c record; is_owner boolean; owner_id uuid;
  nm text; out jsonb;
begin
  if p_token is null or length(p_token) < 8 then return null; end if;

  select 'creator'::text as kind, cp.* into r from public.creator_profiles cp where cp.claim_token = p_token limit 1;
  if not found then
    select 'business'::text as kind, bp.* into r from public.business_profiles bp where bp.claim_token = p_token limit 1;
    if not found then return null; end if;
  end if;

  j := to_jsonb(r);
  k := j->>'kind';
  nm := case when k = 'creator' then j->>'page_name' else j->>'business_name' end;
  owner_id := nullif(j->>'auth_user_id','')::uuid;
  is_owner := auth.uid() is not null and owner_id = auth.uid();
  s := case when jsonb_typeof(j->'nfc_display_settings')='object' then j->'nfc_display_settings' else '{}'::jsonb end;

  -- Unclaimed: minimal preview only (name, photo, city, short bio). No contact, no links.
  if owner_id is null then
    return jsonb_build_object('kind', k, 'status', 'unclaimed', 'is_owner', false,
      'name', nm, 'avatar_url', j->>'avatar_url', 'city', j->>'city',
      'bio', left(coalesce(j->>'bio',''), 280));
  end if;

  -- Claimed but not finished: public sees a placeholder, the owner is sent to the editor.
  if not coalesce((j->>'onboarded')::boolean, false) then
    return jsonb_build_object('kind', k, 'status', 'setting_up', 'is_owner', is_owner,
      'name', case when public._nfc_flag(s,'name',true) then nm end);
  end if;

  out := jsonb_build_object('kind', k, 'status', 'published', 'is_owner', is_owner, 'id', j->>'id',
    'verified', coalesce((j->>'verified')::boolean, false), 'banner_url', j->>'banner_url');

  if public._nfc_flag(s,'name',true)     then out := out || jsonb_build_object('name', nm, 'username', j->>'username'); end if;
  if public._nfc_flag(s,'photo',true)    then out := out || jsonb_build_object('avatar_url', j->>'avatar_url'); end if;
  if public._nfc_flag(s,'bio',true)      then out := out || jsonb_build_object('bio', j->>'bio'); end if;
  if public._nfc_flag(s,'location',true) then out := out || jsonb_build_object('city', j->>'city'); end if;
  if public._nfc_flag(s,'language',true) then out := out || jsonb_build_object('language', j->>'language'); end if;

  if k = 'creator' then
    if public._nfc_flag(s,'role',true)         then out := out || jsonb_build_object('role', j->>'primary_niche'); end if;
    if public._nfc_flag(s,'availability',true) then out := out || jsonb_build_object('availability', j->>'availability'); end if;
    if public._nfc_flag(s,'socials',true)      then out := out || jsonb_build_object('platforms', coalesce(j->'platforms','{}'::jsonb)); end if;
    if public._nfc_flag(s,'portfolio',true)    then out := out || jsonb_build_object('portfolio_link', j->>'portfolio_link'); end if;
  else
    if public._nfc_flag(s,'role',true)    then out := out || jsonb_build_object('role', j->>'industry'); end if;
    if public._nfc_flag(s,'website',true) then out := out || jsonb_build_object('website', j->>'website'); end if;
  end if;

  -- Contact details are OFF unless the owner explicitly turned them on.
  if public._nfc_flag(s,'contact',false) then
    select * into c from public.profile_contact_private where kind = k and profile_id = (j->>'id')::uuid;
    if found then out := out || jsonb_build_object('contact_email', c.email, 'contact_phone', c.phone); end if;
  end if;

  -- Messaging recipient (needed by the existing start_conversation RPC).
  if public._nfc_flag(s,'messaging',true) and not is_owner then
    out := out || jsonb_build_object('recipient_id', owner_id);
  end if;

  return out;
end $$;
revoke all on function public.get_nfc_public_profile(text) from public;
grant execute on function public.get_nfc_public_profile(text) to anon, authenticated;

-- ------------------------------------------------------ 3. owner-only editor read
create or replace function public.get_my_nfc_profile(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r record; j jsonb; k text; c record;
begin
  if auth.uid() is null then raise exception 'Please sign in first.'; end if;
  select 'creator'::text as kind, cp.* into r from public.creator_profiles cp
   where cp.claim_token = p_token and cp.auth_user_id = auth.uid() limit 1;
  if not found then
    select 'business'::text as kind, bp.* into r from public.business_profiles bp
     where bp.claim_token = p_token and bp.auth_user_id = auth.uid() limit 1;
    if not found then return null; end if;
  end if;
  j := to_jsonb(r); k := j->>'kind';
  select * into c from public.profile_contact_private where kind = k and profile_id = (j->>'id')::uuid;
  return jsonb_build_object(
    'kind', k, 'id', j->>'id',
    'name', case when k='creator' then j->>'page_name' else j->>'business_name' end,
    'username', j->>'username', 'avatar_url', j->>'avatar_url', 'bio', j->>'bio',
    'city', j->>'city', 'language', j->>'language',
    'platforms', case when k='creator' then coalesce(j->'platforms','{}'::jsonb) else '{}'::jsonb end,
    'portfolio_link', case when k='creator' then j->>'portfolio_link' end,
    'website', case when k='business' then j->>'website' end,
    'contact_email', c.email, 'contact_phone', c.phone,
    'nfc_display_settings', coalesce(j->'nfc_display_settings','{}'::jsonb),
    'onboarded', coalesce((j->>'onboarded')::boolean,false));
end $$;
revoke all on function public.get_my_nfc_profile(text) from public, anon;
grant execute on function public.get_my_nfc_profile(text) to authenticated;

-- ------------------------------------------------------------------ 4. claim
create or replace function public.claim_nfc_profile(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare n int; v_kind text; v_owner uuid;
begin
  if auth.uid() is null then raise exception 'Please sign in to claim this profile.'; end if;

  -- Atomic first-claim-wins: only rows with no owner can be taken.
  update public.creator_profiles set auth_user_id = auth.uid(), claimed = true
   where claim_token = p_token and auth_user_id is null;
  get diagnostics n = row_count;
  if n > 0 then return jsonb_build_object('ok', true, 'kind', 'creator'); end if;

  update public.business_profiles set auth_user_id = auth.uid(), claimed = true
   where claim_token = p_token and auth_user_id is null;
  get diagnostics n = row_count;
  if n > 0 then return jsonb_build_object('ok', true, 'kind', 'business'); end if;

  -- Not claimable now: already mine (idempotent), someone else's, or unknown.
  select 'creator', auth_user_id into v_kind, v_owner from public.creator_profiles where claim_token = p_token;
  if not found then
    select 'business', auth_user_id into v_kind, v_owner from public.business_profiles where claim_token = p_token;
  end if;
  if v_kind is null then raise exception 'This card was not found.'; end if;
  if v_owner = auth.uid() then return jsonb_build_object('ok', true, 'kind', v_kind, 'already_yours', true); end if;
  raise exception 'This profile has already been claimed.';
exception when unique_violation then
  raise exception 'Your account already has a % profile. Sign in with a different account to claim this card.',
    coalesce(v_kind, 'Commissioner');
end $$;
revoke all on function public.claim_nfc_profile(text) from public, anon;
grant execute on function public.claim_nfc_profile(text) to authenticated;

-- ----------------------------------------------------- 5. owner-only edit RPC
create or replace function public.update_my_nfc_profile(p_token text, p_fields jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  f jsonb := coalesce(p_fields,'{}'::jsonb);
  cp public.creator_profiles; bp public.business_profiles;
  v_name text; v_user text; v_email text; v_phone text; v_kind text; v_id uuid; v_ok boolean;
begin
  if auth.uid() is null then raise exception 'Please sign in first.'; end if;

  -- shared validation
  if f ? 'username' then
    v_user := lower(trim(regexp_replace(coalesce(f->>'username',''), '^@', '')));
    if v_user !~ '^[a-z0-9_.]{3,30}$' then
      raise exception 'Username must be 3-30 characters: letters, numbers, dot or underscore.';
    end if;
  end if;
  if f ? 'contact_email' then
    v_email := nullif(trim(coalesce(f->>'contact_email','')),'');
    if v_email is not null and (length(v_email) > 200 or v_email !~ '^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$') then
      raise exception 'Enter a valid contact email address.';
    end if;
  end if;
  if f ? 'contact_phone' then
    v_phone := nullif(trim(coalesce(f->>'contact_phone','')),'');
    if v_phone is not null and v_phone !~ '^[+0-9 ()\-]{5,25}$' then
      raise exception 'Enter a valid phone number (digits, spaces, + ( ) - only).';
    end if;
  end if;

  select * into cp from public.creator_profiles where claim_token = p_token and auth_user_id = auth.uid() for update;
  if found then
    v_kind := 'creator'; v_id := cp.id;
    update public.creator_profiles set
      page_name      = case when f ? 'name'           then nullif(left(trim(f->>'name'),80),'') else page_name end,
      username       = case when f ? 'username'       then v_user else username end,
      bio            = case when f ? 'bio'            then nullif(left(trim(f->>'bio'),1000),'') else bio end,
      avatar_url     = case when f ? 'avatar_url'     then public._nfc_safe_url(f->>'avatar_url') else avatar_url end,
      city           = case when f ? 'city'           then nullif(left(trim(f->>'city'),80),'') else city end,
      language       = case when f ? 'language'       then nullif(left(trim(f->>'language'),60),'') else language end,
      portfolio_link = case when f ? 'portfolio_link' then public._nfc_safe_url(f->>'portfolio_link') else portfolio_link end,
      platforms      = case when f ? 'platforms'      then public._nfc_clean_platforms(platforms, f->'platforms') else platforms end,
      nfc_display_settings = case when f ? 'nfc_display_settings'
                               then public._nfc_clean_settings(f->'nfc_display_settings') else nfc_display_settings end
    where id = cp.id
    returning (nullif(page_name,'') is not null and nullif(username,'') is not null) into v_ok;
    if v_ok then update public.creator_profiles set onboarded = true, claimed = true where id = cp.id; end if;
  else
    select * into bp from public.business_profiles where claim_token = p_token and auth_user_id = auth.uid() for update;
    if not found then raise exception 'You can only edit a profile you have claimed.'; end if;
    v_kind := 'business'; v_id := bp.id;
    update public.business_profiles set
      business_name = case when f ? 'name'       then nullif(left(trim(f->>'name'),100),'') else business_name end,
      username      = case when f ? 'username'   then v_user else username end,
      bio           = case when f ? 'bio'        then nullif(left(trim(f->>'bio'),1000),'') else bio end,
      avatar_url    = case when f ? 'avatar_url' then public._nfc_safe_url(f->>'avatar_url') else avatar_url end,
      city          = case when f ? 'city'       then nullif(left(trim(f->>'city'),80),'') else city end,
      language      = case when f ? 'language'   then nullif(left(trim(f->>'language'),60),'') else language end,
      website       = case when f ? 'website'    then public._nfc_safe_url(f->>'website') else website end,
      nfc_display_settings = case when f ? 'nfc_display_settings'
                               then public._nfc_clean_settings(f->'nfc_display_settings') else nfc_display_settings end
    where id = bp.id
    returning (nullif(business_name,'') is not null and nullif(username,'') is not null) into v_ok;
    if v_ok then update public.business_profiles set onboarded = true, claimed = true where id = bp.id; end if;
  end if;

  if f ? 'contact_email' or f ? 'contact_phone' then
    insert into public.profile_contact_private(kind, profile_id, email, phone)
    values (v_kind, v_id, v_email, v_phone)
    on conflict (kind, profile_id) do update set
      email = case when f ? 'contact_email' then excluded.email else public.profile_contact_private.email end,
      phone = case when f ? 'contact_phone' then excluded.phone else public.profile_contact_private.phone end,
      updated_at = now();
  end if;

  return jsonb_build_object('ok', true, 'kind', v_kind, 'onboarded', coalesce(v_ok,false));
exception when unique_violation then
  raise exception 'That username is already in use. Please choose another one.';
end $$;
revoke all on function public.update_my_nfc_profile(text, jsonb) from public, anon;
grant execute on function public.update_my_nfc_profile(text, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- OPTIONAL, run deliberately after confirming nothing else reads these columns:
-- the older code path stored the claimer's account email in contact_email, which
-- is publicly selectable through the table's existing RLS policy. The values were
-- copied to profile_contact_private above, so the public copies can be cleared:
--
--   update public.creator_profiles  set contact_email = null where contact_email is not null;
--   update public.business_profiles set contact_email = null where contact_email is not null;
--
-- Also note: claim_token on claimed rows is still selectable through the public
-- table policy (migration 20261001_GOOGLE_NFC_VERIFICATION_FIX keeps it so the
-- card URL stays permanent). It cannot be used to take over a claimed profile
-- (claim_nfc_profile only claims rows with no owner), but it does let a stranger
-- open the card's token URL. Moving tokens to their own table is the clean fix.
-- ---------------------------------------------------------------------------
