# Commissioner UX update — 18 Sep 2026

## Included
- Password-reset request now fails fast after 8 seconds instead of leaving the UI spinning for 15+ seconds.
- A failed reset request no longer imposes a client-side 30-second lockout; Supabase remains responsible for server-side rate limiting.
- Successful reset requests use a shorter 30-second resend window.
- Reset screen copy is shorter and clearer, with a simple explanation before the email field.
- Homepage hero no longer reserves a viewport-height blank area. It starts directly beneath the navigation with a deliberate 56px desktop / 40px mobile breathing space.
- Footer vertical padding and spacing are reduced substantially (roughly half the previous footprint).
- Existing page content, cards, and core application behavior are preserved.

## Supabase production requirement
Password reset must allow the exact production redirect URL:
`https://commissioner.com.et/reset-password`

Set this in Supabase Authentication → URL Configuration → Redirect URLs.

## Vercel
Keep the Vite variables required by the app. `VITE_` values are intentionally exposed to the browser. Use the Supabase Project URL and the browser-safe publishable key, never a `service_role` or `sb_secret_` key.

## Build note
The working environment could not complete `npm ci` because the dependency install timed out, so a local production build could not be truthfully reported as passed. Vercel should install from `package-lock.json` during deployment.
