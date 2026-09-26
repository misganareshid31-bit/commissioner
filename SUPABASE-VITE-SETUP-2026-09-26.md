# Supabase browser setup — Commissioner

Commissioner is a Vite + React application, not a Next.js application. The existing app already uses `@supabase/supabase-js` and already enables session persistence, automatic token refresh, and OAuth/email redirect detection.

Therefore the Next.js-only `@supabase/ssr` server helper and Next.js middleware from the generic Supabase example are **not added** to this build. Adding `cookies()`/Next middleware would be incompatible with the current Vite architecture.

## Environment variables

Use:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

The browser client also accepts the existing `VITE_SUPABASE_ANON_KEY` as a backwards-compatible fallback.

## Session behavior

The existing browser client uses:

- `persistSession: true`
- `autoRefreshToken: true`
- `detectSessionInUrl: true`

Auth components already subscribe to `onAuthStateChange`, so the application does not need Next.js middleware for session refresh.

## Important

The `.env.local` file is local configuration and is ignored by Git. Never put a Supabase service-role key in a Vite environment variable. Only a publishable/anon browser key belongs here.
