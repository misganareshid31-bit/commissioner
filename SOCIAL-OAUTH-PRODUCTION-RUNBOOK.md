# Commissioner social OAuth production runbook — 2026-09-26

This build contains the client/database architecture for Instagram, TikTok and YouTube ownership verification. It does **not** claim provider OAuth is live until the provider applications, approved scopes, callback endpoints and server-side secrets are configured.

## Required production pieces

- Provider developer application and client ID
- Provider client secret stored only in Supabase/Vercel server secrets
- HTTPS callback endpoint per provider
- Server-side state/CSRF validation
- Secure token exchange and storage outside the React bundle
- Provider account ID retrieval
- Audience retrieval only for scopes/API access actually approved
- Disconnect/revocation handling
- Expiration and revalidation handling
- Fallback to manual/code/bio verification when unavailable

## Required user-facing unavailable state

> Verification for this platform is currently unavailable. You can use manual verification.

Never ask for or store a creator's social-media password.
