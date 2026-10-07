'use client'

import { motion } from 'framer-motion'
import { Search, ShieldCheck, KeyRound, Clock, BadgeCheck, Globe2, Lock } from 'lucide-react'
import Reveal, { EASE_OUT_EXPO } from '@/components/motion/Reveal'

const steps = [
  { icon: Search, title: 'Choose', body: 'Browse vetted residences, cars, yachts and protection, or tell the concierge what you have in mind.' },
  { icon: ShieldCheck, title: 'Reserve', body: 'Secure it with a refundable holding deposit while we verify every detail with the owner.' },
  { icon: KeyRound, title: 'Arrive', body: 'Keys, chauffeur, crew or close protection ready on your dates. We stay on call throughout.' },
]

const promises = [
  { icon: Clock, title: '24/7 Concierge', body: 'A real person on WhatsApp, day or night' },
  { icon: BadgeCheck, title: 'Verified Partners', body: 'Every owner and operator vetted by us' },
  { icon: Lock, title: 'Private & Discreet', body: 'Your details shared only when you say so' },
  { icon: Globe2, title: 'Lagos to the World', body: 'Starting at home, expanding worldwide' },
]

export default function HowItWorks() {
  return (
    <section className="py-20 md:py-32 px-5 md:px-12 max-w-7xl mx-auto">
      <Reveal className="text-center mb-14 md:mb-20">
        <p className="text-xs tracking-[0.3em] uppercase mb-4" style={{ color: '#C9A84C', fontFamily: 'var(--font-inter)' }}>
          How it works
        </p>
        <h2 className="text-3xl md:text-5xl leading-tight" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>
          Effortless, from first look <em style={{ color: '#C9A84C' }}>to arrival</em>
        </h2>
      </Reveal>

      <div className="relative grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-10">
        {/* Gold thread connecting the steps, drawn as you scroll in. */}
        <motion.div
          aria-hidden
          className="hidden md:block absolute top-7 left-[16.6%] right-[16.6%] h-px origin-left"
          style={{ background: 'linear-gradient(90deg, rgba(201,168,76,0.1), #C9A84C, rgba(201,168,76,0.1))' }}
          initial={{ scaleX: 0 }}
          whileInView={{ scaleX: 1 }}
          viewport={{ once: true, margin: '0px 0px -20% 0px' }}
          transition={{ duration: 1.6, ease: EASE_OUT_EXPO, delay: 0.2 }}
        />
        {steps.map((s, i) => (
          <Reveal key={s.title} delay={0.15 * i} className="relative text-center px-2">
            <div
              className="relative mx-auto mb-6 flex items-center justify-center w-14 h-14 rounded-full"
              style={{ background: '#0f1a10', border: '1px solid rgba(201,168,76,0.5)', boxShadow: '0 0 0 6px #080c08' }}
            >
              <s.icon size={20} style={{ color: '#C9A84C' }} />
            </div>
            <p className="text-[11px] tracking-[0.3em] uppercase mb-2" style={{ color: '#908673', fontFamily: 'var(--font-inter)' }}>
              Step {i + 1}
            </p>
            <h3 className="text-2xl mb-3" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>
              {s.title}
            </h3>
            <p className="text-sm leading-relaxed max-w-xs mx-auto" style={{ color: '#9a8f7a', fontFamily: 'var(--font-inter)' }}>
              {s.body}
            </p>
          </Reveal>
        ))}
      </div>

      <Reveal delay={0.1} className="mt-20 md:mt-28 grid grid-cols-2 md:grid-cols-4">
        {promises.map((p) => (
          <div
            key={p.title}
            className="p-5 md:p-7 border-t border-lux-border even:border-l md:border-l md:first:border-l-0"
          >
            <p.icon size={18} className="mb-4" style={{ color: '#C9A84C' }} />
            <p className="text-base md:text-lg mb-1" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>
              {p.title}
            </p>
            <p className="text-xs md:text-sm leading-relaxed" style={{ color: '#908673', fontFamily: 'var(--font-inter)' }}>
              {p.body}
            </p>
          </div>
        ))}
      </Reveal>
    </section>
  )
}
