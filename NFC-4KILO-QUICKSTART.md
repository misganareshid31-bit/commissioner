# Commissioner — 4Kilo NFC Gift Card Quick Start

## What this build changes

1. Repairs the mobile navigation into a proper right-side drawer with overlay, close button, scrolling, account actions, and creator CTA.
2. Adds a permanent NFC flow:
   - Before the creator claims the card: the NFC URL opens the profile setup page.
   - After the creator submits and the admin approves the profile: the **same NFC URL** opens the public profile.
3. Adds a public creator/business profile renderer for approved NFC-linked profiles.
4. Adds an Admin shortcut: **Prepare 4Kilo Entertainment card**.
5. The Admin screen now shows **Copy NFC URL** and **Open** for the generated card link.

## Supabase requirement

Run `supabase-schema.sql` in the Supabase SQL Editor if the current production database has not already been updated with the schema in this package.

The public profile fallback relies on the existing RLS policies that allow approved + onboarded creator/business profiles to be read publicly.

## Make the 4Kilo card

1. Deploy this package to the existing Commissioner Vercel project.
2. Sign in with the Commissioner admin account.
3. Open **Admin**.
4. Click **Prepare 4Kilo Entertainment card**.
5. Click **Create claim link**.
6. Click **Copy NFC URL**.
7. Write that URL to the NFC tag using any standard NFC-writing app/device.
8. Tap the physical card with a phone to test it.
9. Give the card to 4Kilo. He can open the NFC page and enter/edit the public information.
10. Approve the profile from Admin. The exact same NFC URL will then open his public profile.

## Important

The code prepares the NFC URL and the web flow. It cannot physically write the NFC chip because that requires the physical NFC tag and an NFC-capable device. No private Supabase service-role key is included in this package.
