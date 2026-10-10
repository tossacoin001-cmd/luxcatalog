'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { CheckCircle2, Loader2 } from 'lucide-react'

type Account = { bankName: string; accountName: string; account: string }
const text = { color: '#9a8f7a', fontFamily: 'var(--font-inter)' }
const inputCls = 'w-full h-11 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#C9A84C]'
const inputStyle = { background: '#080c08', border: '1px solid #1e2e1f', color: '#f5f0e8', fontFamily: 'var(--font-inter)' }

// Partner bank details. The account holder's name comes from the bank via
// Paystack, so a mistyped number can't send money to someone else.
export default function BankDetailsForm({ initial }: { initial: Account | null }) {
  const [account, setAccount] = useState<Account | null>(initial)
  const [editing, setEditing] = useState(!initial)
  const [banks, setBanks] = useState<{ name: string; code: string }[]>([])
  const [bankCode, setBankCode] = useState('')
  const [number, setNumber] = useState('')
  const [resolved, setResolved] = useState<string | null>(null)
  const [busy, setBusy] = useState<'check' | 'save' | null>(null)

  useEffect(() => {
    if (!editing || banks.length) return
    let cancelled = false
    fetch('/api/partner/payout-account?banks=1')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error())))
      .then((d) => !cancelled && setBanks(d.banks ?? []))
      .catch(() => !cancelled && toast.error('Could not load the list of banks'))
    return () => {
      cancelled = true
    }
  }, [editing, banks.length])

  async function check() {
    setBusy('check')
    setResolved(null)
    try {
      const res = await fetch('/api/partner/payout-account', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ bankCode, accountNumber: number }) })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.error || 'Could not check the account')
      setResolved(d.accountName)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setBusy(null)
    }
  }

  async function save() {
    setBusy('save')
    try {
      const bankName = banks.find((b) => b.code === bankCode)?.name ?? ''
      const res = await fetch('/api/partner/payout-account', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ bankCode, bankName, accountNumber: number }) })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.error || 'Could not save')
      setAccount(d.account)
      setEditing(false)
      setNumber('')
      setResolved(null)
      toast.success('Bank details saved.')
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setBusy(null)
    }
  }

  if (account && !editing) {
    return (
      <div className="p-5 flex flex-wrap items-center justify-between gap-3" style={{ background: '#0f1a10', border: '1px solid rgba(111,191,115,0.35)' }}>
        <div className="flex items-start gap-3">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0" style={{ color: '#6fbf73' }} />
          <div>
            <p className="text-sm" style={{ color: '#f5f0e8', fontFamily: 'var(--font-inter)' }}>
              {account.accountName}
            </p>
            <p className="text-xs" style={text}>
              {account.bankName} · {account.account}
            </p>
          </div>
        </div>
        <button type="button" onClick={() => setEditing(true)} className="min-h-11 px-4 text-[11px] tracking-[0.14em] uppercase" style={{ border: '1px solid #1e2e1f', ...text }}>
          Change
        </button>
      </div>
    )
  }

  return (
    <div className="p-5 space-y-4" style={{ background: '#0f1a10', border: '1px solid #1e2e1f' }}>
      <p className="text-sm" style={text}>
        Where should we pay you? We check the account with your bank before saving.
      </p>
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="block text-xs" style={text}>
          Bank
          <select value={bankCode} onChange={(e) => { setBankCode(e.target.value); setResolved(null) }} className={`${inputCls} mt-1`} style={inputStyle}>
            <option value="">{banks.length ? 'Choose your bank' : 'Loading banks…'}</option>
            {banks.map((b) => (
              <option key={b.code + b.name} value={b.code}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs" style={text}>
          Account number
          <input value={number} onChange={(e) => { setNumber(e.target.value.replace(/\D/g, '').slice(0, 10)); setResolved(null) }} inputMode="numeric" placeholder="10 digits" className={`${inputCls} mt-1`} style={inputStyle} />
        </label>
      </div>
      {resolved && (
        <p className="text-sm p-3" style={{ background: 'rgba(111,191,115,0.08)', color: '#b9e0bb', fontFamily: 'var(--font-inter)' }}>
          Account name: <strong>{resolved}</strong>. Is this you or your business?
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {!resolved ? (
          <button type="button" onClick={check} disabled={!bankCode || number.length !== 10 || !!busy} className="inline-flex items-center gap-2 min-h-11 px-5 text-[11px] tracking-[0.14em] uppercase disabled:opacity-50" style={{ background: '#C9A84C', color: '#080c08', fontFamily: 'var(--font-inter)' }}>
            {busy === 'check' && <Loader2 size={13} className="animate-spin" />} Check account
          </button>
        ) : (
          <button type="button" onClick={save} disabled={!!busy} className="inline-flex items-center gap-2 min-h-11 px-5 text-[11px] tracking-[0.14em] uppercase disabled:opacity-50" style={{ background: '#C9A84C', color: '#080c08', fontFamily: 'var(--font-inter)' }}>
            {busy === 'save' && <Loader2 size={13} className="animate-spin" />} Yes, save these details
          </button>
        )}
        {account && (
          <button type="button" onClick={() => setEditing(false)} className="min-h-11 px-4 text-[11px] tracking-[0.14em] uppercase" style={{ border: '1px solid #1e2e1f', ...text }}>
            Cancel
          </button>
        )}
      </div>
    </div>
  )
}
