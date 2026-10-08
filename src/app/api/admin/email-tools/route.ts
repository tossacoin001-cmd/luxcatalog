import { NextResponse } from 'next/server'
import { audit, requireAdminApi } from '@/lib/admin-auth'
import { consentInviteCandidates, sendConsentInvites } from '@/lib/notify/consent'

// Admin-only: preview or send the one-time "choose your emails" invite.
export async function POST(req: Request) {
  const admin = await requireAdminApi()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { action } = await req.json().catch(() => ({ action: null }))
  if (action === 'consent_preview') {
    const users = await consentInviteCandidates()
    return NextResponse.json({ recipients: users.map((u) => u.email) })
  }
  if (action === 'consent_send') {
    const results = await sendConsentInvites({ dryRun: false })
    await audit(admin.userId, 'email.consent_invites.send', undefined, { count: Object.keys(results).length })
    return NextResponse.json({ results })
  }
  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
