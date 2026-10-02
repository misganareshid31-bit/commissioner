# Commissioner — recipient NFC Gift Card Quick Start

## What this build changes

1. Repairs the mobile navigation into a proper right-side drawer with overlay, close button, scrolling, account actions, and creator CTA.
2. Adds a permanent NFC flow:
   - Before the creator claims the card: the NFC URL opens the profile setup page.
   - After the creator submits and the admin approves the profile: the **same NFC URL** opens the public profile.
3. Adds a public creator/business profile renderer for approved NFC-linked profiles.
5. The Admin screen now shows **Copy NFC URL** and **Open** for the generated card link.

## Supabase requirement

Run `supabase-schema.sql` in the Supabase SQL Editor if the current production database has not already been updated with the schema in this package.

The public profile fallback relies on the existing RLS policies that allow approved + onboarded creator/business profiles to be read publicly.

## Make the recipient card

1. Deploy this package to the existing Commissioner Vercel project.
2. Sign in with the Commissioner admin account.
3. Open **Admin**.
4. Create the gift profile from the Admin page.
5. Click **Create claim link**.
6. Click **Copy NFC URL**.
7. Write that URL to the NFC tag using any standard NFC-writing app/device.
8. Tap the physical card with a phone to test it.
9. Give the card to recipient. He can open the NFC page and enter/edit the public information.
10. Approve the profile from Admin. The exact same NFC URL will then open his public profile.

## Important

The code prepares the NFC URL and the web flow. It cannot physically write the NFC chip because that requires the physical NFC tag and an NFC-capable device. No private Supabase service-role key is included in this package.


## Gift / open-ended profiles

The Admin page now has **New open-ended gift profile**. Leave the recipient name empty if you want a blank gift profile. The recipient can tap the NFC card and fill in their own name, username, city, bio, social links, photo, banner, portfolio, availability, and preferences before the admin approves it.

## NTAG215 writing

The built-in **Write to NTAG215** button uses the browser Web NFC API and writes a standard URL/NDEF record. Web NFC writing requires an HTTPS deployment and a supported NFC-capable Android browser/device (commonly Chrome). Desktop browsers generally cannot physically write an NFC tag. If Web NFC is unavailable, use the **Copy** button with an NFC-writing app.

## 2026-09-22 ownership hardening

Before distributing gifted NFC cards, run `20260922_NFC_OWNERSHIP_HARDENING.sql` in Supabase SQL Editor after the existing Commissioner migrations. Gifted claim links remain permanent, but claiming now requires a signed-in Commissioner account and binds the profile to that account. The anonymous NFC lookup no longer returns the claim token or account owner ID.

Recommended acceptance test:
1. Create a new open-ended gift profile in Admin → NFC.
2. Open its claim URL while signed out: the site must require sign-in.
3. Create/sign in to the recipient account and return to the same URL.
4. Complete the profile and save it.
5. Confirm the profile's official URL is `/creator/<id>` or `/business/<id>`.
6. Tap the same NFC card again. It must open the official profile, not the setup form.
7. Sign out and sign in as a different account. The second account must not be able to edit the gifted profile.
