import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { listingId } = await req.json()
  // await prisma.savedListing.upsert({ where: { userId_listingId: { userId, listingId } }, create: { userId, listingId }, update: {} })
  return NextResponse.json({ success: true })
}

export async function DELETE(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { listingId } = await req.json()
  // await prisma.savedListing.delete({ where: { userId_listingId: { userId, listingId } } })
  return NextResponse.json({ success: true })
}

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ savedIds: [] })
  // const saved = await prisma.savedListing.findMany({ where: { userId }, select: { listingId: true } })
  return NextResponse.json({ savedIds: [] })
}
