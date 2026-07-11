import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId, sessionClaims } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = (sessionClaims?.metadata as { role?: string })?.role
  if (role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

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
