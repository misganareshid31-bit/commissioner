# Fix pass — changes made

## 1. Currency: $ → ETB
Every price display and placeholder in `src/components/Site.jsx` now uses
ETB instead of $: the 6 subscription plans, the creator rate-card price,
the 6 onboarding pricing fields, the budget-range placeholder, and the
"Max. price" filter label (which still had a literal `$` left in it).

## 2. Back button on every page
Added a real navigation-history stack to the top-level `Commissioner`
component — it tracks every page change automatically, so it works no
matter which of the many `setPage()` calls triggered the navigation.
A `BackButton` now renders on every page except Home, plus a simpler
back-to-home control on the four standalone pages that sit outside the
normal page tree (reset-password, the public creator/business profile
links, and the NFC claim page).

## 3. Filters — checked, one bug fixed
Reviewed the Creators and Businesses directory filters end to end:
niche, platform, city, follower threshold, price, and verified-only.
Logic is sound (upstream data is already normalized so nothing null
crashes the filter). The one real bug found: the "Max. price" filter
label had a leftover `$` — fixed as part of the ETB change above.

## 4. Hardcoded admin email removed
This was the most important fix. `misganareshid27@gmail.com` was
hardcoded as the permanent admin identity in 22 places across 5 SQL
files and the client (`Site.jsx`).

**Run `ADMIN-ROLE-MIGRATION.sql` in your Supabase SQL editor, after your
existing migrations, to apply this.** It:
- Creates a real `admin_users` table + `is_admin()` function
- Seeds the same two identities that previously had hardcoded access
  (`misganareshid27@gmail.com`, `admin@commissioner.app`) so nobody
  loses access when you run it
- Recreates every affected function and RLS policy to check
  `is_admin()` instead of a hardcoded email

To add or remove an admin from now on, no code changes needed:
```sql
insert into public.admin_users (user_id)
select id from auth.users where email = 'someone@example.com';

delete from public.admin_users where user_id = '<uuid>';
```

`Site.jsx` now calls `supabase.rpc('is_admin')` instead of checking a
hardcoded array — both in the nav (to show/hide the Admin menu item)
and in `AdminPanel` itself (the actual gate).

## 5. Dead code and clutter removed
- Deleted `src/pages/` entirely (8 files) — never imported anywhere,
  since `App.jsx` only ever renders `Site.jsx`
- Deleted 6 unused components: `ProfileCard.jsx`, `ProfileHeader.jsx`,
  `QRCodeBox.jsx`, `DirectoryFilter.jsx`, `Navbar.jsx`, `ui.jsx`, and
  `Footer.jsx` — all shadowed by components defined inline in
  `Site.jsx` and never actually imported
- Deleted the 3 stray draft copies at the repo root (`Site (3).jsx`,
  `Site (4).jsx`, `Site (6).jsx`) and the duplicate root-level
  `Auth.jsx` (byte-for-byte identical to `src/components/Auth.jsx`)
- Deleted the placeholder `New Text Document.env`

## What I did not touch
- The other SQL migration files (`supabase-schema.sql`,
  `NFC-ADMIN-FIX.sql`, `COMMISSIONER-TRUST-MARKETPLACE-B2B.sql`,
  `TRUST-SAFETY-MIGRATION.sql`, `PROFESSIONAL-V1-MIGRATION.sql`,
  `supabase-messaging.sql`) are left as-is — `ADMIN-ROLE-MIGRATION.sql`
  is a forward migration that overrides what it needs to, so you don't
  have to edit or reorder anything already applied to a live database.
- I could not run this against a live Supabase project or a real dev
  server (no network access in my environment) — I verified the JSX
  edits with a bracket-balance check and traced the logic by hand, but
  you should still smoke-test signup/login, the directories, and the
  admin panel after deploying.


## 9. Production hardening pass (new)
Given the detailed 51-item production spec, here's what a real audit of the
code (not the docs/comments, which lag behind) found and fixed. See
`PRODUCTION-HARDENING-MIGRATION.sql` for the SQL — run it last, after every
other migration.

**Real bug found and fixed:** `PLAN-SYSTEM-MIGRATION.sql` redefines
`protect_admin_fields()` (the trigger that stops a normal user from setting
`approved`/`verified`/`plan` on their own profile) and, in doing so, silently
reverted its admin check from `is_admin()` back to the old hardcoded email —
undoing part of `ADMIN-ROLE-MIGRATION.sql` if it was applied afterward (it's
the newer file, so this is the likely order). Not an open door for ordinary
users, but it meant any admin added later through `admin_users` wouldn't be
recognized by this specific trigger. Fixed by redefining the function again,
correctly, in the new migration.

**Real gap found and fixed:** verification's "100% complete before you can
request review" rule only existed in the React client
(`creatorCompletionChecklist` / `businessCompletionChecklist` in Site.jsx). A
direct call to `submit_creator_verification` / `submit_business_verification`
(REST, curl, devtools) could submit a request below 100%. Added
`creator_profile_completion_pct()` / `business_profile_completion_pct()` SQL
functions mirroring the client checklist field-for-field, and both RPCs now
reject the call server-side if completion isn't 100%.

**Real gap found and fixed:** the 50/50 launch gate added last pass was
UI-only. Added `launch_unlocked()` and wired it into the `b2b_connections`
insert policy, so a direct API call can't create a connection before
threshold either. Admins still bypass it.

**Already correct, no change needed:** profile save on both the creator and
business setup flows already uses `.upsert()` — first save, edit, and
re-save all work without duplicate-row or "already exists" errors.
`is_admin()` / `admin_users` (from `ADMIN-ROLE-MIGRATION.sql`) already covers
every table this session checked *except* the one regression above. Ratings,
blocking, and reporting tables already exist (`TRUST-SAFETY-MIGRATION.sql`).
Messaging is already usable without a prior "accepted" connection (visibility
setting per profile, not connection-gated) — matching this session's explicit
instruction, so it was left as-is.

**Confirmed still missing (not built this pass — see report):** a real
notifications system (no table/UI exists at all), a dedicated NFC
"card registry" admin screen (NFC currently works via `claim_token` +
external physical programming, which covers the actual use case, but there's
no list/reassign/disable UI as described in the spec).

## 7. 50/50 launch gate (new)
Added the missing launch-gate feature: Commissioner unlocks full networking
once it has **50 verified creators AND 50 verified businesses**. Nothing
else was in place for this before — no counts, no gate, no UI.

- `fetchLaunchStats()` (top of `src/components/Site.jsx`) runs two
  count-only queries (`creator_profiles` / `business_profiles`, filtered to
  `approved && onboarded && verified`) and returns
  `{ creatorCount, businessCount, threshold: 50, unlocked }`. No schema
  change needed — it reads the same tables/columns the rest of the app
  already queries publicly.
- New shared components: `LaunchProgressBar`, `LaunchProgressCard` (the
  public progress display), `LaunchGateNotice` (shown in place of a locked
  action).
- **Public homepage** now shows a live "Launch progress" section with both
  progress bars — real counts, never placeholders.
- **B2B Network page**: if the platform isn't unlocked yet, the page shows
  `LaunchGateNotice` instead of the connect grid (existing connections, if
  any, still list below it), and the `send()` connect action itself refuses
  to fire while locked, as a second guard.
- **"Message" from a creator card / marketplace "Contact"** (`onHire`, top
  level): now checks the same launch state before opening a conversation;
  shows a toast explaining the threshold instead of silently proceeding.
- **Admins bypass the gate** (checked via the existing `is_admin()` RPC) so
  the team can exercise the network before launch, with a small "Admin
  preview — still locked for everyone else" banner so it's never mistaken
  for the real unlocked state.
- **Admin panel** now shows the same live `LaunchProgressCard` at the top,
  so admins can see real progress without a separate report.

**What this does not do:** the gate above is a client-side/UX gate, not a
database-level security boundary — it stops the UI from offering the
action, but it does not add a Postgres RLS policy that blocks
`b2b_connections` inserts or `start_conversation` calls server-side before
threshold. If you need the lock to hold even against a direct API call
(not just the web UI), that needs a companion SQL migration checking the
same counts inside those functions/policies — flag it and I can add that
next.

## 6. Auth and role-isolated onboarding hardening
- Normal wrong-password/validation errors no longer trigger a 60-second email cooldown; only real rate-limit responses do.
- Confirmation resend displays a clear sending state and keeps the confirmation subject explicit.
- Direct `/join/business` and `/join/creator` loads explicitly set the active role before rendering onboarding, preventing a stale role from opening the wrong setup form.
- Added `FIX-PROFILE-INSERT-RLS.sql` for authenticated self-inserts into creator/business profiles.
- Added `SUPABASE-EMAIL-SETUP.md` documenting the exact email subjects and SMTP configuration required for reliable delivery.
