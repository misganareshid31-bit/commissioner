# Commissioner V1 targeted improvements — October 13, 2026

This patch intentionally preserves the existing brand palette, visual effects, and core product purpose. It focuses on workflow and navigation behavior.

## Changes in this source patch

- Removed the client-side Marketplace launch-threshold screen so the Marketplace is available during V1.
- Changed launch statistics to informational only (`unlocked: true`) and removed the obsolete administrator threshold editor from Overview.
- Opened the B2B network and messaging entry points in the client for signed-in accounts rather than gating them on creator/business counts.
- Added a “Message on Commissioner” action to public NFC creator and business pages. Visitors must sign in before a conversation is started; the app uses the existing `start_conversation` RPC and existing in-app message event.
- Renamed the NFC page's misleading “Go to Website” button to “View Commissioner Profile”. The destination remains the recipient's actual Commissioner profile.
- Renamed the business profile's external-site button to “Visit Website” to distinguish it from the Commissioner profile link.
- Hid the business verification details panel on the NFC business card view, while keeping verification details available on the regular business profile.
- Made creator social buttons generate a platform destination when the stored value is a handle rather than a full URL.
- Fixed a dark-on-dark inline button text color where that exact style was present.

## Important deployment notes

- This is a source-level patch only. It does not modify the production Supabase database or deploy to Vercel.
- The admin verification/delete controls already call secure admin RPCs. Their actual operation depends on the matching SQL migrations and database permissions being installed in Supabase.
- Frontend gate removal does not override any independent server-side/database policy that might still enforce old thresholds. Test B2B connection inserts and conversation creation against the live database after deployment.
- I could not complete `npm run build` in this environment because dependency installation (`npm ci`) stalled and Vite was unavailable. Therefore the build is **not verified**; run `npm ci` and `npm run build` locally or in CI before deploying.
- The pricing page still contains legacy paid-plan copy and is intentionally left unchanged in this patch to avoid changing visible descriptions without a separate content decision. It should be reviewed before V1 is announced as fully free.
- No physical NTAG215 card or live production profile was available for end-to-end NFC testing.
