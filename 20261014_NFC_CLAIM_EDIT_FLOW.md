# NFC claim / edit flow — 2026-10-14

## Flow
1. Tap card -> `/?claim=<token>` -> `NfcFlow` (src/components/Site.jsx).
2. Unclaimed: minimal public preview (name, photo, city, short bio) + **Claim Profile**.
3. Not signed in: Claim Profile sends them to sign in, then back to the same card to tap Claim again (no auto-claim from a link).
4. Signed in: `claim_nfc_profile(token)` — atomic, first claim wins, claimed profiles cannot be taken over.
5. Owner lands in **Edit Profile**: name, username, photo, bio, city, contact email/phone, links (social handles, portfolio/website) and a "Visible on your card" list.
6. Public viewers get only what `get_nfc_public_profile(token)` returns, filtered on the server. Contact details are **off by default**.
7. Messaging: visitors see "Message on Commissioner" (existing `start_conversation` flow) unless the owner switches messaging off.
8. The old 50/50 block is replaced on the card page by `NfcFeatureBlock` (five plain feature descriptions).

## No admin privileges
`claim_nfc_profile` and `update_my_nfc_profile` never write `approved`, `verified`, `plan`, `claim_token`, `auth_user_id` or any `admin_users` row. Smoke tests 6 and 7 check this.

## Deploy order
1. Staging first. Run `supabase/migrations/20261014_NFC_CLAIM_EDIT_VISIBILITY.sql` (must run after all older migrations).
2. Run `20261014_NFC_FLOW_SMOKE_TESTS.sql` (rolls back). Fix the two user UUIDs; adjust the test insert if `creator_profiles` has other NOT NULL columns.
3. `npm ci && npm run build` (the uploaded zip has no node_modules; `dist/` is STALE and still contains the old 50/50 text).
4. Run the device checklist below, then deploy.

## Known gaps (not fixed here)
- `/creator/:id` and `/business/:id` still read the profile tables directly, and the public RLS policy exposes whole rows (including `contact_email` and, on claimed rows, `claim_token`). Visibility choices are only enforced server-side on the NFC token page. See the notes at the bottom of the migration for the optional cleanup.
- Several older migrations redefine `claim_profile` / `claim_business` differently. The old pre-login claim forms are no longer used by the NFC route but the RPCs still exist.

## Device checklist (iPhone Safari, plus one Android Chrome)
Use a real NTAG card written with `https://<domain>/?claim=<token>`.
- [ ] Tap card on an iPhone XS or newer (reads tags in the background; iPhone 7/8 need an NFC reader app or Control Centre tag reader). Banner opens Safari on the card.
- [ ] Unclaimed preview shows, **Claim Profile** is tappable with one thumb, no horizontal scroll at 320/375/390/430 px.
- [ ] Sign in (email and Google) returns to the same card; Claim works; Edit Profile opens.
- [ ] Focusing a text field does NOT zoom the page; keyboard does not hide the Save button (scroll if needed).
- [ ] Photo: choose from library and take with camera; HEIC photos upload and display.
- [ ] Toggle each visibility checkbox, save, open the card in a private tab (signed out): hidden items are absent.
- [ ] Contact off by default; on -> email/phone links work (`mailto:`, `tel:`).
- [ ] Second account cannot claim or edit (error shown); owner sees Edit Profile only on their own card.
- [ ] Message on Commissioner from a second signed-in account opens a conversation.
- [ ] Rotate to landscape, dark-mode iOS setting, Dynamic Type larger text: text stays readable.
- [ ] Notch/home-indicator: Save/Cancel not covered (viewport-fit=cover added).
