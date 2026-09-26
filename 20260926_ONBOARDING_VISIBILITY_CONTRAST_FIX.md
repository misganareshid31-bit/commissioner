# Commissioner — Complete Onboarding + Public Visibility + Contrast Fix

## Onboarding persistence
- Creator onboarding now stores the current step and entered draft locally per authenticated user.
- Returning to unfinished Creator setup restores the last step and saved draft fields.
- Business onboarding has the same behavior, with a separate per-user draft.
- Drafts are cleared only after successful Finish setup.
- Creator/Business drafts do not overwrite each other.

## Public visibility
- Completed profiles are public when `auth_user_id` is present and `onboarded = true`.
- `approved` is not used as the public-discovery gate in Explore, B2B discovery, or public profile event tracking.
- Verification remains a separate process.
- Existing public RLS migration remains `20260924_PUBLIC_PROFILE_VISIBILITY_FIX.sql`.

## Text contrast
- Replaced white text used on light navigation, controls, progress labels, and light surfaces with readable Commissioner ink.
- White text remains on intentionally colored/dark action surfaces.
- No background redesign was introduced.

## Validation
- Source-level checks were performed for remaining public `approved` filters and obvious white-on-white combinations.
- Production build could not be run in this container because the ZIP has no installed Vite binary (`vite: not found`).
