# Commissioner — Master Prompt Implementation

This source package is the implementation target for the Commissioner master product specification supplied on 2026-10-01.

## Important production migration

Run this SQL **after the existing Commissioner migrations**:

`20261001_MASTER_PROMPT_FINAL_HARDENING.sql`

It aligns:

- public profile discovery with `auth_user_id IS NOT NULL AND onboarded = true`
- verification with a dedicated `verification_settings.youtube_subscriber_threshold` defaulting to 1,000
- creator YouTube eligibility
- business verification around business information + authorized representative information
- B2B / Promotions / Marketplace feature gates
- permanent `/nfc/:cardId` NFC routing
- NFC display customization
- promotion creative / CTA / audience / impression / click support
- idempotent public visibility policies and schema reload

## Google OAuth

The frontend now uses real Supabase OAuth:

`supabase.auth.signInWithOAuth({ provider: 'google' })`

Production redirect:

`https://commissioner.com.et/auth/callback`

The exact Supabase-generated provider callback must be configured in Google Cloud.

## NFC

Physical cards should use the stable card URL:

`https://commissioner.com.et/nfc/<NFC_CARD_UUID>`

The route resolves the card server-side. An unclaimed assigned card opens setup; after claiming, the same physical URL opens the owner's public information view.

The owner can configure NFC-specific displayed information from Account Settings.

## Build verification

The source was syntax-checked through the TypeScript JSX compiler in this environment.

A full `npm install` / Vite production build was not possible in the isolated environment because the npm registry dependency download timed out and the required packages were not cached locally.

Run in a networked development/CI environment:

```bash
npm.cmd install
npm.cmd run build
```

Then deploy to Vercel and complete live Supabase/OAuth/NFC smoke testing.
