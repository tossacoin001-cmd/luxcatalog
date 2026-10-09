import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { audit, getRole, getSession } from '@/lib/admin-auth'
import { AgreementError, signAgreement } from '@/lib/agreements-server'

// Sign one partner agreement. The client sends the fingerprint of the text it
// displayed; we only record a signature if it matches the current text.
export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Sign in first' }, { status: 401 })
  if ((await getRole(session.user.id)) !== 'partner') {
    return NextResponse.json({ error: 'Only approved partners sign partner agreements' }, { status: 403 })
  }
  const body = await req.json().catch(() => ({}))
  if (body.agree !== true) return NextResponse.json({ error: 'Tick the box to confirm you have read and agree' }, { status: 400 })

  const h = await headers()
  try {
    const { record, alreadySigned } = await signAgreement(
      session.user.id,
      { key: String(body.key ?? ''), hash: String(body.hash ?? ''), signedName: String(body.signedName ?? '') },
      { ipAddress: h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null, userAgent: h.get('user-agent') }
    )
    if (!alreadySigned) await audit(session.user.id, 'partner_agreement.sign', record.id, { key: record.agreementKey, version: record.version })
    return NextResponse.json({ signed: { id: record.id, signedAt: record.signedAt, signedName: record.signedName } })
  } catch (e) {
    if (e instanceof AgreementError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
}
