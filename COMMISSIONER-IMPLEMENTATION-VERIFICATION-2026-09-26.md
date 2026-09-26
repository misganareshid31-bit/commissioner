# Commissioner — implementation + recheck

## Base inspected
- September 26, 2026 Vite/Supabase build supplied in the ZIP.
- Existing React routes/components, Supabase migrations/RPCs, RLS migrations, authentication, NFC/public profile routing, marketplace, campaigns, verification, B2B networking, promotions, admin controls, and design system were inspected before changes.

## Added in this pass
1. **Structured creator verification evidence UI**
   - Platform
   - Platform account ID
   - Claimed username/profile
   - Audience count
   - Engagement rate
   - Ownership method: OAuth / code / bio / manual
   - Existing verification note retained
2. **Structured business verification evidence UI**
   - Legal business name
   - Trade name
   - Registration reference
   - Trade-license reference where applicable
   - TIN reference where applicable
   - Business activity
   - Authorized representative
   - Official contact
   - Official website
   - Existing verification note retained
3. **Secure verification RPCs**
   - Owner authorization is checked server-side.
   - No passwords, OAuth tokens, or private evidence are stored by the client.
4. **Promotion presentation**
   - Active scheduled promotions can now appear in their configured public placement.
   - Promoted content can optionally link to a target URL.
   - Promotion display remains behind the existing 50-creators / 25-businesses gate.
5. **Promotion admin targeting field**
   - Admin promotion creation now accepts an optional promoted-content URL.
6. **User-facing error hardening**
   - Replaced multiple direct Supabase/Postgres error-message surfaces with `safeUserError()` so schema/RLS/RPC internals are not shown to users.

## Existing features rechecked in source
- Public visibility uses `auth_user_id IS NOT NULL AND onboarded = true`; verification is separate.
- Creator and business public routes are stable profile-ID routes suitable for NFC.
- Owner-only edit controls are present on public profiles.
- Creator 50K eligibility is separated from verification/ownership.
- Manual/code/bio verification wording exists for unavailable provider integrations.
- Business verification is explicitly presented as Commissioner verification, not government verification.
- Trust Center uses the “specific facts, not a blanket safe score” principle.
- Marketplace has the existing 5-product/service launch gate.
- B2B networking has the existing 50-business launch gate.
- Promotion launch logic uses 50 creators + 25 businesses.
- Creator/business Explore sections contain Accounts + Campaigns tabs.
- Existing campaign application/review/messaging infrastructure remains in place.
- Existing admin tabs cover verification, NFC, campaigns, marketplace, promotions, feedback, and site controls.
- Role switching persists the active creator/business role and dynamically updates the alternate-profile label.
- Password reset, recovery routing, resend cooldown, and email redirect flows are already implemented.
- Existing contrast/readability fixes and responsive styles remain intact.

## Validation performed
- JSX/JavaScript syntax transpilation check passed for `src/components/Site.jsx`, `src/components/Auth.jsx`, and `src/App.jsx` using the installed TypeScript parser.
- Source-level checks confirmed the requested visibility rule, role switching, launch gates, admin controls, verification paths, and promotion paths are present.
- The production Vite build could **not** be executed in this environment because the supplied ZIP does not contain a complete installable `node_modules` tree and the environment could not complete `npm ci`/download the missing cached package (`yallist`). This is an environment/dependency-install limitation, not a reported Vite application build failure.

## Supabase migration
Use the consolidated:
`COMMISSIONER-REMAINING-BUILD-2026-09-26-FINAL.sql`

It contains the supplied September 26 remaining-build migration followed by the new evidence/promotion hardening patch.

## External configuration still required
- Supabase project must have the existing migrations applied in their intended order.
- Resend/Supabase SMTP configuration remains external.
- Social OAuth providers remain dependent on provider credentials, approved scopes/API access, and server-side secret configuration. The UI does not claim those integrations are live merely because the metadata architecture exists.
- Vercel production environment variables must match the existing `.env.example`/deployment documentation.

## Important non-blocking limitation
A real production build should still be run after dependencies are installed in a network-enabled environment:
`npm ci && npm run build`
