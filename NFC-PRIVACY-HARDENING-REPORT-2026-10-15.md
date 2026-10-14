# Commissioner NFC / public-profile hardening report — 2026-10-15

## Changes in this ZIP

- Creator public profile pages now request a server-filtered public projection instead of selecting profile rows directly. A signed-in owner can still load their own profile for editing.
- Business public profile pages use the same owner-vs-public loading split.
- Added `supabase/migrations/20261015_PUBLIC_PROFILE_VISIBILITY_HARDENING.sql` with public RPCs that apply the profile visibility settings before returning creator/business fields.
- The new public RPCs do not return contact email, contact phone, or `claim_token`.
- The migration clears legacy `contact_email` copies from the public profile tables after the previous migration copies those values into `profile_contact_private`.
- Renamed the admin-only 50/50 count heading to “Verification operations”; the NFC card flow uses the descriptive feature block instead of a public milestone.
- Kept the existing NFC claim/edit functions, which whitelist editable fields and do not grant admin, verified, approved, or plan privileges.

## Required deployment order

1. Back up the Supabase database and deploy to a staging project first.
2. Apply all existing migrations in the project's documented order, including `20261014_NFC_CLAIM_EDIT_VISIBILITY.sql`.
3. Apply `supabase/migrations/20261015_PUBLIC_PROFILE_VISIBILITY_HARDENING.sql` last.
4. Run `supabase/migrations/20261014_NFC_FLOW_SMOKE_TESTS.sql` in staging after replacing the two sample user UUIDs with real staging auth user IDs. Review any schema-specific NOT NULL fields before running it.
5. Build using `npm ci && npm run build`; deploy through Vercel's build pipeline, not by publishing the bundled `dist/` directory.
6. Test on real iPhone Safari and Android Chrome using the checklist in `20261014_NFC_CLAIM_EDIT_FLOW.md`.

## Important limitation — do not treat as production-certified

The app's normal public profile pages now use filtered RPCs, and contact email copies are cleared from the profile tables. However, this patch does **not** yet migrate `claim_token` out of the profile tables or remove every broad public table-read policy. A client that directly queries those tables may still be able to read claim tokens depending on the active grants/RLS policies. A complete fix requires a coordinated token-vault migration plus updating the admin/NFC management queries to use secure RPCs before removing direct public access. Do not deploy this ZIP as a security-certified release until that remaining token exposure is addressed and verified against the actual Supabase policies.

## Verification performed here

- Reviewed the NFC claim/edit component and migration definitions.
- Static source edits completed.
- Production build **not verified**: the provided environment did not have a working Vite executable, and dependency installation did not complete. No live Supabase database or physical iPhone was available, so SQL execution and device tests remain outstanding.
