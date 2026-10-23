import Link from 'next/link'
import { pageMeta } from '@/lib/seo-metadata'
import type { Metadata } from 'next'
import { ArrowRight, BadgeCheck, FileCheck2, PenLine, ShieldCheck, Compass, Wallet } from 'lucide-react'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import Breadcrumbs from '@/components/Breadcrumbs'
import Reveal, { RevealGroup, RevealItem } from '@/components/motion/Reveal'
import { PARTNER_TYPES } from '@/lib/partner-requirements'
import RequestButton from '@/components/concierge/RequestButton'

export const metadata: Metadata = pageMeta({
  title: 'List Your Luxury Property, Cars or Services',
  description: 'List your luxury property, cars, yachts, services or products on Lux Catalog. Verified partners, discerning clients, Lagos to the world.',
  path: '/partners',
})

const steps = [
  { icon: PenLine, title: 'Apply', body: 'Tell us about your business and upload your documents. It takes about 10 minutes and saves as you go.' },
  { icon: FileCheck2, title: 'Verification', body: 'Our team reviews every partner personally, usually within 2 working days.' },
  { icon: ShieldCheck, title: 'Agreement', body: 'Sign the partner agreement online: clear commission, clear payouts, no surprises.' },
  { icon: Compass, title: 'Go live', body: 'Add your listings. We polish the presentation and put them in front of discerning clients.' },
]

const benefits = [
  { icon: BadgeCheck, title: 'A trusted stage', body: 'Clients book with confidence because every partner is verified. That trust converts.' },
  { icon: Wallet, title: 'Secure payouts', body: 'Clients pay Lux Catalog up front, so every booking is secured. You are paid on the schedule in your agreement, never chasing money.' },
  { icon: Compass, title: 'Presentation handled', body: 'Professional copy, outlined highlights and a cinematic listing page for every asset.' },
]

export default function PartnersPage() {
  return (
    <div style={{ background: '#f4f0e8', minHeight: '100vh' }}>
      <Navbar />

      <section className="relative pt-28 md:pt-36 pb-20 md:pb-28 px-5 md:px-12 overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 60% 55% at 20% 20%, rgba(122,92,36,0.05) 0%, transparent 70%)' }}
        />
        <div className="relative max-w-7xl mx-auto">
          <div className="mb-8">
            <Breadcrumbs trail={[{ label: 'Home', href: '/' }, { label: 'Become a Partner' }]} />
          </div>
          <div className="max-w-3xl">
            <p className="hero-rise text-xs tracking-[0.32em] uppercase mb-5" style={{ color: '#7a5c24', fontFamily: 'var(--font-inter)' }}>
              The Lux Catalog Partner Programme
            </p>
            <h1 className="hero-rise text-4xl md:text-6xl leading-[1.05] mb-6" style={{ fontFamily: 'var(--font-playfair)', color: '#14130f', animationDelay: '0.12s' }}>
              Own something exceptional?
              <br />
              <em style={{ color: '#7a5c24' }}>Let the right clients find it.</em>
            </h1>
            <p className="hero-rise text-base md:text-lg leading-relaxed mb-9 max-w-2xl" style={{ color: '#c9bfae', fontFamily: 'var(--font-inter)', animationDelay: '0.24s' }}>
              Residences, supercars, superyachts, chauffeurs, protection and luxury interiors. Lux Catalog brings owners and
              discerning buyers and guests together, with verification and secure payments on both sides.
            </p>
            <div className="hero-rise flex flex-col sm:flex-row gap-3" style={{ animationDelay: '0.36s' }}>
              <Link
                href="/partners/apply"
                className="sheen group inline-flex items-center justify-center gap-3 min-h-[52px] px-8 text-xs tracking-[0.2em] uppercase"
                style={{ background: '#14130f', color: '#f4f0e8', fontFamily: 'var(--font-inter)' }}
              >
                Apply to become a partner
                <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" />
              </Link>
              <RequestButton
                topic="Becoming a Lux Catalog partner"
                label="Talk to our partner team"
                className="inline-flex items-center justify-center min-h-[52px] px-8 text-xs tracking-[0.2em] uppercase transition-colors hover:bg-[rgba(122,92,36,0.05)]"
                style={{ border: '1px solid rgba(20,19,15,0.25)', color: '#7a5c24', fontFamily: 'var(--font-inter)' }}
              >
                Talk to our partner team
              </RequestButton>
            </div>
          </div>
        </div>
      </section>

      <section className="px-5 md:px-12 pb-20 md:pb-28 max-w-7xl mx-auto">
        <Reveal className="mb-10">
          <p className="text-xs tracking-[0.3em] uppercase mb-4" style={{ color: '#7a5c24', fontFamily: 'var(--font-inter)' }}>
            Who we partner with
          </p>
          <h2 className="text-3xl md:text-4xl" style={{ fontFamily: 'var(--font-playfair)', color: '#14130f' }}>
            One standard, many crafts
          </h2>
        </Reveal>
        <RevealGroup className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {PARTNER_TYPES.map((t) => (
            <RevealItem key={t.key}>
              <div className="h-full p-6 lux-card">
                <p className="text-lg mb-2" style={{ fontFamily: 'var(--font-playfair)', color: '#14130f' }}>
                  {t.label}
                </p>
                <p className="text-sm mb-4" style={{ color: '#5e584c', fontFamily: 'var(--font-inter)' }}>
                  {t.tagline}
                </p>
                <Link href={`/partners/apply?type=${t.key}`} className="inline-flex items-center gap-2 min-h-11 text-xs tracking-[0.16em] uppercase" style={{ color: '#7a5c24', fontFamily: 'var(--font-inter)' }}>
                  Apply as {t.label.toLowerCase()} <ArrowRight size={13} />
                </Link>
              </div>
            </RevealItem>
          ))}
        </RevealGroup>
      </section>

      <section className="px-5 md:px-12 pb-20 md:pb-28 max-w-7xl mx-auto">
        <Reveal className="mb-12">
          <p className="text-xs tracking-[0.3em] uppercase mb-4" style={{ color: '#7a5c24', fontFamily: 'var(--font-inter)' }}>
            How it works
          </p>
          <h2 className="text-3xl md:text-4xl" style={{ fontFamily: 'var(--font-playfair)', color: '#14130f' }}>
            From application to first booking
          </h2>
        </Reveal>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {steps.map((s, i) => (
            <Reveal key={s.title} delay={i * 0.1}>
              <div className="flex items-center gap-3 mb-4">
                <span className="flex items-center justify-center w-11 h-11 rounded-full" style={{ border: '1px solid rgba(20,19,15,0.25)' }}>
                  <s.icon size={17} style={{ color: '#7a5c24' }} />
                </span>
                <span className="text-[11px] tracking-[0.24em] uppercase" style={{ color: '#5e584c', fontFamily: 'var(--font-inter)' }}>
                  Step {i + 1}
                </span>
              </div>
              <p className="text-xl mb-2" style={{ fontFamily: 'var(--font-playfair)', color: '#14130f' }}>
                {s.title}
              </p>
              <p className="text-sm leading-relaxed" style={{ color: '#5e584c', fontFamily: 'var(--font-inter)' }}>
                {s.body}
              </p>
            </Reveal>
          ))}
        </div>
      </section>

      <section style={{ background: '#f4f0e8', borderTop: '1px solid rgba(20,19,15,0.14)', borderBottom: '1px solid rgba(20,19,15,0.14)' }}>
        <div className="max-w-7xl mx-auto px-5 md:px-12 py-16 md:py-20 grid grid-cols-1 md:grid-cols-3 gap-8">
          {benefits.map((b) => (
            <Reveal key={b.title}>
              <b.icon size={20} className="mb-4" style={{ color: '#7a5c24' }} />
              <p className="text-xl mb-2" style={{ fontFamily: 'var(--font-playfair)', color: '#14130f' }}>
                {b.title}
              </p>
              <p className="text-sm leading-relaxed" style={{ color: '#5e584c', fontFamily: 'var(--font-inter)' }}>
                {b.body}
              </p>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="px-5 md:px-12 py-20 md:py-24 text-center">
        <Reveal className="max-w-2xl mx-auto">
          <h2 className="text-3xl md:text-4xl mb-5" style={{ fontFamily: 'var(--font-playfair)', color: '#14130f' }}>
            Ready when you are
          </h2>
          <p className="text-sm mb-8" style={{ color: '#5e584c', fontFamily: 'var(--font-inter)' }}>
            Choose your kind of business and we will show you exactly what is needed. Requirements are shown to applicants only, and you can save and finish later.
          </p>
          <Link
            href="/partners/apply"
            className="inline-flex items-center justify-center gap-3 min-h-[52px] px-10 text-xs tracking-[0.2em] uppercase"
            style={{ background: '#14130f', color: '#f4f0e8', fontFamily: 'var(--font-inter)' }}
          >
            Start your application <ArrowRight size={15} />
          </Link>
        </Reveal>
      </section>

      <Footer />
    </div>
  )
}
