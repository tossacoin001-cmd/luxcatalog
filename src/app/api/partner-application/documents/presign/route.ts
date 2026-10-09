import { NextResponse } from 'next/server'
import { handleUploadPresigned, type HandleUploadPresignedBody } from '@vercel/blob/client'
import { getSession } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'
import { checkDocumentUpload, directUploadAvailable, signDocumentUpload } from '@/lib/partners'

// Signs one browser upload to the private document store. Called by
// uploadPresigned() in the application wizard after POST ../documents
// {action:'start'} handed out the path. Only the signed-in applicant, only
// while their application is editable, only inside their own folder, and
// only for a file that passes the same checks as any other upload.
// Completion is recorded by POST ../documents {action:'complete'}, not by a
// webhook, so nothing is saved until we've inspected the stored file.
export async function POST(req: Request) {
  if (!directUploadAvailable()) return NextResponse.json({ error: 'Direct uploads are not set up' }, { status: 404 })
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Sign in first' }, { status: 401 })
  const app = await prisma.partnerApplication.findUnique({ where: { userId: session.user.id } })
  if (!app || !['draft', 'info_requested', 'rejected'].includes(app.status)) {
    return NextResponse.json({ error: 'This application cannot take uploads' }, { status: 409 })
  }

  const body = (await req.json().catch(() => null)) as HandleUploadPresignedBody | null
  if (body?.type !== 'blob.generate-presigned-url') return NextResponse.json({ error: 'Unsupported' }, { status: 400 })

  try {
    const result = await handleUploadPresigned({
      body,
      request: req,
      webhookPublicKey: process.env.PARTNER_DOCS_WEBHOOK_PUBLIC_KEY ?? 'unused',
      getSignedToken: async (pathname, clientPayload, multipart) => {
        if (!pathname.startsWith(`partner-docs/${app.id}/`) || pathname.includes('..')) throw new Error('Unknown upload path')
        const meta = JSON.parse(clientPayload ?? '{}') as { kind?: string; contentType?: string; size?: number; expiresAt?: string }
        const v = checkDocumentUpload(app.partnerType, String(meta.kind ?? ''), String(meta.contentType ?? ''), Number(meta.size), String(meta.expiresAt ?? ''))
        if (!v.ok) throw new Error(v.error)
        void multipart
        return signDocumentUpload(pathname, String(meta.contentType))
      },
    })
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || 'Could not prepare the upload' }, { status: 400 })
  }
}
