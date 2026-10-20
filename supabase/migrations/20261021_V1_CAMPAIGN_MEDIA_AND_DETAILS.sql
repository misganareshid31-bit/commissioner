-- Commissioner V1: richer campaign briefs and secure campaign cover uploads.
-- Idempotent: safe to apply once or rerun after a partial deployment.

alter table public.campaigns add column if not exists image_url text;
alter table public.campaigns add column if not exists audience text;
alter table public.campaigns add column if not exists deliverables text;
alter table public.campaigns add column if not exists platform text;
alter table public.campaigns add column if not exists creator_count integer not null default 1;
alter table public.campaigns drop constraint if exists campaigns_creator_count_check;
alter table public.campaigns add constraint campaigns_creator_count_check check (creator_count between 1 and 500);

-- Public campaign covers are intentionally readable. Uploads must be placed
-- under the authenticated user's own folder: <auth.uid()>/<filename>.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('campaign-media', 'campaign-media', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg','image/png','image/webp'];

drop policy if exists "Campaign covers are publicly readable" on storage.objects;
create policy "Campaign covers are publicly readable"
  on storage.objects for select to public
  using (bucket_id = 'campaign-media');

drop policy if exists "Users upload campaign covers to own folder" on storage.objects;
create policy "Users upload campaign covers to own folder"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'campaign-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users update campaign covers in own folder" on storage.objects;
create policy "Users update campaign covers in own folder"
  on storage.objects for update to authenticated
  using (bucket_id = 'campaign-media' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'campaign-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users delete campaign covers in own folder" on storage.objects;
create policy "Users delete campaign covers in own folder"
  on storage.objects for delete to authenticated
  using (bucket_id = 'campaign-media' and (storage.foldername(name))[1] = auth.uid()::text);
