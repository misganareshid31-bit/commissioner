# Public discovery: gifted and unclaimed profiles

The Explore frontend previously filtered creators to `auth_user_id IS NOT NULL` and read from a legacy ranked view. That excluded gifted profiles before a recipient claimed them and could silently show an empty creator list if the ranked view was stale. Business Explore queried the raw table and required `onboarded = true`, which also excluded gifted profiles.

The new migration introduces limited-field security-definer RPCs for creator and business discovery. Public rows are limited to:

- claimed/completed profiles linked to a real authenticated account; or
- unclaimed gifted profiles that have no owner, have a claim token, and have a display name.

Claim tokens and contact details are not returned. A visitor cannot claim a profile by knowing its public UUID; claiming still requires the original claim URL/NFC flow. Unclaimed cards are informational only: messaging/connecting is disabled until the profile is claimed.

Run `supabase/migrations/20261016_PUBLIC_UNCLAIMED_DISCOVERY_FIX.sql` after the existing public-profile visibility hardening migration. Do not run all historical migrations in bulk.
