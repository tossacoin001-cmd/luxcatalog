import { NextResponse } from 'next/server'
import { healthChecks, overall } from '@/lib/notify/watchdog'

export const dynamic = 'force-dynamic'

// Polled every few minutes by the uptime monitor (UptimeRobot). The ordinary
// answer is LIGHT: it proves the app is up and configured but never touches
// the database. That matters on Neon's free plan, which bills compute time
// while the database is awake: a check that queried it every few minutes kept
// it awake around the clock and used the whole month's allowance.
// The full check (database, email login, exchange rate) runs when called with
// the scheduled-job secret (?deep=1) and in the daily Watchdog.
// Only check names and short statuses are exposed, never configuration values.
export async function GET(req: Request) {
  const deep = new URL(req.url).searchParams.get('deep') === '1'
  const secret = process.env.CRON_SECRET
  const authorised = !!secret && req.headers.get('authorization') === `Bearer ${secret}`

  if (deep && authorised) {
    const checks = await healthChecks()
    const status = overall(checks)
    return NextResponse.json(
      { status, mode: 'deep', checks: checks.map(({ name, status }) => ({ name, status })), at: new Date().toISOString() },
      { status: status === 'fail' ? 503 : 200, headers: { 'Cache-Control': 'no-store' } },
    )
  }

  const configured = !!process.env.BETTER_AUTH_SECRET
  return NextResponse.json(
    { status: configured ? 'ok' : 'fail', mode: 'light', checks: [{ name: 'app', status: configured ? 'ok' : 'fail' }], at: new Date().toISOString() },
    { status: configured ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
  )
}
