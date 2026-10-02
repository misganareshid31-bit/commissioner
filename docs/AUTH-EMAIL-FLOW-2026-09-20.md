# Commissioner Auth Email Flow — 2026-09-20

## Stable callback URL
Commissioner now sends Supabase confirmation and password-reset emails to:

`https://commissioner-dusky.vercel.app/auth/callback`

The app also builds this from `window.location.origin`, so the same code works on the production custom domain.

## Supabase URL Configuration
Add these exact redirect URLs:

- `https://commissioner-dusky.vercel.app/auth/callback`
- `https://commissioner.com.et/auth/callback`

If the custom domain is not yet active, the Vercel URL is enough for testing. A wildcard may also be used, but exact callback URLs are preferred for auth redirects.

## Resend behavior
- The first signup/reset email is sent once by the normal Supabase operation.
- Commissioner does not automatically send another email when sign-in reports an unconfirmed email.
- Resend is manual, like a modern conversational-product email flow.
- A 60-second client timer starts only after a resend succeeds.
- Double-clicks are blocked while an email request is in progress.
- A failed resend does not start the successful-send timer, except when Supabase itself reports a rate limit; the server-side Supabase limit remains authoritative.

## Password reset callback
Password-reset links return to `/auth/callback`. Commissioner detects Supabase's `type=recovery` URL hash and opens the Set a new password screen. After the password is updated, the recovery URL is removed from the address bar.
