import { NextResponse } from 'next/server'
import { turnstileSiteKey } from '@/lib/turnstile-key'

// The public half of the human check. It is read when the page asks, not when
// the site is built, so changing it in the host settings needs no rebuild of
// the page, and either spelling of the name works.
export const dynamic = 'force-dynamic'

export function GET() {
  return NextResponse.json(
    { siteKey: turnstileSiteKey() },
    { headers: { 'cache-control': 'no-store' } },
  )
}
