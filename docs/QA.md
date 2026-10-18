# Running the tests

The suites run against a **throwaway local database** and a local build, never
production. They create their own data and are meant to be run **one after the
other**, not together.

```
# terminal 1: the test database (slow to wake; restart it if suites start
# failing with "bind message" errors)
bash qa/db.sh

# terminal 2: build and serve the app on :3300
bash qa/serve.sh

# terminal 3: run suites
bash qa/run.sh listing-approval-e2e
bash qa/run.sh discover-unit discover-e2e discover-ui
bash qa/run.sh --all
```

Needs Node, Google Chrome (browser suites; set `CHROME_PATH` if it is not at the
Windows default) and internet for the payment suites (Paystack test mode).
Output for each suite is in `qa/out/<suite>.txt`.

## Suites

- **unit**: pure rules, no server. `services-unit`, `services-s2-unit`,
  `services-s3-unit`, `phase-a-unit`, `phase-b-unit`, `discover-unit`.
- **e2e**: real API and database. Access, booking, payments, partners,
  agreements, team, requests, refunds, payouts, Discover, listing approval.
- **ui**: headless Chrome on a phone (390px) and a desktop (1280px).

## Which neighbours to run with a change

| You touched | Also run |
|---|---|
| listings API or admin listings | `listing-approval-e2e`, `team-e2e`, `partner-e2e`, `services-e2e`, `booking-e2e` |
| Discover | `discover-unit`, `discover-e2e`, `discover-ui`, `phase-a-ui` |
| menu, overlays, services page | `polish-ui`, `phase-b-ui`, `services-ui`, `services-flow-ui` |
| booking | `booking-e2e`, `booking-ui`, `pay-e2e`, `services-booking-e2e` |
| enquiries and requests | `phase-b-e2e`, `phase-b-ui`, `request-e2e`, `phase-a-e2e` |

## Known quirks (not code faults)

- The local database can degrade after heavy runs ("bind message supplies N
  parameters"): restart it.
- Payment suites fail if Paystack is not reachable from the machine.
- Pages are cached for 5 minutes; suites wait for new listings to appear.
- `discover-*`, `polish-ui` and `listing-approval-e2e` expect a mostly empty
  catalogue; the first three empty the Listing table at the start (local test
  database only).
