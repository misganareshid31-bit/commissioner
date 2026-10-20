# Commissioner page hooks, descriptions and navigation update — 2026-10-21

## What changed
- Moved the Explore onboarding/how-to explainer out of the top of Explore and into the shared below-fold guide area.
- The shared `What you can do` / `How to use it` guide now renders after the main page content for standard feature pages, followed by the first-time Commissioner and UGC campaign explainer.
- Improved navigation text contrast and ensured nav icons render as SVG graphics rather than inline text.
- Kept the five primary signed-in destinations: My workspace, Explore, Marketplace, Campaigns, Messages. B2B remains preserved for V2.
- Added no database changes; no SQL migration is required for this UI-only patch.

## Test status
- Source archive integrity should be checked after packaging.
- Full production build, live Supabase workflows, and live deployment have not been run as part of this patch.
