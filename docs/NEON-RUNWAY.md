# The Neon allowance warning (2026-10-24): what it means and the free plan

## What happened

Neon emailed that the project **neon-byzantium-tree** (Lux Catalog's production database) "has used 100% of its 100 CU-hour monthly compute allowance". On Neon's free plan a project gets 100 "compute unit hours" a month. One unit-hour is one small database server running for one hour. The meter runs **only while the database is awake**. Neon puts an idle database to sleep after 5 quiet minutes, and wakes it for the next request.

When the allowance is used up, Neon switches the compute off until the allowance resets next month. **No data is deleted** (storage is separate), but while it is off every query fails: pages that need the database, sign-in, booking, and Paystack payment notifications.

## Why the allowance was used up (found in the code)

The uptime monitor calls `/api/health` every few minutes, and that endpoint ran two database queries each time (`SELECT 1` and the exchange-rate read). A call every few minutes means the database never sleeps. Awake all month is roughly 180 to 730 compute hours depending on size, far above 100.

## What is fixed now (free)

- `/api/health` is now **light by default**: it proves the app is running and configured but never touches the database. The full check (database, email login, exchange rate) runs only with the scheduled-job secret (`?deep=1`) and in the daily Watchdog. Test: `health-e2e` starts a copy of the app whose database is unreachable and shows the ordinary check still answers, while only the deep check reports the failure.
- The uptime monitor needs no change: it keeps calling `/api/health`, which is now free.

## What the Founder does today (no payment needed)

1. **Neon dashboard, project neon-byzantium-tree, Settings, Compute:** set the maximum size to the smallest (0.25 CU) and leave "Suspend after inactivity" on. This makes any hour of use cost the least.
2. **Look at what else uses this database.** The project also holds roughly 150 tables from another app (a Medusa shop). If that app is running and querying, it keeps the database awake too. If it is not needed, move it to its own project or stop it.
3. **Make a backup now**, while the database still answers (it needs a few minutes of compute):
   - In Neon, open the project, Connect, copy the connection string (the "pooled" one is fine).
   - In a terminal in the project folder: `set BACKUP_DATABASE_URL=<paste the string>` then `npm run db:backup` (PowerShell: `$env:BACKUP_DATABASE_URL="<string>"`).
   - It writes a folder under `backups/` with every table and a checksum file. The string is never printed or saved. Keep the folder private (it holds customer data); copy it to an encrypted drive or a private cloud folder.
   - Do this again once a week, and before any big change.
4. **Do not paste the connection string into chat.**

## Plan B with no money: a second free project

Neon's free plan allows several projects, and **each project has its own 100 hours**. A standby is therefore free:

1. Create a new Neon project (for example `luxcatalog-b`) in the same account.
2. Point `DATABASE_URL` and `DIRECT_URL` at it on your own computer, run `npx prisma db push` to create the empty tables.
3. Restore the backup into it: `set RESTORE_DATABASE_URL=<new string>` then `npm run db:restore -- backups/<folder>`. The tool refuses to write into tables that already have rows, loads parents before children, and **proves** the copy: every table's row count and checksum must match the backup, or it undoes everything.
4. If the main database ever goes dark, change `DATABASE_URL`, `DIRECT_URL` (and `DATABASE_URL_UNPOOLED` if present) in Vercel to the standby and redeploy. Anything saved after the last backup is lost, so keep backups recent.

Other free options if ever needed (each has limits and would need a data move): Supabase free (pauses after a week of inactivity), CockroachDB or Aiven free tiers. Staying on Neon with the fix above is the simplest.

## Do we need to pay?

Not now. With the health check fixed and the database allowed to sleep, a site with modest traffic should stay well inside 100 hours. The paid Launch plan becomes worth it when real revenue arrives, mainly for the guarantee of staying online during December and for point-in-time restore. Until then: fix, back up weekly, keep a standby.

## What I cannot do from here

I cannot see Neon's dashboard or read the production connection string (Vercel keeps it hidden), so I cannot take the backup or create the standby for the Founder. The tools are written and tested locally so that doing it takes minutes.
