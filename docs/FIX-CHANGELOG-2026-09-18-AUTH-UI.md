# Commissioner UI/Auth/Supabase cleanup — 2026-09-18

## Frontend
- Removed the two requested cyan/magenta absolute blur-circle hero elements.
- Removed the matching first-section decorative pseudo-glows from `src/index.css`.
- Added a final dark professional UI pass with white/light typography and readable dark surfaces.
- Replaced the previous authentication card UI with a clean Commissioner auth flow:
  - Sign in / Sign up tabs
  - Creator / Business selection during sign-up
  - Email + password
  - Password visibility control
  - Password-strength feedback
  - Forgot-password flow
  - Email confirmation / resend flow
  - Clear loading, rate-limit, redirect, and SMTP messages
  - Signed-in state and sign-out-everywhere
- Kept Supabase Auth as the backend. The UI is redesigned; it does not replace Supabase's secure authentication service.

## Supabase
- Added `SUPABASE-CLEAN-FIX-2026-09-18.sql`.
- It checks that the base Commissioner schema exists before installing the admin layer.
- It uses `admin_users` + `is_admin()` instead of client-side email checks.
- It fixes the older admin claim functions so the `p_verified` parameter is actually respected.
- It grants the exact RPC signatures used by the frontend.
- `admin_check_setup()` now checks exact function signatures rather than counting function names.
- The existing `COMMISSIONER-MASTER-MIGRATION.sql` was also corrected so `p_verified` is not silently ignored.

## Validation
The source files were updated in the supplied project. A local Vite production build could not be executed in this environment because the uploaded project did not contain a complete installable `node_modules` cache and registry access was unavailable. Run `npm install` (or `npm.cmd install` on PowerShell) and then `npm run build` locally before deploying.
