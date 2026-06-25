import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    const body = await req.json()
    const { name, email, phone, message, listingId } = body

    if (!name || !email || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // In production: save to Supabase via Prisma
    // const inquiry = await prisma.inquiry.create({
    //   data: { name, email, phone, message, listingId, userId }
    // })

    console.log('Inquiry received:', { name, email, phone, message, listingId, userId })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Inquiry error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const { userId, sessionClaims } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const role = (sessionClaims?.metadata as { role?: string })?.role
    if (role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    // const inquiries = await prisma.inquiry.findMany({ orderBy: { createdAt: 'desc' }, include: { listing: true } })
    return NextResponse.json({ inquiries: [] })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
