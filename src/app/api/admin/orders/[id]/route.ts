import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminApi } from '@/lib/admin-auth'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminApi()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const { status } = await req.json()
    if (!['pending', 'paid', 'fulfilled', 'cancelled'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const order = await prisma.order.update({ where: { id }, data: { status } })
    return NextResponse.json({ success: true, order })
  } catch (err) {
    console.error('Update order error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
