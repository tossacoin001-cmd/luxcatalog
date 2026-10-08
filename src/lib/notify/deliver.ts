import { randomBytes } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { getAppUrl } from '@/lib/utils'
import { renderEmail, type EmailContent } from '@/lib/notify/layout'

export type EmailKind = 'admin_briefing' | 'partner_digest' | 'lux_edit' | 'consent_invite' | 'watchdog_alert'

// The pref column that switches each kind off (null = cannot be switched off,
// e.g. critical Watchdog alerts to admins).
const PREF_FOR: Record<EmailKind, 'adminBriefing' | 'partnerDigest' | 'luxEdit' | null> = {
  admin_briefing: 'adminBriefing',
  partner_digest: 'partnerDigest',
  lux_edit: 'luxEdit',
  consent_invite: null,
  watchdog_alert: null,
}

export function firstName(name: string | null | undefined, email: string): string {
  const first = (name ?? '').trim().split(/\s+/)[0]
  if (first && first.length > 1) return first.charAt(0).toUpperCase() + first.slice(1)
  const local = email.split('@')[0].replace(/[^a-zA-Z]/g, ' ').trim().split(/\s+/)[0]
  return local ? local.charAt(0).toUpperCase() + local.slice(1) : 'there'
}

// Lagos local time drives the greeting; digests go out around 7-8am WAT.
export function greeting(name: string): string {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone: 'Africa/Lagos' }).format(new Date()))
  const part = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  return `${part}, ${name}`
}

export async function getPrefs(userId: string) {
  const existing = await prisma.notificationPreference.findUnique({ where: { userId } })
  if (existing) return existing
  return prisma.notificationPreference.upsert({
    where: { userId },
    create: { userId, unsubscribeToken: randomBytes(24).toString('base64url') },
    update: {},
  })
}

export function manageUrl() {
  return `${getAppUrl()}/account/notifications`
}

// Footer link: a page that asks for confirmation (so link scanners and
// prefetchers can't unsubscribe anyone by visiting it).
export function unsubscribeUrl(token: string, kind: EmailKind) {
  return `${getAppUrl()}/unsubscribe?t=${encodeURIComponent(token)}&k=${kind}`
}

// List-Unsubscribe header target: mail clients' own "Unsubscribe" button
// POSTs here directly (RFC 8058 one-click), no page involved.
export function oneClickUnsubscribeUrl(token: string, kind: EmailKind) {
  return `${getAppUrl()}/api/unsubscribe?t=${encodeURIComponent(token)}&k=${kind}`
}

type Recipient = { id: string; email: string; name: string | null }

// Sends one rendered email to one user, honouring their preferences, adding
// RFC 8058 one-click unsubscribe headers, never sending the same kind twice
// within `minGapHours`, and logging every outcome.
export async function deliver(
  user: Recipient,
  kind: EmailKind,
  subject: string,
  content: Omit<EmailContent, 'manageUrl' | 'unsubscribeUrl'>,
  { minGapHours = 20, dryRun = false }: { minGapHours?: number; dryRun?: boolean } = {}
): Promise<'sent' | 'skipped_pref' | 'skipped_recent' | 'failed' | 'dry_run'> {
  const prefs = await getPrefs(user.id)
  const prefKey = PREF_FOR[kind]
  if (prefKey) {
    const v = prefs[prefKey]
    if (v === false || v === 'off') return 'skipped_pref'
  }

  const since = new Date(Date.now() - minGapHours * 3600_000)
  const recent = await prisma.emailLog.findFirst({ where: { userId: user.id, kind, status: 'sent', createdAt: { gte: since } } })
  if (recent) return 'skipped_recent'

  const unsub = prefKey ? unsubscribeUrl(prefs.unsubscribeToken, kind) : undefined
  const { html, text } = renderEmail({ ...content, manageUrl: manageUrl(), unsubscribeUrl: unsub })

  if (dryRun) return 'dry_run'

  try {
    await sendEmail({
      to: user.email,
      subject,
      text,
      html,
      headers: unsub
        ? { 'List-Unsubscribe': `<${oneClickUnsubscribeUrl(prefs.unsubscribeToken, kind)}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' }
        : undefined,
    })
    await prisma.emailLog.create({ data: { userId: user.id, to: user.email, kind, subject, status: 'sent' } })
    return 'sent'
  } catch (err) {
    await prisma.emailLog.create({
      data: { userId: user.id, to: user.email, kind, subject, status: 'failed', error: String(err).slice(0, 500) },
    })
    return 'failed'
  }
}
