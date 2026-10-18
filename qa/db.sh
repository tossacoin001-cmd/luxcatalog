#!/usr/bin/env bash
# Starts the local test database (a throwaway Postgres on :55432). Leave it
# running in its own terminal. It is slow to wake and can degrade after heavy
# runs: if suites start failing with "bind message" errors, stop it, start it
# again and re-run. Never point the suites at a real database.
cd "$(dirname "$0")/.."
exec npx prisma dev --name luxtest2 --db-port 55432 --port 55431 --shadow-db-port 55433
