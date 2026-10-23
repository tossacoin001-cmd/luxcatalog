import Link from 'next/link'
import { MessageCircle } from 'lucide-react'
import AssetCard from '@/components/AssetCard'
import RequestButton from '@/components/concierge/RequestButton'
import { SERVICE_GROUPS, SUBCATEGORIES, plainService } from '@/lib/taxonomy'

type Card = {
  id: string; title: string; slug: string; category: string; subcategory: string | null; location: string; country: string
  priceDisplay: string; price: number | null; images: string[]; status: string; featured: boolean
}

const gold = { color: '#7a5c24', fontFamily: 'var(--font-inter)' }
const text = { color: '#5e584c', fontFamily: 'var(--font-inter)' }

// The Private Services catalogue: four groups, every service shown even
// before it has providers (the concierge arranges those), so the page sells
// the full offer from day one.
export default function ServicesCatalog({ listings }: { listings: Card[] }) {
  const services = SUBCATEGORIES.private_services
  return (
    <>
      <nav aria-label="Service groups" className="max-w-7xl mx-auto px-5 md:px-12 pt-8 flex flex-wrap gap-2">
        {SERVICE_GROUPS.map((g) => (
          <a
            key={g.key}
            href={`#${g.key}`}
            className="inline-flex items-center min-h-11 px-4 text-[11px] tracking-[0.16em] uppercase transition-colors hover:bg-[rgba(122,92,36,0.05)]"
            style={{ border: '1px solid rgba(20,19,15,0.23)', ...gold }}
          >
            {plainService(g.label)}
          </a>
        ))}
      </nav>

      <div className="max-w-7xl mx-auto px-5 md:px-12 py-10 space-y-16">
        {SERVICE_GROUPS.map((g) => (
          <section key={g.key} id={g.key} style={{ scrollMarginTop: '6rem' }}>
            <p className="text-xs tracking-[0.3em] uppercase mb-2" style={gold}>
              {plainService(g.label)}
            </p>
            <h2 className="text-2xl md:text-3xl mb-8" style={{ fontFamily: 'var(--font-playfair)', color: '#14130f' }}>
              {g.tagline}
            </h2>
            <div className="space-y-10">
              {services
                .filter((s) => s.group === g.key)
                .map((s) => {
                  const offers = listings.filter((l) => l.subcategory === s.key)
                  return (
                    <div key={s.key} id={`svc-${s.key}`} style={{ scrollMarginTop: '6rem' }}>
                      <div className="flex flex-col md:flex-row md:items-end justify-between gap-2 mb-4 pb-3" style={{ borderBottom: '1px solid #d6cfbf' }}>
                        <div>
                          <h3 className="text-xl" style={{ fontFamily: 'var(--font-playfair)', color: '#14130f' }}>
                            {plainService(s.label)}
                          </h3>
                          <p className="text-sm leading-relaxed max-w-2xl mt-1" style={text}>
                            {s.blurb}
                          </p>
                        </div>
                      </div>
                      {offers.length ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                          {offers.map((l) => (
                            <AssetCard key={l.id} asset={l} href={`/catalog/private-services/${l.slug}`} />
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4" style={{ background: '#fbf9f4', border: '1px solid #d6cfbf' }}>
                          <p className="text-sm" style={text}>
                            Our concierge can arrange a vetted professional for you today.
                          </p>
                          <RequestButton
                            topic={s.label}
                            label={`Request ${plainService(s.label)}`}
                            className="shrink-0 inline-flex items-center justify-center gap-2 min-h-11 px-5 text-[11px] tracking-[0.14em] uppercase"
                            style={{ border: '1px solid rgba(20,19,15,0.23)', ...gold }}
                          >
                            <MessageCircle size={14} /> Request {plainService(s.label)}
                          </RequestButton>
                        </div>
                      )}
                    </div>
                  )
                })}
            </div>
          </section>
        ))}

        <section className="p-8 md:p-10 text-center" style={{ background: '#fbf9f4', border: '1px solid rgba(20,19,15,0.14)' }}>
          <h2 className="text-2xl md:text-3xl mb-3" style={{ fontFamily: 'var(--font-playfair)', color: '#14130f' }}>
            Are you a chef, therapist, barber or stylist?
          </h2>
          <p className="text-sm leading-relaxed max-w-xl mx-auto mb-6" style={text}>
            We work with a small number of vetted professionals who bring five-star service to clients&apos; homes and stays.
          </p>
          <Link
            href="/partners/apply"
            className="inline-flex items-center justify-center min-h-12 px-8 text-xs tracking-[0.2em] uppercase"
            style={{ background: '#14130f', color: '#f4f0e8', fontFamily: 'var(--font-inter)' }}
          >
            Apply to join
          </Link>
        </section>
      </div>
    </>
  )
}
