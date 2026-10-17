# Commissioner V1 discovery patch — deployment instructions

This package is a patch to the existing Commissioner React/Vite + Supabase project, not a rebuild.

## What changed

- Creator Explore and the homepage's featured creators now use `list_public_creator_discovery` rather than the legacy `creator_profiles_ranked` view or a raw table query.
- Business Explore and homepage featured businesses now use `list_public_business_discovery`.
- Both discovery functions return a limited set of public fields. They never return `claim_token` or private contact fields.
- Completed profiles linked to an account appear without requiring verification or admin approval.
- Eligible gifted/unclaimed profiles (no owner ID, a claim token, and a display name) can appear in discovery even before normal onboarding is complete.
- Unclaimed cards are labelled; message/connect actions are disabled until the profile is claimed.
- The public profile RPCs return a safe preview for eligible unclaimed profiles, without exposing the claim token. The page explains that the original claim link/NFC card is needed to manage it.
- Creator onboarding now explicitly saves `claimed: true` when linked to the authenticated user.
- The existing price-filter fix remains: the default price setting should not hide all profiles, and service prices are normalized before filtering.

## Required Supabase step — do this before deploying the frontend

1. Open Supabase Dashboard → SQL Editor for the **production project used by Commissioner**.
2. Open and run only this new migration:
   `supabase/migrations/20261016_PUBLIC_UNCLAIMED_DISCOVERY_FIX.sql`
3. Confirm the query completes successfully. It refreshes the API schema at the end.
4. Deploy this project ZIP through your normal Vercel workflow.
5. If the SQL fails, stop and share the complete error. Do not try to fix it by dropping or recreating `creator_profiles_ranked` / `business_profiles_ranked` views.

Do **not** paste every SQL file from the ZIP into Supabase. This project contains historical migrations that were intended for different deployment dates/order. The patch migration says it should follow the existing `20261015_PUBLIC_PROFILE_VISIBILITY_HARDENING.sql` baseline.

## Smoke-test after deployment

- Open Explore while signed out: a completed claimed creator and a gifted/unclaimed creator should both appear.
- Open an unclaimed creator card: it should open a safe preview, show an “Unclaimed creator profile” notice, and not offer messaging or inquiry actions.
- Open Explore businesses: eligible unclaimed businesses should appear with Connect disabled; View profile should still work.
- Open a claimed creator/business profile: existing profile details and interactions should continue to work.
- Sign in as a creator and complete onboarding: confirm the profile appears without requesting verification.
- Sign in as a business and complete onboarding: confirm it appears without requesting verification.
- Confirm the claim token, contact email, and other private fields do not appear in public RPC results.

## Verification status / limits

- JSX/JavaScript syntax transpilation was checked locally with the globally available TypeScript parser.
- A production Vite build could not be completed in this environment because dependency installation could not finish; the local npm cache is missing `yallist@3.1.1`, and the install attempt timed out. The ZIP therefore must be built by Vercel or a machine with network access before calling the patch production-verified.
- This package cannot run SQL against your live Supabase project, so database migration success and live user flows still require the smoke tests above.
