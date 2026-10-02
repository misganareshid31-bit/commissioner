# Commissioner password reset setup

The frontend now uses Supabase `resetPasswordForEmail()` and sends users back to:

`https://YOUR-COMMISSIONER-DOMAIN/reset-password`

## Required Supabase settings

In Supabase Dashboard:

1. Go to **Authentication → URL Configuration**.
2. Set **Site URL** to your production Commissioner URL, for example:
   `https://your-domain.com`
3. Add this exact redirect URL:
   `https://your-domain.com/reset-password`
4. For local testing also add:
   `http://localhost:5173/reset-password`
5. Go to **Authentication → SMTP Settings** and configure a custom SMTP provider for production email delivery. The built-in/default email sender is intended for testing and is rate-limited.
6. Test with an email address that already has a Commissioner account.

## Expected flow

Forgot password → enter email → Supabase sends reset email → user clicks link → Commissioner opens `/reset-password` → user enters a new password → Supabase updates the password → user returns to Commissioner.

## If the email still does not arrive

Check Supabase **Authentication → Logs** for the reset request and email delivery result. Also check the recipient's Spam/Junk folder and verify that the SMTP provider is configured and allowed to send from the configured sender address.
