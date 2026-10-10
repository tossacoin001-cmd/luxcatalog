import { NextResponse } from 'next/server'
import { validSignature, type PaystackTransaction } from '@/lib/paystack'
import { applyPayment } from '@/lib/bookings-server'
import { applyRefundEvent } from '@/lib/refunds-server'
import { applyTransferEvent } from '@/lib/payouts-server'

// Paystack calls this after a payment. Only requests signed with our secret
// key are accepted; the signature is Paystack's proof the event is genuine.
// Confirming is idempotent, so retries and the guest's return page can both
// arrive without double-processing.
export async function POST(req: Request) {
  const raw = await req.text()
  if (!validSignature(raw, req.headers.get('x-paystack-signature'))) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }
  let event: { event?: string; data?: PaystackTransaction & { id?: number; transaction_reference?: string; transaction?: { reference?: string } } }
  try {
    event = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: 'Bad payload' }, { status: 400 })
  }
  if (event.event === 'charge.success' && event.data?.reference?.startsWith('LUX-')) {
    try {
      const result = await applyPayment(event.data)
      return NextResponse.json({ received: true, outcome: result.outcome })
    } catch (err) {
      console.error('Webhook processing failed:', err)
      // A 5xx makes Paystack retry later.
      return NextResponse.json({ error: 'Processing failed' }, { status: 500 })
    }
  }
  if (event.event?.startsWith('transfer.')) {
    await applyTransferEvent(event.event, (event.data ?? {}) as { reference?: string; transfer_code?: string; reason?: string })
    return NextResponse.json({ received: true })
  }
  if (event.event === 'refund.processed' || event.event === 'refund.failed') {
    await applyRefundEvent(event.event, event.data ?? {})
    return NextResponse.json({ received: true })
  }
  return NextResponse.json({ received: true })
}
