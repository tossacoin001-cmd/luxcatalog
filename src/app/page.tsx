import Link from 'next/link'
import { ArrowRight, Sparkles } from 'lucide-react'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import AssetCard from '@/components/AssetCard'
import HeroCinematic from '@/components/home/HeroCinematic'
import Pillars from '@/components/home/Pillars'
import SeasonStrip from '@/components/home/SeasonStrip'
import HowItWorks from '@/components/home/HowItWorks'
import Reveal, { RevealGroup, RevealItem } from '@/components/motion/Reveal'
import { categoryHrefs } from '@/lib/utils'
import { prisma } from '@/lib/prisma'

// Cached at the edge and refreshed every 5 minutes, or immediately when an
// admin or partner changes a listing (revalidateCatalog). Visitors get an
// instant page and the database isn't woken for every view.
export const revalidate = 300

export default async function HomePage() {
  const [featured, trustedPartners] = await Promise.all([
    prisma.listing.findMany({
      where: { featured: true, published: true },
      orderBy: { createdAt: 'desc' },
      take: 6,
      select: {
        id: true, title: true, slug: true, category: true, location: true, country: true,
        priceDisplay: true, price: true, images: true, status: true, featured: true,
      },
    }),
    prisma.partnerProfile.findMany({
      where: { featured: true, logo: { not: null } },
      select: { userId: true, brandName: true, logo: true },
    }),
  ])
  const featuredListings = featured.map((l) => ({ ...l, price: l.price ? Number(l.price) : null }))

  return (
    <div style={{ background: '#080c08' }}>
      <Navbar />

      <HeroCinematic />

      <Pillars />

      <SeasonStrip />

      {/* FEATURED: cream gallery. Swipeable rail on phones, grid from tablet up. */}
      <section style={{ background: '#f8f4ee' }} className="py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-5 md:px-12">
          <Reveal className="flex flex-col md:flex-row md:items-end justify-between mb-10 md:mb-12 gap-4">
            <div>
              <p className="text-xs tracking-[0.3em] uppercase mb-4" style={{ color: '#7a5f22', fontFamily: 'var(--font-inter)' }}>
                Featured Collection
              </p>
              <h2 className="text-3xl md:text-5xl" style={{ fontFamily: 'var(--font-playfair)', color: '#1a1208' }}>
                Curated this season
              </h2>
            </div>
            <Link
              href="/catalog"
              className="group inline-flex items-center gap-2 min-h-11 text-xs tracking-[0.18em] uppercase self-start md:self-auto"
              style={{ color: '#7a5f22', fontFamily: 'var(--font-inter)' }}
            >
              View all listings
              <ArrowRight size={14} className="transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
          </Reveal>

          {featuredListings.length === 0 ? (
            <p className="text-sm" style={{ color: '#6b604c', fontFamily: 'var(--font-inter)' }}>
              New listings are being added. Browse the full catalog in the meantime.
            </p>
          ) : (
            <RevealGroup className="-mx-5 px-5 md:mx-0 md:px-0 flex md:grid md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5 overflow-x-auto md:overflow-visible snap-x snap-mandatory no-scrollbar pb-2">
              {featuredListings.map((asset) => (
                <RevealItem key={asset.id} className="snap-start shrink-0 w-[82%] sm:w-[60%] md:w-auto">
                  <AssetCard asset={asset} href={`${categoryHrefs[asset.category] ?? '/catalog'}/${asset.slug}`} />
                </RevealItem>
              ))}
            </RevealGroup>
          )}
          {featuredListings.length > 1 && (
            <p className="md:hidden mt-4 text-[11px] tracking-[0.2em] uppercase" style={{ color: '#7a5f22', fontFamily: 'var(--font-inter)' }}>
              Swipe to see more &rarr;
            </p>
          )}
        </div>
      </section>

      <HowItWorks />

      {/* PARTNER INVITATION */}
      <section className="px-5 md:px-12 pb-20 md:pb-28">
        <Reveal className="max-w-7xl mx-auto relative overflow-hidden p-8 md:p-12 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'linear-gradient(120deg, rgba(201,168,76,0.12), rgba(201,168,76,0.02) 55%, transparent)', border: '1px solid rgba(201,168,76,0.25)' }}
          />
          <div className="relative max-w-2xl">
            <p className="text-xs tracking-[0.3em] uppercase mb-3" style={{ color: '#C9A84C', fontFamily: 'var(--font-inter)' }}>
              For owners, operators and brands
            </p>
            <h2 className="text-2xl md:text-4xl leading-tight mb-3" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>
              Own something exceptional? <em style={{ color: '#C9A84C' }}>List it with us.</em>
            </h2>
            <p className="text-sm md:text-base leading-relaxed" style={{ color: '#9a8f7a', fontFamily: 'var(--font-inter)' }}>
              Shortlets, cars, yachts, chauffeur and protection services, interiors. Verified partners, discerning clients, secure payouts.
            </p>
          </div>
          <Link
            href="/partners"
            className="relative group inline-flex items-center justify-center gap-3 min-h-[52px] px-8 text-xs tracking-[0.2em] uppercase shrink-0"
            style={{ background: '#C9A84C', color: '#080c08', fontFamily: 'var(--font-inter)' }}
          >
            Become a Partner
            <ArrowRight size={14} className="transition-transform duration-300 group-hover:translate-x-1" />
          </Link>
        </Reveal>
      </section>

      {trustedPartners.length > 0 && (
        <section style={{ borderTop: '1px solid rgba(201,168,76,0.12)', background: '#0b120b' }}>
          <div className="max-w-7xl mx-auto px-5 md:px-12 py-12">
            <p className="text-[11px] tracking-[0.3em] uppercase text-center mb-8" style={{ color: '#908673', fontFamily: 'var(--font-inter)' }}>
              Trusted Partners
            </p>
            <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6">
              {trustedPartners.map((p) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={p.userId}
                  src={p.logo!}
                  alt={p.brandName}
                  className="h-8 md:h-10 object-contain opacity-70 hover:opacity-100 transition-opacity"
                  style={{ filter: 'grayscale(1)' }}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* AI DISCOVERY */}
      <section className="relative py-24 md:py-32 overflow-hidden" style={{ background: '#080c08', borderTop: '1px solid rgba(201,168,76,0.08)' }}>
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 55% 55% at 50% 50%, rgba(201,168,76,0.07) 0%, transparent 70%)' }}
        />
        <Reveal className="relative max-w-3xl mx-auto text-center px-5 md:px-12">
          <span
            className="inline-flex items-center justify-center w-12 h-12 rounded-full mb-6"
            style={{ border: '1px solid rgba(201,168,76,0.45)' }}
          >
            <Sparkles size={18} style={{ color: '#C9A84C' }} />
          </span>
          <h2 className="text-3xl md:text-5xl leading-tight mb-5" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>
            Not sure where to start?
            <br />
            <em style={{ color: '#C9A84C' }}>Describe it. We&apos;ll find it.</em>
          </h2>
          <p className="text-base mb-9 max-w-xl mx-auto leading-relaxed" style={{ color: '#9a8f7a', fontFamily: 'var(--font-inter)' }}>
            Tell our AI matchmaker what you want, in your own words. A waterfront stay for six, a weekend convertible, a
            discreet security detail. It surfaces the assets that fit.
          </p>
          <Link
            href="/discover"
            className="group inline-flex items-center justify-center gap-3 min-h-[52px] px-10 text-xs tracking-[0.2em] uppercase transition-colors duration-300 hover:bg-[rgba(201,168,76,0.1)]"
            style={{ border: '1px solid #C9A84C', color: '#C9A84C', fontFamily: 'var(--font-inter)' }}
          >
            Try AI Discovery
            <ArrowRight size={14} className="transition-transform duration-300 group-hover:translate-x-1" />
          </Link>
        </Reveal>
      </section>

      <Footer />
    </div>
  )
}
