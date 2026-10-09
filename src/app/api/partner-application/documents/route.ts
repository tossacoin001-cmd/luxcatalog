import { NextResponse } from 'next/server'
import { getSession } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'
import {
  SERVER_UPLOAD_MAX_BYTES,
  checkDocumentUpload,
  deleteStoredDocument,
  directUploadAvailable,
  inspectStoredDocument,
  newDocPathname,
  safeDocName,
  storeDocument,
} from '@/lib/partners'

export const maxDuration = 60

const err = (error: string, status = 400) => NextResponse.json({ error }, { status })
const docSelect = { id: true, kind: true, fileName: true, contentType: true, size: true, expiresAt: true, status: true, note: true, createdAt: true }

// Upload (or replace) one document for the signed-in applicant's own
// application. One file per document kind; uploading again replaces it.
//
// Two ways in:
// - Direct (private store set up): JSON {action:'start'} returns a path in
//   the applicant's own folder; the browser uploads there through a presigned
//   URL (see ./presign); JSON {action:'complete'} then checks what the store
//   actually holds and records it. Handles files up to 10MB.
// - Multipart form: the file comes through this function. Fallback when the
//   store isn't set up; Vercel limits these requests to about 4.5MB.
export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return err('Sign in first', 401)

  const app = await prisma.partnerApplication.findUnique({ where: { userId: session.user.id } })
  if (!app) return err('Start your application first', 404)
  if (!['draft', 'info_requested', 'rejected'].includes(app.status)) return err('This application is under review', 409)

  async function save(kind: string, fields: { fileName: string; contentType: string; size: number; storage: string; blobPathname: string | null; data: Buffer | null; expiresAt: Date | null }) {
    const previous = await prisma.partnerDocument.findMany({ where: { applicationId: app!.id, kind } })
    const doc = await prisma.partnerDocument.create({
      data: { applicationId: app!.id, kind, ...fields, data: fields.data ? new Uint8Array(fields.data) : null },
      select: docSelect,
    })
    for (const p of previous) {
      await deleteStoredDocument(p)
      await prisma.partnerDocument.delete({ where: { id: p.id } })
    }
    return NextResponse.json({ document: doc })
  }

  if ((req.headers.get('content-type') ?? '').includes('application/json')) {
    const body = await req.json().catch(() => ({}))
    const kind = String(body.kind ?? '')
    const expiresRaw = String(body.expiresAt ?? '')

    if (body.action === 'start') {
      if (!directUploadAvailable()) return NextResponse.json({ direct: false, maxBytes: SERVER_UPLOAD_MAX_BYTES })
      const v = checkDocumentUpload(app.partnerType, kind, String(body.contentType ?? ''), Number(body.size), expiresRaw)
      if (!v.ok) return err(v.error)
      return NextResponse.json({ direct: true, pathname: newDocPathname(app.id, String(body.fileName ?? 'document')) })
    }

    if (body.action === 'complete') {
      const pathname = String(body.pathname ?? '')
      // Only paths in this application's own folder; never someone else's file.
      if (!pathname.startsWith(`partner-docs/${app.id}/`) || pathname.includes('..')) return err('Unknown upload', 404)
      const stored = await inspectStoredDocument(pathname)
      if (!stored) return err('Upload not found. Please try again.', 404)
      const v = checkDocumentUpload(app.partnerType, kind, stored.contentType, stored.size, expiresRaw)
      if (!v.ok) {
        await deleteStoredDocument({ storage: 'blob', blobPathname: pathname })
        return err(v.error)
      }
      if (await prisma.partnerDocument.findFirst({ where: { blobPathname: pathname }, select: { id: true } })) return err('Already saved', 409)
      return save(kind, {
        fileName: safeDocName(pathname.split('/').pop()!.replace(/^[0-9a-f]{16}-/, '')),
        contentType: stored.contentType,
        size: stored.size,
        storage: 'blob',
        blobPathname: pathname,
        data: null,
        expiresAt: v.expiresAt,
      })
    }
    return err('Unknown action')
  }

  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File)) return err('No file received')
  const kind = String(form?.get('kind') ?? '')
  const v = checkDocumentUpload(app.partnerType, kind, file.type, file.size, String(form?.get('expiresAt') ?? ''), SERVER_UPLOAD_MAX_BYTES)
  if (!v.ok) return err(v.error)
  const stored = await storeDocument(app.id, file)
  return save(kind, { ...stored, contentType: file.type, size: file.size, expiresAt: v.expiresAt })
}
