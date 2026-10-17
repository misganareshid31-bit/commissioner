# Commissioner notifications — implementation status (2026-10-17)

## What was changed in this candidate

- Replaced the notification bell's hard-coded “You're all caught up” placeholder with a real `user_notifications` query.
- Added unread count badge, newest 30 notifications, loading/error/empty states, mark-one-read, mark-all-read, and links to relevant app sections.
- Added a Supabase Realtime subscription to refresh the notification list when the signed-in user's rows change.
- Added `supabase/migrations/20261017_NOTIFICATION_EVENTS.sql` to create server-side notification events for:
  - incoming direct messages
  - new connection requests and accepted/declined connection requests
  - new campaign applications and accepted/declined applications
  - creator/business verification submissions and status changes, including admin alerts for new pending requests

## Required database rollout

1. Back up the production Supabase database.
2. Confirm `20261016_PROFILE_PREFERENCES_NOTIFICATIONS_FOUNDATION.sql` has already been applied successfully. If it has not, review/apply it first, after the creator/business base tables exist.
3. Apply `20261017_NOTIFICATION_EVENTS.sql` only after messaging, `b2b_connections`, campaign applications, verification claim tables, and `admin_users` have been created by the applicable migrations. The verification triggers are added only if those optional verification tables exist at migration time; if they are created later, rerun the relevant trigger block after reviewing the schema.
4. Deploy this frontend bundle.
5. Test with two real users: send a message, request/accept a connection, submit an application and change its status, and submit/review a verification request. Confirm only the correct recipients receive notifications.

## Not yet implemented / not certified

- Profile-completion reminders are not automatic yet.
- Campaign-match alerts are not automatic; a reliable matching policy and event source must be defined before sending them.
- Email notifications are not implemented by these changes; email delivery requires a separate server-side mailer/template and provider configuration.
- Notification functionality has not been verified against the live Supabase project. No production database was changed by this workspace.
- A production `npm run build` could not be verified in this environment because dependency installation did not complete. Do not deploy without a successful local/CI build.

The migration must not be treated as applied just because the file is present in the ZIP.
