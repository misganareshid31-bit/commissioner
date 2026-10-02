# Verification setup — final behavior

- Creator and Business setup now submit a verification request automatically after the profile is successfully saved.
- The dashboard completion percentage is calculated from the actual saved profile data and waits for the profile query before showing the number.
- Admin → Verification requests shows Creator and Business requests together, with pending requests first.
- Each request has Verify, Approve, Reject, and Delete controls.
- Verify marks the requested verification facts as verified and sets the profile's `verified` flag.
- Approve controls profile approval/visibility separately from verification.
- Reject changes the verification request to `rejected`.
- Delete permanently removes the associated profile through the protected admin RPC.

Run the existing verification/trust SQL migrations in Supabase before testing the automatic verification request flow, especially `COMMISSIONER-TRUST-MARKETPLACE-B2B.sql` and the latest `ADMIN-ROLE-MIGRATION.sql`.
