'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { UserButton } from '@clerk/nextjs'
import { Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'

const adminLinks = [
  { label: 'Dashboard', href: '/admin' },
  { label: 'Listings', href: '/admin/listings' },
  { label: 'Enquiries', href: '/admin/inquiries' },
  { label: 'Orders', href: '/admin/orders' },
  { label: 'Partners', href: '/admin/partners' },
  { label: 'Team', href: '/admin/team' },
]

const vendorLinks = [
  { label: 'Dashboard', href: '/admin' },
  { label: 'My Listings', href: '/admin/listings' },
  { label: 'My Profile', href: '/admin/profile' },
]

// Admin now runs as a separate deployment, so "/" isn't the public site here,
// it's just this app's own root, which middleware bounces back to /admin.
const PUBLIC_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://luxcatalog.vercel.app'

export default function AdminNavbar({ role }: { role?: 'org:admin' | 'org:vendor' | 'org:member' | null }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const links = role === 'org:vendor' ? vendorLinks : adminLinks

  return (
    <>
      <header
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-12 h-20"
        style={{
          background: '#080c08',
          borderBottom: '1px solid rgba(201,168,76,0.15)',
        }}
      >
        <div className="flex items-center gap-10">
          <Link href="/admin" className="flex items-baseline gap-2">
            <span style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8', fontSize: '1.1rem' }}>
              Lux Catalog
            </span>
            <span
              className="text-[10px] tracking-[0.2em] uppercase px-2 py-0.5"
              style={{ border: '1px solid rgba(201,168,76,0.3)', color: '#C9A84C', fontFamily: 'var(--font-inter)' }}
            >
              {role === 'org:vendor' ? 'Partner' : 'Admin'}
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-6">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'text-xs font-inter tracking-[0.15em] uppercase transition-colors duration-200',
                  pathname === link.href ? 'text-lux-gold' : 'text-lux-text-muted hover:text-lux-text'
                )}
                style={{ fontFamily: 'var(--font-inter)' }}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <a
            href={PUBLIC_SITE_URL}
            className="hidden md:inline-flex text-xs tracking-[0.15em] uppercase text-lux-text-muted hover:text-lux-text transition-colors"
            style={{ fontFamily: 'var(--font-inter)' }}
          >
            View Public Site
          </a>
          <UserButton appearance={{ elements: { avatarBox: 'w-8 h-8 ring-1 ring-lux-gold-muted' } }} />
          <button
            className="md:hidden text-lux-text-muted hover:text-lux-gold transition-colors"
            onClick={() => setOpen(!open)}
            aria-label="Toggle menu"
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>

      {open && (
        <div className="fixed inset-0 z-40 md:hidden" onClick={() => setOpen(false)}>
          <div className="absolute inset-0" style={{ background: 'rgba(8,12,8,0.6)' }} />
          <nav
            className="absolute top-20 left-0 right-0 px-6 py-8 flex flex-col gap-6"
            style={{ background: '#0f1a10', borderBottom: '1px solid #1e2e1f' }}
            onClick={(e) => e.stopPropagation()}
          >
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm tracking-[0.2em] uppercase text-lux-text-muted hover:text-lux-gold transition-colors"
                style={{ fontFamily: 'var(--font-inter)' }}
                onClick={() => setOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <a
              href={PUBLIC_SITE_URL}
              className="text-sm tracking-[0.2em] uppercase text-lux-text-muted hover:text-lux-gold transition-colors"
              style={{ fontFamily: 'var(--font-inter)' }}
            >
              View Public Site
            </a>
          </nav>
        </div>
      )}
    </>
  )
}
