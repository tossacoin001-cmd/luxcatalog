import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import Link from 'next/link'
import { whatsappLink } from '@/lib/contact'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'About',
  description: 'Lux Catalog is Nigeria\'s destination for luxury real estate, shortlets, supercars, yachts, executive transport and security, and bespoke interior decor.',
}

export default function AboutPage() {
  return (
    <div style={{ background: '#080c08', minHeight: '100vh' }}>
      <Navbar />

      <div className="pt-32 pb-16 px-6 md:px-12" style={{ borderBottom: '1px solid rgba(201,168,76,0.1)' }}>
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-xs tracking-[0.3em] uppercase mb-4" style={{ color: '#C9A84C', fontFamily: 'var(--font-inter)' }}>
            About Lux Catalog
          </p>
          <h1 className="text-4xl md:text-5xl mb-6" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>
            Every luxury asset.<br />One destination.
          </h1>
          <p className="text-sm leading-relaxed" style={{ color: '#9a8f7a', fontFamily: 'var(--font-inter)' }}>
            Lux Catalog is Nigeria&rsquo;s curated marketplace for the finest real estate, shortlets, supercars,
            yachts, executive transport &amp; security, interior decor, and lifestyle assets, built for a
            Lagos-first, globally-reachable clientele.
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 md:px-12 py-16 space-y-14">
        <div>
          <h2 className="text-xl mb-4" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>
            What we do
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: '#9a8f7a', fontFamily: 'var(--font-inter)' }}>
            We curate access to prime property across Ikoyi, Victoria Island, Lekki, Banana Island, Ikeja GRA,
            and beyond, alongside exotic cars, yachts, and one-of-a-kind decor. Every enquiry is handled by a
            specialist, with complete discretion, whether you&rsquo;re buying, leasing, booking a shortlet, or
            arranging chauffeur-driven transport and executive protection through our vetted partners.
          </p>
        </div>

        <div>
          <h2 className="text-xl mb-4" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>
            How it works
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: '#9a8f7a', fontFamily: 'var(--font-inter)' }}>
            Browse the catalog, enquire on anything that interests you, and a member of our team responds within
            24 hours. Pricing is shown in Naira by default, with a Naira/Dollar toggle for international clients.
            Nothing is automated where it matters: every transaction is guided by a person, not a checkout form.
          </p>
        </div>

        <div className="text-center pt-4">
          <p className="text-sm mb-6" style={{ color: '#9a8f7a', fontFamily: 'var(--font-inter)' }}>
            Have a question, or looking for something specific?
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <a
              href={whatsappLink("Hello, I'd like to know more about Lux Catalog.")}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-8 py-4 text-xs tracking-[0.2em] uppercase"
              style={{ background: '#C9A84C', color: '#080c08', fontFamily: 'var(--font-inter)' }}
            >
              Chat on WhatsApp
            </a>
            <Link
              href="/contact"
              className="inline-flex items-center px-8 py-4 text-xs tracking-[0.2em] uppercase"
              style={{ border: '1px solid rgba(201,168,76,0.3)', color: '#C9A84C', fontFamily: 'var(--font-inter)' }}
            >
              Speak with a Specialist
            </Link>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  )
}
