# Launch plan (written 2026-10-18, target soft launch 2026-10-31)

Status of each item lives in `TASKMANAGEMENT.md`. This file explains the *why*
and the order. Every item has a test or a checklist; nothing is "done" without
one.

## Where we really are (verified 2026-10-18)

- Live on `luxcatalog.vercel.app`: Phase A (checkout, enquiries, security
  headers) and Phase B (WhatsApp as fallback, sale/rent/lease views).
- Built, passing its own tests, **not yet committed or deployed**: the approval
  gate (`listing-policy-unit` 32/32, `listing-approval-e2e` 64/64), Discover v2
  engine, services page without "Private", menu/overlay scroll lock.
- Built, **not yet passing**: Discover v2 browser and API suites (first runs
  mostly failed; not diagnosed), `polish-ui`.
- Found today: the production build would have failed had the moved test files
  been pushed (fixed: `qa/` excluded from the app type-check).
- Only **4 live listings** on the site. An empty-looking marketplace is the
  biggest launch risk, bigger than any bug (see Supply below).

## Order of work

**Phase 0, stabilise (Oct 18-19).** Full regression green, one suite at a time;
fix what it finds; commit in small steps; deploy; smoke-test production.
No new features until this is done.

**Phase 1, quick wins that cost little and matter a lot (Oct 19-22).**
Approval gate live (T-001), team and partner portals named and separate
(T-002), SEO foundations (T-011), price display system (T-012), live data
fixes (T-007, typos in live listings), security pass A (T-013).

**Phase 2, make it feel like Lux Catalog (Oct 22-26).** UI refinement pass
(T-014): a design direction agreed first, then applied page by page, each page
checked on a phone and a desktop.

**Phase 3, go-live readiness (Oct 26-30).** Domain bought and connected
(T-005), email on the new domain, Search Console and Bing, final regression,
security suite (T-015), backups restore drill, Founder items (T-009, T-010).

**Soft launch (Oct 31).** Invite partners and a first circle of clients.
Monitor daily. Then the Lux concierge (T-006) in phases.

If a Phase 1 or 2 item slips, it moves behind Phase 3. Phase 3 does not move.

## SEO (T-011): what is true today

Checked on the live site (2026-10-18):

- A web search for "Lux Catalog" with the site address **found nothing of ours**:
  the site is not showing up for its own name. It may be unindexed or ranking
  below similar names (for example Lux Afrique Boutique).
- Present: title, description, Open Graph text, `robots.txt`, `sitemap.xml`
  (20 addresses including live listings), `lang="en"`.
- **Missing:** canonical links, `metadataBase`, an image for social previews
  (no `og:image`, so a shared link has no picture), structured data
  (JSON-LD: Organization, WebSite, listings, breadcrumbs), a web manifest and
  app icons, any Nigeria or Lagos wording on the home page ("luxury homes in
  Lagos", "shortlets in Ikoyi"), Search Console verification, Bing verification.
- The address `luxcatalog.vercel.app` is a shared subdomain. It can be indexed,
  but a brand needs its own domain (T-005).

**No one can promise ranking.** What we can do is make the site easy to find
and impossible to confuse:

1. Own domain, one canonical address, redirect the old one.
2. Submit to Google Search Console and Bing Webmaster Tools; submit the sitemap.
3. Structured data on every page type; a proper social image per page.
4. Brand and local keywords in titles, headings and copy (not stuffed):
   "Lux Catalog | Luxury homes, shortlets, supercars and yachts in Lagos".
5. A Google Business Profile (service-area business) and consistent profiles
   (Instagram, LinkedIn, X) all using the same name and link; these are what
   search engines use to recognise a brand.
6. Fast pages (Core Web Vitals) and real photographs (alt text that describes).
7. A few real backlinks: partner pages, press, directories.

Acceptance test: `seo-e2e` checks every public page type for title, description,
canonical, Open Graph and Twitter image, JSON-LD that parses, one `h1`, no
`noindex`, and the sitemap listing only live pages.

## Price display (T-012): the question "1,000,000 or one million or 1M?"

What the research supports, and what it does not:

- **Supports:** in the Cornell restaurant study, bare numerals beat prices with a
  currency symbol or written-out words (about +8% spend); spelled-out words did
  *not* beat "$20.00". The explanation offered is "pain of paying": repeated
  cues about money make spending feel costly. (One café, one season: suggestive,
  not proof for luxury.)
- **Supports (weaker, a marketing source):** commas and decimals make a price
  feel bigger; luxury brands avoid ".99" endings.
- **Does not support** spelling prices out in words as a luxury signal.
- **Not found:** how Sotheby's, Knight Frank, Christie's or yacht brokers format
  prices, and how Lagos portals format them. I will not claim it.
- **Real luxury practice that is documented:** "price on request" is used for
  trophy properties, so serious buyers enquire (sellers who let buyers open the
  bidding use it as a negotiating position).
- **Local fact:** a pricing guide for Nigeria advises quoting naira and dollars
  together because local buyers think in naira and diaspora buyers in dollars.

**Recommendation (to be confirmed with five real clients before launch):**

- Show the **full figure with grouping**, no decimals, no ".00":
  `₦1,000,000`. Not "one million naira", not "1M" (shorthand reads as a
  classified ad; written words are slower to scan and carry no luxury benefit).
- Set the **₦ symbol small and light** so the amount carries the weight. This
  keeps clarity for diaspora readers and honours the "less money cue" finding.
- Unit as a quiet small-caps line: `PER NIGHT`, `PER YEAR`, `PER SESSION`.
- Keep the **dollar guide** (`≈ $625`) on detail pages; it is already built.
- Amounts of a billion or more: full figure on detail pages; on cards
  `₦2.5 billion` (ten digits are easy to misread). Test with users.
- Very high or unique items (jets, trophy homes): **Price on request**, with
  the Lux concierge or an enquiry as the route.
- One formatter (`formatPrice`) for the whole site, with a unit test, so no
  page invents its own format.

Acceptance test: `pricing-unit` (every amount from ₦0 to ₦10B in every context
and currency renders as specified) plus a browser check that cards, detail
pages, cart, emails and the admin all agree.

## Security (T-013, T-015): what "safe for high-ticket clients" needs

Done: admin approval gate; staff need 2FA; role read from the database every
request; rate limits on staff writes; audit trail of listing changes; security
headers; human check on public forms; private ID documents; signed webhooks.

Found today: `npm audit` reports **16 issues in production dependencies (1
critical, 10 high)**, mostly in libraries that can be upgraded
(`npm audit fix`). Content-Security-Policy only sets `frame-ancestors`.

To do, in order of value:

1. Upgrade vulnerable dependencies; re-run everything (T-013a).
2. **Step-up check for sensitive admin actions** (approve payout, change a
   role, delete a live listing): ask for the 2FA code again (T-013b).
3. **Alerts to the Founder** for sensitive events: new admin, role change,
   payout approval, sign-in from a new device (T-013c).
4. Content-Security-Policy in report-only mode first, then enforce (T-013d).
5. A security test suite, `security-e2e`: guest A cannot read guest B's
   booking, enquiry, document or order (IDOR); a team member cannot reach
   another area by changing the URL or the method; mass-assignment (extra
   fields in a body); open redirects on sign-in; script injection in listing
   text and enquiries; image-URL abuse; webhook replay; rate limits (T-015).
6. Backups: confirm the database's point-in-time restore works by doing one
   restore drill (Founder + Claude Code).
7. `/.well-known/security.txt` and a contact for responsible disclosure.
8. Error monitoring with alerts (Sentry or similar) and uptime checks.

## UI: "it looks vibe-coded" (T-014)

Honest diagnosis of what readers call vibe-coded: the same gold-on-black card
treatment everywhere, generic sparkle icons and "AI" cues, stock photography,
uniform spacing and rounded boxes, copy that sounds like a template, every
section animated the same way, and empty states that look unfinished.

Approach:

1. **Direction first** (no code): a one-page design direction for Lux Catalog:
   what it should feel like (a private members' house, not a marketplace),
   typography (one serif and one sans, used with restraint), a smaller palette,
   photography rules, how prices and badges look, how motion behaves.
2. Apply it with the design skills available here (the UI/UX skill; Figma
   skills need the Figma connection authorised).
3. Page by page, in this order: home, a category page, a listing page, Discover,
   booking flow, account. Each: before/after on phone and desktop, then the
   regression suites for that area.
4. Real photographs and real copy replace placeholders before launch.

## Supply and demand: the real launch risk

Four live listings is not a marketplace. Before launch:

- Target at least **10 live listings in each of three categories** (shortlets,
  car hire, private services) rather than thin coverage everywhere.
- Concierge-assisted listing: the team lists on a partner's behalf (the gate
  keeps it safe: the admin approves).
- Use the TE-OS Prospector for partner recruitment (human-approved messages
  only), and log every request we cannot fill as demand (Lux, later).
- December homecoming: a waiting list with dates ("tell me when it opens").

## Other things this build needs (not on your list)

- **Trust pages:** About with real names and faces, how vetting works, how
  payments and refunds work, a plain "How booking works" page.
- **Legal:** Terms and Privacy checked by a lawyer against the Nigeria Data
  Protection Act; cookie notice; refund and cancellation wording matching the
  booking engine (T-009).
- **Analytics:** privacy-friendly traffic and funnel measurement (visit, view,
  enquiry, booking) and Search Console. Without it we cannot learn.
- **Support:** one monitored inbox, a reply promise, a handover rule when the
  team is offline.
- **Payments live:** Paystack live needs the registered business; until then,
  launch bookings as "request to book" with payment on confirmation.
- **Accessibility and speed:** gold-on-dark contrast checked to WCAG AA; images
  sized; Lighthouse targets for phone.
- **Email reputation:** SPF, DKIM and DMARC on the new domain before any email
  goes out.
- **Operations runbook:** what the Founder and team do when a payment fails, a
  booking is disputed, a listing is reported, or the site is down.
- **Reviews and verified badges** after the first completed bookings.
