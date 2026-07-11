import Link from 'next/link'
import Image from 'next/image'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import CategoryGrid from '@/components/CategoryGrid'
import AssetCard from '@/components/AssetCard'
import { categoryHrefs } from '@/lib/utils'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const [featured, totalListings] = await Promise.all([
    prisma.listing.findMany({
      where: { featured: true },
      orderBy: { createdAt: 'desc' },
      take: 6,
      select: {
        id: true, title: true, slug: true, category: true, location: true, country: true,
        priceDisplay: true, price: true, images: true, status: true, featured: true,
      },
    }),
    prisma.listing.count(),
  ])
  const featuredListings = featured.map((l) => ({ ...l, price: l.price ? Number(l.price) : null }))

  const stats = [
    { value: 'AI', label: 'Powered Matching' },
    { value: '8', label: 'Asset Categories' },
    { value: String(totalListings), label: totalListings === 1 ? 'Listing' : 'Curated Listings' },
    { value: 'Global', label: 'Luxury Network' },
  ]

  return (
    <div style={{ background: '#080c08' }}>
      <Navbar />

      {/* HERO */}
      <section className="relative min-h-screen flex flex-col justify-end overflow-hidden">
        <div className="absolute inset-0">
          <Image
            src="https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1800&q=90"
            alt="Luxury landscape"
            fill
            className="object-cover"
            priority
          />
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(180deg, rgba(8,12,8,0.3) 0%, rgba(8,12,8,0.6) 40%, rgba(8,12,8,0.95) 100%)' }}
          />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-12 pb-20 md:pb-28 pt-36">
          <div className="max-w-3xl">
            <p
              className="text-xs tracking-[0.35em] uppercase mb-6"
              style={{ color: '#C9A84C', fontFamily: 'var(--font-inter)' }}
            >
              The Definitive Luxury Asset Discovery Platform
            </p>

            <h1
              className="text-5xl md:text-7xl leading-[1.05] mb-6"
              style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}
            >
              Every Luxury Asset.
              <br />
              <em style={{ color: '#C9A84C' }}>One Destination.</em>
            </h1>

            <p
              className="text-base md:text-lg mb-10 max-w-xl leading-relaxed"
              style={{ color: '#9a8f7a', fontFamily: 'var(--font-inter)' }}
            >
              Curated luxury assets — discovered, desired, acquired. An AI-powered engine matches you to your perfect asset before you even know you want it.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href="/catalog"
                className="inline-flex items-center justify-center px-8 py-4 text-xs tracking-[0.2em] uppercase transition-all duration-300 hover:opacity-90 active:scale-95"
                style={{ background: '#C9A84C', color: '#080c08', fontFamily: 'var(--font-inter)' }}
              >
                Browse Catalog
              </Link>
              <Link
                href="/discover"
                className="inline-flex items-center justify-center px-8 py-4 text-xs tracking-[0.2em] uppercase transition-all duration-300"
                style={{ border: '1px solid rgba(201,168,76,0.5)', color: '#C9A84C', fontFamily: 'var(--font-inter)' }}
              >
                AI Discovery →
              </Link>
            </div>
          </div>
        </div>

        <div className="absolute bottom-8 right-8 md:right-12 flex flex-col items-center gap-2">
          <span
            className="text-[9px] tracking-[0.25em] uppercase"
            style={{ color: '#5a5248', fontFamily: 'var(--font-inter)', writingMode: 'vertical-rl' }}
          >
            Scroll
          </span>
          <div style={{ width: 1, height: 48, background: 'linear-gradient(180deg, #C9A84C, transparent)' }} />
        </div>
      </section>

      {/* STATS BAR */}
      <div style={{ borderTop: '1px solid rgba(201,168,76,0.12)', borderBottom: '1px solid rgba(201,168,76,0.12)', background: '#0f1a10' }}>
        <div className="max-w-7xl mx-auto px-6 md:px-12 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((s) => (
              <div key={s.value} className="text-center">
                <p className="text-3xl md:text-4xl mb-1" style={{ fontFamily: 'var(--font-playfair)', color: '#C9A84C' }}>
                  {s.value}
                </p>
                <p className="text-[10px] tracking-[0.2em] uppercase" style={{ color: '#5a5248', fontFamily: 'var(--font-inter)' }}>
                  {s.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CATEGORIES */}
      <CategoryGrid />

      {/* FEATURED LISTINGS — cream section */}
      <section style={{ background: '#f8f4ee' }} className="py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
            <div>
              <p className="text-xs tracking-[0.3em] uppercase mb-4" style={{ color: '#8a6f2e', fontFamily: 'var(--font-inter)' }}>
                Featured Collection
              </p>
              <h2 className="text-3xl md:text-4xl" style={{ fontFamily: 'var(--font-playfair)', color: '#1a1208' }}>
                Curated This Season
              </h2>
            </div>
            <Link
              href="/catalog"
              className="text-xs tracking-[0.18em] uppercase flex items-center gap-2 group transition-colors self-start md:self-auto"
              style={{ color: '#8a6f2e', fontFamily: 'var(--font-inter)' }}
            >
              View All Listings <span className="transition-transform group-hover:translate-x-1">→</span>
            </Link>
          </div>

          {featuredListings.length === 0 ? (
            <p className="text-sm" style={{ color: '#8a7f68', fontFamily: 'var(--font-inter)' }}>
              New listings are being added, check back shortly or browse the full catalog above.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {featuredListings.map((asset) => (
                <AssetCard
                  key={asset.id}
                  asset={asset}
                  href={`${categoryHrefs[asset.category] ?? '/catalog'}/${asset.slug}`}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* AI CTA */}
      <section className="relative py-24 md:py-36 overflow-hidden" style={{ background: '#080c08' }}>
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(201,168,76,0.05) 0%, transparent 70%)' }}
        />
        <div className="relative max-w-3xl mx-auto text-center px-6 md:px-12">
          <p className="text-xs tracking-[0.35em] uppercase mb-6" style={{ color: '#C9A84C', fontFamily: 'var(--font-inter)' }}>
            AI-Powered Discovery
          </p>
          <h2 className="text-3xl md:text-5xl leading-tight mb-6" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>
            Your Perfect Asset,
            <br />
            <em style={{ color: '#C9A84C' }}>Found Before You Ask</em>
          </h2>
          <p className="text-base mb-10 max-w-xl mx-auto leading-relaxed" style={{ color: '#9a8f7a', fontFamily: 'var(--font-inter)' }}>
            Our AI engine learns your preferences, lifestyle, and aspirations — then surfaces assets that are precisely right for you.
          </p>

          <div className="flex flex-wrap gap-3 justify-center mb-10">
            {['Preference Analysis', 'Real-Time Matching', 'Personalised Ranking', 'Global Inventory'].map((f) => (
              <span
                key={f}
                className="px-4 py-2 text-[10px] tracking-[0.15em] uppercase"
                style={{ border: '1px solid rgba(201,168,76,0.2)', color: '#8a6f2e', fontFamily: 'var(--font-inter)' }}
              >
                {f}
              </span>
            ))}
          </div>

          <Link
            href="/discover"
            className="inline-flex items-center gap-3 px-10 py-4 text-xs tracking-[0.2em] uppercase transition-all duration-300 hover:opacity-90 active:scale-95"
            style={{ background: '#C9A84C', color: '#080c08', fontFamily: 'var(--font-inter)' }}
          >
            Start AI Discovery
          </Link>
        </div>
      </section>

      {/* BRAND QUOTE */}
      <section style={{ background: '#f8f4ee', borderTop: '1px solid #e5ddd0' }} className="py-16 md:py-20">
        <div className="max-w-4xl mx-auto text-center px-6 md:px-12">
          <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, #8a6f2e, transparent)', marginBottom: '2rem' }} />
          <blockquote className="text-2xl md:text-3xl leading-snug mb-6 italic" style={{ fontFamily: 'var(--font-playfair)', color: '#1a1208' }}>
            &ldquo;Curated luxury assets — discovered, desired, acquired.&rdquo;
          </blockquote>
          <p className="text-[10px] tracking-[0.3em] uppercase" style={{ color: '#8a6f2e', fontFamily: 'var(--font-inter)' }}>
            The Lux Catalog Promise
          </p>
          <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, #8a6f2e, transparent)', marginTop: '2rem' }} />
        </div>
      </section>

      {/* SCOPE FEATURES */}
      <section className="py-20 md:py-24 px-6 md:px-12 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
          <div>
            <p className="text-xs tracking-[0.3em] uppercase mb-4" style={{ color: '#C9A84C', fontFamily: 'var(--font-inter)' }}>
              Platform Scope
            </p>
            <h2 className="text-3xl md:text-4xl mb-6 leading-snug" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>
              Built for Discerning
              <br />Global Buyers
            </h2>
            <p className="text-sm leading-relaxed mb-8" style={{ color: '#9a8f7a', fontFamily: 'var(--font-inter)' }}>
              Lux Catalog is the single destination for discovering and acquiring the world&apos;s finest assets — prime real estate, supercars, superyachts, bespoke interior decor, and everything that defines the luxury lifestyle.
            </p>
            <Link
              href="/contact"
              className="inline-flex items-center px-8 py-4 text-xs tracking-[0.2em] uppercase transition-all duration-300"
              style={{ border: '1px solid #C9A84C', color: '#C9A84C', fontFamily: 'var(--font-inter)' }}
            >
              Book a Consultation
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {[
              'AI-powered matching engine',
              'Prime real estate catalogue',
              'Supercars, yachts & lifestyle',
              'Personalised discovery flow',
              'Commercial real estate',
              'Premium editorial UX design',
            ].map((item) => (
              <div key={item} className="p-5 lux-card">
                <span className="text-lg mb-3 block" style={{ color: '#C9A84C' }}>◈</span>
                <p className="text-sm leading-snug" style={{ color: '#9a8f7a', fontFamily: 'var(--font-inter)' }}>
                  {item}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
