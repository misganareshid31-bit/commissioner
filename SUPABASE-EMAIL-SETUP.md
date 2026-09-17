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

## Changing the sender/"from" address

The sender address on confirmation, reset, and other auth emails is controlled entirely by
Supabase — there is nothing in this codebase to change. To send as `commissioner@gmail.com`:

1. Supabase Dashboard → **Authentication → Emails → SMTP Settings**.
2. Turn on **Enable Custom SMTP**.
3. Set **Sender email** to `commissioner@gmail.com` and **Sender name** to `Commissioner`.
4. Fill in the SMTP host/port/username/password for whichever account actually sends the mail:
   - Using Gmail itself as the relay: host `smtp.gmail.com`, port `587`, username
     `commissioner@gmail.com`, and a 16-character **App Password** for that account
     (Google Account → Security → 2-Step Verification → App passwords — a normal Gmail
     password will not work here). Gmail's relay is rate-limited (roughly 500 sends/day)
     and is fine for low volume but not a production-scale sender.
   - Using a transactional provider (Resend, Postmark, SendGrid, etc.) with
     `commissioner@gmail.com` as the "from" address: most providers require you to verify a
     *domain* you control to send as it, and a bare `@gmail.com` sender frequently gets
     flagged as spoofed/fails SPF-DKIM checks since Google doesn't let you verify that
     domain elsewhere. If deliverability matters, a domain you own (e.g. `mail@commissioner.com.et`)
     will work far more reliably than a Gmail address.
5. Save, then send a test confirmation/reset email to confirm the new sender shows correctly.

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
