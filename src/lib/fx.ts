import { prisma } from '@/lib/prisma'

const STALE_AFTER_MS = 24 * 60 * 60 * 1000 // refresh at most daily

// NGN->USD rate, cached in the FxRate table rather than fetched live on
// every request. open.er-api.com is free and keyless.
export async function getNgnToUsdRate(): Promise<number> {
  const existing = await prisma.fxRate.findFirst({ where: { base: 'NGN', quote: 'USD' } })

  const isStale = !existing || Date.now() - existing.updatedAt.getTime() > STALE_AFTER_MS
  if (!isStale) return Number(existing.rate)

  try {
    const res = await fetch('https://open.er-api.com/v6/latest/NGN', {
      signal: AbortSignal.timeout(8000),
    })
    const data = await res.json()
    const rate = data?.rates?.USD
    if (typeof rate !== 'number' || rate <= 0) throw new Error('Invalid rate response')

    if (existing) {
      await prisma.fxRate.update({
        where: { id: existing.id },
        data: { rate, source: 'open.er-api.com', updatedAt: new Date() },
      })
    } else {
      await prisma.fxRate.create({
        data: { base: 'NGN', quote: 'USD', rate, source: 'open.er-api.com' },
      })
    }
    return rate
  } catch (err) {
    console.error('FX rate refresh failed, falling back to cached/default:', err)
    if (existing) return Number(existing.rate)
    return 0.00062 // rough fallback so the toggle never fully breaks
  }
}
