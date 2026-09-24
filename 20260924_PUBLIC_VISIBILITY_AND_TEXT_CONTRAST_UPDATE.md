# Commissioner — Public Profile Visibility + Text Contrast Update

## Visibility rule
Completed profiles are publicly discoverable when `auth_user_id` is present and `onboarded = true`.
`approved` is no longer used as the public-discovery gate.
Verification remains separate from public visibility.

Updated across:
- Creator Explore query
- Business Explore query
- Explore/B2B discovery query
- Public profile RLS
- Public creator/business ranked views
- Marketplace listing visibility for completed profiles
- Creator product visibility for completed profiles

## Text visibility
Reviewed inline white text in light/white surfaces and changed those instances to readable dark Commissioner ink. White text remains where it is intentionally placed on dark/colored surfaces.

## Migration
Run:
`20260924_PUBLIC_PROFILE_VISIBILITY_FIX.sql`

This migration updates RLS and reloads the PostgREST schema cache.
