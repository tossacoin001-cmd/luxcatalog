import { NextResponse } from 'next/server'
import { daysBetween, isDay } from '@/lib/booking'
import { SESSION_POLICY_TEXT } from '@/lib/sessions'
import { availability, sessionListing } from '@/lib/sessions-server'

const MAX_DAYS = 62

// Public: what a Private Services listing offers (packages, areas served
// with travel fees, policy) and, with ?package=&from=&to=, the free start
// times per day. Never reveals which times are taken or why.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const found = await sessionListing(id)
  if (!found) return NextResponse.json({ error: 'This service is not taking online bookings' }, { status: 404 })
  const { rules, packages } = found
  const info = {
    packages,
    areas: rules.areas,
    instantBook: rules.instantBook,
    advanceNoticeHours: rules.advanceNoticeHours,
    policy: { key: rules.cancellationPolicy, ...SESSION_POLICY_TEXT[rules.cancellationPolicy] },
  }
  const url = new URL(req.url)
  const packageId = url.searchParams.get('package')
  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')
  if (!packageId && !from && !to) return NextResponse.json({ info })

  const pkg = packages.find((p) => p.id === packageId)
  if (!pkg) return NextResponse.json({ error: 'Choose a package' }, { status: 400 })
  if (!isDay(from) || !isDay(to) || to < from) return NextResponse.json({ error: 'Choose the days to check' }, { status: 400 })
  if (daysBetween(from, to) >= MAX_DAYS) return NextResponse.json({ error: `Check up to ${MAX_DAYS} days at a time` }, { status: 400 })
  return NextResponse.json({ info, days: await availability(id, rules, pkg, from, to) })
}
