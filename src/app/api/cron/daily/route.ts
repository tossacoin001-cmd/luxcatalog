import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { deepChecks, overall } from '@/lib/notify/watchdog'
import { sendAdminBriefings, sendPartnerDigests } from '@/lib/notify/digests'
import { requireAdminApi } from '@/lib/admin-auth'
import { runDailyBookingJobs } from '@/lib/refunds-server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

async function run(dryRun: boolean) {
  // Bookings first (finish stays, queue caution refunds) so the briefing sees them.
  const bookings = dryRun ? null : await runDailyBookingJobs().catch((e) => (console.error('Booking jobs failed:', e), null))
  const checks = await deepChecks()
  const status = overall(checks)
  await prisma.watchdogRun.create({ data: { kind: dryRun ? 'daily_dry' : 'daily', ok: status !== 'fail', checks } })
  const admins = await sendAdminBriefings(checks, { dryRun })
  const partners = await sendPartnerDigests({ dryRun })
  return { status, checks, bookings, emails: { admins, partners } }
}

// Vercel Cron calls this once a day (vercel.json) with
// "Authorization: Bearer <CRON_SECRET>". Nothing else can trigger a send.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    return NextResponse.json(await run(false))
  } catch (err) {
    console.error('Daily job failed:', err)
    return NextResponse.json({ error: 'Daily job failed' }, { status: 500 })
  }
}

// Admins can preview the run from the panel: full Watchdog scan, digests
// built but not sent (dry run), so content can be checked safely.
export async function POST() {
  const admin = await requireAdminApi()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json(await run(true))
}
