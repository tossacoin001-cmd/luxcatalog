# Domain: buying it and moving the site

Current address: `https://luxcatalog.vercel.app` (Vercel).

`luxcatalog.com`, `luxurycatalog.com` and `luxcatalogue.com` are taken. Checked
available on 2026-10-13 (a point-in-time check, not a hold; first-year prices):
`luxcatalog.co` $24, `theluxcatalog.com` $16, `luxcatalog.africa` $19,
`luxcatalog.net` $19, `getluxcatalog.com` $16. `luxcatalog.ng` was not
checked (Nigerian .ng names are sold through Nigerian registrars).

## Where to buy

Recommended: **Cloudflare Registrar** for `.co`, `.com` or `.net`. It charges the
wholesale price with no markup on registration or renewal, includes privacy and
strong DNS. Confirm on their site that your exact extension is supported before
choosing the name (`.africa` was not confirmed). Fallback: **Namecheap**.
**Vercel Domains** is the easiest to connect but is usually dearer; buying
elsewhere and pointing the domain at Vercel is normal and costs nothing extra.

Buy it under the Founder's own account and email (not an agent's), turn on
auto-renew, and use two-step sign-in on the registrar account.

## Moving the site (after the Founder buys)

1. Vercel project > Settings > Domains > add the domain (and `www`); copy the
   DNS records Vercel shows into the registrar's DNS.
2. Set `NEXT_PUBLIC_APP_URL` and `BETTER_AUTH_URL` in Vercel to the new address
   and redeploy.
3. Cloudflare Turnstile: add the new hostname to the widget.
4. Brevo (email): verify the new domain for sending (SPF, DKIM, DMARC records).
   Keep "block unknown IPs" OFF.
5. Paystack: update the webhook URL to the new address (test mode).
6. Redirect `luxcatalog.vercel.app` to the new domain; update the sitemap,
   canonical links and social images.
7. Run `bash qa/run.sh phase-a-e2e` against the local build, then smoke-test the
   live site: sign in, enquiry, a booking up to the Paystack page.
