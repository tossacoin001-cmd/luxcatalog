import { NextResponse } from 'next/server'
import { audit, requireAreaApi } from '@/lib/admin-auth'
import { RefundError, approveRefund, rejectRefund } from '@/lib/refunds-server'

// Approve (send to Paystack) or reject a refund. Admins and team members
// with Bookings access only; each decision is audited.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireAreaApi('bookings')
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  try {
    if (body.action === 'approve') {
      try {
        await approveRefund(id, staff.userId)
      } catch (e) {
        // Failed attempts are on record too.
        await audit(staff.userId, 'refund.approve_failed', id, { error: (e as Error).message })
        throw e
      }
      await audit(staff.userId, 'refund.approve', id)
      return NextResponse.json({ approved: true })
    }
    if (body.action === 'reject') {
      const reason = String(body.reason ?? '').trim()
      if (reason.length < 5) return NextResponse.json({ error: 'Give a reason for rejecting this refund' }, { status: 400 })
      await rejectRefund(id, staff.userId, reason)
      await audit(staff.userId, 'refund.reject', id, { reason })
      return NextResponse.json({ rejected: true })
    }
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e) {
    if (e instanceof RefundError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
}
