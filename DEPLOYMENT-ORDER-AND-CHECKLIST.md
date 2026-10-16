# Commissioner deployment bundle

## Included
- Existing React + Vite application source from the supplied ZIP.
- Public assets and Vercel SPA routing configuration.
- Existing Supabase SQL migration history in `supabase/migrations/`.
- `.env.example` with the two browser-safe Vite variables.
- `20261016_PROFILE_PREFERENCES_NOTIFICATIONS_FOUNDATION.sql`, a new backend foundation migration for profile contact preferences and user notification records.

## Deploy the frontend
1. Extract this folder and open a terminal in it.
2. Copy `.env.example` to `.env.local`.
3. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to the project's actual Supabase URL and anon/publishable key.
4. Run `npm ci`.
5. Run `npm run build`. Do not deploy if the build fails.
6. Push the source to GitHub and import it into Vercel. Use Vite, `npm run build`, output directory `dist`.
7. Add the same two variables in Vercel's Production environment, then redeploy.

Never put a Supabase service-role key in `.env.local`, any `VITE_` variable, or browser code.

## Supabase SQL — important
This ZIP contains a history of SQL migrations/repairs, not one universal script that is safe to execute in any order against every database. The existing `DEPLOYMENT.md` and `docs/` describe older rollout steps and some instructions conflict because the schema evolved over time.

- If setting up a **new, empty** Supabase project, review the migrations and apply the intended base schema plus the required migrations in chronological dependency order, testing each stage.
- If deploying to the **existing production** Supabase project, take a database backup first and check which migrations have already been applied. Apply only missing migrations; do not blindly rerun every root-level `.sql` file or every repair migration in the SQL Editor.
- Do not treat the root-level SQL copies as a separate execution list. The canonical migration files in this bundle are under `supabase/migrations/`.
- Apply `20261016_PROFILE_PREFERENCES_NOTIFICATIONS_FOUNDATION.sql` only after `creator_profiles` and `business_profiles` exist. It adds storage/table/RLS only; it does not automatically send notifications or make the frontend display them.
- Admin assignment must use the real admin user's auth UUID and the existing `admin_users` design. Do not hardcode an admin email into frontend source.

## Critical verification before production
The project was not connected to your live Supabase instance, so no remote database was changed and live auth/RLS behavior cannot be certified here. Before deploying, verify:
- `npm ci` and `npm run build` succeed.
- Creator and business signup/login and profile editing work.
- Public profile visibility does not expose private contact data or claim tokens.
- Campaign creation and applications respect the real account type and row-level security.
- Messaging, verification/admin RPCs, NFC claim/edit, and storage policies work.
- Direct routes load after refresh in Vercel.
- The new notification table is not represented as functional until UI/events are wired to it.

## Current feature status
This is a clean deployment bundle of the supplied latest source plus a safe backend foundation migration. It does **not** claim that all requested Explore ranking, creator-owned campaign UI, profile-sharing buttons, settings guide, and notification UI have already been implemented. Those need source-level changes and end-to-end testing before calling the feature set complete.
