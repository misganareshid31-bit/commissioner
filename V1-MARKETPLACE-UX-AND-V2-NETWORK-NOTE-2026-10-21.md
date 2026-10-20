# Commissioner V1 marketplace + navigation polish (21 Oct 2026)

## Included
- The B2B Network page and its underlying implementation are preserved. It is labelled as planned for V2, while V1 primary navigation remains focused on the active core experience.
- Marketplace has a more engaging, branded hero, clearer search/discovery copy, a direct “Post a listing” action, and a scroll-oriented intro.
- Business marketplace listings can upload a photo (JPG/PNG/WebP, max 5 MB) rather than requiring an externally hosted image URL.
- Creator products/services can upload a photo (JPG/PNG/WebP, max 5 MB) rather than requiring an externally hosted image URL.
- Existing media URL fields remain available as a fallback. Marketplace cards already render listing media.
- Top navigation gets a refined branded accent strip, cleaner logo/tagline treatment, and clearer active-page styling.

## Supabase SQL
Run this additional migration in Supabase SQL Editor:
`supabase/migrations/20261021_V1_MARKETPLACE_MEDIA.sql`

The prior campaign image migration is separate:
`supabase/migrations/20261021_V1_CAMPAIGN_MEDIA_AND_DETAILS.sql`
Only run a migration if it has not already been applied to this Supabase project. Do not rerun unrelated historical SQL files.

## Verification status
- This is a source update, not a live deployment.
- SQL syntax and storage policies have not been tested against the live Supabase project.
- The full Vite production build has not been run in this environment because dependencies are not installed here.
- V2 B2B code is preserved; it has not been deleted or rebuilt.
