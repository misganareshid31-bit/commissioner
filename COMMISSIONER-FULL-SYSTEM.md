# Commissioner — Full System V2

This build extends the previous `commissioner-professional-v1` project into the product direction agreed in the conversation.

## Product model

**Identity → Verification → Discovery → Marketplace → B2B communication**

Commissioner does **not** process marketplace payments, hold money, provide escrow, or operate a wallet.

## Included

### Identity
- Creator and business accounts
- Public permanent profile URLs
- Profile claiming and NFC flow from the previous build
- QR/NFC-ready identity pages
- Mobile-first public profiles

### Creator marketplace
- Creator discovery
- Niche/location filtering from the existing creator directory
- Creator products and services
- Business inquiry flow
- Creator statistics shown separately from verification

### Business marketplace
- Business discovery
- Business categories
- Business profile setup/editing
- Products, merchandise, services and collaboration listings
- External website/order links

### B2B network
- Business and creator discovery
- Connection requests
- Professional connection message
- Existing Commissioner messaging remains the conversation layer

### Verification
Verification is claim-based rather than a blanket “safe” score.

Creators can request review for:
- Identity
- Account ownership
- Followers
- Engagement

Businesses can request review for:
- Registration
- License
- Authorized representative

The admin queue lets the administrator verify individual claims. A public profile only exposes safe verification states and the last checked date; private evidence and admin notes are not exposed.

### Trust & safety
- Verification details
- Clear distinction between verified facts and unverified claims
- Profile reporting schema
- Admin review queue
- Verification expiry/recheck fields

## Database setup

Run these files in Supabase SQL Editor in this order:

1. `supabase-schema.sql`
2. `NFC-ADMIN-FIX.sql` (if your current deployment uses that migration)
3. `PROFESSIONAL-V1-MIGRATION.sql`
4. `COMMISSIONER-TRUST-MARKETPLACE-B2B.sql`

Do not put a Supabase service-role key in the frontend environment.

## Important verification limitation

The current UI provides the **verification workflow and data model**. Automatic follower/engagement verification requires authorized platform APIs for each supported social network. Do not use scraping as the security foundation. Until a platform API is connected, those metrics should remain clearly marked as not verified.

## Deployment

From the project directory:

```bash
npm install
npm run build
npm run dev
```

Then deploy the resulting Vite app to Vercel using the existing Supabase environment variables.

## No payment architecture

There is deliberately no:
- Commissioner wallet
- Escrow
- Payment processor
- Stored card/payment credential system
- Marketplace payment settlement

Users can use the marketplace to discover and contact each other and then handle commercial arrangements outside Commissioner.
