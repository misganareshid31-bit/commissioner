# Commissioner email configuration

The frontend now uses these exact subject lines in its check-email guidance:

- Account confirmation: `Confirm your Commissioner account`
- Password reset: `Reset your Commissioner password`

These titles are displayed by the app, but the actual subject sent by Supabase is controlled by
**Supabase Dashboard → Authentication → Email Templates**.

Set the Confirmation and Recovery template subjects to the exact titles above.

## Fast delivery

The frontend cannot make Supabase's email infrastructure deliver faster. For production, configure
a real SMTP provider in **Authentication → SMTP Settings** (for example Resend, Postmark, or SendGrid)
and verify your sending domain.

Also make sure the site URL and redirect URL are configured:

- Site URL: your deployed Commissioner URL
- Redirect URL for confirmation: your deployed Commissioner URL
- Redirect URL for recovery: your deployed Commissioner URL + `/reset-password`

## Current frontend behavior

- Confirmation, resend, and password-reset emails share a 60-second UI cooldown.
- A normal wrong-password login does **not** impose a one-minute wait.
- A real Supabase rate-limit response starts the one-minute cooldown.
- An unconfirmed creator or business login automatically requests a fresh confirmation email.
- The check-email screen clearly says whether the email is confirmation or password reset.
