# Commissioner — feature inventory and workflow audit

Date: 2026-10-19

## Product end goal

Commissioner is a professional identity and opportunity network where creators and businesses create real profiles, optionally verify specific claims, discover one another, send connection requests, discuss work, publish campaigns/listings, and coordinate collaborations. It is not a payment processor or escrow product in V1. Trust is shown as specific verified facts, not a blanket safety guarantee.

## Workflow changes in this patch

### Campaign applications

1. A signed-in creator opens a published campaign and selects **Apply to campaign**.
2. A composer opens with the campaign title and an editable application message.
3. **Send Application** calls the secure `apply_to_campaign` RPC. The RPC requires a completed Creator profile, checks the campaign is published, blocks self-applications, prevents duplicate applications, restricts application writes to the secure RPCs, and saves the application as Pending.
4. The same transaction creates an application-specific conversation and sends the application text as the first message. The business gets the existing campaign-application notification event when the notification migration is installed.
5. The creator is taken to Messages, and the application remains in **Your campaign applications**.
6. The campaign-owning business sees **Pending**, **Accepted**, **Declined**, and **All** tabs. Accept/Decline only changes a pending application owned by that business. On success, the item moves immediately to the chosen tab and displays a confirmation.
7. The creator's dashboard reflects the same database status. Pending and Accepted application conversations can be opened by either participant. Accepted applications explicitly enable campaign-specific coordination and messaging; they do not grant admin rights, verification, payment access, or unrelated permissions.
8. A declined application cannot be opened through the application conversation action. Existing message history remains in the user's inbox.

### B2B connections

- Any signed-in account can initiate a B2B connection, including creator-only accounts and accounts that have not created a business profile. The Explore shortcut no longer adds a separate 100%-profile-completion precheck before routing to B2B.
- B2B shows accepted, outgoing-pending, and incoming-pending counts.
- A connection request can be accepted or declined only by its recipient. Accepting changes the status and opens/reuses the Messages conversation.
- Direct B2B messaging is available only after the connection is accepted.
- An unclaimed profile has no account to receive a request, so Connect remains unavailable and the UI explains why instead of pretending to send it.

## Feature inventory from the supplied source

### Public site and account
- Branded homepage, calls to action, getting-started guide, responsive navigation and footer.
- Email/password authentication, Google sign-in integration hooks, sign-out and password reset flow.
- One login can hold Creator and Business profiles, switch the active role, and open separate role dashboards.
- Creator and Business onboarding/profile editing, public profile pages, profile completion checks, avatar/media upload paths, profile URLs and selected public information.
- Account settings, role management, NFC display settings and profile-edit entry points.

### Discovery and identity
- Explore hub, creator directory and business directory.
- Search/filter by profile name, niche/industry and location where supported by each view.
- Public creator/business profiles, profile saving, verification indicators and unclaimed/gifted profile previews.
- Public inquiry/Work With Me form for creators.
- Profile contact visibility and public-field controls where configured in the database.

### NFC and QR-ready identity
- Public NFC card/profile route and claim flow for an unclaimed gifted profile.
- Claim/authentication before editing; owner-only profile editing and public visibility settings.
- Admin NFC registry: register/assign cards, manage card status, copy NFC link/setup link and write URL where browser/device support exists.
- iOS Safari does not expose Web NFC writing; an NFC-capable Android browser or external USB writer is required to write tags. A card link can still be copied and written externally.

### B2B Network
- Search creator/business profiles.
- Connection introduction message, outgoing/incoming requests, status labels and counts.
- Accept/decline actions, accepted-connection state, direct conversation opening and Messages handoff.
- Claim-status guard for unclaimed profiles.

### Campaigns and creator collaboration
- Business campaign publishing with title, description, niche, budget, deadline, location and requirements.
- Public list of published campaigns.
- Creator applications, application statuses, business review, accepted/declined states and application-related messages.
- In-app notifications for campaign applications/status updates when the notification foundation and event migration are installed.

### Marketplace
- Marketplace listing discovery and listing/category/price fields supported by the current source.
- Listing inquiries and a Messages conversation handoff for listings with valid IDs.
- Admin listing moderation (activate/hide).
- External website/order links where configured; Commissioner does not take payment or hold funds.

### Messages and notifications
- Conversation list, open thread, send/reply, unread counts/read-state support and conversation search.
- Marketplace inquiry conversations, B2B conversations and campaign-application conversations.
- In-app notification list/unread indicator, mark-one/all-read and Realtime updates where Supabase Realtime is enabled.
- Event hooks for new messages, B2B requests/status, campaign applications/status, and verification requests/status when the relevant SQL migrations are installed.

### Trust and verification
- Separate Creator and Business verification workflows.
- Creator evidence fields for platform/account ownership and optional audience/engagement facts; business evidence fields for legal/trade name, activity, representative and official contacts.
- Private evidence upload path and admin manual-review queue.
- Verified, pending, rejected and needs-recheck states; verification badge and plan assignment by authorized admins.
- Verification is separate from profile publication and is not automatically granted by editing a profile or accepting a campaign application.

### Dashboards, plans and reputation
- Separate Creator/Business dashboards.
- Creator analytics/rating-summary integration and campaign application panels.
- Basic/Pro/Premium plan presentation and admin plan assignment.
- Spotlight/featured content page.
- Plans/pricing page.

### Administration and site operations
- Admin-only overview and operational counts.
- Account/profile management and page deletion controls.
- Creator/Business verification review.
- NFC card manager and gifted profile creation/claim-link management.
- Campaign moderation (publish/close), marketplace moderation, promotion/banner management, feedback inbox and site maintenance/page controls.
- Feedback collection, About and Terms pages, robots.txt, sitemap.xml and Google Search Console verification asset.

## Known gaps or items that still need production verification

These are not claimed as complete just because related UI exists:

- The production Supabase schema/RLS/functions and the Vercel deployment must be tested together; no live database was changed by this patch.
- `npm ci` timed out in this environment, so a full Vite production build could not be confirmed. TypeScript's JSX transpiler reports zero syntax diagnostics for the source files checked.
- The campaign post form currently has no campaign poster-image upload field. This patch does not add that feature.
- Dashboard elements such as the creator “Campaign invitations” placeholder and some static summary values need review before being treated as live analytics.
- Pricing/Basic-Pro-Premium display is not proof that payments are enabled. Payment processing is intentionally off in V1.
- Automatic social-platform follower/engagement verification depends on approved provider APIs and credentials; manual review is the fallback.
- Email delivery, email notification templates, automatic profile-completion reminders and campaign-match alerts are not confirmed as implemented. The notification work here is in-app.
- Multi-team business permissions, advanced analytics, paid plan entitlements and campaign fulfilment/payment settlement need separate implementation/validation before being marketed as available.

## Deployment instructions for this patch

1. Back up the existing Supabase database and confirm which migrations have already been applied.
2. Do not run every historical `.sql` file. Apply only missing migrations in dependency order.
3. Ensure the existing campaign, profile and messaging tables exist.
4. Apply `supabase/migrations/20261019_CAMPAIGN_ACCEPTED_WORKFLOW.sql` after `campaign_applications`, `campaigns`, `creator_profiles`, `business_profiles`, `conversations`, `conversation_members`, and `messages` exist.
5. For B2B request/accept behavior, verify the existing B2B foundation is present, then apply missing `20261019_B2B_CONNECTIONS_OPEN_TO_SIGNED_IN_USERS.sql` and `20261019_B2B_ACCEPT_AND_MESSAGES.sql` in that order after their prerequisites exist.
6. If in-app notifications are not already active, verify `20261016_PROFILE_PREFERENCES_NOTIFICATIONS_FOUNDATION.sql` and the messaging/B2B/campaign/verification tables first, then apply `20261017_NOTIFICATION_EVENTS.sql`. Do not rerun blindly if already applied.
7. Set only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Vercel. Never expose a service-role key in browser code.
8. Install dependencies, run `npm run build`, deploy, then run the smoke tests below.

## Required smoke tests

- Creator and business signup/login; one account creates/switches both profiles; edit/save/public view consistency.
- Unclaimed NFC preview, claim, owner edit/save, logged-out public view, and privacy settings.
- B2B request from creator-only account, request notification, recipient accept/decline, count changes, and conversation opening for both users.
- Campaign apply with a custom message; application record and initial message exist once; business receives it; accept moves it to Accepted; creator sees Accepted; both participants can reopen the same thread; declined application is in Declined.
- Marketplace inquiry and message; verification evidence remains private; admin actions are restricted to authorized admin users.
- Notification read state, Realtime, direct routes on refresh, mobile layout and Vercel production logs.

A feature is production-ready only after its database/RLS behavior and end-to-end browser flow pass, not merely because its UI component is present.
