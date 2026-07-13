import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminApi } from '@/lib/admin-auth'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminApi()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const { status } = await req.json()
    if (!['new', 'in_progress', 'closed'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const inquiry = await prisma.inquiry.update({ where: { id }, data: { status } })
    return NextResponse.json({ success: true, inquiry })
  } catch (err) {
    console.error('Update inquiry error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
