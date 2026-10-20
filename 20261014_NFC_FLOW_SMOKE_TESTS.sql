-- Run in a STAGING Supabase project (SQL editor) after 20261014_NFC_CLAIM_EDIT_VISIBILITY.sql.
-- Everything runs in one transaction and ends with ROLLBACK, so no data is kept.
-- Each block raises an exception if its expectation fails; "NOTICE: PASS ..." lines mean it held.
-- Replace the two UUIDs with real auth.users ids from staging (user A claims, user B is a stranger).
begin;
do $$
declare
  a uuid := '00000000-0000-0000-0000-00000000000a';  -- <- real staging user A
  b uuid := '00000000-0000-0000-0000-00000000000b';  -- <- real staging user B
  tok text := 'smoketest-' || substr(md5(random()::text),1,12);
  pid uuid; res jsonb; ok boolean;
begin
  insert into public.creator_profiles(page_name, claim_token) values ('Smoke Creator', tok) returning id into pid;

  -- 1. anonymous preview of an unclaimed card: no contact, no links, no owner id
  perform set_config('request.jwt.claims','{"role":"anon"}', true);
  res := public.get_nfc_public_profile(tok);
  assert res->>'status' = 'unclaimed', 'unclaimed status';
  assert not (res ? 'contact_email') and not (res ? 'recipient_id') and not (res ? 'platforms'), 'unclaimed leaks';
  raise notice 'PASS 1 unclaimed preview is minimal';

  -- 2. user A claims; user B cannot take it over
  perform set_config('request.jwt.claims', json_build_object('sub',a,'role','authenticated')::text, true);
  assert (public.claim_nfc_profile(tok)->>'ok')::boolean, 'claim ok';
  perform set_config('request.jwt.claims', json_build_object('sub',b,'role','authenticated')::text, true);
  begin perform public.claim_nfc_profile(tok); raise exception 'B claimed A''s card';
  exception when others then if sqlerrm like 'B claimed%' then raise; end if; end;
  raise notice 'PASS 2 first claim wins, takeover refused';

  -- 3. B cannot edit A's profile
  begin perform public.update_my_nfc_profile(tok, '{"name":"Hacked"}'); raise exception 'B edited A';
  exception when others then if sqlerrm like 'B edited%' then raise; end if; end;
  raise notice 'PASS 3 non-owner edit refused';

  -- 4. A edits; bad links are rejected; contact stays private until switched on
  perform set_config('request.jwt.claims', json_build_object('sub',a,'role','authenticated')::text, true);
  begin perform public.update_my_nfc_profile(tok, '{"portfolio_link":"javascript:alert(1)"}'); raise exception 'js url accepted';
  exception when others then if sqlerrm like 'js url%' then raise; end if; end;
  perform public.update_my_nfc_profile(tok, '{"name":"Smoke Creator","username":"smoke_creator_x","bio":"Hello","contact_email":"a@example.com","contact_phone":"+251 911 000000","nfc_display_settings":{"bio":false,"contact":false}}');
  perform set_config('request.jwt.claims','{"role":"anon"}', true);
  res := public.get_nfc_public_profile(tok);
  assert res->>'status' = 'published', 'published after save';
  assert not (res ? 'bio'), 'hidden bio leaked';
  assert not (res ? 'contact_email') and not (res ? 'contact_phone'), 'contact leaked while off';
  raise notice 'PASS 4 hidden fields are absent from the public response';

  -- 5. turning contact on exposes it; claim_token / auth_user_id never appear
  perform set_config('request.jwt.claims', json_build_object('sub',a,'role','authenticated')::text, true);
  perform public.update_my_nfc_profile(tok, '{"nfc_display_settings":{"contact":true}}');
  perform set_config('request.jwt.claims','{"role":"anon"}', true);
  res := public.get_nfc_public_profile(tok);
  assert res->>'contact_email' = 'a@example.com', 'contact shown when on';
  assert not (res ? 'claim_token') and not (res ? 'auth_user_id'), 'secret fields leaked';
  raise notice 'PASS 5 contact only when owner allows; no token / auth id';

  -- 6. editing never changes verified / approved / plan
  perform set_config('request.jwt.claims', json_build_object('sub',a,'role','authenticated')::text, true);
  perform public.update_my_nfc_profile(tok, '{"verified":true,"approved":true,"plan":"premium"}');
  select (verified is not true and approved is not true) into ok from public.creator_profiles where id = pid;
  assert ok, 'privileged columns changed';
  raise notice 'PASS 6 claimant gains no verified/approved/plan';

  -- 7. claiming does not create an admin
  assert not exists (select 1 from public.admin_users where user_id in (a,b)), 'user became admin';
  raise notice 'PASS 7 no admin rows created';
end $$;
rollback;
