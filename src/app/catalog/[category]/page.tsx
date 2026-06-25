import { notFound } from 'next/navigation'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import AssetCard from '@/components/AssetCard'
import { categoryLabels } from '@/lib/utils'
import type { Metadata } from 'next'

const categorySlugMap: Record<string, string> = {
  'real-estate': 'real_estate',
  'supercars':   'supercar',
  'yachts':      'yacht',
  'decor':       'decor',
  'commercial':  'commercial',
  'lifestyle':   'lifestyle',
}

// Same data as catalog client — in production query DB
const allListings = [
  { id: '1',  title: 'Cap Ferrat Clifftop Villa',       slug: 'cap-ferrat-clifftop-villa',        category: 'real_estate', location: 'Saint-Jean-Cap-Ferrat', country: 'France',        priceDisplay: '$48,000,000',          price: 48000000, images: ['https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=700&q=80'], status: 'available',    featured: true  },
  { id: '2',  title: 'Manhattan Sky Penthouse',          slug: 'manhattan-sky-penthouse',          category: 'real_estate', location: 'New York City',          country: 'United States', priceDisplay: '$35,000,000',          price: 35000000, images: ['https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=700&q=80'], status: 'available',    featured: true  },
  { id: '3',  title: 'Maldives Overwater Estate',        slug: 'maldives-overwater-estate',        category: 'real_estate', location: 'North Malé Atoll',       country: 'Maldives',      priceDisplay: 'Price On Application',  price: null,    images: ['https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=700&q=80'], status: 'available',    featured: true  },
  { id: '4',  title: 'Belgravia Garden Townhouse',       slug: 'belgravia-garden-townhouse',       category: 'real_estate', location: 'Belgravia, London',      country: 'United Kingdom',priceDisplay: '£22,500,000',          price: 28500000, images: ['https://images.unsplash.com/photo-1605276374104-dee2a0ed3cd6?w=700&q=80'], status: 'available',    featured: false },
  { id: '5',  title: 'Bugatti Chiron Super Sport 300+',  slug: 'bugatti-chiron-super-sport-300',   category: 'supercar',    location: 'Geneva',                 country: 'Switzerland',   priceDisplay: '$5,200,000',           price: 5200000,  images: ['https://images.unsplash.com/photo-1544636331-e26879cd4d9b?w=700&q=80'],  status: 'available',    featured: true  },
  { id: '6',  title: 'Ferrari LaFerrari Aperta',         slug: 'ferrari-laferrari-aperta',         category: 'supercar',    location: 'Monaco',                 country: 'Monaco',        priceDisplay: '$7,800,000',           price: 7800000,  images: ['https://images.unsplash.com/photo-1592198084033-aade902d1aae?w=700&q=80'], status: 'under_offer',  featured: true  },
  { id: '7',  title: 'Koenigsegg Regera',                slug: 'koenigsegg-regera',                category: 'supercar',    location: 'London',                 country: 'United Kingdom',priceDisplay: '$6,400,000',           price: 6400000,  images: ['https://images.unsplash.com/photo-1514316703755-dca7d7d9d882?w=700&q=80'], status: 'available',    featured: false },
  { id: '8',  title: 'Rolls-Royce Phantom Bespoke',      slug: 'rolls-royce-phantom-bespoke',      category: 'supercar',    location: 'Dubai',                  country: 'UAE',           priceDisplay: '$850,000',             price: 850000,   images: ['https://images.unsplash.com/photo-1563720223185-11003d516935?w=700&q=80'], status: 'available',    featured: false },
  { id: '9',  title: 'M/Y Aphrodite — 73m Superyacht',   slug: 'my-aphrodite-73m-superyacht',      category: 'yacht',       location: 'Monaco',                 country: 'France',        priceDisplay: 'Price On Application',  price: null,    images: ['https://images.unsplash.com/photo-1567899378494-47b22a2ae96a?w=700&q=80'], status: 'available',    featured: true  },
  { id: '10', title: 'S/Y Altair — 55m Sailing Ketch',   slug: 'sy-altair-55m-sailing-ketch',      category: 'yacht',       location: 'Palma de Mallorca',      country: 'Spain',         priceDisplay: '$18,500,000',          price: 18500000, images: ['https://images.unsplash.com/photo-1605281317010-fe5ffe798166?w=700&q=80'], status: 'available',    featured: false },
  { id: '11', title: 'Baccarat Crystal Chandelier',       slug: 'baccarat-crystal-chandelier-grand-palais', category: 'decor', location: 'Paris',              country: 'France',        priceDisplay: '$380,000',             price: 380000,   images: ['https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=700&q=80'], status: 'available',    featured: false },
  { id: '12', title: 'Hermès Armchair — Compagnie',       slug: 'hermes-armchair-compagnie-des-arts', category: 'decor',     location: 'New York',               country: 'United States', priceDisplay: '$95,000',              price: 95000,    images: ['https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=700&q=80'],  status: 'available',    featured: false },
  { id: '13', title: 'Mayfair Mixed-Use Trophy Asset',    slug: 'mayfair-mixed-use-trophy',         category: 'commercial',  location: 'Mayfair, London',        country: 'United Kingdom',priceDisplay: 'Price On Application',  price: null,    images: ['https://images.unsplash.com/photo-1486325212027-8081e485255e?w=700&q=80'], status: 'available',    featured: true  },
  { id: '14', title: 'Dubai DIFC Grade-A Office Tower',   slug: 'dubai-difc-office-tower',          category: 'commercial',  location: 'DIFC, Dubai',            country: 'UAE',           priceDisplay: 'Price On Application',  price: null,    images: ['https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=700&q=80'], status: 'available',    featured: false },
  { id: '15', title: 'Airbus ACH130 Private Helicopter',  slug: 'airbus-ach130-private-helicopter', category: 'lifestyle',   location: 'Nice',                   country: 'France',        priceDisplay: '$4,200,000',           price: 4200000,  images: ['https://images.unsplash.com/photo-1540979388789-6cee28a1cdc9?w=700&q=80'], status: 'available',    featured: true  },
  { id: '16', title: 'Private Members Club — St. Moritz', slug: 'private-members-club-st-moritz',   category: 'lifestyle',   location: 'St. Moritz',             country: 'Switzerland',   priceDisplay: '$650,000',             price: 650000,   images: ['https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=700&q=80'], status: 'available',    featured: false },
]

export async function generateMetadata({ params }: { params: Promise<{ category: string }> }): Promise<Metadata> {
  const { category } = await params
  const key = categorySlugMap[category]
  if (!key) return { title: 'Not Found' }
  return { title: categoryLabels[key], description: `Browse luxury ${categoryLabels[key]?.toLowerCase()} on Lux Catalog.` }
}

export default async function CategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const { category: categorySlug } = await params
  const categoryKey = categorySlugMap[categorySlug]
  if (!categoryKey) notFound()

  const listings = allListings.filter((l) => l.category === categoryKey)

  return (
    <div style={{ background: '#080c08', minHeight: '100vh' }}>
      <Navbar />

      <div className="pt-32 pb-12 px-6 md:px-12" style={{ borderBottom: '1px solid rgba(201,168,76,0.1)' }}>
        <div className="max-w-7xl mx-auto">
          <p className="text-xs tracking-[0.3em] uppercase mb-4" style={{ color: '#C9A84C', fontFamily: 'var(--font-inter)' }}>
            Asset Category
          </p>
          <h1 className="text-4xl md:text-5xl" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>
            {categoryLabels[categoryKey]}
          </h1>
          <p className="mt-2 text-sm" style={{ color: '#9a8f7a', fontFamily: 'var(--font-inter)' }}>
            {listings.length} asset{listings.length !== 1 ? 's' : ''} available
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 md:px-12 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {listings.map((asset) => (
            <AssetCard
              key={asset.id}
              asset={asset}
              href={`/catalog/${categorySlug}/${asset.slug}`}
            />
          ))}
        </div>
      </div>

      <Footer />
    </div>
  )
}
