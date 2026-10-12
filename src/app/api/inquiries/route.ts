import { NextResponse, after } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserId, requireAreaApi } from '@/lib/admin-auth'
import { validateEnquiry } from '@/lib/enquiry'
import { clientIp, rateLimit, verifyHuman } from '@/lib/protect'
import { notifyEnquiry } from '@/lib/enquiries-server'

export const maxDuration = 60

// Anyone can enquire or request a viewing; no account needed. Bots are
// stopped by a hidden field, the Turnstile check (for guests) and a limit
// of 5 enquiries an hour per visitor. The team hears at once.
export async function POST(req: Request) {
  try {
    const userId = await getUserId()
    const body = await req.json().catch(() => ({}))
    // Hidden field only bots fill in: accept quietly, store nothing.
    if (typeof body.website === 'string' && body.website.trim()) return NextResponse.json({ success: true })
    const ip = clientIp(req.headers)
    if (!(await rateLimit(`enquiry:${ip}`, 5, 3_600_000))) {
      return NextResponse.json({ error: 'You’ve sent several enquiries in a short time. Please wait a little, or message our concierge.' }, { status: 429 })
    }
    if (!userId && !(await verifyHuman(body.captcha, ip))) {
      return NextResponse.json({ error: 'Please complete the quick check and try again.' }, { status: 400 })
    }
    const v = validateEnquiry(body)
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 })
    const listingId = typeof body.listingId === 'string' && body.listingId
      ? (await prisma.listing.findFirst({ where: { id: body.listingId, published: true }, select: { id: true } }))?.id ?? null
      : null

    const inquiry = await prisma.inquiry.create({
      data: {
        ...v.data,
        listingId,
        userId: userId || null,
        checkIn: body.checkIn ? new Date(body.checkIn) : null,
        checkOut: body.checkOut ? new Date(body.checkOut) : null,
      },
    })
    after(() => notifyEnquiry(inquiry.id).catch((e) => console.error('Enquiry alerts failed:', e)))
    return NextResponse.json({ success: true, id: inquiry.id })
  } catch (err) {
    console.error('Inquiry error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const admin = await requireAreaApi('enquiries')
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const inquiries = await prisma.inquiry.findMany({
      orderBy: { createdAt: 'desc' },
      include: { listing: { select: { title: true, category: true, slug: true } } },
    })
    return NextResponse.json({ inquiries })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
