import Link from 'next/link'
import Image from 'next/image'
import { MessageCircle, Phone } from 'lucide-react'
import { whatsappLink, PHONE_LINK, PHONE_DISPLAY } from '@/lib/contact'

const footerLinks = {
  Catalog: [
    { label: 'Real Estate', href: '/catalog/real-estate' },
    { label: 'Shortlets', href: '/catalog/shortlets' },
    { label: 'Supercars', href: '/catalog/supercars' },
    { label: 'Yachts', href: '/catalog/yachts' },
    { label: 'Chauffeur & Security', href: '/catalog/executive-services' },
    { label: 'Interior Decor', href: '/catalog/decor' },
    { label: 'Commercial', href: '/catalog/commercial' },
    { label: 'Lifestyle', href: '/catalog/lifestyle' },
  ],
  Platform: [
    { label: 'Become a Partner', href: '/partners' },
    { label: 'AI Discovery', href: '/discover' },
    { label: 'Saved Assets', href: '/saved' },
    { label: 'Dashboard', href: '/dashboard' },
  ],
  Company: [
    { label: 'About', href: '/about' },
    { label: 'Contact', href: '/contact' },
    { label: 'Privacy Policy', href: '/privacy' },
    { label: 'Terms of Service', href: '/terms' },
  ],
}

export default function Footer() {
  return (
    <footer
      style={{
        background: '#050805',
        borderTop: '1px solid rgba(201,168,76,0.12)',
      }}
    >
      {/* Gold divider line */}
      <div
        style={{
          height: '1px',
          background: 'linear-gradient(90deg, transparent, #C9A84C, transparent)',
          opacity: 0.25,
        }}
      />

      <div className="max-w-7xl mx-auto px-6 md:px-12 py-16 md:py-20">
        {/* Top row */}
        <div className="flex flex-col md:flex-row gap-12 md:gap-0 justify-between">
          {/* Brand */}
          <div className="max-w-xs">
            <Link href="/">
              <Image
                src="/logo-horizontal.svg"
                alt="Lux Catalog"
                width={180}
                height={42}
              />
            </Link>
            <p
              className="mt-5 text-sm leading-relaxed"
              style={{ color: '#908673', fontFamily: 'var(--font-inter)' }}
            >
              The definitive platform for discovering and acquiring the world&apos;s finest luxury assets.
            </p>
            {/* Direct contact */}
            <div className="mt-4 flex flex-col">
              <a
                href={whatsappLink("Hello, I'd like to speak with a Lux Catalog specialist.")}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 min-h-11 text-sm transition-colors hover:text-lux-gold w-fit"
                style={{ color: '#9a8f7a', fontFamily: 'var(--font-inter)' }}
              >
                <MessageCircle size={14} />
                WhatsApp: {PHONE_DISPLAY}
              </a>
              <a
                href={PHONE_LINK}
                className="inline-flex items-center gap-2 min-h-11 text-sm transition-colors hover:text-lux-gold w-fit"
                style={{ color: '#9a8f7a', fontFamily: 'var(--font-inter)' }}
              >
                <Phone size={14} />
                Call: {PHONE_DISPLAY}
              </a>
            </div>
          </div>

          {/* Link columns */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-10 md:gap-16">
            {Object.entries(footerLinks).map(([heading, links]) => (
              <div key={heading}>
                <h4
                  className="text-xs tracking-[0.2em] uppercase mb-5"
                  style={{ color: '#C9A84C', fontFamily: 'var(--font-inter)' }}
                >
                  {heading}
                </h4>
                <ul className="flex flex-col">
                  {links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="inline-flex items-center min-h-11 text-sm transition-colors hover:text-lux-text"
                        style={{ color: '#908673', fontFamily: 'var(--font-inter)' }}
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom bar */}
        <div
          className="mt-14 pt-8 flex flex-col md:flex-row items-center justify-between gap-4"
          style={{ borderTop: '1px solid #1e2e1f' }}
        >
          <p
            className="text-xs tracking-wider"
            style={{ color: '#908673', fontFamily: 'var(--font-inter)' }}
          >
            &copy; {new Date().getFullYear()} Lux Catalog. All rights reserved.
          </p>
          <p
            className="text-xs tracking-wider"
            style={{ color: '#908673', fontFamily: 'var(--font-inter)' }}
          >
            Crafted by{' '}
            <a
              href="https://tossacoin.com"
              className="inline-flex items-center min-h-11 hover:text-lux-gold-muted transition-colors"
              style={{ color: '#908673' }}
            >
              Toss Enterprise
            </a>
          </p>
        </div>
      </div>
    </footer>
  )
}
