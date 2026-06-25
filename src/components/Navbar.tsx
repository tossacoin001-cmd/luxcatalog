'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { Show, UserButton } from '@clerk/nextjs'
import { Menu, X } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

const navLinks = [
  { label: 'Discover', href: '/discover' },
  { label: 'Catalog', href: '/catalog' },
  { label: 'Saved', href: '/saved' },
]

// NEXT_PUBLIC_ vars are inlined at build time — false when keys aren't set
const hasClerk = !!(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)

export default function Navbar() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  return (
    <>
      <header
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-12 h-20"
        style={{
          background: 'linear-gradient(180deg, rgba(8,12,8,0.95) 0%, rgba(8,12,8,0.8) 100%)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(201,168,76,0.1)',
        }}
      >
        {/* Logo */}
        <Link href="/" className="flex-shrink-0">
          <Image
            src="/logo-horizontal.svg"
            alt="Lux Catalog"
            width={200}
            height={46}
            priority
          />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'text-xs font-inter tracking-[0.2em] uppercase transition-colors duration-200',
                pathname === link.href
                  ? 'text-lux-gold'
                  : 'text-lux-text-muted hover:text-lux-text'
              )}
              style={{ fontFamily: 'var(--font-inter)' }}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-4">
          {hasClerk ? (
            <>
              <Show when="signed-out">
                <Link
                  href="/sign-in"
                  className="hidden md:inline-flex text-xs tracking-[0.18em] uppercase text-lux-text-muted hover:text-lux-text transition-colors"
                  style={{ fontFamily: 'var(--font-inter)' }}
                >
                  Sign In
                </Link>
              </Show>
              <Show when="signed-in">
                <UserButton
                  appearance={{
                    elements: { avatarBox: 'w-8 h-8 ring-1 ring-lux-gold-muted' },
                  }}
                />
              </Show>
            </>
          ) : (
            <Link
              href="/sign-in"
              className="hidden md:inline-flex text-xs tracking-[0.18em] uppercase transition-colors"
              style={{ fontFamily: 'var(--font-inter)', color: '#9a8f7a' }}
            >
              Sign In
            </Link>
          )}

          {/* Book a call CTA */}
          <Link
            href="/contact"
            className="hidden md:inline-flex items-center gap-2 px-5 py-2 text-xs tracking-[0.16em] uppercase transition-all duration-300 hover:scale-105"
            style={{
              fontFamily: 'var(--font-inter)',
              border: '1px solid #C9A84C',
              color: '#C9A84C',
              background: 'transparent',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#C9A84C'
              e.currentTarget.style.color = '#080c08'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = '#C9A84C'
            }}
          >
            Book a Call
          </Link>

          {/* Mobile menu button */}
          <button
            className="md:hidden text-lux-text-muted hover:text-lux-gold transition-colors"
            onClick={() => setOpen(!open)}
            aria-label="Toggle menu"
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>

      {/* Mobile drawer */}
      {open && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          onClick={() => setOpen(false)}
        >
          <div className="absolute inset-0" style={{ background: 'rgba(8,12,8,0.6)' }} />
          <nav
            className="absolute top-20 left-0 right-0 px-6 py-8 flex flex-col gap-6"
            style={{ background: '#0f1a10', borderBottom: '1px solid #1e2e1f' }}
            onClick={(e) => e.stopPropagation()}
          >
            {navLinks.map((link) => (
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
            {hasClerk ? (
              <Show when="signed-out">
                <Link
                  href="/sign-in"
                  className="text-sm tracking-[0.2em] uppercase text-lux-text-muted hover:text-lux-gold transition-colors"
                  style={{ fontFamily: 'var(--font-inter)' }}
                  onClick={() => setOpen(false)}
                >
                  Sign In
                </Link>
              </Show>
            ) : (
              <Link
                href="/sign-in"
                className="text-sm tracking-[0.2em] uppercase text-lux-text-muted hover:text-lux-gold transition-colors"
                style={{ fontFamily: 'var(--font-inter)' }}
                onClick={() => setOpen(false)}
              >
                Sign In
              </Link>
            )}
            <Link
              href="/contact"
              className="inline-flex w-fit items-center px-6 py-3 text-xs tracking-[0.18em] uppercase"
              style={{ border: '1px solid #C9A84C', color: '#C9A84C', fontFamily: 'var(--font-inter)' }}
              onClick={() => setOpen(false)}
            >
              Book a Call
            </Link>
          </nav>
        </div>
      )}
    </>
  )
}
