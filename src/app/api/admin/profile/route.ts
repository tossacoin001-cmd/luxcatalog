import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireStaffApi } from '@/lib/admin-auth'

export async function GET() {
  const staff = await requireStaffApi()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await prisma.partnerProfile.findUnique({ where: { userId: staff.userId } })
  return NextResponse.json({ profile })
}

export async function POST(req: Request) {
  const staff = await requireStaffApi()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { brandName, logo, bio } = await req.json()
    if (!brandName?.trim()) {
      return NextResponse.json({ error: 'Brand name is required' }, { status: 400 })
    }

    const profile = await prisma.partnerProfile.upsert({
      where: { userId: staff.userId },
      create: { userId: staff.userId, brandName: brandName.trim(), logo: logo || null, bio: bio || null },
      update: { brandName: brandName.trim(), logo: logo || null, bio: bio || null },
    })

    return NextResponse.json({ success: true, profile })
  } catch (err) {
    console.error('Partner profile save error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
