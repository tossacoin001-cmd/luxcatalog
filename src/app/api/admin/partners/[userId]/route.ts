import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminApi } from '@/lib/admin-auth'

export async function PATCH(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const admin = await requireAdminApi()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { userId } = await params
    const { featured } = await req.json()

    const profile = await prisma.partnerProfile.update({
      where: { userId },
      data: { featured: !!featured },
    })

    return NextResponse.json({ success: true, profile })
  } catch (err) {
    console.error('Update partner profile error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
