import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { requireAdminApi } from '@/lib/admin-auth'

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    const body = await req.json()
    const { name, email, phone, message, listingId, checkIn, checkOut } = body

    if (!name || !email || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const inquiry = await prisma.inquiry.create({
      data: {
        name,
        email,
        phone: phone || null,
        message,
        listingId: listingId || null,
        userId: userId || null,
        checkIn: checkIn ? new Date(checkIn) : null,
        checkOut: checkOut ? new Date(checkOut) : null,
      },
    })

    return NextResponse.json({ success: true, id: inquiry.id })
  } catch (err) {
    console.error('Inquiry error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const admin = await requireAdminApi()
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
