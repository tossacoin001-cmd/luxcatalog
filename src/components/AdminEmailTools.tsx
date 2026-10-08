'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Activity, MailPlus } from 'lucide-react'

type Check = { name: string; status: 'ok' | 'warn' | 'fail'; detail: string }
type RunResult = { status: Check['status']; checks: Check[]; emails: { admins: Record<string, string>; partners: Record<string, string> } }

const tone = { ok: '#6fbf73', warn: '#e8a84c', fail: '#e85c4c' }
const text = { color: '#9a8f7a', fontFamily: 'var(--font-inter)' }
const btn = 'inline-flex items-center gap-2 min-h-11 px-5 text-xs tracking-[0.16em] uppercase disabled:opacity-60'

const OUTCOME: Record<string, string> = {
  dry_run: 'would receive it',
  sent: 'sent',
  skipped_pref: 'opted out',
  skipped_recent: 'already sent today',
  skipped_quiet: 'no activity, skipped',
  skipped_no_listings: 'no listings yet, skipped',
  failed: 'failed',
}

export default function AdminEmailTools({ lastRun }: { lastRun: { at: string; status: Check['status'] } | null }) {
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<RunResult | null>(null)
  const [invitees, setInvitees] = useState<string[] | null>(null)
  const [sending, setSending] = useState(false)

  async function preview() {
    setRunning(true)
    try {
      const res = await fetch('/api/cron/daily', { method: 'POST' })
      if (!res.ok) throw new Error()
      setResult(await res.json())
    } catch {
      toast.error('Watchdog run failed. Please try again.')
    } finally {
      setRunning(false)
    }
  }

  async function loadInvitees() {
    const res = await fetch('/api/admin/email-tools', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'consent_preview' }) })
    if (!res.ok) return toast.error('Could not load members.')
    setInvitees((await res.json()).recipients)
  }

  async function sendInvites() {
    if (!invitees?.length || !confirm(`Send the one-time "choose your emails" invite to ${invitees.length} member(s)?`)) return
    setSending(true)
    try {
      const res = await fetch('/api/admin/email-tools', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'consent_send' }) })
      if (!res.ok) throw new Error()
      const { results } = await res.json()
      const sent = Object.values(results).filter((r) => r === 'sent').length
      toast.success(`Invite sent to ${sent} member(s).`)
      setInvitees(null)
    } catch {
      toast.error('Sending failed. Nothing was marked as sent.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="p-6 md:p-8 space-y-6" style={{ background: '#0f1a10', border: '1px solid #1e2e1f' }}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="text-[11px] tracking-[0.2em] uppercase mb-2" style={{ color: '#C9A84C', fontFamily: 'var(--font-inter)' }}>
            Emails &amp; Watchdog
          </p>
          <p className="text-sm" style={text}>
            Daily at 7am Lagos time the Watchdog checks the platform, then sends your Lux Briefing and partner updates.
            {lastRun && (
              <>
                {' '}Last run {new Date(lastRun.at).toLocaleString('en-GB', { timeZone: 'Africa/Lagos', dateStyle: 'medium', timeStyle: 'short' })}:{' '}
                <span style={{ color: tone[lastRun.status] }}>{lastRun.status === 'ok' ? 'all healthy' : lastRun.status === 'warn' ? 'needs a look' : 'problems found'}</span>.
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={preview} disabled={running} className={btn} style={{ background: '#C9A84C', color: '#080c08', fontFamily: 'var(--font-inter)' }}>
            <Activity size={14} /> {running ? 'Checking…' : 'Run Watchdog & preview emails'}
          </button>
          <button type="button" onClick={loadInvitees} className={btn} style={{ border: '1px solid rgba(201,168,76,0.4)', color: '#C9A84C', fontFamily: 'var(--font-inter)' }}>
            <MailPlus size={14} /> Invite members to choose emails
          </button>
        </div>
      </div>

      {result && (
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <p className="text-xs tracking-[0.16em] uppercase mb-3" style={text}>Watchdog</p>
            <ul className="space-y-2">
              {result.checks.map((c) => (
                <li key={c.name} className="flex items-start gap-3 text-sm" style={text}>
                  <span className="mt-1.5 w-2 h-2 shrink-0" style={{ background: tone[c.status] }} />
                  <span>
                    <span style={{ color: '#f5f0e8' }}>{c.name.replace(/_/g, ' ')}</span>: {c.detail}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs tracking-[0.16em] uppercase mb-3" style={text}>Today&apos;s emails (preview, nothing sent)</p>
            <ul className="space-y-2 text-sm" style={text}>
              {Object.entries({ ...result.emails.admins }).map(([email, r]) => (
                <li key={`a-${email}`}>Briefing → {email}: {OUTCOME[r] ?? r}</li>
              ))}
              {Object.entries(result.emails.partners).map(([email, r]) => (
                <li key={`p-${email}`}>Partner update → {email}: {OUTCOME[r] ?? r}</li>
              ))}
              {!Object.keys(result.emails.admins).length && !Object.keys(result.emails.partners).length && <li>No recipients yet.</li>}
            </ul>
          </div>
        </div>
      )}

      {invitees && (
        <div className="space-y-3">
          <p className="text-sm" style={text}>
            {invitees.length
              ? `${invitees.length} member(s) haven't chosen their emails yet: ${invitees.join(', ')}`
              : 'Everyone has already chosen, or already received the invite.'}
          </p>
          {invitees.length > 0 && (
            <button type="button" onClick={sendInvites} disabled={sending} className={btn} style={{ background: '#C9A84C', color: '#080c08', fontFamily: 'var(--font-inter)' }}>
              {sending ? 'Sending…' : `Send invite to ${invitees.length}`}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
