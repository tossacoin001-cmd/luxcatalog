import { NextResponse } from 'next/server'
import { getSession } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'
import { deleteStoredDocument } from '@/lib/partners'

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Sign in first' }, { status: 401 })
  const { id } = await params

  const doc = await prisma.partnerDocument.findUnique({ where: { id }, include: { application: true } })
  if (!doc || doc.application.userId !== session.user.id) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!['draft', 'info_requested', 'rejected'].includes(doc.application.status)) {
    return NextResponse.json({ error: 'This application is under review' }, { status: 409 })
  }

  await deleteStoredDocument(doc)
  await prisma.partnerDocument.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
