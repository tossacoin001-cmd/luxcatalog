import { NextResponse } from 'next/server'
import { getNgnToUsdRate } from '@/lib/fx'

export async function GET() {
  const rate = await getNgnToUsdRate()
  return NextResponse.json({ base: 'NGN', quote: 'USD', rate })
}
