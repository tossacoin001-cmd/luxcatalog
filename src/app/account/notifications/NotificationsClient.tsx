'use client'

import { useState } from 'react'
import { toast } from 'sonner'

type Freq = 'daily' | 'weekly' | 'off'
type Prefs = {
  luxEdit: Freq
  partnerDigest: boolean
  adminBriefing: boolean
  instantAlerts: boolean
  marketingConsent: boolean
}

const text = { color: '#9a8f7a', fontFamily: 'var(--font-inter)' }

async function save(patch: Partial<Prefs>) {
  const res = await fetch('/api/account/notifications', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
  if (!res.ok) throw new Error()
}

function Row({ title, body, children }: { title: string; body: string; children: React.ReactNode }) {
  return (
    <div className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-5" style={{ background: '#0f1a10', border: '1px solid #1e2e1f' }}>
      <div className="max-w-md">
        <p className="text-lg mb-1" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>
          {title}
        </p>
        <p className="text-sm leading-relaxed" style={text}>
          {body}
        </p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className="relative inline-flex items-center w-14 h-11"
    >
      <span className="absolute inset-x-0 h-7 rounded-full transition-colors duration-300" style={{ background: on ? '#C9A84C' : '#1e2e1f' }} />
      <span
        className="relative w-5 h-5 rounded-full transition-transform duration-300"
        style={{ background: on ? '#080c08' : '#908673', transform: `translateX(${on ? 30 : 6}px)` }}
      />
    </button>
  )
}

export default function NotificationsClient({ role, initial }: { role: string; initial: Prefs }) {
  const [prefs, setPrefs] = useState(initial)

  async function update(patch: Partial<Prefs>, message: string) {
    const prev = prefs
    setPrefs({ ...prefs, ...patch })
    try {
      await save(patch)
      toast.success(message)
    } catch {
      setPrefs(prev)
      toast.error('Could not save. Please try again.')
    }
  }

  // The Lux Edit is marketing: choosing daily/weekly also records consent.
  const editValue: Freq = prefs.marketingConsent ? prefs.luxEdit : 'off'

  return (
    <div className="space-y-4">
      <Row
        title="The Lux Edit"
        body="Hand-picked new listings in the collections you browse, price drops on what you've saved, and seasonal offers. Only sent when there's something new for you."
      >
        <div className="flex" role="radiogroup" aria-label="Lux Edit frequency" style={{ border: '1px solid rgba(201,168,76,0.3)' }}>
          {(['daily', 'weekly', 'off'] as const).map((f) => (
            <button
              key={f}
              type="button"
              role="radio"
              aria-checked={editValue === f}
              onClick={() =>
                update(
                  f === 'off' ? { luxEdit: 'off' } : { luxEdit: f, marketingConsent: true },
                  f === 'off' ? 'The Lux Edit is paused.' : `You'll get the Lux Edit ${f === 'daily' ? 'daily' : 'weekly'}.`
                )
              }
              className="min-h-11 px-4 text-xs tracking-[0.14em] uppercase transition-colors"
              style={{
                background: editValue === f ? '#C9A84C' : 'transparent',
                color: editValue === f ? '#080c08' : '#9a8f7a',
                fontFamily: 'var(--font-inter)',
              }}
            >
              {f === 'off' ? 'Off' : f}
            </button>
          ))}
        </div>
      </Row>

      <Row title="Instant alerts" body="When something you saved changes price or availability, or a booking you made needs attention.">
        <Toggle on={prefs.instantAlerts} label="Instant alerts" onChange={(v) => update({ instantAlerts: v }, v ? 'Instant alerts on.' : 'Instant alerts off.')} />
      </Row>

      {(role === 'partner' || role === 'admin') && (
        <Row title="Partner performance" body="Views, saves and enquiries on your listings, with tips to win more bookings. Daily when there's activity, weekly otherwise.">
          <Toggle on={prefs.partnerDigest} label="Partner performance emails" onChange={(v) => update({ partnerDigest: v }, v ? 'Partner updates on.' : 'Partner updates off.')} />
        </Row>
      )}

      {role === 'admin' && (
        <Row title="The Lux Briefing" body="Your 7am summary: enquiries, orders, new members, approvals waiting, and the Watchdog's system health report.">
          <Toggle on={prefs.adminBriefing} label="Daily admin briefing" onChange={(v) => update({ adminBriefing: v }, v ? 'Daily briefing on.' : 'Daily briefing off.')} />
        </Row>
      )}
    </div>
  )
}
