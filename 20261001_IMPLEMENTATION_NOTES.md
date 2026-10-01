# Commissioner — 2026-10-01 NFC / Google / Business Profile Update

## Included

- Added **Continue with Google** to the existing Supabase Auth screen using `supabase.auth.signInWithOAuth({ provider: 'google' })`.
- Google/email auth can preserve a pending NFC claim return URL through `/auth/callback`.
- NFC gift flow is now designed as a two-stage experience:
  1. First tap: recipient is guided to secure the open-ended profile with Google or email, then completes setup.
  2. After setup: the same physical NFC URL opens the profile as an information page; the tag does not need to be rewritten.
- NFC setup collects the signed-in account email and stores it as the profile contact email.
- NFC setup lets the owner choose which categories appear on the profile: bio, location, language, social links, services, portfolio, website/portfolio link, contact email, and verification details.
- Creator/business public profile rendering respects those NFC visibility preferences.
- Business onboarding/editing now supports an optional **banner image**.
- Business onboarding includes an in-app visual example at `/business-banner-example.svg` showing the recommended 1500×500 banner composition.
- YouTube creator verification eligibility is now **1,000 subscribers**. Other platforms continue to use the configured general creator threshold (15,000 by default in this migration).
- Business verification admin checks were aligned with the current Commissioner requirement: business information + authorized representative information; the UI no longer requires a trade-license field as the verification gate.
- Admin NFC writing now programs the permanent claim/profile URL rather than the temporary official profile URL. The same tag transitions from setup mode to information mode after the recipient finishes setup.

## Supabase migration

Run this file after the existing Commissioner migrations:

`20261001_NFC_PROFILE_CUSTOMIZATION_AND_YOUTUBE_THRESHOLD.sql`

It adds:

- `creator_profiles.contact_email`
- `business_profiles.contact_email`
- `creator_profiles.nfc_visibility`
- `business_profiles.nfc_visibility`
- platform-aware creator verification thresholds
- YouTube 1,000-subscriber threshold
- persistent NFC claim tokens after setup
- the updated NFC resolver and claim functions

## Google configuration

The frontend does **not** contain a Google client secret.

In Supabase → Authentication → Providers → Google, enter the Google Client ID and the newly regenerated Client Secret. Keep the secret out of source control.

The application uses the Supabase callback URL shown on the Google provider page. Google OAuth redirect configuration should point to that Supabase callback URL.

## Validation note

The project was not production-built in this environment because the extracted package does not have a usable Vite binary and the attempt to restore dependencies with `npm ci` timed out. The source changes and migration are included, but run `npm ci`/`npm run build` in your normal project environment before deployment.
