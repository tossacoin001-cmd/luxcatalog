import { createHash, randomBytes } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { actionEmail, sendEmail } from '@/lib/email'
import { getAppUrl } from '@/lib/utils'
import type { StaffRole } from '@/lib/admin-auth'

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

// Creates an invitation and returns the raw link. The raw token is never
// stored, only its hash, so a database leak can't be turned into staff access.
export async function createStaffInvitation({ email, role, invitedById }: { email: string; role: StaffRole; invitedById: string }) {
  const normalized = email.trim().toLowerCase()

  // One live invitation per email: issuing a new one retires the old link.
  await prisma.staffInvitation.updateMany({
    where: { email: normalized, acceptedAt: null, revokedAt: null },
    data: { revokedAt: new Date() },
  })

  const token = randomBytes(32).toString('base64url')
  const invitation = await prisma.staffInvitation.create({
    data: {
      email: normalized,
      role,
      tokenHash: hashToken(token),
      invitedById,
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
    },
  })

  const link = `${getAppUrl()}/invite?token=${token}`
  const mail = actionEmail({
    heading: role === 'admin' ? 'You have been invited as an admin' : 'You have been invited as a partner',
    body:
      role === 'admin'
        ? 'You have been given full admin access to Lux Catalog. Accept within 7 days to set up your account.'
        : 'You have been invited to list and manage your assets on Lux Catalog. Accept within 7 days to set up your account.',
    actionLabel: 'Accept invitation',
    actionUrl: link,
  })
  let emailed = true
  const subject = 'Your Lux Catalog invitation'
  try {
    await sendEmail({ to: normalized, subject, ...mail })
    await prisma.emailLog.create({ data: { to: normalized, kind: 'staff_invite', subject, status: 'sent' } })
  } catch (err) {
    // The link is still returned to the admin to share directly.
    console.error('Invitation email failed:', err)
    emailed = false
    await prisma.emailLog.create({ data: { to: normalized, kind: 'staff_invite', subject, status: 'failed', error: String(err).slice(0, 500) } })
  }

  return { invitation, link, emailed }
}

export async function findUsableInvitation(token: string) {
  const invitation = await prisma.staffInvitation.findUnique({ where: { tokenHash: hashToken(token) } })
  if (!invitation || invitation.acceptedAt || invitation.revokedAt || invitation.expiresAt < new Date()) return null
  return invitation
}
