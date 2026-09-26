# Commissioner production hardening — 2026-09-26

Base: `Commissioner-complete-onboarding-visibility-contrast-fix-2026-09-26-PRODUCTION-HARDENED.zip`

## Changes in this pass
- Preserved completed-profile public visibility as `auth_user_id IS NOT NULL AND onboarded = true`.
- Preserved verification as a separate concern from public visibility.
- Hardened Trust Center so it reads private verification state through safe summary RPCs rather than directly selecting private claim rows.
- Added creator 50K eligibility status to Trust Center using the server-side eligibility function; 50K remains an eligibility trigger, not automatic verification.
- Added a Trust Center view of configured social OAuth connection metadata without exposing secrets/tokens.
- Added business verification history/audit storage and records admin review actions.
- Preserved admin-controlled promotions and launch gates.
- Preserved public verification wording and private evidence boundaries.
- Added a social OAuth production runbook documenting the external credentials/provider-approval dependency.

## External configuration still required
Instagram/TikTok/YouTube OAuth requires provider-approved applications, redirect URLs, scopes, client IDs and secrets. Secrets must be configured server-side (Supabase Edge Functions/Vercel secrets). This source does not claim those provider integrations are live.

## Build status
`npm run build` could not be verified in this isolated environment because the archive did not contain installed dependencies and package installation could not complete from the available package cache. The source was structurally inspected and delimiter-balanced, but that is not equivalent to a production compile.

Before deployment, run:

```bash
npm ci
npm run build
```

Then apply the migrations in their established project order, ending with:

`COMMISSIONER-REMAINING-BUILD-2026-09-26.sql`
