# Commissioner V1 workflow implementation — 2026-10-21

## Included in this patch
- Removed B2B Network from the ordinary top navigation for V1. The existing route and database work are preserved for a future release; this patch does not drop B2B tables or data.
- Expanded campaign posting with optional campaign cover image, target audience, platform/content format, deliverables and number of creators.
- Campaign covers upload to the `campaign-media` Supabase Storage bucket. The matching migration creates the bucket and ownership-scoped upload/update/delete policies.
- Campaign management displays the cover image and new details; existing close/reopen and owner-scoped delete controls remain.
- Business marketplace posts can now be hidden/restored as well as deleted. Delete prompts for confirmation and failures are surfaced.
- Existing application letter, application status and campaign conversation workflows are preserved.

## Required SQL
Run only `supabase/migrations/20261021_V1_CAMPAIGN_MEDIA_AND_DETAILS.sql` in Supabase SQL Editor for this patch. It is idempotent. Do not rerun unrelated historical migrations just because they are in the repository.

## Important current limitations
- This patch does not yet implement editing an already-published campaign's text/image in place; owners can close/reopen or delete and repost. Do not advertise full in-place editing as finished.
- Marketplace manager still supports create, hide/restore, and delete; in-place edit is not added in this patch.
- Explore messaging/connection preferences require a full audit of existing profile preference schema and RLS before exposing UI controls. Do not treat a client-side setting alone as an access control.
- B2B navigation is hidden, not erased. Existing internal routes/admin controls and migrations remain available to avoid destructive changes.
- Deployment/live Supabase behavior has not been verified from this source archive. Run the migration, build, then test with separate Creator and Business accounts before deploying.
