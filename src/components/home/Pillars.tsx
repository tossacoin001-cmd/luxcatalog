import Image from 'next/image'
import Link from 'next/link'
import { ArrowUpRight, Plane } from 'lucide-react'
import Reveal, { RevealGroup, RevealItem } from '@/components/motion/Reveal'
import { whatsappLink } from '@/lib/contact'

type Sub = { label: string; href: string; external?: boolean }

// The four main pillars, each with the sub-collections customers actually
// shop for. Rental/cruise/stay sub-collections route to the concierge until
// online booking ships, so every tap leads somewhere useful today.
const pillars: { title: string; tagline: string; href: string; image: string; alt: string; subs: Sub[] }[] = [
  {
    title: 'Prime Real Estate',
    tagline: 'Residences to own, rent or stay the night',
    href: '/catalog/real-estate',
    image: 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=1400&q=80',
    alt: 'White modern villa with a pool',
    subs: [
      { label: 'For Sale', href: '/catalog/real-estate' },
      { label: 'For Rent', href: whatsappLink("Hello, I'm looking for a luxury property to rent."), external: true },
      { label: 'Luxury Shortlets', href: '/catalog/shortlets' },
    ],
  },
  {
    title: 'Supercars',
    tagline: 'Acquire the icon, or take the keys for a day',
    href: '/catalog/supercars',
    image: 'https://images.unsplash.com/photo-1544636331-e26879cd4d9b?w=1400&q=80',
    alt: 'Supercar in a dark studio',
    subs: [
      { label: 'For Sale', href: '/catalog/supercars' },
      { label: 'Private Car Rental', href: whatsappLink("Hello, I'd like to rent a car, with or without a chauffeur."), external: true },
    ],
  },
  {
    title: 'Superyachts',
    tagline: 'Ownership, charters and nights on the water',
    href: '/catalog/yachts',
    image: 'https://images.unsplash.com/photo-1567899378494-47b22a2ae96a?w=1400&q=80',
    alt: 'Superyacht anchored in a turquoise bay',
    subs: [
      { label: 'For Sale', href: '/catalog/yachts' },
      { label: 'Boat Cruises', href: whatsappLink("Hello, I'd like to book a boat cruise."), external: true },
      { label: 'Aqua Homes', href: whatsappLink("Hello, I'd like to stay at an Aqua Home on the water."), external: true },
    ],
  },
  {
    title: 'Chauffeur & Private Guards',
    tagline: 'Arrive composed. Move protected.',
    href: '/catalog/executive-services',
    image: 'https://images.unsplash.com/photo-1563720223185-11003d516935?w=1400&q=80',
    alt: 'Black Range Rover for chauffeured travel',
    subs: [
      { label: 'Chauffeur', href: '/catalog/executive-services' },
      { label: 'Close Protection', href: '/catalog/executive-services' },
    ],
  },
]

const more = [
  { label: 'Interior Decor', href: '/catalog/decor' },
  { label: 'Commercial', href: '/catalog/commercial' },
  { label: 'Lifestyle', href: '/catalog/lifestyle' },
]

function SubChip({ sub }: { sub: Sub }) {
  const cls =
    'relative z-10 inline-flex items-center min-h-10 px-4 text-[11px] tracking-[0.16em] uppercase transition-colors duration-300 hover:bg-lux-gold hover:text-lux-bg'
  const style = { border: '1px solid rgba(228,200,120,0.45)', color: '#f5f0e8', background: 'rgba(8,12,8,0.45)', backdropFilter: 'blur(8px)', fontFamily: 'var(--font-inter)' }
  return sub.external ? (
    <a href={sub.href} target="_blank" rel="noopener noreferrer" className={cls} style={style}>
      {sub.label}
    </a>
  ) : (
    <Link href={sub.href} className={cls} style={style}>
      {sub.label}
    </Link>
  )
}

export default function Pillars() {
  return (
    <section className="py-20 md:py-32 px-5 md:px-12 max-w-7xl mx-auto">
      <Reveal className="mb-12 md:mb-16 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <p className="text-xs tracking-[0.3em] uppercase mb-4" style={{ color: '#C9A84C', fontFamily: 'var(--font-inter)' }}>
            The Collections
          </p>
          <h2 className="text-3xl md:text-5xl leading-tight" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>
            Four pillars of <em style={{ color: '#C9A84C' }}>exceptional</em> living
          </h2>
        </div>
        <p className="max-w-sm text-sm leading-relaxed" style={{ color: '#9a8f7a', fontFamily: 'var(--font-inter)' }}>
          Buy outright, rent by the month or book by the night. Every asset is vetted, every partner verified.
        </p>
      </Reveal>

      <RevealGroup className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
        {pillars.map((p, i) => (
          <RevealItem key={p.title} className={i === 0 || i === 3 ? 'md:row-span-1' : ''}>
            <article className="group relative overflow-hidden aspect-[4/5] sm:aspect-[16/11] isolate">
              <Image
                src={p.image}
                alt={p.alt}
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover transition-transform duration-[1400ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.06]"
              />
              <div
                className="absolute inset-0"
                style={{ background: 'linear-gradient(180deg, rgba(8,12,8,0.05) 0%, rgba(8,12,8,0.35) 45%, rgba(8,12,8,0.92) 100%)' }}
              />
              <div className="absolute inset-0 ring-1 ring-inset ring-transparent transition-[box-shadow] duration-500 group-hover:ring-[rgba(201,168,76,0.55)]" />
              {/* Whole card is a link; chips sit above it with their own targets. */}
              <Link href={p.href} className="absolute inset-0" aria-label={`Explore ${p.title}`} />

              <div className="absolute inset-x-0 bottom-0 p-6 md:p-8 pointer-events-none">
                <div className="flex items-end justify-between gap-4 mb-5">
                  <div>
                    <p className="text-[11px] tracking-[0.24em] uppercase mb-2" style={{ color: '#e4c878', fontFamily: 'var(--font-inter)' }}>
                      0{i + 1} &middot; {p.tagline}
                    </p>
                    <h3 className="text-2xl md:text-3xl" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>
                      {p.title}
                    </h3>
                  </div>
                  <span
                    className="hidden sm:flex flex-shrink-0 items-center justify-center w-12 h-12 rounded-full transition-all duration-500 group-hover:bg-lux-gold group-hover:rotate-45"
                    style={{ border: '1px solid rgba(201,168,76,0.6)' }}
                  >
                    <ArrowUpRight size={18} className="text-lux-gold transition-colors duration-500 group-hover:text-lux-bg" />
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 pointer-events-auto">
                  {p.subs.map((s) => (
                    <SubChip key={s.label} sub={s} />
                  ))}
                </div>
              </div>
            </article>
          </RevealItem>
        ))}
      </RevealGroup>

      <Reveal className="mt-10 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6" delay={0.1}>
        <span className="text-[11px] tracking-[0.24em] uppercase" style={{ color: '#908673', fontFamily: 'var(--font-inter)' }}>
          Also in the catalog
        </span>
        <div className="flex flex-wrap gap-2">
          {more.map((m) => (
            <Link
              key={m.href}
              href={m.href}
              className="inline-flex items-center min-h-11 px-4 text-xs tracking-[0.14em] uppercase transition-colors duration-300 hover:text-lux-gold hover:border-lux-gold-muted"
              style={{ border: '1px solid #1e2e1f', color: '#9a8f7a', fontFamily: 'var(--font-inter)' }}
            >
              {m.label}
            </Link>
          ))}
          <a
            href={whatsappLink("Hello, I'd like to request a private jet.")}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 min-h-11 px-4 text-xs tracking-[0.14em] uppercase transition-colors duration-300 hover:bg-[rgba(201,168,76,0.08)]"
            style={{ border: '1px solid rgba(201,168,76,0.4)', color: '#C9A84C', fontFamily: 'var(--font-inter)' }}
          >
            <Plane size={13} />
            Private Jets &middot; On Request
          </a>
        </div>
      </Reveal>
    </section>
  )
}
