# Lux Catalog: task management

One place for what is being done, by whom, and how we know it is finished.
Read `AGENTS.md` first (this is not the Next.js you know), then this file,
then `docs/AGENT-WORKFLOW.md` before you touch anything.

**People and agents:** the **Founder** decides and runs production SQL and
payments. **Claude Code** builds and designs. **Cline** audits, checks and
makes small, tested fixes. Anyone may add a task; only the Founder moves a
task to *approved*.

## Rules that never bend

1. **Plan, then tests, then build.** A task is not started until it has a
   written goal and an acceptance test. The test is written and seen failing
   before the fix.
2. **Verify before you fix.** Reproduce the problem and say how. A report from
   another agent is a lead, not a fact (see T-001: half of one report was
   wrong).
3. **Own branch, small commits.** `cline/<task-id>-<short-name>` or
   `claude/<task-id>-<short-name>`. Never push to `main`. Never force-push.
4. **Production is read-only for agents.** Production SQL is run by the
   Founder in the Neon editor. Paystack stays in test mode. Secrets live in
   gitignored `.env*.local` files and are never printed or sent anywhere.
5. **Money and outbound messages need a human.** Refunds, payouts, live
   payments, and any message to people we have not met.
6. **Every claim has evidence.** Quote the file and line, the command and its
   output, or the test name. If a tool failed, say so; do not guess.
7. **Update this file in the same change.** Status, branch, evidence.

## Board

Status: `idea` → `approved` → `in progress` → `in review` → `done`
(or `blocked: <who>`)

| ID | Task | Owner | Status | Test (acceptance) |
|----|------|-------|--------|-------------------|
| T-001 | Approval gate: nothing goes live without an admin (partner, team, and any edit); an edit changes only what it sends | Claude Code | **built, tests pass (64/64 e2e, 32/32 unit); awaiting full regression, commit, deploy** | `listing-policy-unit`, `listing-approval-e2e` |
| T-002 | Team portal and team profile; role-correct names (menu link, page titles) | Claude Code | built (team profile page, "Team Desk" / "Partner Dashboard" labels); browser check still to add | `listing-approval-e2e` section 10, `portal-ui` (to write) |
| T-003 | Finish Discover v2 (own rules engine, per-kind questions and budgets) | Claude Code | in progress, uncommitted | `discover-unit`, `discover-e2e`, `discover-ui` |
| T-004 | Services page without the word "Private"; menu and overlays hold the page still | Claude Code | in progress, uncommitted | `polish-ui` |
| T-005 | Buy the domain and move the site to it | Founder + Claude Code | blocked: Founder buys | checklist in `docs/DOMAIN.md` |
| T-006 | "Lux" concierge, phase C0 (Brand Brain, model layer, conversation store) | Claude Code | idea, plan approved, tests not written | to be written first |
| T-007 | Re-categorise the live lease listing "Brand new three bedroom" (stored as for-sale) | Founder (admin page) | ready | n/a (data) |
| T-008 | Remove test accounts and the test enquiry from production | Founder (SQL) | ready | n/a (data) |
| T-009 | Lawyer review of the partner agreements (incl. Schedule H) | Founder | blocked: Founder | n/a |
| T-010 | Switch Paystack to live keys; register the business for transfers | Founder | blocked: Founder | live keys are never used by the suites |
| T-011 | SEO foundations: canonical, `metadataBase`, social image, JSON-LD, local keywords, manifest, Search Console and Bing | Claude Code | approved by Founder's request; tests first | `seo-e2e` (to write first) |
| T-012 | One price formatter: full figures, light ₦, unit line, "price on request" for trophy items | Claude Code | plan written (`docs/LAUNCH-PLAN.md`); confirm with 5 real clients | `pricing-unit`, browser check |
| T-013 | Security pass A: dependency fixes (1 critical, 10 high found), step-up 2FA for sensitive actions, Founder alerts, CSP report-only, security.txt, monitoring | Claude Code | plan written; tests first | `security-e2e` (T-015) |
| T-014 | UI refinement ("vibe-coded"): design direction, then page by page | Claude Code + Founder review | direction document first | before/after on phone and desktop; area suites |
| T-015 | `security-e2e`: IDOR, area access, mass assignment, redirects, script injection, webhook replay | Claude Code (Cline runs and reports) | tests to write | itself |
| T-016 | Supply: 10 live listings in each of three launch categories; concierge-assisted listing | Founder + Claude Code | idea | count on the live site |
| T-017 | Fix the live data: typo "Masionette" in a live listing slug and title, lease stored as sale (T-007) | Founder (admin page) | ready | n/a (data) |
| T-018 | Cline: run `qa/run.sh --all` on its own clone and report counts; first fix its broken diff | Cline | **blocked: its diff has a syntax error (`'admin;`); repair on a branch** | its report matches `qa/out/` |

## Task template

```
### T-0xx  Title
Goal (one sentence, in the customer's or admin's words):
Why it matters:
How to reproduce today:
Acceptance test (suite and the checks that must pass):
Out of scope:
Owner / branch / PR:
Evidence (files, lines, command output):
Decisions needed (link to docs/DECISIONS.md):
```

## Lanes

**Claude Code:** designs, new features, anything touching auth, payments,
bookings or the database schema, migrations (additive and re-runnable SQL in
`prisma/sql/`), the concierge.

**Cline:** read-only audits and reports; reproducing bugs; small fixes where a
failing test already exists; docs; running the suites and reporting results.
Cline does not edit `prisma/schema.prisma`, `src/lib/auth.ts`,
`src/lib/admin-auth.ts`, payment or webhook code, or anything in `prisma/sql/`
without a task that names it and the Founder's approval.

## Definition of done

- The acceptance test passes, one suite at a time (`bash qa/run.sh <suite>`).
- The neighbouring suites still pass (`docs/QA.md` lists which).
- `npx tsc --noEmit` and `npx eslint src` are clean.
- Phone (390px) and desktop checked in a browser for anything visible.
- This file and `docs/DECISIONS.md` updated, with a summary for the Founder in
  plain words (what changed for a customer, partner or admin).

---

## Task notes

### T-001  Listing approval (verified 2026-10-17)

**Reproduced from the code, not from a report:**

- `src/app/api/admin/listings/route.ts` lines 15 and 97: `isVendor` is true only
  for partners, so a **team member with the Listings area** gets
  `published: true` on create, can also set `featured`, hire terms and `status`,
  and goes live with no admin review.
- `src/app/api/admin/listings/[id]/route.ts` lines 69-77: for anyone who is not
  a partner the request can publish or unpublish, and
  `src/app/admin/listings/page.tsx` passes `canPublish={!isVendor}`, so team
  members see the Publish button.
- **It is by design today:** `src/lib/access.ts` describes Listings as "Add,
  edit and publish any listing", and the schema comment only promises approval
  for **partners**. So this is a policy decision (D1), not an accident.
- **A second bug the report missed (real data loss):** the PATCH handler writes
  `featured: !!featured` and the hire fields whenever the caller is not a
  partner. The Publish button sends only `{ published: true }`, so **publishing
  a listing silently un-features it and wipes its hire terms**. The same
  happens on any title-only edit by an admin. (D4.)

**Cline's proposed diff, reviewed:** changing create to
`published: staff.role === 'admin'` is right under D1. The PATCH change is not
enough and has side effects: it would take a live listing offline on every team
edit, silently ignore feature and hire changes, leave the Publish button on
screen doing nothing, and not fix the data-loss bug. The test says what we want.

### T-002  Portal wording (verified 2026-10-17)

- Not a security fault: `src/lib/admin-auth.ts` reads role and permissions from
  the database on every request, and the team access sweep (`team-e2e`, 54
  checks) shows a team member cannot open pages or APIs outside their areas.
- Cline's "2FA turns the denial into a wrong redirect" is **incorrect**:
  `requirePage` sends a staff member without 2FA to `/account?setup=2fa`
  before it checks areas.
- Cline's "the client session role is trusted" is **incorrect**: the session
  has no cookie cache (`src/lib/auth.ts`), and the menu only decides whether to
  show a link; the server re-checks.
- What is real: `src/components/UserMenu.tsx` line 74 labels the staff link
  **"Admin Panel" for team members and partners too**, and
  `src/app/admin/page.tsx` sets the browser title to "Admin" for everyone. That
  is what a team member reads as "I am in the admin portal". The fix is wording
  (D5).
- **Founder: please tell us exactly what you saw** (which page, what text) so we
  fix what you actually met, not only what the code suggests.
