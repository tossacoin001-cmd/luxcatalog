import { NextResponse } from 'next/server'
import { getNgnToUsdRate } from '@/lib/fx'

// Every page's currency toggle calls this, so let the CDN serve it: fresh for
// an hour, then stale-while-revalidate so visitors never wait on a refresh.
const CACHE = 'public, s-maxage=3600, stale-while-revalidate=86400'

export async function GET() {
  try {
    const rate = await getNgnToUsdRate()
    return NextResponse.json({ base: 'NGN', quote: 'USD', rate }, { headers: { 'Cache-Control': CACHE } })
  } catch (err) {
    // A database hiccup must never break the toggle: fall back to a rough
    // rate (same as fx.ts) and don't let the CDN cache the fallback long.
    console.error('fx-rate failed:', err)
    return NextResponse.json(
      { base: 'NGN', quote: 'USD', rate: 0.00062, fallback: true },
      { headers: { 'Cache-Control': 'public, s-maxage=60' } }
    )
  }
}
