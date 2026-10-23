import { NextResponse } from 'next/server'
import { audit, requireAdminApi } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'

// Only the administrator deletes enquiries (a team member may answer and close
// them, never erase them). Either named ones, or every closed one at once.
// "Delete all new" is deliberately not possible.
export async function DELETE(req: Request) {
  const admin = await requireAdminApi()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Say which enquiries to delete.' }, { status: 400 })

  if (Array.isArray(body.ids)) {
    const ids = body.ids.filter((x: unknown): x is string => typeof x === 'string' && x.length > 0 && x.length < 100).slice(0, 200)
    if (!ids.length) return NextResponse.json({ error: 'Say which enquiries to delete.' }, { status: 400 })
    const { count } = await prisma.inquiry.deleteMany({ where: { id: { in: ids } } })
    await audit(admin.userId, 'enquiry.delete', ids.join(',').slice(0, 300), { count })
    return NextResponse.json({ success: true, deleted: count })
  }
  if (body.status === 'closed') {
    const { count } = await prisma.inquiry.deleteMany({ where: { status: 'closed' } })
    await audit(admin.userId, 'enquiry.delete.closed', undefined, { count })
    return NextResponse.json({ success: true, deleted: count })
  }
  return NextResponse.json({ error: 'Only named enquiries, or all closed ones, can be deleted.' }, { status: 400 })
}
