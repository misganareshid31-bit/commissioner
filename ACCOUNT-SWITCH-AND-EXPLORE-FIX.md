# Commissioner account switch and Explore fix

## Supabase SQL

Use `supabase/migrations/20261016_PUBLIC_DISCOVERY_NO_APPROVAL.sql` in Supabase SQL Editor.

This corrected migration only adds the public SELECT policies for completed Creator and Business profiles. It deliberately does **not** run `CREATE OR REPLACE VIEW` on the existing `creator_profiles_ranked` or `business_profiles_ranked` views. Those views use `table.*`, and adding a new table column can shift the view's column order and trigger PostgreSQL error 42P16.

The policies allow completed profiles (`onboarded = true`) belonging to an account (`auth_user_id IS NOT NULL`) to be read by `anon` and `authenticated` roles without requiring approval or verification. They do not make incomplete profiles public.

## Important notes

- Back up the database before applying SQL.
- This SQL assumes both profile tables have `auth_user_id` and `onboarded` columns. If Supabase reports a missing column, stop and inspect the actual schema rather than guessing a replacement column.
- RLS policies on a table are generally combined permissively with OR. Existing policies can therefore also grant visibility; audit them if you need the exact public-visibility rule to be exclusive.
- This migration does not change frontend Explore queries or account-switch UI. Deploy the matching application code as well, and test in a logged-out browser.
