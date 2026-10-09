import { NextResponse } from 'next/server'
import { audit, getSession, isAdmin } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'
import { readDocument } from '@/lib/partners'

// The only way to open a partner document: the applicant themself, or an
// admin (whose access is written to the audit log). Never cached anywhere.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return new NextResponse('Sign in first', { status: 401 })
  const { id } = await params

  const doc = await prisma.partnerDocument.findUnique({ where: { id }, include: { application: { select: { userId: true } } } })
  if (!doc) return new NextResponse('Not found', { status: 404 })

  const owner = doc.application.userId === session.user.id
  const admin = !owner && (await isAdmin(session.user.id))
  if (!owner && !admin) return new NextResponse('Not found', { status: 404 })
  if (admin) await audit(session.user.id, 'partner_document.view', doc.id, { kind: doc.kind })

  const body = await readDocument(doc)
  if (!body) return new NextResponse('File unavailable', { status: 410 })

  return new NextResponse(body as BodyInit, {
    headers: {
      'Content-Type': doc.contentType,
      'Content-Disposition': `inline; filename="${doc.fileName.replace(/"/g, '')}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      // Lock images down hard; PDFs need the browser's built-in viewer,
      // which a sandboxed CSP would block.
      ...(doc.contentType === 'application/pdf'
        ? {}
        : { 'Content-Security-Policy': "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox" }),
    },
  })
}
