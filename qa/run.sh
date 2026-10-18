#!/usr/bin/env bash
# Runs suites one after another (never together: a failure must point at one
# thing). Usage:
#   bash qa/run.sh listing-approval-e2e discover-unit
#   bash qa/run.sh --all            every suite, in the order of qa/suites.json
# Needs qa/db.sh and qa/serve.sh running. Results: qa/out/<suite>.txt and a
# one-line summary per suite on screen. Exit code 1 if any suite fails.
cd "$(dirname "$0")/.."
export OUT="$PWD/qa/out"; mkdir -p "$OUT"
DB='postgres://postgres:postgres@localhost:55432/template1?sslmode=disable'
npx tsx qa/gen-agreements.ts
[ -f .env.paystack.local ] && { set -a; . ./.env.paystack.local; set +a; }
clear_rl() { node -e "const pg=require('pg');const c=new pg.Client('$DB');c.connect().then(()=>c.query('delete from \"RateLimit\"')).then(()=>c.end()).catch(()=>{})"; }
steady() { local ok=0; for i in $(seq 1 40); do if curl -s -o /dev/null -m 8 https://api.paystack.co/; then ok=$((ok+1)); else ok=0; fi; [ $ok -ge 3 ] && return 0; sleep 5; done; echo "  (Paystack not reachable: payment suites may fail for that reason, not a code reason)"; }
if [ "$1" = "--all" ]; then set -- $(node -e "const s=require('./qa/suites.json');console.log([...s.unit,...s.e2e,...s.ui].join(' '))"); fi
bad=0
for t in "$@"; do
  f=qa/suites/$t.mjs; [ -f "$f" ] || f=qa/suites/$t.ts
  [ -f "$f" ] || { echo "unknown suite: $t"; bad=1; continue; }
  case $t in *-e2e|*-ui) steady;; esac
  clear_rl
  if [[ $f == *.ts ]]; then npx tsx "$f" > "$OUT/$t.txt" 2>&1; else node "$f" > "$OUT/$t.txt" 2>&1; fi
  echo "== $t: $(tail -1 "$OUT/$t.txt") | $(grep -c '  FAIL' "$OUT/$t.txt") failing checks"
  grep '  FAIL' "$OUT/$t.txt" | head -8 | cut -c1-200
  grep -q '  FAIL' "$OUT/$t.txt" && bad=1
  tail -1 "$OUT/$t.txt" | grep -q 'failed' || bad=1
done
exit $bad
