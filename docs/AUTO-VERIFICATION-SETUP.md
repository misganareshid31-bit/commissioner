# Automatic verification — setup (YouTube)

Threshold: 15,000 followers/subscribers (live setting `platform_settings.creator_follower_threshold`; admins can change it).

## How it works
1. Creator submits verification (platform YouTube, ownership = "Put a code in your bio", channel ID or @handle).
2. The app calls the `auto-verify` Edge Function with the creator's own session.
3. The function reads the channel's REAL subscriber count and description from the YouTube Data API.
4. The database verifies the creator only if: followers >= threshold, the `CMS-XXXXXX` code is in the channel description, the profile is 100% complete, and the channel is not verified for another profile.
5. Otherwise the request stays pending with a plain-language reason; an admin can still review it.

Other platforms (Instagram, TikTok, Facebook, X, Twitch, LinkedIn) stay in the admin queue: their follower counts and bios cannot be read without approved platform apps.

## Turn it on (3 steps)
1. Supabase → SQL Editor → run `20260930_AUTO_VERIFICATION.sql` (after the 20260929 file).
2. Create a YouTube Data API v3 key (Google Cloud Console → APIs & Services → Credentials), then:
   `supabase secrets set YOUTUBE_API_KEY=your_key`
3. Deploy the function: `supabase functions deploy auto-verify`

Until step 3 is done, the app shows "Automatic check is not available right now" and requests go to the admin queue as before. Nothing breaks.

## Notes
- YouTube rounds public subscriber counts to 3 significant figures, and channels can hide the count (a hidden count cannot be auto-verified).
- `service_auto_verify_creator` can only be called with the service role key, never from a browser.
