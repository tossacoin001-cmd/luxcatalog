'use client'

import Link from 'next/link'
import Image from 'next/image'
import { categoryImages, categoryHrefs } from '@/lib/utils'

const categories = [
  { key: 'real_estate',        label: 'Real Estate',           sub: 'Ikoyi, Lekki, VI & beyond' },
  { key: 'shortlet',           label: 'Shortlets',             sub: 'Book by the night' },
  { key: 'supercar',           label: 'Supercars',             sub: 'Exotic & hyper cars' },
  { key: 'yacht',              label: 'Yachts',                sub: 'Motor & sailing yachts' },
  { key: 'executive_services', label: 'Chauffeur & Security',  sub: 'Drive, escort, protect' },
  { key: 'decor',              label: 'Interior Decor',        sub: 'Bespoke furnishings' },
  { key: 'commercial',         label: 'Commercial',            sub: 'Premium office & retail' },
  { key: 'lifestyle',          label: 'Lifestyle',             sub: 'Private jets & more' },
]

export default function CategoryGrid() {
  return (
    <section className="py-20 md:py-28 px-6 md:px-12 max-w-7xl mx-auto">
      <div className="mb-12 text-center">
        <p
          className="text-xs tracking-[0.3em] uppercase mb-4"
          style={{ color: '#C9A84C', fontFamily: 'var(--font-inter)' }}
        >
          Asset Categories
        </p>
        <h2
          className="text-3xl md:text-4xl"
          style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}
        >
          Every Category of Excellence
        </h2>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-5">
        {categories.map((cat, i) => (
          <Link
            key={cat.key}
            href={categoryHrefs[cat.key] ?? '/catalog'}
            className="group relative overflow-hidden aspect-[4/3]"
            style={{
              ...(i === 0 ? { gridColumn: 'span 1', gridRow: 'span 1' } : {}),
            }}
          >
            {/* Image */}
            <Image
              src={categoryImages[cat.key]}
              alt={cat.label}
              fill
              className="object-cover transition-transform duration-700 group-hover:scale-108"
              sizes="(max-width: 768px) 50vw, 33vw"
            />

            {/* Dark overlay */}
            <div
              className="absolute inset-0 transition-opacity duration-500"
              style={{
                background: 'linear-gradient(180deg, rgba(8,12,8,0.2) 0%, rgba(8,12,8,0.7) 100%)',
              }}
            />

            {/* Gold border on hover */}
            <div
              className="absolute inset-0 border border-transparent group-hover:border-lux-gold transition-colors duration-500"
              style={{ borderColor: 'transparent' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(201,168,76,0.5)' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = 'transparent' }}
            />

            {/* Content */}
            <div className="absolute bottom-0 left-0 right-0 p-5">
              <p
                className="text-[10px] tracking-[0.2em] uppercase mb-1"
                style={{ color: '#C9A84C', fontFamily: 'var(--font-inter)' }}
              >
                {cat.sub}
              </p>
              <h3
                className="text-lg group-hover:text-lux-gold transition-colors duration-300"
                style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}
              >
                {cat.label}
              </h3>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
