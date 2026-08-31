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
