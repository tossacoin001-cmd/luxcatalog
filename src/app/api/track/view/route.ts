import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { randomBytes } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { getUserId } from '@/lib/admin-auth'

const VISITOR_COOKIE = 'lux_vid'
const DEDUPE_MS = 30 * 60_000
const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|headless/i

// Records one listing view for partner stats and personal picks. One count
// per visitor per listing per 30 minutes; bots, link previews and the
// listing's own owner are not counted.
export async function POST(req: Request) {
  try {
    if (BOT.test(req.headers.get('user-agent') ?? '')) return new NextResponse(null, { status: 204 })

    const { listingId } = await req.json().catch(() => ({ listingId: null }))
    if (typeof listingId !== 'string' || listingId.length > 64) return new NextResponse(null, { status: 400 })

    const jar = await cookies()
    let visitorId = jar.get(VISITOR_COOKIE)?.value
    const fresh = !visitorId
    if (!visitorId) visitorId = randomBytes(16).toString('base64url')

    const [userId, listing] = await Promise.all([
      getUserId(),
      prisma.listing.findUnique({ where: { id: listingId }, select: { ownerId: true, published: true } }),
    ])
    if (!listing?.published || (userId && userId === listing.ownerId)) return new NextResponse(null, { status: 204 })

    const recent = await prisma.listingView.findFirst({
      where: { visitorId, listingId, createdAt: { gte: new Date(Date.now() - DEDUPE_MS) } },
      select: { id: true },
    })
    if (!recent) await prisma.listingView.create({ data: { listingId, userId, visitorId } })

    const res = new NextResponse(null, { status: 204 })
    if (fresh) {
      res.cookies.set(VISITOR_COOKIE, visitorId, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 60 * 60 * 24 * 365, path: '/' })
    }
    return res
  } catch (err) {
    console.error('track view failed:', err)
    return new NextResponse(null, { status: 204 })
  }
}
