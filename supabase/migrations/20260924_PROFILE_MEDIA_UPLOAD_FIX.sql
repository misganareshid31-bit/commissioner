-- Commissioner profile media upload fix — 2026-09-24
-- Adds creator portfolio media storage and a JSONB field for up to 8 public
-- portfolio items. This does NOT introduce or require business-license checks.

alter table public.creator_profiles
  add column if not exists portfolio_media jsonb not null default '[]'::jsonb;

insert into storage.buckets (id, name, public)
values ('portfolio', 'portfolio', true)
on conflict (id) do update set public = true;

drop policy if exists "Public read portfolio" on storage.objects;
create policy "Public read portfolio"
  on storage.objects for select
  using (bucket_id = 'portfolio');

drop policy if exists "Users upload their own portfolio" on storage.objects;
create policy "Users upload their own portfolio"
  on storage.objects for insert
  with check (
    bucket_id = 'portfolio'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users update their own portfolio" on storage.objects;
create policy "Users update their own portfolio"
  on storage.objects for update
  using (
    bucket_id = 'portfolio'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'portfolio'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users delete their own portfolio" on storage.objects;
create policy "Users delete their own portfolio"
  on storage.objects for delete
  using (
    bucket_id = 'portfolio'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
