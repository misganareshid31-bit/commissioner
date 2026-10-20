-- Commissioner B2B access model (2026-10-19)
-- Any authenticated Commissioner account, including Creator accounts, may send
-- a B2B connection request. Preserve self-connection and block protections.
-- This does not grant unauthenticated access or admin privileges.

begin;

do $$
begin
  if to_regclass('public.b2b_connections') is null then
    raise exception 'public.b2b_connections does not exist. Apply the existing Commissioner B2B migrations first.';
  end if;
end $$;

alter table public.b2b_connections enable row level security;

drop policy if exists "Users create B2B connection" on public.b2b_connections;
create policy "Users create B2B connection"
  on public.b2b_connections
  for insert
  to authenticated
  with check (
    requester_user_id = auth.uid()
    and requester_user_id <> recipient_user_id
    and not public.is_blocked(requester_user_id, recipient_user_id)
  );

notify pgrst, 'reload schema';
commit;
