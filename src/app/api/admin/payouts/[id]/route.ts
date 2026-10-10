import { NextResponse } from 'next/server'
import { audit, requireAreaApi } from '@/lib/admin-auth'
import { PayoutError, approvePayout, cancelPayout, markPaidManually } from '@/lib/payouts-server'

// Approve (send by Paystack Transfer) or cancel a partner payout. Admins, or
// team members explicitly given Payouts. Every attempt is audited.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireAreaApi('payouts')
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  try {
    if (body.action === 'approve') {
      try {
        await approvePayout(id, staff.userId)
      } catch (e) {
        await audit(staff.userId, 'payout.approve_failed', id, { error: (e as Error).message })
        throw e
      }
      await audit(staff.userId, 'payout.approve', id)
      return NextResponse.json({ approved: true })
    }
    if (body.action === 'mark_paid') {
      const reference = String(body.reference ?? '').trim()
      if (reference.length < 4) return NextResponse.json({ error: 'Enter the bank transfer reference' }, { status: 400 })
      await markPaidManually(id, staff.userId, reference)
      await audit(staff.userId, 'payout.mark_paid', id, { reference })
      return NextResponse.json({ paid: true })
    }
    if (body.action === 'cancel') {
      const reason = String(body.reason ?? '').trim()
      if (reason.length < 5) return NextResponse.json({ error: 'Give a reason (kept on record)' }, { status: 400 })
      await cancelPayout(id, staff.userId, reason)
      await audit(staff.userId, 'payout.cancel', id, { reason })
      return NextResponse.json({ cancelled: true })
    }
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e) {
    if (e instanceof PayoutError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
}
