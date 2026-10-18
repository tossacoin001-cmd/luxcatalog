#!/usr/bin/env bash
# Builds the app and serves it on :3300 against the local test database.
# Needs qa/db.sh running. Emails are written to qa/mail instead of being sent.
# Usage: bash qa/serve.sh [--no-build]
cd "$(dirname "$0")/.."
until (echo > /dev/tcp/127.0.0.1/55432) 2>/dev/null; do sleep 3; done
[ -f .env.paystack.local ] && { set -a; . ./.env.paystack.local; set +a; }   # test keys only, optional
L='postgres://postgres:postgres@localhost:55432/template1?sslmode=disable'
export DATABASE_URL=$L DIRECT_URL=$L DATABASE_POOL_MAX=1 \
  BETTER_AUTH_SECRET=local-test-secret-0123456789abcdef0123 BETTER_AUTH_URL=http://localhost:3300 \
  NEXT_PUBLIC_APP_URL=http://localhost:3300 CRON_SECRET=local-cron-secret-0123456789 EMAIL_DEBUG_DIR="$PWD/qa/mail"
mkdir -p qa/mail
[ "$1" = "--no-build" ] || npx next build || exit 1
exec npx next start -p 3300
