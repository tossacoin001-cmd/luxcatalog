import Image from 'next/image'
import Link from 'next/link'
import { ArrowUpRight, Plane } from 'lucide-react'
import Reveal, { RevealGroup, RevealItem } from '@/components/motion/Reveal'
import RequestButton from '@/components/concierge/RequestButton'

type Sub = { label: string; href: string }

// The five main pillars, each with the sub-collections customers actually
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
      { label: 'For Sale', href: '/catalog/real-estate?view=for_sale' },
      { label: 'For Rent', href: '/catalog/real-estate?view=for_rent' },
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
      { label: 'For Sale', href: '/catalog/supercars?view=for_sale' },
      { label: 'Private Car Rental', href: '/catalog/supercars?view=car_rental' },
    ],
  },
  {
    title: 'Superyachts',
    tagline: 'Ownership, charters and nights on the water',
    href: '/catalog/yachts',
    image: 'https://images.unsplash.com/photo-1567899378494-47b22a2ae96a?w=1400&q=80',
    alt: 'Superyacht anchored in a turquoise bay',
    subs: [
      { label: 'For Sale', href: '/catalog/yachts?view=for_sale' },
      { label: 'Boat Cruises', href: '/catalog/yachts?view=boat_cruises' },
      { label: 'Aqua Homes', href: '/catalog/yachts?view=aqua_homes' },
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
  {
    title: 'Private Services',
    tagline: 'Five-star service, brought to your door',
    href: '/catalog/private-services',
    image: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1600&q=80',
    alt: 'A plated fine-dining course served at a candlelit table',
    subs: [
      { label: 'Private Dining', href: '/catalog/private-services#dining' },
      { label: 'Wellness', href: '/catalog/private-services#wellness' },
      { label: 'Grooming & Beauty', href: '/catalog/private-services#grooming' },
      { label: 'Home & Hosting', href: '/catalog/private-services#hosting' },
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
    'inline-flex items-center min-h-11 px-4 text-[11px] tracking-[0.16em] uppercase transition-colors duration-300 hover:bg-[#14130f] hover:text-[#f4f0e8]'
  const style = { border: '1px solid #c4bcaa', color: '#14130f', fontFamily: 'var(--font-inter)' }
  return (
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
          <p className="text-xs tracking-[0.3em] uppercase mb-4" style={{ color: '#7a5c24', fontFamily: 'var(--font-inter)' }}>
            The Collections
          </p>
          <h2 className="text-3xl md:text-5xl leading-tight" style={{ fontFamily: 'var(--font-playfair)', color: '#14130f' }}>
            Five pillars of <em style={{ color: '#7a5c24' }}>exceptional</em> living
          </h2>
        </div>
        <p data-pillars-intro className="max-w-sm text-base md:text-lg font-medium leading-relaxed" style={{ color: '#3a362d', fontFamily: 'var(--font-inter)' }}>
          Buy outright, rent by the month or book by the night. Every asset is vetted, every partner verified.
        </p>
      </Reveal>

      <RevealGroup className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
        {pillars.map((p, i) => (
          <RevealItem key={p.title} className={i === 4 ? 'md:col-span-2' : ''}>
            <article className="group">
              <div className={`relative overflow-hidden isolate aspect-[4/3] ${i === 4 ? 'md:aspect-[21/8]' : ''}`}>
                <Image
                  src={p.image}
                  alt={p.alt}
                  fill
                  sizes={i === 4 ? '100vw' : '(max-width: 768px) 100vw, 50vw'}
                  className="object-cover transition-transform duration-[1400ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.03]"
                />
                {/* The whole picture is a link; the chips below have their own targets. */}
                <Link href={p.href} className="absolute inset-0" aria-label={`Explore ${p.title}`} />
              </div>
              <div className="pt-5 pb-2">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <p data-pillar-tagline className="text-sm leading-snug mb-1.5" style={{ color: '#3a362d', fontFamily: 'var(--font-inter)' }}>
                      {p.tagline}
                    </p>
                    <h3 className="text-2xl md:text-3xl" style={{ fontFamily: 'var(--font-playfair)', color: '#14130f' }}>
                      {p.title}
                    </h3>
                  </div>
                  <ArrowUpRight size={20} className="mt-1 flex-shrink-0 transition-transform duration-500 group-hover:translate-x-1 group-hover:-translate-y-1" style={{ color: '#14130f' }} aria-hidden />
                </div>
                <div className="flex flex-wrap gap-2">
                  {p.subs.map((sb) => (
                    <SubChip key={sb.label} sub={sb} />
                  ))}
                </div>
              </div>
            </article>
          </RevealItem>
        ))}
      </RevealGroup>

      <Reveal className="mt-10 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6" delay={0.1}>
        <span className="text-[11px] tracking-[0.24em] uppercase" style={{ color: '#5e584c', fontFamily: 'var(--font-inter)' }}>
          Also in the catalog
        </span>
        <div className="flex flex-wrap gap-2">
          {more.map((m) => (
            <Link
              key={m.href}
              href={m.href}
              className="inline-flex items-center min-h-11 px-4 text-xs tracking-[0.14em] uppercase transition-colors duration-300 hover:text-lux-gold hover:border-lux-gold-muted"
              style={{ border: '1px solid #d6cfbf', color: '#5e584c', fontFamily: 'var(--font-inter)' }}
            >
              {m.label}
            </Link>
          ))}
          <RequestButton
            topic="A private jet charter"
            label="Private jet, on request"
            className="inline-flex items-center gap-2 min-h-11 px-4 text-xs tracking-[0.14em] uppercase transition-colors duration-300 hover:bg-[rgba(122,92,36,0.05)]"
            style={{ border: '1px solid rgba(20,19,15,0.20)', color: '#7a5c24', fontFamily: 'var(--font-inter)' }}
          >
            <Plane size={13} />
            Private Jets &middot; On Request
          </RequestButton>
        </div>
      </Reveal>
    </section>
  )
}
