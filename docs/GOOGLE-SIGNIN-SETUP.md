# Commissioner — Google Sign-In Setup

The Commissioner frontend uses Supabase Auth for Google OAuth. The button is implemented in `src/components/Auth.jsx` and returns users to the current site's root URL.

## 1. Enable Google in Supabase

Supabase Dashboard → Authentication → Providers → Google → Enable.

Create a Google OAuth **Web application** client in Google Cloud / Google Auth Platform.

## 2. Google OAuth redirect URI

In Google Cloud, copy the **Callback URL shown by the Supabase Google provider page** and add it under:

Google Cloud → APIs & Services / Google Auth Platform → Credentials → OAuth client → Authorized redirect URIs

Do not invent a callback URL; use the one Supabase shows for your project.

Also configure the application's authorized JavaScript origin as the actual Commissioner site origin, for example:

`https://your-domain.com`

For local development, also add the exact local origin, such as:

`http://localhost:5173`

## 3. Supabase URL configuration

Supabase Dashboard → Authentication → URL Configuration:

- **Site URL:** your production Commissioner URL, e.g. `https://your-domain.com/`
- **Redirect URLs:** add the exact production root URL, e.g. `https://your-domain.com/`
- For local development add the exact Vite URL, e.g. `http://localhost:5173/`

The frontend sends `redirectTo = window.location.origin + '/'`, so the URL must be allowed by Supabase.

## 4. Test

1. Open Commissioner.
2. Click **Sign in with Google**.
3. Choose a Google account.
4. Google should redirect to Supabase and then back to Commissioner.
5. The session should appear automatically.

## If it still fails

The new UI will display a specific setup error instead of the old raw error. The most common causes are:

- Google provider is disabled in Supabase.
- Google Client ID/Secret are missing or incorrect.
- Google Authorized redirect URI does not exactly match Supabase's callback URL.
- Commissioner production URL is not in Supabase Redirect URLs.
- You are testing on a different hostname/port than the configured redirect URL.
