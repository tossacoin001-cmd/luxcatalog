'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import UserMenu from '@/components/UserMenu'
import ConciergeButton from '@/components/ConciergeButton'
import { useSession } from '@/lib/auth-client'
import { Menu, X, ShoppingBag } from 'lucide-react'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { useCurrency } from '@/components/CurrencyProvider'
import { useCart } from '@/components/CartProvider'

const navLinks = [
  { label: 'Discover', href: '/discover' },
  { label: 'Catalog', href: '/catalog' },
  { label: 'Saved', href: '/saved' },
  { label: 'Dashboard', href: '/dashboard' },
]

function CurrencyToggle() {
  const { currency, setCurrency } = useCurrency()
  return (
    <div
      className="hidden md:flex items-center text-[11px] tracking-[0.1em]"
      style={{ fontFamily: 'var(--font-inter)', border: '1px solid rgba(201,168,76,0.25)' }}
    >
      {(['NGN', 'USD'] as const).map((c) => (
        <button
          key={c}
          onClick={() => setCurrency(c)}
          className="px-3 h-9 transition-colors"
          style={{
            background: currency === c ? '#C9A84C' : 'transparent',
            color: currency === c ? '#080c08' : '#9a8f7a',
          }}
        >
          {c}
        </button>
      ))}
    </div>
  )
}

function CartIcon() {
  const { count } = useCart()
  return (
    <Link href="/cart" className="relative flex items-center justify-center w-11 h-11 -mx-2" aria-label="Cart">
      <ShoppingBag size={18} style={{ color: '#9a8f7a' }} />
      {count > 0 && (
        <span
          className="absolute top-1 right-1 flex items-center justify-center min-w-4 h-4 px-1 text-[10px] leading-none rounded-full"
          style={{ background: '#C9A84C', color: '#080c08', fontFamily: 'var(--font-inter)' }}
        >
          {count > 9 ? '9+' : count}
        </span>
      )}
    </Link>
  )
}

function MobileCurrencyToggle() {
  const { currency, setCurrency } = useCurrency()
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs tracking-[0.2em] uppercase" style={{ color: '#908673', fontFamily: 'var(--font-inter)' }}>
        Currency
      </span>
      <div className="flex" style={{ border: '1px solid rgba(201,168,76,0.25)' }}>
        {(['NGN', 'USD'] as const).map((c) => (
          <button
            key={c}
            onClick={() => setCurrency(c)}
            className="px-4 h-11 text-xs tracking-wider transition-colors"
            style={{
              fontFamily: 'var(--font-inter)',
              background: currency === c ? '#C9A84C' : 'transparent',
              color: currency === c ? '#080c08' : '#9a8f7a',
            }}
          >
            {c}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function Navbar() {
  const pathname = usePathname()
  // The drawer remembers which page it was opened on, so navigating
  // anywhere closes it without an effect.
  const [openOn, setOpenOn] = useState<string | null>(null)
  const open = openOn === pathname
  const setOpen = (next: boolean) => setOpenOn(next ? pathname : null)
  const [scrolled, setScrolled] = useState(false)
  const { data: session } = useSession()

  // Airy over the hero, a compact frosted bar once the page moves.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])


  return (
    <>
      <header
        className={cn(
          'fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-5 md:px-12 transition-[height,background-color,box-shadow,border-color] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]',
          scrolled ? 'h-16 md:h-[68px]' : 'h-20'
        )}
        style={{
          background: scrolled ? 'rgba(8,12,8,0.78)' : 'linear-gradient(180deg, rgba(8,12,8,0.75) 0%, rgba(8,12,8,0) 100%)',
          backdropFilter: scrolled ? 'blur(18px) saturate(140%)' : 'none',
          WebkitBackdropFilter: scrolled ? 'blur(18px) saturate(140%)' : 'none',
          borderBottom: `1px solid ${scrolled ? 'rgba(201,168,76,0.14)' : 'transparent'}`,
          // Paint the gradient under the border too; otherwise its dark top edge
          // repeats into the transparent 1px border as a hard line.
          backgroundOrigin: 'border-box',
          boxShadow: scrolled ? '0 10px 40px rgba(0,0,0,0.35)' : 'none',
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
            className={cn('h-auto transition-[width] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]', scrolled ? 'w-[150px] md:w-[170px]' : 'w-[160px] md:w-[200px]')}
          />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'group relative py-3 text-xs font-inter tracking-[0.2em] uppercase transition-colors duration-200',
                pathname === link.href || pathname.startsWith(`${link.href}/`)
                  ? 'text-lux-gold'
                  : 'text-lux-text-muted hover:text-lux-text'
              )}
              style={{ fontFamily: 'var(--font-inter)' }}
            >
              {link.label}
              <span
                aria-hidden
                className={cn(
                  'absolute left-0 right-0 bottom-1.5 h-px origin-left bg-lux-gold transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]',
                  pathname === link.href || pathname.startsWith(`${link.href}/`) ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'
                )}
              />
            </Link>
          ))}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-4">
          <CurrencyToggle />
          <CartIcon />
          <UserMenu />

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
            className="md:hidden flex items-center justify-center w-11 h-11 -mr-2 text-lux-text-muted hover:text-lux-gold transition-colors"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
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
            className={cn("absolute left-0 right-0 px-6 py-8 flex flex-col gap-6 max-h-[calc(100dvh-4rem)] overflow-y-auto", scrolled ? "top-16" : "top-20")}
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
            <MobileCurrencyToggle />
            {!session && (
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
      <ConciergeButton />
    </>
  )
}
