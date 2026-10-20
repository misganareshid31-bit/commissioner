-- Run this diagnostic in Supabase SQL Editor. It does not modify any data.
-- It reports completed-profile counts, current public SELECT policies, and grants.

select 'creator_profiles' as source,
       count(*) as total_rows,
       count(*) filter (where coalesce(onboarded, false)) as completed_rows,
       count(*) filter (where coalesce(onboarded, false) and auth_user_id is not null) as discoverable_rows,
       count(*) filter (where auth_user_id is null and coalesce(claimed, false) = false and claim_token is not null and nullif(trim(page_name), '') is not null) as unclaimed_discoverable_rows,
       count(*) filter (where coalesce(onboarded, false) and coalesce(verified, false)) as verified_rows
from public.creator_profiles
union all
select 'business_profiles' as source,
       count(*) as total_rows,
       count(*) filter (where coalesce(onboarded, false)) as completed_rows,
       count(*) filter (where coalesce(onboarded, false) and auth_user_id is not null) as discoverable_rows,
       count(*) filter (where auth_user_id is null and coalesce(claimed, false) = false and claim_token is not null and nullif(trim(business_name), '') is not null) as unclaimed_discoverable_rows,
       count(*) filter (where coalesce(onboarded, false) and coalesce(verified, false)) as verified_rows
from public.business_profiles;

select schemaname, tablename, policyname, permissive, roles, cmd, qual
from pg_policies
where schemaname = 'public'
  and tablename in ('creator_profiles', 'business_profiles')
  and cmd in ('SELECT', 'ALL')
order by tablename, policyname;

select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('creator_profiles', 'business_profiles')
  and grantee in ('anon', 'authenticated')
  and privilege_type = 'SELECT'
order by table_name, grantee;
