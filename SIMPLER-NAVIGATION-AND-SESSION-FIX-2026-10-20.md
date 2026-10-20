# Commissioner navigation and session restoration patch — 2026-10-20

## Changes in this patch

- Added clear signed-in navigation destinations for My workspace, Explore, Marketplace, B2B Network, Campaigns, and Messages.
- Added account-menu shortcuts for Edit profile, NFC settings, Manage campaigns & activity, and Account settings on desktop and mobile.
- Added dashboard shortcuts for Edit profile, NFC settings, Messages, and Marketplace post management.
- Added a My campaigns section to the Business dashboard, showing the signed-in business's own campaigns and allowing it to close/reopen or delete its own campaign. The database's existing row-level security remains the authorization boundary.
- Changed workspace restoration to derive the current user's saved Creator/Business workspace before waiting on Supabase profile lookups, reducing the wrong-workspace flash after refresh.
- Ignored Supabase's INITIAL_SESSION event for page-routing decisions and only auto-routed on an actual SIGNED_IN event, avoiding startup/refresh races that could redirect the user unexpectedly.

## Manual test checklist

1. Sign in as a Creator, open Edit profile, save, and refresh. Confirm Creator remains selected.
2. Sign in as a Business, open Edit profile, save, and refresh. Confirm Business remains selected.
3. Switch Creator/Business and confirm the selected workspace remains after refresh.
4. Open NFC settings from both desktop and mobile menus.
5. As a Business, post a campaign; confirm it appears under My campaigns. Close/reopen it and delete a test campaign.
6. Open Marketplace → Marketplace setup and verify that your own product/service listings can be managed there.
7. Sign out and sign into a different account. Confirm the previous user's profile is not displayed.

## Verification limits

The JSX source passed TypeScript's JSX transpilation check with zero syntax diagnostics. A full Vite production build was not run because node_modules are absent and dependency installation was not completed. This patch has not been deployed or tested against the live Supabase database/site. No SQL migration is intended for the UI/session changes; campaign management relies on existing table policies allowing owners to update/delete their own campaign rows.
