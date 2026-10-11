'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

// Pay (or resume paying) for a booking awaiting payment.
export default function PayNow({ reference, label }: { reference: string; label: string }) {
  const [busy, setBusy] = useState(false)
  async function pay() {
    setBusy(true)
    try {
      const res = await fetch(`/api/bookings/${reference}/pay`, { method: 'POST' })
      const d = await res.json().catch(() => ({}))
      if (!res.ok || !d.url) throw new Error(d.error || 'Could not start the payment. Please try again.')
      window.location.assign(d.url)
    } catch (err) {
      toast.error((err as Error).message)
      setBusy(false)
    }
  }
  return (
    <button
      type="button"
      onClick={pay}
      disabled={busy}
      className="sheen inline-flex items-center justify-center gap-2 min-h-12 px-8 w-full sm:w-auto text-xs tracking-[0.18em] uppercase disabled:opacity-50"
      style={{ background: '#C9A84C', color: '#080c08', fontFamily: 'var(--font-inter)' }}
    >
      {busy && <Loader2 size={14} className="animate-spin" />} {label}
    </button>
  )
}
