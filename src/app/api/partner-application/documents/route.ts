import { NextResponse } from 'next/server'
import { getSession } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'
import { ALLOWED_DOC_TYPES, MAX_DOC_BYTES, partnerTypeSpec } from '@/lib/partner-requirements'
import { deleteStoredDocument, storeDocument } from '@/lib/partners'

export const maxDuration = 60

// Upload (or replace) one document for the signed-in applicant's own
// application. One file per document kind; uploading again replaces it.
export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Sign in first' }, { status: 401 })

  const app = await prisma.partnerApplication.findUnique({ where: { userId: session.user.id } })
  if (!app) return NextResponse.json({ error: 'Start your application first' }, { status: 404 })
  if (!['draft', 'info_requested', 'rejected'].includes(app.status)) {
    return NextResponse.json({ error: 'This application is under review' }, { status: 409 })
  }

  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  const kind = String(form?.get('kind') ?? '')
  const expiresRaw = String(form?.get('expiresAt') ?? '')
  if (!(file instanceof File)) return NextResponse.json({ error: 'No file received' }, { status: 400 })

  const spec = partnerTypeSpec(app.partnerType)
  const requirement = spec?.docs.find((d) => d.kind === kind)
  if (!requirement) return NextResponse.json({ error: 'Unknown document type' }, { status: 400 })
  if (file.size === 0 || file.size > MAX_DOC_BYTES) return NextResponse.json({ error: 'Files must be under 10MB' }, { status: 400 })
  if (!ALLOWED_DOC_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Upload a PDF or a photo (JPG, PNG, WEBP, HEIC)' }, { status: 400 })
  }

  let expiresAt: Date | null = null
  if (requirement.expires && expiresRaw) {
    const d = new Date(expiresRaw)
    if (Number.isNaN(d.getTime())) return NextResponse.json({ error: 'Invalid expiry date' }, { status: 400 })
    expiresAt = d
  }

  const stored = await storeDocument(app.id, file)
  const previous = await prisma.partnerDocument.findMany({ where: { applicationId: app.id, kind } })
  const doc = await prisma.partnerDocument.create({
    data: {
      applicationId: app.id,
      kind,
      fileName: stored.fileName,
      contentType: file.type,
      size: file.size,
      storage: stored.storage,
      blobPathname: stored.blobPathname,
      data: stored.data ? new Uint8Array(stored.data) : null,
      expiresAt,
    },
    select: { id: true, kind: true, fileName: true, contentType: true, size: true, expiresAt: true, status: true, note: true, createdAt: true },
  })
  for (const p of previous) {
    await deleteStoredDocument(p)
    await prisma.partnerDocument.delete({ where: { id: p.id } })
  }

  return NextResponse.json({ document: doc })
}
