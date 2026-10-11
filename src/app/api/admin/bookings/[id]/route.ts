import { NextResponse } from 'next/server'
import { audit, requireStaffApi } from '@/lib/admin-auth'
import { RefundError, cancelByStaff, decideClaim, fileClaim } from '@/lib/refunds-server'
import { BookingError, acceptRequest, declineRequest } from '@/lib/bookings-server'

// Actions on a booking from the admin panel:
// - cancel: partner (own listing), admin, or team with Bookings. Full refund.
// - claim: the listing's partner reports damage after check-out.
// - decide_claim: admin or team with Bookings decides how much to keep.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaffApi()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const handlesBookings = staff.role === 'admin' || (staff.role === 'team' && staff.areas.includes('bookings'))
  const { id } = await params
  const body = await req.json().catch(() => ({}))

  try {
    if (body.action === 'cancel') {
      if (staff.role === 'team' && !handlesBookings) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      const reason = String(body.reason ?? '').trim()
      if (reason.length < 5) return NextResponse.json({ error: 'Give the reason for cancelling (the guest will see it)' }, { status: 400 })
      const refund = await cancelByStaff(id, { userId: staff.userId, role: staff.role }, reason)
      await audit(staff.userId, 'booking.cancel.staff', id, { refund, reason })
      return NextResponse.json({ cancelled: true, refund })
    }
    if (body.action === 'accept' || body.action === 'decline') {
      if (staff.role === 'team' && !handlesBookings) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      if (body.action === 'accept') {
        await acceptRequest(id, staff)
      } else {
        const reason = String(body.reason ?? '').trim()
        if (reason.length < 3) return NextResponse.json({ error: 'Give the guest a short reason' }, { status: 400 })
        await declineRequest(id, staff, reason)
      }
      await audit(staff.userId, `booking.request.${body.action}`, id)
      return NextResponse.json({ ok: true })
    }
    if (body.action === 'claim') {
      if (staff.role !== 'partner') return NextResponse.json({ error: 'Only the listing’s partner can report damage' }, { status: 403 })
      await fileClaim(id, staff.userId, Number(body.amount), String(body.note ?? ''))
      await audit(staff.userId, 'booking.caution.claim', id, { amount: Number(body.amount) })
      return NextResponse.json({ claimed: true })
    }
    if (body.action === 'decide_claim') {
      if (!handlesBookings) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      const result = await decideClaim(id, staff.userId, Number(body.keep))
      await audit(staff.userId, 'booking.caution.decide', id, result)
      return NextResponse.json(result)
    }
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e) {
    if (e instanceof RefundError || e instanceof BookingError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
}
