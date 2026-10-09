import { NextResponse } from 'next/server'
import { audit, getSession } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'
import { emailAdminsNewApplication, emailApplicationReceived, missingForSubmit } from '@/lib/partners'

export async function POST() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Sign in first' }, { status: 401 })

  const app = await prisma.partnerApplication.findUnique({
    where: { userId: session.user.id },
    include: { documents: { select: { kind: true, expiresAt: true } } },
  })
  if (!app) return NextResponse.json({ error: 'Start your application first' }, { status: 404 })
  if (!['draft', 'info_requested'].includes(app.status)) {
    return NextResponse.json({ error: 'This application has already been submitted' }, { status: 409 })
  }

  const missing = missingForSubmit(app)
  if (missing.length) return NextResponse.json({ error: 'Application incomplete', missing }, { status: 400 })

  const resubmission = app.status === 'info_requested'
  const updated = await prisma.partnerApplication.update({
    where: { id: app.id },
    data: { status: 'submitted', submittedAt: new Date() },
  })
  await audit(session.user.id, resubmission ? 'partner_application.resubmit' : 'partner_application.submit', app.id)

  await emailApplicationReceived(updated, session.user.email)
  await emailAdminsNewApplication(updated)

  return NextResponse.json({ success: true, status: updated.status })
}
