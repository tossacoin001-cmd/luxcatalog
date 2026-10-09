import { prisma } from '@/lib/prisma'
import { verifyEmailTransport, emailConfigured } from '@/lib/email'
import { getNgnToUsdRate } from '@/lib/fx'

export type CheckStatus = 'ok' | 'warn' | 'fail'
export type Check = { name: string; status: CheckStatus; detail: string }

const FX_STALE_MS = 48 * 3600_000

// SMTP login is slow-ish and Gmail dislikes being poked every few minutes,
// so the result is reused for 30 minutes per server instance.
let smtpCache: { ok: boolean; at: number } | null = null
async function smtpOk(): Promise<boolean> {
  if (smtpCache && Date.now() - smtpCache.at < 30 * 60_000) return smtpCache.ok
  const ok = await verifyEmailTransport()
  smtpCache = { ok, at: Date.now() }
  return ok
}

// Fast checks for /api/health, polled by the uptime monitor every few minutes.
export async function healthChecks(): Promise<Check[]> {
  const checks: Check[] = []

  const t0 = Date.now()
  try {
    await prisma.$queryRaw`SELECT 1`
    const ms = Date.now() - t0
    checks.push({ name: 'database', status: ms > 3000 ? 'warn' : 'ok', detail: `${ms}ms` })
  } catch {
    checks.push({ name: 'database', status: 'fail', detail: 'unreachable' })
  }

  checks.push({
    name: 'auth',
    status: process.env.BETTER_AUTH_SECRET ? 'ok' : 'fail',
    detail: process.env.BETTER_AUTH_SECRET ? 'configured' : 'BETTER_AUTH_SECRET missing',
  })

  if (!emailConfigured) {
    checks.push({ name: 'email', status: 'fail', detail: 'SMTP not configured' })
  } else {
    const ok = await smtpOk()
    checks.push({ name: 'email', status: ok ? 'ok' : 'fail', detail: ok ? 'SMTP login ok' : 'SMTP login failed' })
  }

  try {
    const fx = await prisma.fxRate.findFirst({ where: { base: 'NGN', quote: 'USD' } })
    const age = fx ? Date.now() - fx.updatedAt.getTime() : Infinity
    checks.push({
      name: 'fx_rate',
      status: age < FX_STALE_MS ? 'ok' : 'warn',
      detail: fx ? `updated ${Math.round(age / 3600_000)}h ago` : 'never fetched',
    })
  } catch {
    checks.push({ name: 'fx_rate', status: 'warn', detail: 'could not read' })
  }

  return checks
}

async function imageReachable(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(8000) })
    if (res.ok) return true
    // Some CDNs reject HEAD; confirm with a tiny ranged GET before flagging.
    const get = await fetch(url, { headers: { Range: 'bytes=0-0' }, signal: AbortSignal.timeout(8000) })
    return get.ok || get.status === 206
  } catch {
    return false
  }
}

// Daily deep scan: system health plus the business problems a shopper or
// partner would notice. Fixes what it safely can (stale FX rate) itself.
export async function deepChecks(): Promise<Check[]> {
  const checks = await healthChecks()

  // Self-heal: refresh a stale FX rate.
  const fx = checks.find((c) => c.name === 'fx_rate')
  if (fx && fx.status !== 'ok') {
    try {
      await getNgnToUsdRate()
      fx.status = 'ok'
      fx.detail += ' → refreshed by Watchdog'
    } catch {
      /* stays warn */
    }
  }

  const listings = await prisma.listing.findMany({
    where: { published: true },
    select: { id: true, title: true, images: true, price: true, priceDisplay: true },
  })

  const noPhotos = listings.filter((l) => l.images.length === 0)
  checks.push({
    name: 'listings_without_photos',
    status: noPhotos.length ? 'warn' : 'ok',
    detail: noPhotos.length ? noPhotos.map((l) => l.title).slice(0, 5).join('; ') : 'all live listings have photos',
  })

  const noPrice = listings.filter((l) => l.price == null && !l.priceDisplay?.trim())
  checks.push({
    name: 'listings_without_price',
    status: noPrice.length ? 'warn' : 'ok',
    detail: noPrice.length ? noPrice.map((l) => l.title).slice(0, 5).join('; ') : 'all live listings show a price',
  })

  // Broken cover photos (first image of each live listing, capped).
  const covers = listings.filter((l) => l.images[0]).slice(0, 40)
  const results = await Promise.all(covers.map(async (l) => ({ l, ok: await imageReachable(l.images[0]) })))
  const broken = results.filter((r) => !r.ok).map((r) => r.l.title)
  checks.push({
    name: 'broken_cover_photos',
    status: broken.length ? 'fail' : 'ok',
    detail: broken.length ? broken.slice(0, 5).join('; ') : `${covers.length} cover photos load`,
  })

  const dayAgo = new Date(Date.now() - 24 * 3600_000)
  const unanswered = await prisma.inquiry.count({ where: { status: 'new', createdAt: { lt: dayAgo } } })
  checks.push({
    name: 'unanswered_enquiries',
    status: unanswered ? 'warn' : 'ok',
    detail: unanswered ? `${unanswered} enquir${unanswered === 1 ? 'y' : 'ies'} waiting over 24h` : 'none waiting over 24h',
  })

  const pending = await prisma.listing.count({ where: { published: false, ownerId: { not: null } } })
  checks.push({
    name: 'partner_listings_awaiting_approval',
    status: pending ? 'warn' : 'ok',
    detail: pending ? `${pending} awaiting your approval` : 'none waiting',
  })

  const waitingApps = await prisma.partnerApplication.count({ where: { status: 'submitted' } })
  const staleApps = await prisma.partnerApplication.count({ where: { status: 'submitted', submittedAt: { lt: new Date(Date.now() - 2 * 24 * 3600_000) } } })
  checks.push({
    name: 'partner_applications_waiting',
    status: staleApps ? 'warn' : 'ok',
    detail: waitingApps ? `${waitingApps} waiting${staleApps ? `, ${staleApps} for over 2 days (we promise 2 working days)` : ''}` : 'none waiting',
  })

  const failedEmails = await prisma.emailLog.count({ where: { status: 'failed', createdAt: { gte: dayAgo } } })
  checks.push({
    name: 'failed_emails_24h',
    status: failedEmails ? 'fail' : 'ok',
    detail: failedEmails ? `${failedEmails} failed` : 'none failed',
  })

  return checks
}

export function overall(checks: Check[]): CheckStatus {
  if (checks.some((c) => c.status === 'fail')) return 'fail'
  if (checks.some((c) => c.status === 'warn')) return 'warn'
  return 'ok'
}

export const CHECK_LABELS: Record<string, string> = {
  database: 'Database',
  auth: 'Login system',
  email: 'Email sending',
  fx_rate: 'NGN/USD rate',
  listings_without_photos: 'Listings without photos',
  listings_without_price: 'Listings without a price',
  broken_cover_photos: 'Broken cover photos',
  unanswered_enquiries: 'Unanswered enquiries',
  partner_listings_awaiting_approval: 'Partner listings to approve',
  partner_applications_waiting: 'Partner applications',
  failed_emails_24h: 'Failed emails (24h)',
}
