# Commissioner NFC account setup — 2026-10-08

## User flow
1. Sign in and open Account Settings.
2. Choose the active Creator or Business profile.
3. Finish the profile if it is incomplete.
4. In **NFC card setup**, copy the permanent official profile URL or open the profile website.
5. Write the URL to an NFC tag using a compatible NFC writer, then test by tapping the card.
6. Use **NFC public information** to choose which public fields appear on the NFC profile.

## Access and privacy
- NFC setup is available to every signed-in Creator or Business account; it is not an admin-only feature.
- Admin approval is not required to copy or use the public profile URL.
- The NFC tag stores only the public profile URL. Do not write login credentials, private contact data, or account tokens to the tag.
- On iPhone/Safari, use a compatible external NFC writer or an NFC-capable Android phone to write NTAG215 tags.

## Important deployment note
The new account panel uses the existing `/creator/:id` and `/business/:id` official profile routes and the existing profile tables. Apply the project's existing Supabase migrations as required by the deployment. This UI change does not grant admin privileges or change database access policies.
