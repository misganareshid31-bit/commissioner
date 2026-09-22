# Admin RPC Repair — 2026-09-22

The admin Campaigns and Marketplace screens call these zero-argument Supabase RPCs:

- `public.admin_list_campaigns()`
- `public.admin_list_marketplace()`

If Supabase reports that either function cannot be found in the schema cache, run `20260922_ADMIN_RPC_REPAIR.sql` in **Supabase Dashboard → SQL Editor**.

## Required order

1. Make sure the main Commissioner schema is installed.
2. Make sure `public.campaigns` exists.
3. Make sure `public.marketplace_listings` exists.
4. Make sure `public.is_admin()` exists.
5. Run `20260922_ADMIN_RPC_REPAIR.sql`.
6. Wait a few seconds, refresh the Commissioner admin page, and sign in again if needed.

The migration grants `EXECUTE` only to `authenticated` and the SQL functions still enforce `public.is_admin()`, so merely being signed in does not grant admin access.

## What this fixes

It fixes the exact PostgREST shape used by the React app: a zero-parameter RPC call. It also sends a PostgREST schema reload notification after the functions are created.
