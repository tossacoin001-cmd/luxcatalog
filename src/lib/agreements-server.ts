import { createHash } from 'node:crypto'
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { getAppUrl } from '@/lib/utils'
import { renderEmail } from '@/lib/notify/layout'
import { partnerTypeSpec } from '@/lib/partner-requirements'
import { DEFAULT_COMMISSION, SUBCATEGORIES } from '@/lib/taxonomy'
import {
  COMPANY,
  PAYOUT_TIMING_TEXT,
  agreementByKey,
  renderAgreement,
  requiredAgreements,
  type AgreementContext,
  type CommissionLine,
  type RenderedAgreement,
} from '@/lib/agreements'

const COLLECTION_LABEL: Record<string, string> = Object.fromEntries(
  Object.values(SUBCATEGORIES).flat().map((s) => [s.key, s.label])
)

// The partner's commission, per collection they offer: a rate set for them
// personally wins, then the active platform default, then the code default.
async function commissionFor(userId: string, collections: string[]): Promise<CommissionLine[]> {
  const rules = await prisma.commissionRule.findMany({
    where: { active: true, OR: [{ partnerId: userId }, { partnerId: null }] },
    orderBy: { updatedAt: 'desc' },
  })
  const lines: CommissionLine[] = []
  for (const c of collections) {
    const matches = (r: { subcategory: string | null; mode: string | null }) =>
      c === 'for_sale' ? r.mode === 'sale' && !r.subcategory : r.subcategory === c
    const rule =
      rules.find((r) => r.partnerId === userId && matches(r)) ??
      rules.find((r) => !r.partnerId && matches(r)) ??
      DEFAULT_COMMISSION.find((r) => matches({ subcategory: r.subcategory ?? null, mode: r.mode ?? null }))
    if (!rule) continue
    lines.push({
      collection: COLLECTION_LABEL[c] ?? c,
      ratePercent: Number(rule.ratePercent),
      payout: PAYOUT_TIMING_TEXT[rule.payoutTiming] ?? 'paid out as agreed',
    })
  }
  return lines
}

async function contextFor(userId: string) {
  const [user, app, profile] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true, role: true } }),
    prisma.partnerApplication.findUnique({ where: { userId }, select: { partnerType: true, businessName: true, contactName: true, collections: true } }),
    prisma.partnerProfile.findUnique({ where: { userId }, select: { brandName: true } }),
  ])
  if (!user) return null
  const spec = partnerTypeSpec(app?.partnerType)
  // Commission covers what they applied for, or every collection their type can offer.
  const collections = app?.collections.length ? app.collections : (spec?.collections ?? [])
  const ctx: AgreementContext = {
    partnerName: app?.contactName || user.name,
    businessName: app?.businessName || profile?.brandName || user.name,
    partnerTypeLabel: spec?.label ?? 'Partner',
    commission: await commissionFor(userId, collections),
  }
  return { user, partnerType: app?.partnerType ?? null, ctx }
}

// The fingerprint is the SHA-256 of the exact JSON string we store.
export const serializeAgreement = (r: RenderedAgreement) => JSON.stringify(r)
export const hashAgreement = (r: RenderedAgreement) => createHash('sha256').update(serializeAgreement(r)).digest('hex')

// Everything a partner must sign right now, with what they have signed.
export async function agreementStatus(userId: string) {
  const base = await contextFor(userId)
  if (!base) return null
  const signed = await prisma.partnerAgreement.findMany({
    where: { userId },
    orderBy: { signedAt: 'desc' },
    select: { id: true, agreementKey: true, version: true, title: true, signedName: true, signedAt: true },
  })
  const items = requiredAgreements(base.partnerType).map((t) => {
    const rendered = renderAgreement(t, base.ctx)
    const current = signed.find((s) => s.agreementKey === t.key && s.version === t.version) ?? null
    const previous = current ? null : (signed.find((s) => s.agreementKey === t.key) ?? null)
    return { key: t.key, title: t.title, version: t.version, summary: t.summary, rendered, hash: hashAgreement(rendered), signed: current, previous }
  })
  return { ctx: base.ctx, email: base.user.email, items, allSigned: items.every((i) => !!i.signed), history: signed }
}

// Gate for partner actions (adding listings). Admins are never gated.
export async function partnerMustSign(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } })
  if (user?.role !== 'partner') return false
  const status = await agreementStatus(userId)
  return !!status && !status.allSigned
}

export class AgreementError extends Error {
  constructor(message: string, public status: number) {
    super(message)
  }
}

export async function signAgreement(
  userId: string,
  input: { key: string; hash: string; signedName: string },
  meta: { ipAddress: string | null; userAgent: string | null }
) {
  const status = await agreementStatus(userId)
  if (!status) throw new AgreementError('Sign in first', 401)
  const item = status.items.find((i) => i.key === input.key)
  if (!item) throw new AgreementError('This agreement does not apply to you', 404)
  if (item.signed) return { record: await prisma.partnerAgreement.findUniqueOrThrow({ where: { id: item.signed.id } }), alreadySigned: true }
  // The text must be exactly what the partner was shown.
  if (item.hash !== input.hash) throw new AgreementError('This agreement was just updated. Please read the latest version and sign again.', 409)

  const signedName = input.signedName.trim().replace(/\s+/g, ' ')
  if (signedName.length < 5 || signedName.length > 120 || signedName.split(' ').length < 2) {
    throw new AgreementError('Type your full legal name (first and last name) to sign', 400)
  }

  const record = await prisma.partnerAgreement.create({
    data: {
      userId,
      agreementKey: item.key,
      version: item.version,
      title: item.title,
      content: serializeAgreement(item.rendered),
      contentHash: item.hash,
      signedName,
      signerEmail: status.email,
      businessName: status.ctx.businessName,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent?.slice(0, 300) ?? null,
    },
  })
  await emailSignedCopy(record, userId)
  return { record, alreadySigned: false }
}

type AgreementRecord = {
  id: string
  title: string
  version: string
  content: string
  contentHash: string
  signedName: string
  signerEmail: string
  businessName: string
  ipAddress: string | null
  signedAt: Date
}

async function emailSignedCopy(record: AgreementRecord, userId: string) {
  const subject = `Your signed ${record.title}`
  const { html, text } = renderEmail({
    preheader: 'Your signed copy is attached for your records.',
    eyebrow: 'Partner agreement',
    greeting: `Thank you, ${record.signedName.split(' ')[0]}`,
    intro: `You signed the Lux Catalog ${record.title} (version ${record.version}) for ${record.businessName}. Your signed copy is attached as a PDF.`,
    blocks: [{ type: 'cta', label: 'View your agreements', url: `${getAppUrl()}/partners/agreement` }],
    reason: 'You receive this because you signed a Lux Catalog partner agreement.',
    manageUrl: `${getAppUrl()}/account/notifications`,
  })
  try {
    const pdf = await buildAgreementPdf(record)
    await sendEmail({
      to: record.signerEmail,
      subject,
      text,
      html,
      attachments: [{ filename: pdfFileName(record), content: Buffer.from(pdf), contentType: 'application/pdf' }],
    })
    await prisma.emailLog.create({ data: { userId, to: record.signerEmail, kind: 'partner_agreement_signed', subject, status: 'sent' } })
  } catch (err) {
    console.error('Signed agreement email failed:', err)
    await prisma.emailLog.create({ data: { userId, to: record.signerEmail, kind: 'partner_agreement_signed', subject, status: 'failed', error: String(err).slice(0, 500) } })
  }
}

export const pdfFileName = (r: { title: string; version: string; signedName?: string }) =>
  `LuxCatalog-${r.title.replace(/[^a-zA-Z0-9]+/g, '-')}-v${r.version}${r.signedName ? '-' + r.signedName.replace(/[^a-zA-Z0-9]+/g, '-') : ''}.pdf`.replace(/-+/g, '-')

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------

// The standard PDF fonts only cover Windows-1252; map typographic characters
// to plain ones and drop anything else so a stray emoji can't break a PDF.
function pdfSafe(s: string) {
  return s
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/₦/g, 'NGN ')
    .replace(/[^\x20-\x7E\xA0-\xFF\n]/g, '')
}

const PAGE = { w: 595.28, h: 841.89, margin: 56 }
const GOLD = rgb(0.6, 0.47, 0.17)
const INK = rgb(0.1, 0.09, 0.07)
const MUTED = rgb(0.42, 0.38, 0.3)

// Draft (unsigned) renders, e.g. the lawyer's review copy, omit `signature`.
export async function buildAgreementPdf(
  record: { title: string; version: string; content: string } & Partial<Omit<AgreementRecord, 'title' | 'version' | 'content'>>,
  opts: { draftNote?: string } = {}
) {
  const doc = await PDFDocument.create()
  doc.setTitle(pdfSafe(`${COMPANY.name} ${record.title} v${record.version}`))
  doc.setAuthor(COMPANY.name)
  const regular = await doc.embedFont(StandardFonts.TimesRoman)
  const bold = await doc.embedFont(StandardFonts.TimesRomanBold)
  const sans = await doc.embedFont(StandardFonts.Helvetica)

  let page: PDFPage = doc.addPage([PAGE.w, PAGE.h])
  let y = PAGE.h - PAGE.margin
  const width = PAGE.w - PAGE.margin * 2

  const newPage = () => {
    page = doc.addPage([PAGE.w, PAGE.h])
    y = PAGE.h - PAGE.margin
  }
  const write = (text: string, font: PDFFont, size: number, color = INK, gap = 4, indent = 0) => {
    for (const para of pdfSafe(text).split('\n')) {
      const words = para.split(' ')
      let line = ''
      const lines: string[] = []
      for (const w of words) {
        const next = line ? `${line} ${w}` : w
        if (font.widthOfTextAtSize(next, size) > width - indent && line) {
          lines.push(line)
          line = w
        } else line = next
      }
      lines.push(line)
      for (const l of lines) {
        if (y - size < PAGE.margin) newPage()
        page.drawText(l, { x: PAGE.margin + indent, y: y - size, size, font, color })
        y -= size * 1.35
      }
      y -= gap
    }
  }

  write(COMPANY.name.toUpperCase(), sans, 9, GOLD, 10)
  write(record.title, bold, 20, INK, 4)
  write(`Version ${record.version}`, sans, 9, MUTED, 14)
  if (opts.draftNote) write(opts.draftNote, sans, 9, rgb(0.7, 0.2, 0.15), 14)

  const content = JSON.parse(record.content) as RenderedAgreement
  content.clauses.forEach((c, i) => {
    y -= 4
    write(`${i + 1}. ${c.heading}`, bold, 12, INK, 4)
    for (const p of c.paragraphs) write(p, regular, 11, INK, 6, 14)
  })

  if (record.signedName && record.signedAt) {
    y -= 10
    if (y < PAGE.margin + 150) newPage()
    page.drawLine({ start: { x: PAGE.margin, y }, end: { x: PAGE.w - PAGE.margin, y }, thickness: 0.6, color: GOLD })
    y -= 16
    write('Electronic signature', bold, 12, INK, 6)
    write(`Signed by: ${record.signedName}`, regular, 11)
    write(`For: ${record.businessName ?? ''}`, regular, 11)
    write(`Email: ${record.signerEmail ?? ''}`, regular, 11)
    write(`Date and time: ${record.signedAt.toISOString().replace('T', ' ').slice(0, 19)} UTC`, regular, 11)
    write(`IP address: ${record.ipAddress ?? 'not recorded'}`, regular, 11)
    write(`Record: ${record.id ?? ''}`, sans, 8, MUTED, 2)
    write(`Text fingerprint (SHA-256): ${record.contentHash ?? ''}`, sans, 8, MUTED, 2)
  }

  const pages = doc.getPages()
  pages.forEach((p, i) =>
    p.drawText(pdfSafe(`${COMPANY.name} - ${record.title} v${record.version} - page ${i + 1} of ${pages.length}`), {
      x: PAGE.margin,
      y: 28,
      size: 8,
      font: sans,
      color: MUTED,
    })
  )
  return doc.save()
}

// A clean review copy of a template for the lawyer, with sample details.
export async function buildTemplatePdf(key: string) {
  const t = agreementByKey(key)
  if (!t) return null
  const sample: AgreementContext = {
    partnerName: '[Partner contact name]',
    businessName: '[Partner business name]',
    partnerTypeLabel: t.appliesTo === 'all' ? '[partner type]' : (partnerTypeSpec(t.appliesTo[0])?.label ?? '[partner type]'),
    commission: DEFAULT_COMMISSION.map((r) => ({
      collection: r.subcategory ? (COLLECTION_LABEL[r.subcategory] ?? r.subcategory) : 'Sales',
      ratePercent: r.ratePercent,
      payout: PAYOUT_TIMING_TEXT[r.payoutTiming] ?? 'paid out as agreed',
    })),
  }
  const rendered = renderAgreement(t, sample)
  return buildAgreementPdf(
    { title: t.title, version: t.version, content: serializeAgreement(rendered) },
    { draftNote: t.reviewed ? undefined : 'DRAFT FOR LEGAL REVIEW. Sample partner details and the current default commission rates are shown.' }
  )
}
