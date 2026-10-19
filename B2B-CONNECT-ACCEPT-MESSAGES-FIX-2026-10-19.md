# Commissioner B2B connection fixes — 2026-10-19

## Included
- B2B page shows counts for accepted connections, outgoing pending requests, and incoming pending requests.
- Unclaimed profiles are explicitly labelled and cannot be sent connection requests or messages. This prevents a missing `auth_user_id` from leaving a button stuck on “Sending…”.
- Connect requests have a `finally` cleanup for the busy state and display useful errors/status messages.
- Incoming requests show Accept and Decline actions.
- Accepting a request uses the `accept_b2b_connection` RPC, marks the connection accepted, creates/reuses the conversation, inserts a short acceptance message, and opens Messages through the existing Commissioner event.
- Direct Messages buttons are available only after the connection is accepted.
- Added migration `supabase/migrations/20261019_B2B_ACCEPT_AND_MESSAGES.sql` with secure RPCs. It preserves authentication, self-connection prevention, and block checks while allowing accepted B2B connections to open conversations without the old 50/50 networking gate.

## SQL rollout
Run this migration after the existing Commissioner B2B and messaging migrations, and after `20261019_B2B_CONNECTIONS_OPEN_TO_SIGNED_IN_USERS.sql`.

## Verification status
The source changes and migration are included, but the production build could not be verified in this environment because `npm ci` timed out. The SQL has not been executed against the live Supabase project. Test using two real signed-in accounts: send request, accept from recipient, confirm both accounts can open the same Messages conversation, and confirm an unclaimed profile is not stuck in a loading/sending state.
