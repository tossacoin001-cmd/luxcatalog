'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import BankDetailsForm from '@/components/booking/BankDetailsForm'

const label = { color: '#5e584c', fontFamily: 'var(--font-inter)' }
const inputStyle = { background: '#fbf9f4', border: '1px solid #d6cfbf', color: '#14130f', fontFamily: 'var(--font-inter)' }

// A team member's own details: name and phone (so a slip made when they joined
// can be fixed without anyone's help) and where they are paid. Everything else
// about the account (role, areas, email) is set by the administrator only.
export default function TeamProfileForm({
  name,
  phone,
  email,
  payout,
}: {
  name: string
  phone: string
  email: string
  payout: { bankName: string; accountName: string; account: string } | null
}) {
  const router = useRouter()
  const [n, setN] = useState(name)
  const [p, setP] = useState(phone)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setSaved(false)
    setError(null)
    try {
      const body: Record<string, string> = {}
      if (n.trim() !== name) body.name = n.trim()
      if (p.trim() && p.trim() !== phone) body.phone = p.trim()
      if (!Object.keys(body).length) {
        setSaved(true)
        return
      }
      const res = await fetch('/api/team/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.error || 'Could not save. Please try again.')
      setSaved(true)
      router.refresh()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-10">
      <section>
        <h2 className="text-xs tracking-[0.2em] uppercase mb-4" style={{ color: '#7a5c24', fontFamily: 'var(--font-inter)' }}>Your details</h2>
        <form data-team-profile onSubmit={save} className="p-5 space-y-4" style={{ background: '#fbf9f4', border: '1px solid #d6cfbf' }}>
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="block text-[11px] tracking-[0.15em] uppercase" style={label}>
              Full name
              <input name="name" value={n} onChange={(e) => setN(e.target.value)} className="mt-2 w-full h-11 px-3 text-sm normal-case tracking-normal" style={inputStyle} autoComplete="name" />
            </label>
            <label className="block text-[11px] tracking-[0.15em] uppercase" style={label}>
              Phone
              <input name="phone" value={p} onChange={(e) => setP(e.target.value)} inputMode="tel" placeholder="0803 123 4567" className="mt-2 w-full h-11 px-3 text-sm normal-case tracking-normal" style={inputStyle} autoComplete="tel" />
            </label>
          </div>
          <label className="block text-[11px] tracking-[0.15em] uppercase" style={label}>
            Email (set by the administrator)
            <input name="email" value={email} readOnly className="mt-2 w-full h-11 px-3 text-sm normal-case tracking-normal" style={{ ...inputStyle, background: '#ece6d9' }} />
          </label>
          <div className="flex flex-wrap items-center gap-4">
            <button type="submit" data-save-profile disabled={busy} className="min-h-11 px-6 text-xs tracking-[0.16em] uppercase disabled:opacity-60" style={{ background: '#14130f', color: '#f4f0e8', fontFamily: 'var(--font-inter)' }}>
              {busy ? 'Saving…' : 'Save'}
            </button>
            {saved && (
              <span data-saved role="status" className="text-sm" style={{ color: '#2f6b45', fontFamily: 'var(--font-inter)' }}>
                Saved.
              </span>
            )}
            {error && (
              <span data-profile-error role="alert" className="text-sm" style={{ color: '#8a3b2e', fontFamily: 'var(--font-inter)' }}>
                {error}
              </span>
            )}
          </div>
          <p className="text-xs" style={label}>
            Your role and the areas you can use are set by the administrator. Anything you change on the platform other than your own details goes through an administrator.
          </p>
        </form>
      </section>

      <section data-payment-method>
        <h2 className="text-xs tracking-[0.2em] uppercase mb-4" style={{ color: '#7a5c24', fontFamily: 'var(--font-inter)' }}>Payment method (bank account)</h2>
        <p className="text-sm mb-4" style={label}>Where any commission or bonus owed to you is paid. The account name comes from your bank, so a wrong number cannot send money to someone else.</p>
        <div className="p-5" style={{ background: '#fbf9f4', border: '1px solid #d6cfbf' }}>
          <BankDetailsForm initial={payout} endpoint="/api/team/payout-account" />
        </div>
      </section>
    </div>
  )
}
