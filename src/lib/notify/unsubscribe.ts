import { prisma } from '@/lib/prisma'

export const UNSUB_KINDS = {
  lux_edit: { field: 'luxEdit', value: 'off', label: 'The Lux Edit (curated picks)' },
  partner_digest: { field: 'partnerDigest', value: false, label: 'partner performance updates' },
  admin_briefing: { field: 'adminBriefing', value: false, label: 'the daily Lux Briefing' },
} as const

export type UnsubKind = keyof typeof UNSUB_KINDS

export function isUnsubKind(k: string | null | undefined): k is UnsubKind {
  return !!k && k in UNSUB_KINDS
}

export async function findPrefsByToken(token: string | null | undefined) {
  if (!token || token.length > 100) return null
  return prisma.notificationPreference.findUnique({ where: { unsubscribeToken: token } })
}

export async function unsubscribe(token: string, kind: UnsubKind) {
  const prefs = await findPrefsByToken(token)
  if (!prefs) return false
  const { field, value } = UNSUB_KINDS[kind]
  await prisma.notificationPreference.update({ where: { id: prefs.id }, data: { [field]: value } })
  return true
}
