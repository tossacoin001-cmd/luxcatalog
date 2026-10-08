import { NextResponse } from 'next/server'
import { healthChecks, overall } from '@/lib/notify/watchdog'

export const dynamic = 'force-dynamic'

// Polled every few minutes by the uptime monitor (UptimeRobot). Returns 503
// when anything critical fails so the monitor alerts. Only check names and
// short statuses are exposed, never configuration values.
export async function GET() {
  const checks = await healthChecks()
  const status = overall(checks)
  return NextResponse.json(
    { status, checks: checks.map(({ name, status }) => ({ name, status })), at: new Date().toISOString() },
    { status: status === 'fail' ? 503 : 200, headers: { 'Cache-Control': 'no-store' } }
  )
}
