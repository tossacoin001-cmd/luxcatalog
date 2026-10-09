import { getSession, isAdmin } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'
import { buildAgreementPdf, pdfFileName } from '@/lib/agreements-server'

// Signed copy as PDF: the signer, or an admin. Built from the stored snapshot,
// so it always shows exactly what was signed.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return new Response('Sign in first', { status: 401 })
  const { id } = await params
  const record = await prisma.partnerAgreement.findUnique({ where: { id } })
  if (!record || (record.userId !== session.user.id && !(await isAdmin(session.user.id)))) {
    return new Response('Not found', { status: 404 })
  }
  const pdf = await buildAgreementPdf(record)
  return new Response(Buffer.from(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${pdfFileName(record)}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
