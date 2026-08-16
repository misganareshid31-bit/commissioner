-- Commissioner trust + marketplace + B2B layer
-- Run AFTER supabase-schema.sql, NFC-ADMIN-FIX.sql and PROFESSIONAL-V1-MIGRATION.sql.

create table if not exists public.creator_verification_claims (
  id uuid primary key default gen_random_uuid(),
  creator_profile_id uuid not null references public.creator_profiles(id) on delete cascade,
  identity_status text not null default 'not_submitted' check (identity_status in ('not_submitted','pending','verified','rejected')),
  account_status text not null default 'not_submitted' check (account_status in ('not_submitted','pending','verified','rejected')),
  followers_status text not null default 'not_submitted' check (followers_status in ('not_submitted','pending','verified','rejected')),
  engagement_status text not null default 'not_submitted' check (engagement_status in ('not_submitted','pending','verified','rejected')),
  evidence_note text default '',
  status text not null default 'pending' check (status in ('pending','verified','rejected','needs_recheck')),
  checked_at timestamptz,
  expires_at timestamptz,
  admin_note text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (creator_profile_id)
);

create table if not exists public.business_verification_claims (
  id uuid primary key default gen_random_uuid(),
  business_profile_id uuid not null references public.business_profiles(id) on delete cascade,
  registration_status text not null default 'not_submitted' check (registration_status in ('not_submitted','pending','verified','rejected')),
  license_status text not null default 'not_submitted' check (license_status in ('not_submitted','pending','verified','rejected')),
  representative_status text not null default 'not_submitted' check (representative_status in ('not_submitted','pending','verified','rejected')),
  evidence_note text default '',
  status text not null default 'pending' check (status in ('pending','verified','rejected','needs_recheck')),
  checked_at timestamptz,
  expires_at timestamptz,
  admin_note text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_profile_id)
);

create table if not exists public.marketplace_listings (
  id uuid primary key default gen_random_uuid(),
  owner_type text not null check (owner_type in ('creator','business')),
  owner_id uuid not null,
  title text not null check (char_length(trim(title)) between 1 and 140),
  description text default '',
  listing_type text not null default 'service' check (listing_type in ('product','service','merch','collaboration')),
  category text default '',
  price_display text default '',
  external_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists marketplace_listing_active_idx on public.marketplace_listings(active, created_at desc);

create table if not exists public.b2b_connections (
  id uuid primary key default gen_random_uuid(),
  requester_user_id uuid not null references auth.users(id) on delete cascade,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined','blocked')),
  message text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (requester_user_id, recipient_user_id),
  check (requester_user_id <> recipient_user_id)
);

create table if not exists public.profile_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_user_id uuid references auth.users(id) on delete set null,
  target_type text not null check (target_type in ('creator','business','listing','message')),
  target_id uuid not null,
  reason text not null check (reason in ('impersonation','fraud','misleading_information','spam','harassment','counterfeit','other')),
  details text default '',
  status text not null default 'open' check (status in ('open','reviewing','resolved','dismissed')),
  created_at timestamptz not null default now()
);

alter table public.creator_verification_claims enable row level security;
alter table public.business_verification_claims enable row level security;
alter table public.marketplace_listings enable row level security;
alter table public.b2b_connections enable row level security;
alter table public.profile_reports enable row level security;

-- Public verification summaries are intentionally read-only. Evidence and admin notes are not exposed here.
drop policy if exists "Public can view creator verification summary" on public.creator_verification_claims;
create policy "Public can view creator verification summary" on public.creator_verification_claims for select using (status = 'verified');
drop policy if exists "Creator manages own verification claim" on public.creator_verification_claims;
create policy "Creator manages own verification claim" on public.creator_verification_claims for all using (exists (select 1 from public.creator_profiles p where p.id=creator_profile_id and p.auth_user_id=auth.uid())) with check (exists (select 1 from public.creator_profiles p where p.id=creator_profile_id and p.auth_user_id=auth.uid()));
drop policy if exists "Admin manages creator verification claims" on public.creator_verification_claims;
create policy "Admin manages creator verification claims" on public.creator_verification_claims for all using (coalesce(auth.jwt()->>'email','')='misganareshid27@gmail.com');

drop policy if exists "Public can view business verification summary" on public.business_verification_claims;
create policy "Public can view business verification summary" on public.business_verification_claims for select using (status = 'verified');
drop policy if exists "Business manages own verification claim" on public.business_verification_claims;
create policy "Business manages own verification claim" on public.business_verification_claims for all using (exists (select 1 from public.business_profiles p where p.id=business_profile_id and p.auth_user_id=auth.uid())) with check (exists (select 1 from public.business_profiles p where p.id=business_profile_id and p.auth_user_id=auth.uid()));
drop policy if exists "Admin manages business verification claims" on public.business_verification_claims;
create policy "Admin manages business verification claims" on public.business_verification_claims for all using (coalesce(auth.jwt()->>'email','')='misganareshid27@gmail.com');

drop policy if exists "Public can view active marketplace listings" on public.marketplace_listings;
create policy "Public can view active marketplace listings" on public.marketplace_listings for select using (
  active = true and (
    (owner_type='creator' and exists(select 1 from public.creator_profiles p where p.id=owner_id and p.approved=true and p.onboarded=true)) or
    (owner_type='business' and exists(select 1 from public.business_profiles p where p.id=owner_id and p.approved=true and p.onboarded=true))
  )
);
drop policy if exists "Owners manage marketplace listings" on public.marketplace_listings;
create policy "Owners manage marketplace listings" on public.marketplace_listings for all using (
  (owner_type='creator' and exists(select 1 from public.creator_profiles p where p.id=owner_id and p.auth_user_id=auth.uid())) or
  (owner_type='business' and exists(select 1 from public.business_profiles p where p.id=owner_id and p.auth_user_id=auth.uid()))
) with check (
  (owner_type='creator' and exists(select 1 from public.creator_profiles p where p.id=owner_id and p.auth_user_id=auth.uid())) or
  (owner_type='business' and exists(select 1 from public.business_profiles p where p.id=owner_id and p.auth_user_id=auth.uid()))
);

drop policy if exists "Users view own B2B connections" on public.b2b_connections;
create policy "Users view own B2B connections" on public.b2b_connections for select using (requester_user_id=auth.uid() or recipient_user_id=auth.uid());
drop policy if exists "Users create B2B connection" on public.b2b_connections;
create policy "Users create B2B connection" on public.b2b_connections for insert with check (requester_user_id=auth.uid());
drop policy if exists "Recipients update B2B connection" on public.b2b_connections;
create policy "Recipients update B2B connection" on public.b2b_connections for update using (recipient_user_id=auth.uid() or requester_user_id=auth.uid());

drop policy if exists "Users create reports" on public.profile_reports;
create policy "Users create reports" on public.profile_reports for insert with check (reporter_user_id=auth.uid());
drop policy if exists "Admins view reports" on public.profile_reports;
create policy "Admins view reports" on public.profile_reports for select using (coalesce(auth.jwt()->>'email','')='misganareshid27@gmail.com');
drop policy if exists "Admins update reports" on public.profile_reports;
create policy "Admins update reports" on public.profile_reports for update using (coalesce(auth.jwt()->>'email','')='misganareshid27@gmail.com');

create or replace function public.submit_creator_verification(p_creator_profile_id uuid, p_evidence_note text default '') returns uuid as $$
declare v_id uuid;
begin
  if not exists(select 1 from public.creator_profiles where id=p_creator_profile_id and auth_user_id=auth.uid()) then raise exception 'not authorized'; end if;
  insert into public.creator_verification_claims(creator_profile_id,evidence_note,status)
  values(p_creator_profile_id,trim(coalesce(p_evidence_note,'')),'pending')
  on conflict (creator_profile_id) do update set evidence_note=excluded.evidence_note,status='pending',updated_at=now()
  returning id into v_id;
  return v_id;
end; $$ language plpgsql security definer set search_path=public;
grant execute on function public.submit_creator_verification(uuid,text) to authenticated;

create or replace function public.submit_business_verification(p_business_profile_id uuid, p_evidence_note text default '') returns uuid as $$
declare v_id uuid;
begin
  if not exists(select 1 from public.business_profiles where id=p_business_profile_id and auth_user_id=auth.uid()) then raise exception 'not authorized'; end if;
  insert into public.business_verification_claims(business_profile_id,evidence_note,status)
  values(p_business_profile_id,trim(coalesce(p_evidence_note,'')),'pending')
  on conflict (business_profile_id) do update set evidence_note=excluded.evidence_note,status='pending',updated_at=now()
  returning id into v_id;
  return v_id;
end; $$ language plpgsql security definer set search_path=public;
grant execute on function public.submit_business_verification(uuid,text) to authenticated;

create or replace function public.touch_commissioner_updated_at() returns trigger as $$ begin new.updated_at=now(); return new; end; $$ language plpgsql;
drop trigger if exists touch_creator_verification_claims on public.creator_verification_claims;
create trigger touch_creator_verification_claims before update on public.creator_verification_claims for each row execute procedure public.touch_commissioner_updated_at();
drop trigger if exists touch_business_verification_claims on public.business_verification_claims;
create trigger touch_business_verification_claims before update on public.business_verification_claims for each row execute procedure public.touch_commissioner_updated_at();
drop trigger if exists touch_marketplace_listings on public.marketplace_listings;
create trigger touch_marketplace_listings before update on public.marketplace_listings for each row execute procedure public.touch_commissioner_updated_at();
drop trigger if exists touch_b2b_connections on public.b2b_connections;
create trigger touch_b2b_connections before update on public.b2b_connections for each row execute procedure public.touch_commissioner_updated_at();

-- Safe public summaries: expose only verification states, never evidence or admin notes.
create or replace function public.get_creator_verification_summary(p_creator_profile_id uuid)
returns table(identity_status text, account_status text, followers_status text, engagement_status text, checked_at timestamptz) as $$
  select identity_status, account_status, followers_status, engagement_status, checked_at
  from public.creator_verification_claims where creator_profile_id=p_creator_profile_id and status in ('pending','verified','needs_recheck') limit 1;
$$ language sql security definer set search_path=public;
grant execute on function public.get_creator_verification_summary(uuid) to anon, authenticated;

create or replace function public.get_business_verification_summary(p_business_profile_id uuid)
returns table(registration_status text, license_status text, representative_status text, checked_at timestamptz) as $$
  select registration_status, license_status, representative_status, checked_at
  from public.business_verification_claims where business_profile_id=p_business_profile_id and status in ('pending','verified','needs_recheck') limit 1;
$$ language sql security definer set search_path=public;
grant execute on function public.get_business_verification_summary(uuid) to anon, authenticated;
