# Commissioner account switch and Explore visibility fix

## Changes in this bundle

1. The Creator/Business switch control in the signed-in header is now always visible on small and large screens. If the other profile does not exist yet, selecting it starts that role's setup instead of hiding the control.
2. Added `supabase/migrations/20261016_PUBLIC_DISCOVERY_NO_APPROVAL.sql`. It defines public discovery eligibility as an owned profile with `onboarded = true`; `approved` and `verified` are not required. Premium/Pro only affect ranking.

## Apply the SQL

1. Back up your Supabase database.
2. Open Supabase Dashboard → SQL Editor.
3. Review and run `supabase/migrations/20261016_PUBLIC_DISCOVERY_NO_APPROVAL.sql`.
4. Deploy the updated app bundle to Vercel.
5. Test Explore while logged out and signed in, with one completed unverified Creator and one completed unverified Business profile.

## Important

This migration assumes the current Commissioner schema has `creator_profiles`, `business_profiles`, `auth_user_id`, `onboarded`, `plan`, and `plan_expires_at`, matching the project's existing migrations and queries. It does not make incomplete profiles public. If profiles still fail to appear after applying it, inspect Supabase Table Editor to confirm their `onboarded` value is `true` and check the browser console/network response for RLS errors. This SQL has not been run against the live database from this workspace.
