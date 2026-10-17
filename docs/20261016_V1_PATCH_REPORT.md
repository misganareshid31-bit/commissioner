# Commissioner V1 patch report — 2026-10-16

## Implemented in this patch

- Replaced creator discovery's legacy ranked-view dependency with a narrow RPC.
- Replaced business Explore's raw table query with the same limited-field RPC pattern.
- Included eligible gifted/unclaimed creator and business profiles in public discovery without requiring approval or verification.
- Added explicit unclaimed labels and disabled message/connect actions until ownership is claimed.
- Allowed the public profile route to render a safe unclaimed preview.
- Kept claim tokens and private contact fields out of public discovery RPC outputs.
- Marked creator profiles as claimed when saved by their authenticated owner.
- Preserved the default-price-filter fix.

## Validation performed

- `src/components/Site.jsx` was transpiled using the locally installed TypeScript parser with JSX enabled: zero syntax diagnostics.
- Migration text and frontend RPC names were cross-checked for consistency.

## Not verified in this environment

- Full `vite build`: dependency installation did not complete because `yallist@3.1.1` was not available in the offline cache and the network install timed out.
- Execution of the migration against production Supabase.
- Live Vercel deployment and browser end-to-end tests.

Treat this as a prepared V1 patch, not proof that the production deployment has passed all launch gates. Follow `DEPLOY-THIS-PATCH-FIRST.md` and complete its smoke tests.
