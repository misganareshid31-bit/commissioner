# Commissioner B2B access model — 2026-10-19

## Confirmed product rule
All signed-in users can initiate B2B connection requests, including Creator accounts. Users do not need to switch to a Business role just to send a connection request. The request must still be authenticated, cannot target the same account, and respects existing block protections.

## Code changes
- Removed the B2B page's old 50/50 launch-threshold UI gate for connection requests.
- Updated the page intro to explain that signed-in creators and businesses can connect.
- Added `supabase/migrations/20261019_B2B_CONNECTIONS_OPEN_TO_SIGNED_IN_USERS.sql` to replace the old RLS insert policy that required the launch threshold.

## Important rollout note
Run the migration only after the existing B2B table and `public.is_blocked(uuid, uuid)` function have been created by earlier Commissioner migrations. This migration has not been run against the production Supabase project. Direct-message initiation is handled separately by `start_conversation`; this change opens B2B connection requests and does not remove the existing profile-completion, messaging privacy, or block checks on direct messages.
