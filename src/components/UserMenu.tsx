'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSession, signOut } from '@/lib/auth-client'

// Replaces Clerk's <UserButton>: initials avatar with a small menu.
// Renders a Sign In link when signed out, nothing while the session loads
// (avoids a flash of "Sign In" for signed-in visitors).
export default function UserMenu({ showStaffLink = true }: { showStaffLink?: boolean }) {
  const { data, isPending } = useSession()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  if (isPending) return <div className="w-8 h-8" aria-hidden />

  if (!data) {
    return (
      <Link
        href="/sign-in"
        className="hidden md:inline-flex text-xs tracking-[0.18em] uppercase text-lux-text-muted hover:text-lux-text transition-colors"
        style={{ fontFamily: 'var(--font-inter)' }}
      >
        Sign In
      </Link>
    )
  }

  const { user } = data
  const initials = user.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('') || user.email[0]?.toUpperCase()
  const isStaff = user.role === 'admin' || user.role === 'partner'

  const item = 'block px-4 py-2.5 text-xs tracking-[0.12em] uppercase text-left w-full hover:bg-white/5 transition-colors'

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Account menu"
        aria-expanded={open}
        className="w-8 h-8 rounded-full flex items-center justify-center text-xs"
        style={{ background: '#5b3a29', color: '#f5f0e8', boxShadow: '0 0 0 1px rgba(201,168,76,0.4)', fontFamily: 'var(--font-inter)' }}
      >
        {initials}
      </button>
      {open && (
        <div
          className="absolute right-0 mt-3 w-60 z-50 py-2"
          style={{ background: '#0f1a10', border: '1px solid #1e2e1f', fontFamily: 'var(--font-inter)', color: '#9a8f7a' }}
        >
          <div className="px-4 pb-3 mb-1" style={{ borderBottom: '1px solid #1e2e1f' }}>
            <p className="text-sm truncate" style={{ color: '#f5f0e8' }}>{user.name}</p>
            <p className="text-xs truncate">{user.email}</p>
          </div>
          <Link href="/dashboard" className={item} onClick={() => setOpen(false)}>Dashboard</Link>
          <Link href="/account" className={item} onClick={() => setOpen(false)}>Account &amp; Security</Link>
          <Link href="/account/notifications" className={item} onClick={() => setOpen(false)}>Email Preferences</Link>
          {isStaff && showStaffLink && (
            <Link href="/admin" className={item} onClick={() => setOpen(false)}>Admin Panel</Link>
          )}
          <button
            type="button"
            className={item}
            onClick={async () => {
              await signOut()
              window.location.href = '/'
            }}
          >
            Sign Out
          </button>
        </div>
      )}
    </div>
  )
}
