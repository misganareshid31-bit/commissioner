# Commissioner final hardening — 2026-09-27

This patch is designed to run after the existing Commissioner 2026-09-26 migrations.

## Completed in this patch

- Private `verification-evidence` storage bucket with RLS.
- Creator/business evidence storage metadata.
- Owner/admin-only evidence attachment RPC.
- Admin verification readiness checks.
- Creator verification gate: 50K+ audience plus account-ownership evidence.
- Business verification gate: legal business identity, registration/licensing reference, and authorized representative.
- Verification approval audit entries.
- Admin evidence review panel showing the submitted verification facts.
- Admin private-evidence signed-link access.
- Trust Center private evidence upload UI.
- Clear distinction between eligibility and verification.

## Important external configuration

Instagram/TikTok/YouTube OAuth is still provider-dependent. This build does not claim those integrations are live without the required provider applications, approved scopes, callback URLs, and server-side secrets.

## Verification meaning

A Commissioner verification badge means that Commissioner reviewed the specific claims/evidence under its verification process. It is not a government license, blanket safety score, or guarantee of future conduct.

## Validation

The source was structurally inspected after modification. A production Vite build could not be executed in this isolated environment because the archive has no installed dependencies and the package cache lacks required npm tarballs. Run:

npm ci
npm run build

before deployment.
