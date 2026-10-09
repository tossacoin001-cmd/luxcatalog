import { randomBytes } from 'node:crypto'
import { get, put, del, head, issueSignedToken } from '@vercel/blob'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { getAppUrl } from '@/lib/utils'
import { renderEmail, type Block } from '@/lib/notify/layout'
import { ALLOWED_DOC_TYPES, MAX_DOC_BYTES, partnerTypeSpec } from '@/lib/partner-requirements'
export { missingForSubmit } from '@/lib/partner-requirements'

// ---------------------------------------------------------------------------
// Private document storage
// ---------------------------------------------------------------------------

// Partner documents live in their own PRIVATE Vercel Blob store (the main
// store is public, for listing photos, and can't hold private files). It is
// connected to the project with the env prefix PARTNER_DOCS: on Vercel the
// SDK authenticates with the project's OIDC identity plus
// PARTNER_DOCS_STORE_ID (a PARTNER_DOCS_READ_WRITE_TOKEN also works). Files
// there have no public URL and are only readable through our own
// authenticated route. Without the store (local dev) documents are kept in
// the database instead, so an applicant's upload never fails.
const DOCS_TOKEN = process.env.PARTNER_DOCS_READ_WRITE_TOKEN
const DOCS_STORE = process.env.PARTNER_DOCS_STORE_ID
const docsStore = () => (DOCS_TOKEN ? { token: DOCS_TOKEN } : { storeId: DOCS_STORE })

// Vercel caps a request to a function at 4.5MB, so server-side uploads must
// stay under that. Larger files go straight from the browser to the private
// store with a presigned URL, which is only possible when the store exists.
export const SERVER_UPLOAD_MAX_BYTES = 4 * 1024 * 1024

export const directUploadAvailable = () => !!(DOCS_TOKEN || DOCS_STORE)

export function safeDocName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(-80) || 'document'
}

export function newDocPathname(applicationId: string, fileName: string) {
  return `partner-docs/${applicationId}/${randomBytes(8).toString('hex')}-${safeDocName(fileName)}`
}

// Every upload path (server, presign, complete) applies the same rules.
export function checkDocumentUpload(
  partnerType: string,
  kind: string,
  contentType: string,
  size: number,
  expiresRaw: string,
  maxBytes = MAX_DOC_BYTES
): { ok: false; error: string } | { ok: true; requirement: { kind: string; label: string }; expiresAt: Date | null } {
  const requirement = partnerTypeSpec(partnerType)?.docs.find((d) => d.kind === kind)
  if (!requirement) return { ok: false, error: 'Unknown document type' }
  if (!ALLOWED_DOC_TYPES.includes(contentType)) return { ok: false, error: 'Upload a PDF or a photo (JPG, PNG, WEBP, HEIC)' }
  if (!size || size > maxBytes) {
    return { ok: false, error: maxBytes < MAX_DOC_BYTES ? 'Files must be under 4MB here. Try a smaller photo or a compressed PDF.' : 'Files must be under 10MB' }
  }
  let expiresAt: Date | null = null
  if (requirement.expires && expiresRaw) {
    const d = new Date(expiresRaw)
    if (Number.isNaN(d.getTime())) return { ok: false, error: 'Invalid expiry date' }
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)
    if (d < today) return { ok: false, error: `This ${requirement.label.toLowerCase()} has expired. Please upload a current one.` }
    expiresAt = d
  }
  return { ok: true, requirement, expiresAt }
}

// A short-lived signed token that can only PUT one file, at one path, of one
// content type and at most MAX_DOC_BYTES, into the private store.
export async function signDocumentUpload(pathname: string, contentType: string) {
  const validUntil = Date.now() + 10 * 60 * 1000
  const token = await issueSignedToken({
    ...docsStore(),
    pathname,
    operations: ['put'],
    allowedContentTypes: [contentType],
    maximumSizeInBytes: MAX_DOC_BYTES,
    validUntil,
  })
  return { token, urlOptions: { allowedContentTypes: [contentType], maximumSizeInBytes: MAX_DOC_BYTES, validUntil, addRandomSuffix: false } }
}

// What the store actually holds at a path (size and type as stored, not as
// the browser claimed), or null if nothing was uploaded there.
export async function inspectStoredDocument(pathname: string) {
  try {
    const h = await head(pathname, docsStore())
    return { size: h.size, contentType: h.contentType }
  } catch {
    return null
  }
}

export async function storeDocument(applicationId: string, file: File) {
  const bytes = Buffer.from(await file.arrayBuffer())
  const fileName = safeDocName(file.name)
  if (directUploadAvailable()) {
    try {
      const pathname = newDocPathname(applicationId, file.name)
      const blob = await put(pathname, bytes, { access: 'private', contentType: file.type, addRandomSuffix: false, ...docsStore() })
      return { storage: 'blob' as const, blobPathname: blob.pathname, data: null as Buffer | null, fileName }
    } catch (err) {
      console.error('Private blob upload failed, storing document in database:', err)
    }
  }
  return { storage: 'db' as const, blobPathname: null as string | null, data: bytes, fileName }
}

export async function readDocument(doc: { storage: string; blobPathname: string | null; data: Uint8Array | null }) {
  if (doc.storage === 'db') return doc.data ? new Uint8Array(doc.data) : null
  if (!doc.blobPathname) return null
  const res = await get(doc.blobPathname, { access: 'private', ...docsStore() })
  return res?.stream ?? null
}

export async function deleteStoredDocument(doc: { storage: string; blobPathname: string | null }) {
  if (doc.storage === 'blob' && doc.blobPathname) {
    try {
      await del(doc.blobPathname, docsStore())
    } catch (err) {
      console.error('Blob delete failed:', err)
    }
  }
}

// ---------------------------------------------------------------------------
// Emails
// ---------------------------------------------------------------------------

async function sendTransactional(
  to: string,
  userId: string | null,
  kind: string,
  subject: string,
  content: { eyebrow: string; greeting: string; intro: string; blocks: Block[]; preheader: string }
) {
  const { html, text } = renderEmail({
    ...content,
    reason: 'You receive this because of your Lux Catalog partner application.',
    manageUrl: `${getAppUrl()}/account/notifications`,
  })
  try {
    await sendEmail({ to, subject, text, html })
    await prisma.emailLog.create({ data: { userId, to, kind, subject, status: 'sent' } })
  } catch (err) {
    console.error(`${kind} email failed:`, err)
    await prisma.emailLog.create({ data: { userId, to, kind, subject, status: 'failed', error: String(err).slice(0, 500) } })
  }
}

const first = (name: string) => name.trim().split(/\s+/)[0] || 'there'

export async function emailApplicationReceived(app: { userId: string; contactName: string; businessName: string; partnerType: string }, email: string) {
  const spec = partnerTypeSpec(app.partnerType)
  await sendTransactional(email, app.userId, 'partner_application_received', `${first(app.contactName)}, we've received your partner application`, {
    preheader: 'Our team reviews every application personally, usually within 2 working days.',
    eyebrow: 'Partner application',
    greeting: `Thank you, ${first(app.contactName)}`,
    intro: `Your application for ${app.businessName} as a ${spec?.label ?? 'partner'} is with our team. We review every partner personally to protect the standard our clients expect.`,
    blocks: [
      { type: 'heading', text: 'What happens next' },
      {
        type: 'bullets',
        items: [
          { text: 'We check your documents and may call you to confirm a few details.' },
          { text: 'You will hear from us within 2 working days: approved, or what else we need.' },
          { text: 'Once approved, you sign the partner agreement and publish your first listing.' },
        ],
      },
      { type: 'cta', label: 'View your application', url: `${getAppUrl()}/partners/apply` },
    ],
  })
}

export async function emailAdminsNewApplication(app: { id: string; businessName: string; partnerType: string; city: string }) {
  const admins = await prisma.user.findMany({ where: { role: 'admin' }, select: { id: true, email: true, name: true } })
  const spec = partnerTypeSpec(app.partnerType)
  for (const a of admins) {
    await sendTransactional(a.email, a.id, 'partner_application_admin', `New partner application: ${app.businessName}`, {
      preheader: `${spec?.label ?? 'Partner'} in ${app.city} is waiting for review.`,
      eyebrow: 'Review queue',
      greeting: `New application, ${first(a.name)}`,
      intro: `${app.businessName} (${spec?.label ?? 'partner'}, ${app.city}) has applied to list on Lux Catalog.`,
      blocks: [{ type: 'cta', label: 'Review application', url: `${getAppUrl()}/admin/applications/${app.id}` }],
    })
  }
}

export async function emailApplicationDecision(
  app: { userId: string; contactName: string; businessName: string },
  email: string,
  decision: 'approved' | 'info_requested' | 'rejected',
  note: string | null
) {
  const name = first(app.contactName)
  const content =
    decision === 'approved'
      ? {
          subject: `Welcome to Lux Catalog, ${name}`,
          eyebrow: 'Application approved',
          greeting: `You're in, ${name}`,
          intro: `${app.businessName} is now a Lux Catalog partner. Set up two-step verification, then add your first listing; our team polishes and publishes it.`,
          blocks: [
            ...(note ? [{ type: 'paragraph' as const, text: note }] : []),
            { type: 'cta' as const, label: 'Open your partner dashboard', url: `${getAppUrl()}/admin` },
          ],
        }
      : decision === 'info_requested'
        ? {
            subject: `${name}, one more thing for your partner application`,
            eyebrow: 'Application update',
            greeting: `Almost there, ${name}`,
            intro: 'We need a little more before we can approve your application:',
            blocks: [
              { type: 'paragraph' as const, text: note ?? 'Please check your application for details.' },
              { type: 'cta' as const, label: 'Update your application', url: `${getAppUrl()}/partners/apply` },
            ],
          }
        : {
            subject: `Your Lux Catalog partner application`,
            eyebrow: 'Application update',
            greeting: `Thank you, ${name}`,
            intro: "After careful review, we can't approve your application at this time.",
            blocks: [
              ...(note ? [{ type: 'paragraph' as const, text: note }] : []),
              { type: 'paragraph' as const, text: 'You are welcome to reapply when circumstances change. Our concierge is happy to talk it through.' },
            ],
          }
  await sendTransactional(email, app.userId, `partner_application_${decision}`, content.subject, {
    preheader: content.intro,
    eyebrow: content.eyebrow,
    greeting: content.greeting,
    intro: content.intro,
    blocks: content.blocks,
  })
}
