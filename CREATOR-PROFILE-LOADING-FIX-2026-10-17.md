# Creator profile loading fix — 2026-10-17

Updated `src/components/Site.jsx` in `OfficialCreatorPage` so the profile loader does not remain indefinitely on “Loading creator profile…” when the profile query or public-profile RPC fails.

Changes:
- Wrap profile loading in `try/catch/finally`, ensuring the loading state is cleared on success or error.
- Surface a readable error when `get_public_creator_profile` returns an error or no profile.
- Add a 15-second UI timeout and a **Try again** button.
- Handle the public RPC result as either a single object or an array.

Deployment note: the frontend change does not repair a missing/broken Supabase function or database permissions. If the error appears after deployment, check Supabase SQL migrations, API logs, and the browser console. This candidate has not been production-build-tested or tested against the live database.
