'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { X, Mail, Copy, Check } from 'lucide-react'
import { AREAS, PRESETS, areaLabel, type Area } from '@/lib/access'

interface Member {
  id: string
  userId?: string
  name: string | null
  email?: string
  role: string
  permissions?: string[]
}

interface Invitation {
  id: string
  email: string
  role: string
  permissions?: string[]
  status: string
}

const inputStyle = {
  background: '#0f1a10',
  border: '1px solid #1e2e1f',
  color: '#f5f0e8',
  fontFamily: 'var(--font-inter)',
}
const muted = { color: '#908673', fontFamily: 'var(--font-inter)' }
const card = { background: '#0f1a10', border: '1px solid #1e2e1f' }

const roleLabel = (role: string) => (role === 'admin' ? 'Admin' : role === 'team' ? 'Team' : role === 'partner' ? 'Partner' : 'Member')

async function api(method: string, body: unknown) {
  const res = await fetch('/api/admin/team', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.')
  return data
}

// Pick the areas a team member can use: one-tap presets, then fine-tune.
function AreaPicker({ value, onChange }: { value: Area[]; onChange: (v: Area[]) => void }) {
  const same = (a: Area[]) => a.length === value.length && a.every((x) => value.includes(x))
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => onChange(p.areas)}
            className="min-h-9 px-3 text-[11px] tracking-[0.12em] uppercase"
            style={{ border: `1px solid ${same(p.areas) ? '#C9A84C' : '#1e2e1f'}`, color: same(p.areas) ? '#e4c878' : '#9a8f7a', fontFamily: 'var(--font-inter)' }}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="grid sm:grid-cols-2 gap-2">
        {AREAS.map((a) => {
          const on = value.includes(a.key)
          return (
            <label key={a.key} className="flex items-start gap-3 p-3 cursor-pointer" style={{ border: `1px solid ${on ? 'rgba(201,168,76,0.45)' : '#1e2e1f'}` }}>
              <input
                type="checkbox"
                checked={on}
                onChange={() => onChange(on ? value.filter((k) => k !== a.key) : [...value, a.key])}
                className="mt-0.5 w-4 h-4 accent-[#C9A84C] shrink-0"
              />
              <span>
                <span className="block text-sm" style={{ color: '#f5f0e8', fontFamily: 'var(--font-inter)' }}>
                  {a.label}
                </span>
                <span className="block text-xs" style={muted}>
                  {a.help}
                </span>
              </span>
            </label>
          )
        })}
      </div>
    </div>
  )
}

function RoleSelect({ value, onChange }: { value: 'admin' | 'team'; onChange: (v: 'admin' | 'team') => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as 'admin' | 'team')} className="h-11 px-4 text-sm focus:outline-none" style={{ ...inputStyle, appearance: 'none' as const }}>
      <option value="team">Team member (only the areas you choose)</option>
      <option value="admin">Admin (full access, manages the team)</option>
    </select>
  )
}

function AreaChips({ areas }: { areas: string[] }) {
  if (!areas.length) return <span className="text-xs" style={{ color: '#e0b75a', fontFamily: 'var(--font-inter)' }}>No access yet</span>
  return (
    <span className="flex flex-wrap gap-1.5">
      {areas.map((a) => (
        <span key={a} className="text-[11px] px-2 py-0.5" style={{ border: '1px solid #1e2e1f', ...muted }}>
          {areaLabel(a)}
        </span>
      ))}
    </span>
  )
}

// Editor for one person's role and areas (members, old partner invites, pending invites).
function AccessEditor({
  initialRole,
  initialAreas,
  saveLabel,
  onSave,
  onCancel,
}: {
  initialRole: 'admin' | 'team'
  initialAreas: Area[]
  saveLabel: string
  onSave: (role: 'admin' | 'team', areas: Area[]) => Promise<void>
  onCancel: () => void
}) {
  const [role, setRole] = useState(initialRole)
  const [areas, setAreas] = useState<Area[]>(initialAreas)
  const [busy, setBusy] = useState(false)
  return (
    <div className="mt-4 pt-4 space-y-4" style={{ borderTop: '1px solid #1e2e1f' }}>
      <RoleSelect value={role} onChange={setRole} />
      {role === 'team' && <AreaPicker value={areas} onChange={setAreas} />}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy || (role === 'team' && areas.length === 0)}
          onClick={async () => {
            setBusy(true)
            try {
              await onSave(role, areas)
            } finally {
              setBusy(false)
            }
          }}
          className="inline-flex items-center gap-2 min-h-11 px-5 text-xs tracking-[0.16em] uppercase disabled:opacity-50"
          style={{ background: '#C9A84C', color: '#080c08', fontFamily: 'var(--font-inter)' }}
        >
          <Check size={13} /> {saveLabel}
        </button>
        <button type="button" onClick={onCancel} className="min-h-11 px-4 text-xs tracking-[0.14em] uppercase" style={{ border: '1px solid #1e2e1f', ...muted }}>
          Cancel
        </button>
      </div>
      {role === 'team' && areas.length === 0 && (
        <p className="text-xs" style={muted}>
          Choose at least one area.
        </p>
      )}
    </div>
  )
}

export default function AdminTeamManager({
  members,
  invitations,
  invitedPartners = [],
  currentUserId,
}: {
  members: Member[]
  invitations: Invitation[]
  invitedPartners?: { id: string; name: string | null; email: string }[]
  currentUserId: string
}) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'admin' | 'team'>('team')
  const [areas, setAreas] = useState<Area[]>([])
  const [lastInvite, setLastInvite] = useState<{ email: string; link: string; emailed: boolean } | null>(null)
  const [inviting, setInviting] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    if (role === 'team' && areas.length === 0) return toast.error('Choose at least one area for this team member.')
    setInviting(true)
    try {
      const data = await api('POST', { email: email.trim(), role, permissions: areas })
      setLastInvite({ email: email.trim(), link: data.link, emailed: data.emailed })
      toast.success(data.emailed ? `Invitation sent to ${email.trim()}.` : 'Invitation created. Copy the link below to share it.')
      setEmail('')
      setAreas([])
      router.refresh()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setInviting(false)
    }
  }

  const resend = async (inv: Invitation, change?: { role: 'admin' | 'team'; areas: Area[] }) => {
    setBusyId(inv.id)
    try {
      const data = await api('POST', { resendId: inv.id, ...(change ? { role: change.role, permissions: change.areas } : {}) })
      setLastInvite({ email: inv.email, link: data.link, emailed: data.emailed })
      toast.success(data.emailed ? `Invitation sent to ${inv.email}. Ask them to check Spam too.` : 'New link created. Copy it below to share.')
      setEditing(null)
      router.refresh()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setBusyId(null)
    }
  }

  const updateAccess = async (userId: string, newRole: 'admin' | 'team', newAreas: Area[]) => {
    try {
      await api('PATCH', { userId, role: newRole, permissions: newAreas })
      toast.success('Access updated.')
      setEditing(null)
      router.refresh()
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  const handleRemove = async (type: 'member' | 'invitation', id: string) => {
    if (!confirm(type === 'member' ? 'Remove this person from the team? They lose all admin access at once.' : 'Revoke this invitation?')) return
    setBusyId(id)
    try {
      await api('DELETE', { type, id })
      toast.success(type === 'member' ? 'Removed from the team.' : 'Invitation revoked.')
      router.refresh()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-10">
      {/* Invite form */}
      <form onSubmit={handleInvite} className="p-6 space-y-4" style={card}>
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-[11px] tracking-[0.15em] uppercase mb-2" style={muted}>
              Invite by email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teammate@example.com"
              required
              className="w-full h-11 px-4 text-sm focus:outline-none"
              style={inputStyle}
            />
          </div>
          <div>
            <label className="block text-[11px] tracking-[0.15em] uppercase mb-2" style={muted}>
              Role
            </label>
            <RoleSelect value={role} onChange={setRole} />
          </div>
        </div>
        {role === 'team' && (
          <div>
            <p className="text-[11px] tracking-[0.15em] uppercase mb-2" style={muted}>
              What they can access
            </p>
            <AreaPicker value={areas} onChange={setAreas} />
          </div>
        )}
        <button
          type="submit"
          disabled={inviting || (role === 'team' && areas.length === 0)}
          className="h-11 px-8 text-xs tracking-[0.18em] uppercase disabled:opacity-60"
          style={{ background: '#C9A84C', color: '#080c08', fontFamily: 'var(--font-inter)' }}
        >
          {inviting ? 'Sending…' : 'Send invite'}
        </button>
      </form>

      {lastInvite && (
        <div className="p-5 space-y-3" style={{ background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.3)' }}>
          <p className="text-sm" style={{ color: '#e8d9b0', fontFamily: 'var(--font-inter)' }}>
            {lastInvite.emailed ? `Emailed to ${lastInvite.email}.` : `Email could not be sent to ${lastInvite.email}.`} You can also share this
            link directly (for example on WhatsApp). It works once, only for that email address, and expires in 7 days.
          </p>
          <div className="flex gap-2">
            <input readOnly value={lastInvite.link} className="flex-1 min-w-0 h-10 px-3 text-xs" style={inputStyle} onFocus={(e) => e.target.select()} />
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(lastInvite.link)
                toast.success('Link copied.')
              }}
              className="h-10 px-4 flex items-center gap-2 text-xs tracking-[0.15em] uppercase"
              style={{ border: '1px solid #C9A84C', color: '#C9A84C', fontFamily: 'var(--font-inter)' }}
            >
              <Copy size={13} /> Copy
            </button>
          </div>
        </div>
      )}

      {/* Old team invites that landed as partners */}
      {invitedPartners.length > 0 && (
        <div>
          <p className="text-[11px] tracking-[0.2em] uppercase mb-2" style={{ color: '#e0b75a', fontFamily: 'var(--font-inter)' }}>
            Invited as partners
          </p>
          <p className="text-sm mb-4" style={muted}>
            These accounts were invited with the old &ldquo;partner&rdquo; option and never applied as a brand. If they work for Lux Catalog, move them
            to the team and choose their access. Until then they are treated as partners.
          </p>
          <div className="space-y-3">
            {invitedPartners.map((p) => (
              <div key={p.id} className="p-4" style={card}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm" style={{ color: '#f5f0e8', fontFamily: 'var(--font-inter)' }}>
                      {p.name || p.email}
                    </p>
                    <p className="text-xs break-all" style={muted}>
                      {p.email}
                    </p>
                  </div>
                  {editing !== p.id && (
                    <button
                      onClick={() => setEditing(p.id)}
                      className="min-h-11 px-4 text-[11px] tracking-[0.14em] uppercase"
                      style={{ border: '1px solid rgba(201,168,76,0.4)', color: '#C9A84C', fontFamily: 'var(--font-inter)' }}
                    >
                      Move to team
                    </button>
                  )}
                </div>
                {editing === p.id && (
                  <AccessEditor initialRole="team" initialAreas={[]} saveLabel="Move to team" onSave={(r, a) => updateAccess(p.id, r, a)} onCancel={() => setEditing(null)} />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Current members */}
      <div>
        <p className="text-[11px] tracking-[0.2em] uppercase mb-4" style={{ color: '#C9A84C', fontFamily: 'var(--font-inter)' }}>
          Team
        </p>
        <div className="space-y-3">
          {members.map((m) => {
            const self = m.userId === currentUserId
            return (
              <div key={m.id} className="p-4" style={card}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1.5">
                    <p className="text-sm" style={{ color: '#f5f0e8', fontFamily: 'var(--font-inter)' }}>
                      {m.name || m.email}
                      {self && <span className="ml-2 text-[11px] uppercase" style={muted}>(You)</span>}
                    </p>
                    <p className="text-xs break-all" style={muted}>
                      {m.email}
                    </p>
                    {m.role === 'team' && <AreaChips areas={m.permissions ?? []} />}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] tracking-[0.15em] uppercase px-2.5 py-1" style={{ border: '1px solid rgba(201,168,76,0.3)', color: '#C9A84C', fontFamily: 'var(--font-inter)' }}>
                      {roleLabel(m.role)}
                    </span>
                    {!self && editing !== m.id && (
                      <button
                        onClick={() => setEditing(m.id)}
                        className="min-h-11 px-3 text-[11px] tracking-[0.14em] uppercase"
                        style={{ color: '#C9A84C', fontFamily: 'var(--font-inter)' }}
                      >
                        Edit access
                      </button>
                    )}
                    {!self && (
                      <button
                        onClick={() => handleRemove('member', m.userId!)}
                        disabled={busyId === m.userId}
                        className="inline-flex items-center justify-center w-11 h-11 transition-colors hover:text-lux-sold disabled:opacity-60"
                        style={{ color: '#908673' }}
                        aria-label={`Remove ${m.name || m.email}`}
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                </div>
                {editing === m.id && (
                  <AccessEditor
                    initialRole={m.role === 'admin' ? 'admin' : 'team'}
                    initialAreas={(m.permissions ?? []) as Area[]}
                    saveLabel="Save access"
                    onSave={(r, a) => updateAccess(m.userId!, r, a)}
                    onCancel={() => setEditing(null)}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Pending invitations */}
      {invitations.length > 0 && (
        <div>
          <p className="text-[11px] tracking-[0.2em] uppercase mb-4" style={{ color: '#C9A84C', fontFamily: 'var(--font-inter)' }}>
            Pending invitations
          </p>
          <div className="space-y-3">
            {invitations.map((inv) => (
              <div key={inv.id} className="p-4" style={card}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1.5">
                    <p className="flex items-center gap-2 text-sm break-all" style={{ color: '#9a8f7a', fontFamily: 'var(--font-inter)' }}>
                      <Mail size={14} className="shrink-0" style={{ color: '#908673' }} /> {inv.email}
                    </p>
                    {inv.role === 'team' && <AreaChips areas={inv.permissions ?? []} />}
                    {inv.role === 'partner' && (
                      <p className="text-xs" style={{ color: '#e0b75a', fontFamily: 'var(--font-inter)' }}>
                        Sent with the old partner option. Change it to a team invite.
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] tracking-[0.15em] uppercase px-2.5 py-1" style={{ border: '1px solid #1e2e1f', ...muted }}>
                      {roleLabel(inv.role)} &middot; Pending
                    </span>
                    {editing !== inv.id && (
                      <button
                        onClick={() => (inv.role === 'partner' ? setEditing(inv.id) : resend(inv))}
                        disabled={busyId === inv.id}
                        className="inline-flex items-center min-h-11 px-3 text-[11px] tracking-[0.14em] uppercase transition-colors hover:text-lux-gold disabled:opacity-60"
                        style={{ color: '#C9A84C', fontFamily: 'var(--font-inter)' }}
                      >
                        {inv.role === 'partner' ? 'Change to team' : 'Resend'}
                      </button>
                    )}
                    {inv.role !== 'partner' && editing !== inv.id && (
                      <button
                        onClick={() => setEditing(inv.id)}
                        className="inline-flex items-center min-h-11 px-3 text-[11px] tracking-[0.14em] uppercase"
                        style={muted}
                      >
                        Edit
                      </button>
                    )}
                    <button
                      onClick={() => handleRemove('invitation', inv.id)}
                      disabled={busyId === inv.id}
                      className="inline-flex items-center justify-center w-11 h-11 transition-colors hover:text-lux-sold disabled:opacity-60"
                      style={{ color: '#908673' }}
                      aria-label={`Revoke invitation for ${inv.email}`}
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
                {editing === inv.id && (
                  <AccessEditor
                    initialRole={inv.role === 'admin' ? 'admin' : 'team'}
                    initialAreas={(inv.permissions ?? []) as Area[]}
                    saveLabel="Save and resend"
                    onSave={(r, a) => resend(inv, { role: r, areas: a })}
                    onCancel={() => setEditing(null)}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
