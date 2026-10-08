import { NextResponse } from 'next/server'
import { getSession } from '@/lib/admin-auth'
import { getPrefs } from '@/lib/notify/deliver'
import { prisma } from '@/lib/prisma'

const FREQUENCIES = ['daily', 'weekly', 'off'] as const

export async function PATCH(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Sign in first' }, { status: 401 })
  const userId = session.user.id
  const body = await req.json().catch(() => ({}))

  await getPrefs(userId) // ensure the row exists

  const prefData: Record<string, unknown> = {}
  if (FREQUENCIES.includes(body.luxEdit)) prefData.luxEdit = body.luxEdit
  for (const key of ['partnerDigest', 'adminBriefing', 'instantAlerts'] as const) {
    if (typeof body[key] === 'boolean') prefData[key] = body[key]
  }
  if (Object.keys(prefData).length) {
    await prisma.notificationPreference.update({ where: { userId }, data: prefData })
  }

  // Consent is recorded with a timestamp (NDPA 2023 evidence of opt-in).
  if (typeof body.marketingConsent === 'boolean') {
    await prisma.user.update({
      where: { id: userId },
      data: { marketingConsent: body.marketingConsent, consentAt: body.marketingConsent ? new Date() : null },
    })
  }

  return NextResponse.json({ success: true })
}
