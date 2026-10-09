import { NextResponse } from 'next/server'
import { audit, requireAreaApi } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'
import { emailApplicationDecision } from '@/lib/partners'
import { revalidateCatalog } from '@/lib/revalidate'

const ACTIONS = ['approve', 'request_info', 'reject', 'note'] as const
type Action = (typeof ACTIONS)[number]

// Admin decisions on a partner application. Approving makes the applicant a
// partner and creates their public partner profile; every decision emails the
// applicant and is written to the audit log.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAreaApi('applications')
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const action = body.action as Action
  if (!ACTIONS.includes(action)) return NextResponse.json({ error: 'Unknown action' }, { status: 400 })

  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 2000) : ''
  const app = await prisma.partnerApplication.findUnique({ where: { id } })
  if (!app) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const user = await prisma.user.findUnique({ where: { id: app.userId }, select: { id: true, email: true, role: true } })
  if (!user) return NextResponse.json({ error: 'Applicant account no longer exists' }, { status: 410 })

  if (action === 'note') {
    await prisma.partnerApplication.update({ where: { id }, data: { internalNote: note || null } })
    return NextResponse.json({ success: true })
  }
  if (action === 'request_info' && !note) return NextResponse.json({ error: 'Say what is needed' }, { status: 400 })
  if (action === 'reject' && !note) return NextResponse.json({ error: 'Give the applicant a reason' }, { status: 400 })
  if (!['submitted', 'info_requested'].includes(app.status) && action !== 'approve') {
    return NextResponse.json({ error: `Application is ${app.status}` }, { status: 409 })
  }

  const status = action === 'approve' ? 'approved' : action === 'request_info' ? 'info_requested' : 'rejected'
  await prisma.$transaction(async (tx) => {
    await tx.partnerApplication.update({
      where: { id },
      data: { status, reviewNote: note || null, reviewedAt: new Date(), reviewedById: admin.userId },
    })
    if (action === 'approve') {
      // Never demote an admin who happens to apply.
      if (user.role === 'customer') await tx.user.update({ where: { id: user.id }, data: { role: 'partner' } })
      await tx.partnerProfile.upsert({
        where: { userId: user.id },
        create: { userId: user.id, brandName: app.businessName, bio: app.about.slice(0, 600) },
        update: {},
      })
      await tx.partnerDocument.updateMany({ where: { applicationId: id, status: 'pending' }, data: { status: 'accepted' } })
    }
  })
  await audit(admin.userId, `partner_application.${action}`, id, { note: note || undefined })
  await emailApplicationDecision(app, user.email, status as 'approved' | 'info_requested' | 'rejected', note || null)
  if (action === 'approve') revalidateCatalog()

  return NextResponse.json({ success: true, status })
}
