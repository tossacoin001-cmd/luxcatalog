# Decisions

Open ones need the Founder. Each has a recommended answer; the tests are
written to the recommended answer and change only when the decision changes.

## Open

**D1 (T-001) Who publishes a listing? DECIDED 2026-10-18: only an admin.**
Recommended: only an admin publishes, unpublishes, features or sets hire terms.
A team member with Listings creates drafts and edits text; a draft waits for an
admin. Alternatives: keep team members able to publish (today's behaviour), or
add a separate "Publish" permission an admin can grant to trusted team members
(no database change needed, permissions are stored as a list).

**D2 (T-001) A team member edits a live listing. DECIDED 2026-10-18.**
Anything a team member or partner changes goes back to an admin before
customers see it, and every change is recorded in the audit log. (The Founder:
"there must be a gate".) The cost: a typo fix by a team member takes the listing
offline until an admin approves.

**D3 (T-001) Deleting.**
Recommended: only an admin deletes a live listing; a team member may remove a
draft.

**D4 (T-001) An edit changes only what it sends.**
Recommended, and not really optional: it is a data-loss bug today (Publish
wipes featured and hire terms).

**D5 (T-002) Names.**
Recommended: admin "Admin Panel", team "Team Desk", partner "Partner
Dashboard"; browser titles to match.

**D6 Transcript retention for the Lux concierge (T-006).**
Recommended: keep 90 days with a notice and a delete option. In plain words:
when someone chats with Lux, we save the conversation so the team can see what
was asked and carry on without making the person repeat themselves. After 90
days it is erased, and the person can ask for it to be erased sooner.

## Decided

- 2026-10-13: the concierge is called **Lux** (no "concierge" label in the
  interface); the whole build must look unique and luxurious, not generic.
- 2026-10-13: Groq (primary) and Gemini (second) free tiers now, Claude later as
  supervisor. Free tiers are not private, so names, emails, phones and IDs are
  removed before text leaves our server (Founder: yes).
- 2026-10-13: the concierge confirms availability, or recommends similar
  available products; booking still needs a signed-in account.
- 2026-10-10 onward: Paystack test mode only until the Founder switches it;
  WhatsApp is a fallback, never the main call to action (Phase B).
- Earlier: own sign-in (better-auth), Clerk retired; production SQL run by the
  Founder; plan, then tests, then build.
