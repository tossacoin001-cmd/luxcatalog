'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { X, Mail } from 'lucide-react'

interface Member {
  id: string
  userId?: string
  name: string | null
  email?: string
  role: string
  imageUrl?: string
}

interface Invitation {
  id: string
  email: string
  role: string
  status: string
}

const inputStyle = {
  background: '#0f1a10',
  border: '1px solid #1e2e1f',
  color: '#f5f0e8',
  fontFamily: 'var(--font-inter)',
}

const roleLabel = (role: string) =>
  role === 'org:admin' ? 'Admin' : role === 'org:vendor' ? 'Partner' : 'Member'

export default function AdminTeamManager({
  members,
  invitations,
  currentUserId,
}: {
  members: Member[]
  invitations: Invitation[]
  currentUserId: string
}) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'org:admin' | 'org:vendor' | 'org:member'>('org:vendor')
  const [inviting, setInviting] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setInviting(true)
    try {
      const res = await fetch('/api/admin/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), role }),
      })
      if (!res.ok) throw new Error()
      toast.success(`Invitation sent to ${email.trim()}.`)
      setEmail('')
      router.refresh()
    } catch {
      toast.error('Failed to send invitation. Please try again.')
    } finally {
      setInviting(false)
    }
  }

  const handleRemove = async (type: 'member' | 'invitation', id: string) => {
    if (!confirm(type === 'member' ? 'Remove this team member?' : 'Revoke this invitation?')) return
    setRemovingId(id)
    try {
      const res = await fetch('/api/admin/team', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, id }),
      })
      if (!res.ok) throw new Error()
      toast.success(type === 'member' ? 'Team member removed.' : 'Invitation revoked.')
      router.refresh()
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setRemovingId(null)
    }
  }

  return (
    <div className="space-y-10">
      {/* Invite form */}
      <form onSubmit={handleInvite} className="p-6 flex flex-col md:flex-row gap-4 md:items-end" style={{ background: '#0f1a10', border: '1px solid #1e2e1f' }}>
        <div className="flex-1">
          <label className="block text-[10px] tracking-[0.15em] uppercase mb-2" style={{ color: '#5a5248', fontFamily: 'var(--font-inter)' }}>
            Invite by Email
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
          <label className="block text-[10px] tracking-[0.15em] uppercase mb-2" style={{ color: '#5a5248', fontFamily: 'var(--font-inter)' }}>
            Role
          </label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as 'org:admin' | 'org:vendor' | 'org:member')}
            className="h-11 px-4 text-sm focus:outline-none"
            style={{ ...inputStyle, appearance: 'none' as const }}
          >
            <option value="org:vendor">Partner (their own listings only)</option>
            <option value="org:admin">Admin (full access)</option>
            <option value="org:member">Member (read-only)</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={inviting}
          className="h-11 px-8 text-xs tracking-[0.18em] uppercase disabled:opacity-60"
          style={{ background: '#C9A84C', color: '#080c08', fontFamily: 'var(--font-inter)' }}
        >
          {inviting ? 'Sending…' : 'Send Invite'}
        </button>
      </form>

      {/* Current members */}
      <div>
        <p className="text-[10px] tracking-[0.2em] uppercase mb-4" style={{ color: '#C9A84C', fontFamily: 'var(--font-inter)' }}>
          Team Members
        </p>
        <div className="space-y-3">
          {members.map((m) => (
            <div key={m.id} className="flex items-center justify-between p-4" style={{ background: '#0f1a10', border: '1px solid #1e2e1f' }}>
              <div>
                <p className="text-sm" style={{ color: '#f5f0e8', fontFamily: 'var(--font-inter)' }}>
                  {m.name || m.email}
                  {m.userId === currentUserId && (
                    <span className="ml-2 text-[10px] uppercase" style={{ color: '#5a5248' }}>(You)</span>
                  )}
                </p>
                <p className="text-xs" style={{ color: '#5a5248', fontFamily: 'var(--font-inter)' }}>{m.email}</p>
              </div>
              <div className="flex items-center gap-4">
                <span
                  className="text-[10px] tracking-[0.15em] uppercase px-2.5 py-1"
                  style={{ border: '1px solid rgba(201,168,76,0.3)', color: '#C9A84C', fontFamily: 'var(--font-inter)' }}
                >
                  {roleLabel(m.role)}
                </span>
                {m.userId !== currentUserId && (
                  <button
                    onClick={() => handleRemove('member', m.userId!)}
                    disabled={removingId === m.userId}
                    className="p-1.5 transition-colors hover:text-lux-sold disabled:opacity-60"
                    style={{ color: '#5a5248' }}
                    aria-label="Remove member"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pending invitations */}
      {invitations.length > 0 && (
        <div>
          <p className="text-[10px] tracking-[0.2em] uppercase mb-4" style={{ color: '#C9A84C', fontFamily: 'var(--font-inter)' }}>
            Pending Invitations
          </p>
          <div className="space-y-3">
            {invitations.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between p-4" style={{ background: '#0f1a10', border: '1px solid #1e2e1f' }}>
                <div className="flex items-center gap-3">
                  <Mail size={14} style={{ color: '#5a5248' }} />
                  <p className="text-sm" style={{ color: '#9a8f7a', fontFamily: 'var(--font-inter)' }}>{inv.email}</p>
                </div>
                <div className="flex items-center gap-4">
                  <span
                    className="text-[10px] tracking-[0.15em] uppercase px-2.5 py-1"
                    style={{ border: '1px solid #1e2e1f', color: '#5a5248', fontFamily: 'var(--font-inter)' }}
                  >
                    {roleLabel(inv.role)} &middot; Pending
                  </span>
                  <button
                    onClick={() => handleRemove('invitation', inv.id)}
                    disabled={removingId === inv.id}
                    className="p-1.5 transition-colors hover:text-lux-sold disabled:opacity-60"
                    style={{ color: '#5a5248' }}
                    aria-label="Revoke invitation"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
