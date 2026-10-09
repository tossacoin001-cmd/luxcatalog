import { NextResponse } from 'next/server'
import { getSession } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'
import { APPLICANT_APPLICATION_SELECT, PARTNER_TYPES, partnerTypeSpec } from '@/lib/partner-requirements'

const EDITABLE = ['draft', 'info_requested', 'rejected']
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : undefined)


export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Sign in first' }, { status: 401 })
  const app = await prisma.partnerApplication.findUnique({ where: { userId: session.user.id }, select: APPLICANT_APPLICATION_SELECT })
  return NextResponse.json({ application: app })
}

// Autosave: creates the draft on first save, then updates it. Only the
// owner, and only while the application is editable.
export async function PUT(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Sign in first' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const userId = session.user.id

  const existing = await prisma.partnerApplication.findUnique({ where: { userId } })
  if (existing && !EDITABLE.includes(existing.status)) {
    return NextResponse.json({ error: 'This application is being reviewed and can no longer be edited' }, { status: 409 })
  }

  const partnerType = str(body.partnerType, 40) ?? existing?.partnerType
  const spec = partnerTypeSpec(partnerType)
  if (!spec) return NextResponse.json({ error: 'Choose a valid partner type' }, { status: 400 })

  const allowedCollections = new Set(spec.collections)
  const collections = Array.isArray(body.collections)
    ? body.collections.filter((c: unknown): c is string => typeof c === 'string' && allowedCollections.has(c))
    : undefined

  // Declarations: store the time each one was ticked; unticking removes it.
  let declarations: Record<string, string> | undefined
  if (body.declarations && typeof body.declarations === 'object') {
    const prev = (existing?.declarations ?? {}) as Record<string, string>
    declarations = {}
    for (const d of spec.declarations) {
      if (body.declarations[d.key]) declarations[d.key] = prev[d.key] ?? new Date().toISOString()
    }
  }

  const years = Number(body.yearsOperating)
  const data = {
    partnerType: spec.key,
    legalForm: body.legalForm === 'company' ? 'company' : body.legalForm === 'individual' ? 'individual' : undefined,
    businessName: str(body.businessName, 120),
    contactName: str(body.contactName, 120),
    phone: str(body.phone, 30),
    city: str(body.city, 80),
    country: str(body.country, 80),
    website: str(body.website, 200) ?? undefined,
    socialHandle: str(body.socialHandle, 120) ?? undefined,
    cacNumber: str(body.cacNumber, 40) ?? undefined,
    about: str(body.about, 3000),
    yearsOperating: Number.isFinite(years) && years >= 0 && years < 200 ? Math.round(years) : undefined,
    collections,
    declarations,
    // Editing after a rejection starts a fresh draft.
    ...(existing?.status === 'rejected' ? { status: 'draft' as const, reviewNote: null } : {}),
  }
  const clean = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined))

  const application = existing
    ? await prisma.partnerApplication.update({ where: { userId }, data: clean, select: APPLICANT_APPLICATION_SELECT })
    : await prisma.partnerApplication.create({
        data: { userId, partnerType: spec.key, contactName: session.user.name ?? '', ...clean },
        select: APPLICANT_APPLICATION_SELECT,
      })

  return NextResponse.json({ application, types: PARTNER_TYPES.length })
}
