'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { UserButton } from '@clerk/nextjs'
import { cn } from '@/lib/utils'

const adminLinks = [
  { label: 'Dashboard', href: '/admin' },
  { label: 'Listings', href: '/admin/listings' },
  { label: 'Enquiries', href: '/admin/inquiries' },
  { label: 'Orders', href: '/admin/orders' },
  { label: 'Team', href: '/admin/team' },
]

const vendorLinks = [
  { label: 'Dashboard', href: '/admin' },
  { label: 'My Listings', href: '/admin/listings' },
]

// Admin now runs as a separate deployment, so "/" isn't the public site here,
// it's just this app's own root, which middleware bounces back to /admin.
const PUBLIC_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://luxcatalog.vercel.app'

export default function AdminNavbar({ role }: { role?: 'org:admin' | 'org:vendor' | 'org:member' | null }) {
  const pathname = usePathname()
  const links = role === 'org:vendor' ? vendorLinks : adminLinks

  return (
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
      </div>
    </header>
  )
}
