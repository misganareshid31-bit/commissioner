# Getting commissioner.com.et found on Google

Code changes alone won't make a brand-new site show up in search — Google has to
discover, crawl, and index it first, which normally takes days to a few weeks even
after everything below is done. What changed in this update, plus what you still
need to do yourself:

## What was fixed in the code (this update)
- `index.html` had no `<meta name="description">`, no Open Graph tags, and a bare
  `<title>Commissioner</title>` — search engines had almost nothing to show or match
  against a query. Added a real title, description, Open Graph/Twitter tags, and basic
  Organization structured data.
- `sitemap.xml` still pointed at the old `commissioner-dusky.vercel.app` Vercel URL
  instead of your live domain, and listed `/creators` and `/businesses` as if they were
  separate crawlable pages — they aren't; the app is a single-page app and those
  in-app views load under `/` without changing the URL, so a crawler visiting the old
  `/creators` URL just saw the homepage again. Sitemap now correctly lists only
  `https://commissioner.com.et/`.
- `robots.txt` now points crawlers at the sitemap.

## What only you can do (requires your Google account / DNS access)
1. **Google Search Console** — verify `commissioner.com.et` at
   https://search.google.com/search-console (DNS TXT record or HTML file, your choice).
   Until the domain is verified here, Google has no reason to prioritize crawling it.
2. **Submit the sitemap** — inside Search Console, Sitemaps → submit
   `https://commissioner.com.et/sitemap.xml`.
3. **Request indexing** — use the URL Inspection tool on the homepage and click
   "Request indexing" to speed up the first crawl.
4. **Build a couple of backlinks** — a link from anywhere else real (your own social
   profiles, a partner site, a directory listing) helps Google find and trust a new
   domain faster than the sitemap alone.
5. **Give it time** — a brand-new domain with no history commonly takes 1–4 weeks to
   appear for its own name, longer for competitive terms like "influencer marketplace."

## One thing worth knowing about this app specifically
Because navigation between Home / Find Creators / Find Businesses / etc. is handled
in JavaScript state rather than real distinct URLs, Google will only ever be able to
index the single homepage URL — not separate pages for creators, businesses, or
individual profiles like `/creator/<id>` unless a visitor lands there directly. If you
want individual creator/business pages (which already have distinct URLs) to be
discoverable in search too, they'd need to be added to the sitemap and that's a larger
change — say the word if you want that built out.
