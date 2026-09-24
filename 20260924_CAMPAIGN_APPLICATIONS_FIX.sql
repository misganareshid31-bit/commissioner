-- Run after 20260920_CAMPAIGNS_FEEDBACK.sql because it uses public.campaigns.
-- Campaign applications: make the UGC application flow persistent.
create table if not exists public.campaign_applications (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  creator_profile_id uuid not null references public.creator_profiles(id) on delete cascade,
  message text not null default '',
  status text not null default 'pending' check (status in ('pending','accepted','declined','withdrawn')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, creator_profile_id)
);

create index if not exists campaign_applications_campaign_idx on public.campaign_applications(campaign_id, created_at desc);
create index if not exists campaign_applications_creator_idx on public.campaign_applications(creator_profile_id, created_at desc);
alter table public.campaign_applications enable row level security;

drop policy if exists "Creators view own campaign applications" on public.campaign_applications;
create policy "Creators view own campaign applications"
  on public.campaign_applications for select to authenticated
  using (exists (select 1 from public.creator_profiles p where p.id=creator_profile_id and p.auth_user_id=auth.uid()));

drop policy if exists "Creators apply to published campaigns" on public.campaign_applications;
create policy "Creators apply to published campaigns"
  on public.campaign_applications for insert to authenticated
  with check (
    exists (select 1 from public.creator_profiles p where p.id=creator_profile_id and p.auth_user_id=auth.uid() and p.onboarded=true)
    and exists (select 1 from public.campaigns c where c.id=campaign_id and c.status='published')
  );

drop policy if exists "Business owners view campaign applications" on public.campaign_applications;
create policy "Business owners view campaign applications"
  on public.campaign_applications for select to authenticated
  using (exists (
    select 1 from public.campaigns c join public.business_profiles b on b.id=c.business_profile_id
    where c.id=campaign_id and b.auth_user_id=auth.uid()
  ));

drop policy if exists "Business owners review campaign applications" on public.campaign_applications;
create policy "Business owners review campaign applications"
  on public.campaign_applications for update to authenticated
  using (exists (
    select 1 from public.campaigns c join public.business_profiles b on b.id=c.business_profile_id
    where c.id=campaign_id and b.auth_user_id=auth.uid()
  ))
  with check (status in ('pending','accepted','declined','withdrawn'));

drop function if exists public.apply_to_campaign(uuid,text);
create or replace function public.apply_to_campaign(p_campaign_id uuid, p_message text default '')
returns uuid
language plpgsql security definer set search_path=public
as $$
declare v_creator uuid; v_id uuid;
begin
  select id into v_creator from public.creator_profiles where auth_user_id=auth.uid() and onboarded=true limit 1;
  if v_creator is null then raise exception 'Complete your Creator profile setup before applying to a campaign.'; end if;
  if not exists (select 1 from public.campaigns where id=p_campaign_id and status='published') then raise exception 'This campaign is not open for applications.'; end if;
  insert into public.campaign_applications(campaign_id,creator_profile_id,message,status)
  values(p_campaign_id,v_creator,trim(coalesce(p_message,'')),'pending')
  on conflict (campaign_id,creator_profile_id) do update set message=excluded.message,status='pending',updated_at=now()
  returning id into v_id;
  return v_id;
end;
$$;
grant execute on function public.apply_to_campaign(uuid,text) to authenticated;

drop function if exists public.review_campaign_application(uuid,text);
create or replace function public.review_campaign_application(p_application_id uuid, p_status text)
returns boolean
language plpgsql security definer set search_path=public
as $$
declare v_ok boolean; v_rows integer;
begin
  if lower(p_status) not in ('accepted','declined') then raise exception 'Invalid application status.'; end if;
  update public.campaign_applications a
  set status=lower(p_status), updated_at=now()
  from public.campaigns c
  join public.business_profiles b on b.id=c.business_profile_id
  where a.id=p_application_id and a.campaign_id=c.id and b.auth_user_id=auth.uid();
  get diagnostics v_rows = row_count;
  v_ok := v_rows > 0;
  return v_ok;
end;
$$;
grant execute on function public.review_campaign_application(uuid,text) to authenticated;
