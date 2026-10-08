import { prisma } from '@/lib/prisma'
import { getAppUrl } from '@/lib/utils'
import { deliver, firstName, greeting } from '@/lib/notify/deliver'

// One-time invitation for members who joined before email preferences
// existed: asks them to choose what they receive. Sent only to people who
// have not consented yet and never received this invite before.
export async function consentInviteCandidates() {
  const already = await prisma.emailLog.findMany({ where: { kind: 'consent_invite', status: 'sent' }, select: { userId: true } })
  const sentIds = already.map((a) => a.userId).filter((x): x is string => !!x)
  return prisma.user.findMany({
    where: { marketingConsent: false, id: { notIn: sentIds } },
    select: { id: true, email: true, name: true },
  })
}

export async function sendConsentInvites({ dryRun = true } = {}) {
  const users = await consentInviteCandidates()
  const results: Record<string, string> = {}
  for (const u of users) {
    const name = firstName(u.name, u.email)
    results[u.email] = await deliver(
      u,
      'consent_invite',
      `${name}, choose what Lux Catalog sends you`,
      {
        preheader: 'Hand-picked listings and private offers, only when you want them.',
        eyebrow: 'Your email preferences',
        greeting: greeting(name),
        intro:
          "Lux Catalog has grown: a new look, our own secure sign-in, and soon online booking for shortlets, cars, cruises and protection. We'd like to keep you in the loop, but only in the way you prefer.",
        blocks: [
          { type: 'heading', text: 'What you can choose' },
          {
            type: 'bullets',
            items: [
              { text: 'The Lux Edit: hand-picked new listings and private offers, daily or weekly.' },
              { text: 'Instant alerts when something you saved drops in price or becomes available.' },
              { text: 'Or nothing at all. Booking confirmations and security emails still arrive.' },
            ],
          },
          { type: 'cta', label: 'Choose my emails', url: `${getAppUrl()}/account/notifications` },
          {
            type: 'paragraph',
            text: "If you've never signed in since our upgrade, use \"Forgot password\" on the sign-in page to set your new password first.",
          },
        ],
        reason: "You're receiving this once because you have a Lux Catalog account. We won't send marketing unless you opt in.",
      },
      { dryRun, minGapHours: 24 * 365 }
    )
  }
  return results
}
