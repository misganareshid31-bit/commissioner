# NFC profile entry workflow fix — 2026-10-17

## What changed
- The signed-in NFC information settings page now loads the current role profile's `claim_token`.
- Added a clearly labelled **Enter or update your NFC information** section and an **Edit NFC profile details** action.
- The action opens the existing owner-only NFC profile editor inline from the account settings page, rather than requiring the user to discover the edit action by tapping the physical card first.
- The editor includes contact email and phone number inputs. They are private by default and appear on the public NFC card only when **Contact email and phone** is enabled.
- Added the contact visibility checkbox to the regular NFC visibility settings list.
- After saving, the settings page refreshes the profile name, banner, token, and saved visibility settings.

## Important
- This is a source-code ZIP update only. It has not been built successfully in this environment or deployed to Vercel.
- The editor depends on the existing Supabase migrations/functions `get_my_nfc_profile`, `update_my_nfc_profile`, and `update_my_nfc_display_settings`, plus the `profile_contact_private` table and avatar storage bucket. Those database objects must already be installed.
- If the account has no `claim_token`, the UI explains that the NFC profile must first be linked/claimed. This does not create or assign a physical NFC card.
