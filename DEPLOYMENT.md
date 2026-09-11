# Commissioner — Production deployment

## 1. Supabase

Apply the existing migrations in the order documented by the project, then apply:

1. `COMMISSIONER-MASTER-MIGRATION.sql` — **last of the existing migrations**
2. `20260911_DUAL_IDENTITY_COMPLETION_SECURITY.sql` — **final repair migration**

The master migration is the forward security layer. It replaces the older email-based
admin checks, adds secure verification review, the server-side 50/50 launch gate, and
the admin-only NFC registry. The final repair migration then adds server-backed
profile-completion percentages, reinforces dual-profile constraints, and removes any
legacy hardcoded-admin profile policies that may still exist from older schema files.

### Assign an admin

Do this in the Supabase SQL Editor using the email/identity you actually want to
administer the project. This command is an administrative setup action; the email is
not stored in the application source:

```sql
insert into public.admin_users (user_id)
select id
from auth.users
where lower(email) = lower('YOUR_ADMIN_EMAIL')
on conflict (user_id) do nothing;
```

Verify:

```sql
select public.is_admin();
```

Run that while signed in as the intended admin through the application/session.

Do **not** put a Supabase service-role key in Vercel or frontend code.

## 2. Environment variables

Copy `.env.example` values into Vercel:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Use the Supabase project's normal browser-safe anon/publishable key. Never use a
service-role secret in a `VITE_` variable.

## 3. Local build

From the project directory:

```bash
npm install
npm run build
npm run preview
```

This ZIP was inspected and modified, but dependency installation/build execution was
not available in the current environment because the npm dependency download timed
out. Therefore the production build result is **NOT TESTED** here.

## 4. GitHub

Create a repository and upload the project contents. Do not commit `.env` files
containing real secrets.

## 5. Vercel

Import the GitHub repository into Vercel.

Use:

- Framework preset: Vite
- Build command: `npm run build`
- Output directory: `dist`

Add the two Supabase environment variables for the Production environment.

The included `vercel.json` rewrites SPA routes to `index.html`, so direct URLs such
as `/admin`, `/creator/<id>`, `/business/<id>`, and `/join/creator` can refresh without
falling into a Vercel 404.

## 6. After deployment

Test in this order:

1. Sign up as Creator.
2. Sign up as Business.
3. Complete/edit both profiles and confirm repeat saves do not create duplicates.
4. Confirm incomplete profiles cannot request verification.
5. As admin, open `/admin` directly and after a refresh.
6. Verify a request, then approve it.
7. Confirm a normal user cannot set `verified` or `approved`.
8. Confirm live creator/business counts drive the 50/50 gate.
9. Confirm a direct connection insert is rejected below the gate.
10. Register and assign an NFC card in Admin → NFC management.
11. Program the physical NTAG215 externally with the displayed public URL.
12. Tap the card and confirm the public profile loads without login.

## NFC note

The website can generate, store, assign, and display the destination URL, and supported
browsers may write an NDEF URL directly. The physical NTAG215 is still a separate
piece of hardware: actual tag programming requires an NFC-capable device/writer.

## Current status

**NOT READY — production integration requires the Supabase master migration, admin
assignment, environment variables, and a successful production build/smoke test.**

No remote Supabase database was modified from this environment.

### Final public-discovery / marketplace migration
After the dual-identity security migration, run:
- `20260911_PUBLIC_VISIBILITY_MARKETPLACE_INTERACTION.sql`

This migration makes registered Creator and Business profiles publicly viewable while they are being completed, adds marketplace photo/video fields, and enforces the 100%-complete profile requirement before new connections or messages can be started.
