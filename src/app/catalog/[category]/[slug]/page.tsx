import { notFound } from 'next/navigation'
import Image from 'next/image'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { Badge } from '@/components/ui/badge'
import InquiryModal from '@/components/InquiryModal'
import { formatPrice, categoryLabels } from '@/lib/utils'
import { MapPin, Check } from 'lucide-react'
import type { Metadata } from 'next'

// Shared static data — in production this would come from Prisma
const allListings = [
  { id: '1',  title: 'Cap Ferrat Clifftop Villa',          slug: 'cap-ferrat-clifftop-villa',         category: 'real_estate', location: 'Saint-Jean-Cap-Ferrat', country: 'France',        priceDisplay: '$48,000,000',          price: 48000000, status: 'available', featured: true,
    description: "An extraordinary clifftop residence commanding panoramic views across the Côte d'Azur. Five en-suite bedrooms, an infinity pool that dissolves into the Mediterranean horizon, and meticulously landscaped gardens spanning 2,000 m². A masterwork of contemporary Provençal architecture.",
    images: ['https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200&q=85','https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=1200&q=85','https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1200&q=85'],
    specs: { 'Bedrooms': '5', 'Bathrooms': '6', 'Floor Area': '1,240 m²', 'Land': '2,000 m²', 'Pool': 'Infinity', 'Year Built': '2019' },
    features: ['Infinity Pool', 'Private Beach Access', 'Home Cinema', 'Wine Cellar', 'Staff Quarters', 'Helipad'] },
  { id: '2',  title: 'Manhattan Sky Penthouse',             slug: 'manhattan-sky-penthouse',           category: 'real_estate', location: 'New York City',          country: 'United States', priceDisplay: '$35,000,000',          price: 35000000, status: 'available', featured: true,
    description: "A rarified duplex penthouse crowning one of Manhattan's most sought-after addresses. Floor-to-ceiling glass envelopes a 270° panorama from the Hudson River to Central Park.",
    images: ['https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1200&q=85','https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1200&q=85'],
    specs: { 'Bedrooms': '4', 'Bathrooms': '5', 'Floor Area': '740 m²', 'Floor': '72nd', 'Year Built': '2021' },
    features: ['Panoramic Views', 'Private Terrace', 'Concierge', 'Spa & Pool', 'Private Elevator', 'Smart Home'] },
  { id: '3',  title: 'Maldives Overwater Estate',           slug: 'maldives-overwater-estate',         category: 'real_estate', location: 'North Malé Atoll',       country: 'Maldives',      priceDisplay: 'Price On Application',  price: null,     status: 'available', featured: true,
    description: "The pinnacle of aquatic living — a private overwater estate spanning an entire sandbank. Three connected pavilions above a turquoise lagoon, a private 30-metre jetty.",
    images: ['https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=1200&q=85'],
    specs: { 'Bedrooms': '6', 'Bathrooms': '7', 'Floor Area': '2,100 m²', 'Frontage': 'Private Lagoon' },
    features: ['Private Lagoon', 'Overwater Design', 'Marine Biologist', 'Private Jetty', 'Dive Centre', 'Helicopter Transfer'] },
  { id: '4',  title: 'Belgravia Garden Townhouse',          slug: 'belgravia-garden-townhouse',        category: 'real_estate', location: 'Belgravia, London',      country: 'United Kingdom',priceDisplay: '£22,500,000',          price: 28500000, status: 'available', featured: false,
    description: "A flawlessly restored Grade II listed stucco townhouse on London's most prestigious garden square. Six floors of exceptional lateral living.",
    images: ['https://images.unsplash.com/photo-1605276374104-dee2a0ed3cd6?w=1200&q=85'],
    specs: { 'Bedrooms': '7', 'Bathrooms': '6', 'Floor Area': '950 m²', 'Garden': '100 ft', 'Listed': 'Grade II' },
    features: ['Garden Square', 'Period Features', 'Wine Cellar', 'Staff Flat', 'Lift', 'Garage'] },
  { id: '5',  title: 'Bugatti Chiron Super Sport 300+',     slug: 'bugatti-chiron-super-sport-300',    category: 'supercar',    location: 'Geneva',                 country: 'Switzerland',   priceDisplay: '$5,200,000',           price: 5200000,  status: 'available', featured: true,
    description: "One of just 30 units produced worldwide — the Chiron Super Sport 300+ commemorates Bugatti's historic 300 mph barrier. In Deep Blue Carbon with a bespoke interior by Bugatti Atelier.",
    images: ['https://images.unsplash.com/photo-1544636331-e26879cd4d9b?w=1200&q=85','https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=1200&q=85'],
    specs: { 'Power': '1,600 hp', 'Top Speed': '304 mph', '0–60 mph': '2.4s', 'Engine': '8.0L W16 Quad-Turbo', 'Production': '30 units', 'Mileage': '312 km' },
    features: ['1 of 30 Worldwide', "Bugatti Atelier Interior", 'Carbon Fibre Body', 'Full Service History', 'Collector\'s Set'] },
  { id: '6',  title: 'Ferrari LaFerrari Aperta',            slug: 'ferrari-laferrari-aperta',          category: 'supercar',    location: 'Monaco',                 country: 'Monaco',        priceDisplay: '$7,800,000',           price: 7800000,  status: 'under_offer', featured: true,
    description: "The rarest of Ferrari's open-top hypercars — LaFerrari Aperta in Rosso Corsa with a specially commissioned Nero interior featuring Tricolore accents.",
    images: ['https://images.unsplash.com/photo-1592198084033-aade902d1aae?w=1200&q=85'],
    specs: { 'Power': '963 hp', '0–62 mph': '2.9s', 'Engine': 'V12 HY-KERS', 'Production': '210 units', 'Mileage': '1,840 km' },
    features: ['Rosso Corsa', 'Ferrari Classiche Certified', 'HY-KERS Hybrid', 'Active Aerodynamics', 'One Owner'] },
  { id: '7',  title: 'Koenigsegg Regera',                   slug: 'koenigsegg-regera',                 category: 'supercar',    location: 'London',                 country: 'United Kingdom',priceDisplay: '$6,400,000',           price: 6400000,  status: 'available', featured: false,
    description: "An automotive singularity — the Regera produces 1,500 hp through its unique Koenigsegg Direct Drive system, eliminating the traditional gearbox entirely.",
    images: ['https://images.unsplash.com/photo-1514316703755-dca7d7d9d882?w=1200&q=85'],
    specs: { 'Power': '1,500 hp', 'Top Speed': '255 mph', '0–62 mph': '2.7s', 'Production': '80 units', 'Mileage': '450 km' },
    features: ['Direct Drive System', 'Liquid Silver', 'Blue Carbon Fibre', '80 Built Worldwide', 'Full Koenigsegg Service'] },
  { id: '8',  title: 'Rolls-Royce Phantom Bespoke',         slug: 'rolls-royce-phantom-bespoke',       category: 'supercar',    location: 'Dubai',                  country: 'UAE',           priceDisplay: '$850,000',             price: 850000,   status: 'available', featured: false,
    description: "A singular Phantom commissioned through the Rolls-Royce Bespoke programme — the Gallery dashboard features a hand-painted celestial map.",
    images: ['https://images.unsplash.com/photo-1563720223185-11003d516935?w=1200&q=85'],
    specs: { 'Power': '571 hp', 'Engine': '6.75L V12', 'Year': '2023', 'Mileage': '3,200 km' },
    features: ['Bespoke Gallery Dashboard', 'Starlight Headliner', 'Lambswool Rugs', 'Commissioned Art', 'Champagne Cooler'] },
  { id: '9',  title: 'M/Y Aphrodite — 73m Superyacht',      slug: 'my-aphrodite-73m-superyacht',       category: 'yacht',       location: 'Monaco',                 country: 'France',        priceDisplay: 'Price On Application',  price: null,     status: 'available', featured: true,
    description: "Delivered in 2022 from Lürssen's Rendsburg shipyard, Aphrodite represents the zenith of contemporary superyacht design. Exterior by Espen Øino, interior by Reymond Langton.",
    images: ['https://images.unsplash.com/photo-1567899378494-47b22a2ae96a?w=1200&q=85','https://images.unsplash.com/photo-1605281317010-fe5ffe798166?w=1200&q=85'],
    specs: { 'Length': '73m', 'Guest Cabins': '6', 'Guests': '12', 'Crew': '22', 'Range': '6,000 nm', 'Max Speed': '18 knots', 'Built': '2022' },
    features: ['6 Guest Staterooms', 'Spa & Gym', 'Beach Club', 'Helipad', 'Toy Garage', 'Zero-Speed Stabilisers'] },
  { id: '10', title: 'S/Y Altair — 55m Sailing Ketch',      slug: 'sy-altair-55m-sailing-ketch',       category: 'yacht',       location: 'Palma de Mallorca',      country: 'Spain',         priceDisplay: '$18,500,000',          price: 18500000, status: 'available', featured: false,
    description: "A masterpiece of the sailing world — Altair was conceived by Philippe Briand and built by Perini Navi as a performance sailing ketch capable of crossing oceans in extraordinary comfort.",
    images: ['https://images.unsplash.com/photo-1605281317010-fe5ffe798166?w=1200&q=85'],
    specs: { 'Length': '55m', 'Guest Cabins': '4', 'Guests': '10', 'Crew': '9', 'Builder': 'Perini Navi', 'Built': '2018' },
    features: ['Carbon Rig', 'Hydraulic Sails', '4 Guest Cabins', 'Zero-Emissions Mode', 'Stabilised', 'Full Race Record'] },
  { id: '11', title: 'Baccarat Crystal Chandelier',          slug: 'baccarat-crystal-chandelier-grand-palais', category: 'decor', location: 'Paris',              country: 'France',        priceDisplay: '$380,000',             price: 380000,   status: 'available', featured: false,
    description: "A museum-quality chandelier crafted by Baccarat's master crystal artisans for the Grand Palais collection. 2,400 individually hand-cut crystals.",
    images: ['https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=1200&q=85'],
    specs: { 'Diameter': '3.2m', 'Height': '2.8m', 'Crystals': '2,400', 'Material': 'Lead Crystal & Gilded Bronze', 'Edition': 'Grand Palais' },
    features: ['Hand-Cut Crystal', 'Gilded Bronze Frame', 'Baccarat Certificate', 'White Glove Installation', 'Dimmable LED'] },
  { id: '12', title: 'Hermès Compagnie des Arts Armchair',   slug: 'hermes-armchair-compagnie-des-arts', category: 'decor',     location: 'New York',               country: 'United States', priceDisplay: '$95,000',              price: 95000,    status: 'available', featured: false,
    description: "A singular armchair from Hermès Maison — part of the exclusive Compagnie des Arts Équestres collection. Saddle-stitched Barenia leather over a hand-carved walnut frame.",
    images: ['https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=1200&q=85'],
    specs: { 'Material': 'Barenia Leather & Walnut', 'Edition': 'Compagnie des Arts', 'Units': '12 worldwide' },
    features: ['Barenia Leather', 'Saddle-Stitched', 'Hand-Carved Walnut', '1 of 12', 'Hermès Certificate'] },
  { id: '13', title: 'Mayfair Mixed-Use Trophy Asset',       slug: 'mayfair-mixed-use-trophy',          category: 'commercial',  location: 'Mayfair, London',        country: 'United Kingdom',priceDisplay: 'Price On Application',  price: null,     status: 'available', featured: true,
    description: "A landmark freehold building on Mount Street, Mayfair — comprising four retail units at ground floor, eight residential apartments above, and a lateral penthouse.",
    images: ['https://images.unsplash.com/photo-1486325212027-8081e485255e?w=1200&q=85'],
    specs: { 'GIA': '3,200 m²', 'Tenure': 'Freehold', 'Net Income': '£3.2m pa', 'Units': '12', 'Net Yield': '4.2%' },
    features: ['Freehold', 'Mixed-Use', 'Prime Mayfair', 'Strong Rent Roll', 'Trophy Asset'] },
  { id: '14', title: 'Dubai DIFC Grade-A Office Tower',      slug: 'dubai-difc-office-tower',           category: 'commercial',  location: 'DIFC, Dubai',            country: 'UAE',           priceDisplay: 'Price On Application',  price: null,     status: 'available', featured: false,
    description: "A 42-storey fully-let Grade-A office tower in Dubai International Financial Centre — leased to sovereign wealth funds and global financial institutions.",
    images: ['https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1200&q=85'],
    specs: { 'Floors': '42', 'GLA': '82,000 m²', 'Tenants': '18', 'Net Income': 'AED 95m pa', 'LEED': 'Platinum', 'WAULT': '7.5 years' },
    features: ['LEED Platinum', 'Fully Let', 'Grade-A', 'Blue Chip Tenants', 'DIFC Jurisdiction'] },
  { id: '15', title: 'Airbus ACH130 Private Helicopter',     slug: 'airbus-ach130-private-helicopter',  category: 'lifestyle',   location: 'Nice',                   country: 'France',        priceDisplay: '$4,200,000',           price: 4200000,  status: 'available', featured: true,
    description: "The Airbus ACH130 configured in ACH Corporate trim — the most refined single-engine helicopter available. Cabin finished in hand-stitched Nappa leather.",
    images: ['https://images.unsplash.com/photo-1540979388789-6cee28a1cdc9?w=1200&q=85'],
    specs: { 'Seats': '5', 'Range': '630 km', 'Cruise Speed': '233 km/h', 'Year': '2022', 'Hours': '210', 'Engine': 'Safran Arriel 2D' },
    features: ['ACH Corporate Trim', 'Nappa Leather', 'Macassar Ebony', 'EASA Certified', 'Maintenance Contract'] },
  { id: '16', title: 'Private Members Club — St. Moritz',    slug: 'private-members-club-st-moritz',    category: 'lifestyle',   location: 'St. Moritz',             country: 'Switzerland',   priceDisplay: '$650,000',             price: 650000,   status: 'available', featured: false,
    description: "Lifetime founding membership in a newly established private members club at the Suvretta House, St. Moritz — offering ski-in access, a dedicated chalet suite allocation, Michelin-starred dining.",
    images: ['https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=1200&q=85'],
    specs: { 'Membership': 'Founding Lifetime', 'Partner Clubs': '22', 'Suites Allocated': '4', 'Dining': '2 Michelin Stars' },
    features: ['Ski-In Access', 'Chalet Suites', 'Michelin Dining', '22 Partner Clubs', 'Global Network', 'Lifetime'] },
]

const categorySlugMap: Record<string, string> = {
  'real-estate': 'real_estate',
  'supercars': 'supercar',
  'yachts': 'yacht',
  'decor': 'decor',
  'commercial': 'commercial',
  'lifestyle': 'lifestyle',
}

export async function generateMetadata({ params }: { params: Promise<{ category: string; slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const listing = allListings.find((l) => l.slug === slug)
  if (!listing) return { title: 'Not Found' }
  return {
    title: listing.title,
    description: listing.description.slice(0, 160),
  }
}

export default async function AssetDetailPage({ params }: { params: Promise<{ category: string; slug: string }> }) {
  const { category: categorySlug, slug } = await params
  const categoryKey = categorySlugMap[categorySlug]
  const listing = allListings.find((l) => l.slug === slug && l.category === categoryKey)

  if (!listing) notFound()

  const statusVariant =
    listing.status === 'available' ? 'available' : listing.status === 'under_offer' ? 'under_offer' : 'sold'

  return (
    <div style={{ background: '#080c08', minHeight: '100vh' }}>
      <Navbar />

      {/* Hero gallery */}
      <div className="relative pt-20 h-[55vh] md:h-[70vh] overflow-hidden">
        <Image
          src={listing.images[0]}
          alt={listing.title}
          fill
          className="object-cover"
          priority
        />
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(180deg, rgba(8,12,8,0.2) 0%, rgba(8,12,8,0.85) 100%)' }}
        />

        {/* Title overlay */}
        <div className="absolute bottom-0 left-0 right-0 max-w-7xl mx-auto px-6 md:px-12 pb-10">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs tracking-[0.25em] uppercase mb-3" style={{ color: '#C9A84C', fontFamily: 'var(--font-inter)' }}>
                {categoryLabels[listing.category]}
              </p>
              <h1 className="text-3xl md:text-5xl leading-tight" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>
                {listing.title}
              </h1>
              <div className="flex items-center gap-2 mt-3">
                <MapPin size={13} style={{ color: '#9a8f7a' }} />
                <span className="text-sm" style={{ color: '#9a8f7a', fontFamily: 'var(--font-inter)' }}>
                  {listing.location}, {listing.country}
                </span>
              </div>
            </div>
            <Badge variant={statusVariant} className="hidden md:inline-flex">
              {listing.status === 'under_offer' ? 'Under Offer' : listing.status}
            </Badge>
          </div>
        </div>
      </div>

      {/* Thumbnail strip */}
      {listing.images.length > 1 && (
        <div
          className="flex gap-3 max-w-7xl mx-auto px-6 md:px-12 py-4 overflow-x-auto"
          style={{ borderBottom: '1px solid #1e2e1f' }}
        >
          {listing.images.map((img, i) => (
            <div key={i} className="relative w-24 h-16 flex-shrink-0 overflow-hidden" style={{ border: i === 0 ? '1px solid #C9A84C' : '1px solid #1e2e1f' }}>
              <Image src={img} alt={`${listing.title} photo ${i + 1}`} fill className="object-cover" />
            </div>
          ))}
        </div>
      )}

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-6 md:px-12 py-12 grid grid-cols-1 lg:grid-cols-3 gap-12">
        {/* Left — description + specs + features */}
        <div className="lg:col-span-2 space-y-10">
          {/* Description */}
          <div>
            <h2 className="text-xl mb-4" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>
              About This Asset
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: '#9a8f7a', fontFamily: 'var(--font-inter)' }}>
              {listing.description}
            </p>
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(201,168,76,0.2), transparent)' }} />

          {/* Specs */}
          <div>
            <h2 className="text-xl mb-5" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>
              Specifications
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {Object.entries(listing.specs).map(([key, val]) => (
                <div key={key} className="p-4" style={{ background: '#0f1a10', border: '1px solid #1e2e1f' }}>
                  <p className="text-[10px] tracking-[0.15em] uppercase mb-1" style={{ color: '#5a5248', fontFamily: 'var(--font-inter)' }}>
                    {key}
                  </p>
                  <p className="text-sm font-medium" style={{ color: '#f5f0e8', fontFamily: 'var(--font-inter)' }}>
                    {val as string}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Features */}
          <div>
            <h2 className="text-xl mb-5" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>
              Features & Highlights
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {listing.features.map((f) => (
                <div key={f} className="flex items-center gap-3">
                  <Check size={13} style={{ color: '#C9A84C', flexShrink: 0 }} />
                  <span className="text-sm" style={{ color: '#9a8f7a', fontFamily: 'var(--font-inter)' }}>
                    {f}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right — inquiry panel */}
        <div className="lg:col-span-1">
          <div
            className="sticky top-24 p-7 space-y-6"
            style={{ background: '#0f1a10', border: '1px solid #1e2e1f' }}
          >
            <div>
              <p className="text-[10px] tracking-[0.2em] uppercase mb-2" style={{ color: '#5a5248', fontFamily: 'var(--font-inter)' }}>
                Asking Price
              </p>
              <p className="text-2xl md:text-3xl" style={{ fontFamily: 'var(--font-playfair)', color: '#C9A84C', fontStyle: !listing.price ? 'italic' : 'normal' }}>
                {formatPrice(listing.price, listing.priceDisplay)}
              </p>
            </div>

            <div style={{ height: 1, background: '#1e2e1f' }} />

            <div className="space-y-3">
              <div className="flex justify-between text-xs" style={{ fontFamily: 'var(--font-inter)' }}>
                <span style={{ color: '#5a5248' }}>Category</span>
                <span style={{ color: '#9a8f7a' }}>{categoryLabels[listing.category]}</span>
              </div>
              <div className="flex justify-between text-xs" style={{ fontFamily: 'var(--font-inter)' }}>
                <span style={{ color: '#5a5248' }}>Location</span>
                <span style={{ color: '#9a8f7a' }}>{listing.location}</span>
              </div>
              <div className="flex justify-between text-xs" style={{ fontFamily: 'var(--font-inter)' }}>
                <span style={{ color: '#5a5248' }}>Status</span>
                <Badge variant={statusVariant}>
                  {listing.status === 'under_offer' ? 'Under Offer' : listing.status}
                </Badge>
              </div>
            </div>

            <div style={{ height: 1, background: '#1e2e1f' }} />

            <InquiryModal
              listingId={listing.id}
              listingTitle={listing.title}
              listingPrice={listing.price}
            />

            <p
              className="text-[10px] leading-relaxed text-center"
              style={{ color: '#3a3028', fontFamily: 'var(--font-inter)' }}
            >
              Your enquiry is handled with complete discretion. A specialist will respond within 24 hours.
            </p>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  )
}
