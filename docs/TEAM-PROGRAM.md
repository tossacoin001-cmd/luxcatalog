# Team programme: how a team member earns, and why they stay

Written 2026-10-22. Status: **plan, awaiting the Founder's answers (D7 to D12 below)**. Nothing in section 3 is built yet.
Sections 1 and 2 are research. Section 4 is what we say to anyone who asks "how do I make money here?".

## 1. What the brands we learn from actually do

| Brand | What the earner gets | What it teaches us |
|---|---|---|
| Airbnb host referral | **Cash**, paid by transfer within 30 days, only **after the referred host completes a real booking**. Capped at the first 25 referred hosts per type. Amount varies by place and listing type. Offers expire. | Pay on a **verified paid event**, not on sign-up. Cap and expire so the cost is known in advance. |
| Uber referral | Reward only after the referred driver completes a minimum number of trips, in **tiers** (each tier pays when reached). Cancelled trips do not count. 60-day window. | Tiered milestones; unfinished or cancelled work earns nothing; a time window. |
| Amazon Associates | A **percentage per category** (about 1 to 10%, most everyday categories 1 to 4%, luxury beauty 10%). Short attribution window (24 hours; 90 days once an item is in the cart). | Different goods can carry different rates. Attribution rules must be written down. |
| Booking.com partners | No cash to partners. **Visibility tiers** (badge, ranking) in exchange for extra commission. The partner funds the discount. | Status and visibility are a reward that costs the platform little. |
| eXp Realty | Agents earn a **share of the commissions** of agents they bring in, over several levels, plus a fast-start bonus. Sources disagree on the exact numbers. | Multi-level sharing is powerful for growth and is also where schemes turn into pyramids. We use **one level only**. |
| Luxury programmes (Hilton for Luxury and similar) | **Recognition, access and experiences**, not discounts. Discount-style rewards cheapen a luxury brand. | Our reward language should feel like membership, not coupons. |

Sources: Airbnb help centre articles 2699, 1129 and 3857; Uber referral programme rules; HousingWire and RISMedia on eXp (2025); Getlasso and Shopify on Amazon rates (2026); PriceLabs and The Points Guy on Booking.com; ReferralCandy and Rivo on luxury loyalty. Several figures come from vendor blogs and conflict with each other, so they are shown as patterns, not as numbers to copy.

## 2. What the research says about your idea (daily targets, rewards, tokens)

**Daily activity table and targets: yes, with care.**
- Visible progress and quick feedback help. The vendor claims of "89% more productivity" are unverified and we ignore them.
- Pitfalls found in the sources: a leaderboard of revenue alone discourages the people at the bottom and rewards hoarding; rewards that are not tied to what the business really wants distort behaviour; participation-only rewards make people do the minimum.
- Psychology research (Deci and colleagues; the Cameron and Pierce rebuttal) agrees on this much: **praise raises motivation; a tangible reward promised in advance and only loosely tied to performance can lower it; a reward clearly tied to real performance mostly does not.** So: reward results people control, and keep praise personal.

**"Tokens that can later be withdrawn as real money": do not build it as tokens.**
- In Nigeria a token that can be traded or cashed out falls under the SEC's digital-asset rules (Investments and Securities Act 2025; registration, custody and AML duties). A balance that holds customer money and can be withdrawn falls under CBN licensing (e-money or mobile-money operator). Unlicensed financial business is an offence under BOFIA 2020. We found no rule that says plain loyalty points are exempt once they can be cashed out.
- We have no inflow yet. A promise of future cash that is not backed by money in hand is a liability and a trust risk with our own team.
- **Recommendation:** use **points** for status and recognition (they never convert to cash and cannot be withdrawn), and pay **cash commission in naira by bank transfer** only from money Lux Catalog has actually received. A commission owed to someone is an ordinary payable, not a wallet and not a token. We reuse the payout machinery we already built for partners (verified bank account, admin approval, Paystack transfer).
- Tax: Nigerian withholding tax on commission to individuals is commonly quoted at 5% (10% for companies), but sources conflict and the 2025 tax act changed things. **Confirm with an accountant before the first payout**; the system will record the gross, the deduction and the net so the answer can be applied later.

## 3. Recommended design

### 3.1 Two kinds of reward, kept apart

**A. Cash commission (real money, only from real revenue).**
Paid in naira to the team member's verified bank account after the customer's payment has cleared and the stay or service is complete (same rule as partner payouts).

| Earning route | Who qualifies | Suggested rate (to confirm, D8) |
|---|---|---|
| **Client referral:** a customer you brought books or buys | Any team member, no property needed | 10% of **Lux Catalog's fee** on that booking for 12 months from that client's first booking |
| **Partner referral:** you brought a vetted partner (owner or operator) whose listing earns a booking | Any team member | 10% of Lux Catalog's fee on that partner's bookings for 12 months |
| **Concierge close:** you personally handled an enquiry to a paid booking | Team members with Enquiries access | 15% of Lux Catalog's fee, one booking |
| **Team referral:** you recruit another team member | Any | A **fixed bonus** after that person's first paid booking (not a share of their earnings; one level only) |

Important honest points:
- Rates apply to **our fee**, not the booking total, so we can never owe more than we earn.
- **You do not need a property or a service to earn.** You earn by bringing clients, partners or teammates, or by closing enquiries.
- If we earn nothing in a month, commissions that month are zero. We never promise a figure.
- Cancelled, refunded, self-referred (own account, family address) and test bookings earn nothing. Fraud forfeits everything earned.

**B. Points and levels (status, no cash value).**
Points come from daily activity, not from sales, so a newcomer with no sales still progresses:
replying to an enquiry within the target time, completing a daily task, onboarding a partner document check, a clean week, a client five-star rating.
Levels (suggested names): **Associate, Specialist, Senior, Principal**. A higher level gets, in order of cost to us:
1. recognition on the scoreboard and a personal profile badge;
2. first pick of new enquiries (a real, free advantage);
3. a **higher commission rate on referrals** (for example 10% to 12% to 15%), which is only paid when sales happen, so it costs nothing in advance;
4. access to the best listings and viewings, training, a named reference letter;
5. later, when there is money: a **monthly performance pool** set as a fixed share (for example 5%) of Lux Catalog's **actual net revenue** that month, split by points, paid in naira after month end. No revenue, no pool. It is written as a discretionary bonus, never as a promise.

### 3.2 The daily table (Team Desk)

One table per person per day, easy to read on a phone:

| Task | Target | Done | Points |
|---|---|---|---|
| Enquiries answered inside 30 minutes | 5 | 3 | 30 |
| Follow-ups with clients | 3 | 3 | 30 |
| Partner leads contacted | 2 | 1 | 10 |
| Listing checks (photos, price, availability) | 4 | 4 | 40 |

Below it: today's points, a seven-day streak, the week's scoreboard (everyone sees their own rank; the full board shows the top five and **"most improved"** so people at the bottom are not shamed), and "what to do next".
Activities are **recorded by the system where possible** (enquiry replies, listing edits, bookings handled come from the audit log) so the table cannot be padded; a few manual items need an admin tick.

### 3.3 Emails and your admin report (all automatic, all from Lux Catalog, never promises of money)

**To each team member** (they can mute any of them):
- 7:30 morning: a warm greeting, today's tasks and targets, one line of encouragement.
- Midday: a gentle check-in only if no task is done yet.
- 6:30 evening: today's score, streak, rank, what they earned (commission recorded, if any).
- Weekly: the scoreboard, most improved, next level progress.
- Immediate: a task assigned, a task approved, a milestone, a level-up.

**To you (the administrator)**, one daily report at 8:00 plus alerts:
- new enquiries and how many are unanswered, bookings and payments, listings waiting for approval, new applications;
- each team member's score and who missed targets two days running;
- commissions recorded today and the total owed (so money owed is always visible);
- anything unusual (failed payments, sign-ins from new places).
And an **admin table** in your dashboard with the same numbers, per person and per day, with a filter and an export.

### 3.4 What we say to someone who asks

Short answers, final wording in `docs/TEAM-FAQ.md` once approved:
- *How do I make money with you?* You bring clients or partners, or you close enquiries. When a booking you brought is paid and completed, you earn a share of our fee for it, paid to your bank account.
- *Why refer a friend?* The same share, for 12 months on that friend's bookings; and a fixed bonus if the friend joins the team and completes a first paid booking.
- *Do I need a property or a service to earn?* No.
- *What do I get with no sales yet?* Points, level, first pick of enquiries, a higher referral rate as you progress, and training. Cash only comes from real bookings.
- *When am I paid?* After the customer's payment has cleared and the stay or service is complete, after an admin approves the transfer.
- *Is there a salary?* Not at this stage. We say so plainly.

## 4. Decisions for the Founder (recommended answer first)

**D7. Tokens.** Recommended: **no withdrawable tokens**; points for status, naira commission by bank transfer. Reason in section 2.
**D8. Commission rates.** Recommended: 10% of our fee for client and partner referrals for 12 months, 15% for a personally closed enquiry, a fixed bonus for a team referral. Confirm the real fee percentage first, because every rate above is a share of it.
**D9. Monthly performance pool.** Recommended: start it only once there is revenue; announce it as a discretionary bonus.
**D10. Who sees the full scoreboard.** Recommended: everyone sees their own rank, the top five and "most improved"; only you see everyone.
**D11. Withholding tax and records.** Recommended: ask an accountant before the first payout; we record gross, tax and net.
**D12. Daily targets.** Recommended: you set the targets per role (for example Concierge or Partner onboarding), changeable by you at any time.

## 5. Build order (each step tested first)

1. **Now (bugs and basics):** team members edit their own name and phone and add a payment method; an admin can correct a member's details; in-page confirmations instead of the browser pop-up (the cancel-invite button); an admin can delete enquiries.
2. **Lux chat:** a real chat panel (see `docs/LUX-CHAT.md`).
3. **Team Desk daily table and points** (no money yet), plus the admin table and the daily report.
4. **Emails** (morning, evening, weekly) and the admin daily report.
5. **Commission ledger** and payouts, only after D7 to D11 are answered.
