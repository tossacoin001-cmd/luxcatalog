import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

const listings = [
  // REAL ESTATE
  {
    title: 'Cap Ferrat Clifftop Villa',
    slug: 'cap-ferrat-clifftop-villa',
    category: 'real_estate' as const,
    description: 'An extraordinary clifftop residence commanding panoramic views across the Côte d\'Azur. Five en-suite bedrooms, an infinity pool that dissolves into the Mediterranean horizon, and meticulously landscaped gardens spanning 2,000 m². A masterwork of contemporary Provençal architecture.',
    price: 48000000,
    priceDisplay: '$48,000,000',
    location: 'Saint-Jean-Cap-Ferrat',
    country: 'France',
    images: [
      'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200&q=85',
      'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=1200&q=85',
    ],
    specs: { bedrooms: 5, bathrooms: 6, area: '1,240 m²', land: '2,000 m²', pool: 'Infinity', year: 2019 },
    features: ['Infinity Pool', 'Private Beach Access', 'Home Cinema', 'Wine Cellar', 'Staff Quarters', 'Helipad'],
    status: 'available' as const,
    featured: true,
  },
  {
    title: 'Manhattan Sky Penthouse',
    slug: 'manhattan-sky-penthouse',
    category: 'real_estate' as const,
    description: 'A rarified duplex penthouse crowning one of Manhattan\'s most sought-after addresses. Floor-to-ceiling glass envelopes a 270° panorama from the Hudson River to Central Park. Bulthaup kitchen, Poliform closets, and a private rooftop terrace with outdoor fireplace.',
    price: 35000000,
    priceDisplay: '$35,000,000',
    location: 'New York City',
    country: 'United States',
    images: [
      'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1200&q=85',
      'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1200&q=85',
    ],
    specs: { bedrooms: 4, bathrooms: 5, area: '740 m²', floor: 72, year: 2021 },
    features: ['Panoramic Views', 'Private Terrace', 'Concierge', 'Spa & Pool', 'Private Elevator', 'Smart Home'],
    status: 'available' as const,
    featured: true,
  },
  {
    title: 'Maldives Overwater Estate',
    slug: 'maldives-overwater-estate',
    category: 'real_estate' as const,
    description: 'The pinnacle of aquatic living — a private overwater estate spanning an entire sandbank. Three connected pavilions above a turquoise lagoon, a private 30-metre jetty, and a dedicated marine biologist on staff to guide exploration of the surrounding reef.',
    price: null,
    priceDisplay: 'Price On Application',
    location: 'North Malé Atoll',
    country: 'Maldives',
    images: [
      'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=1200&q=85',
    ],
    specs: { bedrooms: 6, bathrooms: 7, area: '2,100 m²', waterfront: 'Private Lagoon' },
    features: ['Private Lagoon', 'Overwater Design', 'Marine Biologist', 'Private Jetty', 'Dive Centre', 'Helicopter Transfer'],
    status: 'available' as const,
    featured: true,
  },
  {
    title: 'Belgravia Garden Townhouse',
    slug: 'belgravia-garden-townhouse',
    category: 'real_estate' as const,
    description: 'A flawlessly restored Grade II listed stucco townhouse on London\'s most prestigious garden square. Six floors of exceptional lateral living, a double-height drawing room, and a 100-foot south-facing garden in the heart of Belgravia.',
    price: 28500000,
    priceDisplay: '£22,500,000',
    location: 'Belgravia, London',
    country: 'United Kingdom',
    images: [
      'https://images.unsplash.com/photo-1605276374104-dee2a0ed3cd6?w=1200&q=85',
    ],
    specs: { bedrooms: 7, bathrooms: 6, area: '950 m²', garden: '100 ft', listed: 'Grade II' },
    features: ['Garden Square', 'Period Features', 'Wine Cellar', 'Staff Flat', 'Lift', 'Garage'],
    status: 'available' as const,
    featured: false,
  },

  // SUPERCARS
  {
    title: 'Bugatti Chiron Super Sport 300+',
    slug: 'bugatti-chiron-super-sport-300',
    category: 'supercar' as const,
    description: 'One of just 30 units produced worldwide — the Chiron Super Sport 300+ commemorates Bugatti\'s historic 300 mph barrier. In Deep Blue Carbon with a bespoke interior by Bugatti Atelier, this example has covered a mere 312 km from new and arrives with its full collector\'s book set.',
    price: 5200000,
    priceDisplay: '$5,200,000',
    location: 'Geneva',
    country: 'Switzerland',
    images: [
      'https://images.unsplash.com/photo-1544636331-e26879cd4d9b?w=1200&q=85',
    ],
    specs: { power: '1,600 hp', topSpeed: '304 mph', acceleration: '2.4s 0-60', engine: '8.0L W16 Quad-Turbo', production: 30, km: 312 },
    features: ['1 of 30', 'Collector\'s Set', 'Bugatti Atelier Interior', 'Carbon Fibre Body', 'Full Service History'],
    status: 'available' as const,
    featured: true,
  },
  {
    title: 'Ferrari LaFerrari Aperta',
    slug: 'ferrari-laferrari-aperta',
    category: 'supercar' as const,
    description: 'The rarest of Ferrari\'s open-top hypercars — LaFerrari Aperta in Rosso Corsa with a specially commissioned Nero interior featuring Tricolore accents. Delivered new to a prominent Ferrari collector and maintained exclusively by Ferrari Classiche.',
    price: 7800000,
    priceDisplay: '$7,800,000',
    location: 'Monaco',
    country: 'Monaco',
    images: [
      'https://images.unsplash.com/photo-1592198084033-aade902d1aae?w=1200&q=85',
    ],
    specs: { power: '963 hp', acceleration: '2.9s 0-62', engine: 'V12 HY-KERS', production: 210, km: 1840 },
    features: ['Rosso Corsa', 'Ferrari Classiche Certified', 'HY-KERS Hybrid', 'Active Aerodynamics', 'One Owner'],
    status: 'under_offer' as const,
    featured: true,
  },
  {
    title: 'Koenigsegg Regera',
    slug: 'koenigsegg-regera',
    category: 'supercar' as const,
    description: 'An automotive singularity — the Regera produces 1,500 hp through its unique Koenigsegg Direct Drive system, eliminating the traditional gearbox entirely. This UK-supplied example in Liquid Silver with blue-tinted carbon fibre is one of just 80 in existence.',
    price: 6400000,
    priceDisplay: '$6,400,000',
    location: 'London',
    country: 'United Kingdom',
    images: [
      'https://images.unsplash.com/photo-1514316703755-dca7d7d9d882?w=1200&q=85',
    ],
    specs: { power: '1,500 hp', topSpeed: '255 mph', acceleration: '2.7s 0-62', production: 80, km: 450 },
    features: ['Direct Drive System', 'Liquid Silver', 'Blue Carbon Fibre', '80 Built Worldwide', 'Full Koenigsegg Service'],
    status: 'available' as const,
    featured: false,
  },
  {
    title: 'Rolls-Royce Phantom Bespoke',
    slug: 'rolls-royce-phantom-bespoke',
    category: 'supercar' as const,
    description: 'A singular Phantom commissioned through the Rolls-Royce Bespoke programme — the Gallery dashboard features a hand-painted celestial map commemorating the owner\'s birth date. Starlight Headliner, Lambswool rugs, and a hand-stitched Seashell leather interior.',
    price: 850000,
    priceDisplay: '$850,000',
    location: 'Dubai',
    country: 'UAE',
    images: [
      'https://images.unsplash.com/photo-1563720223185-11003d516935?w=1200&q=85',
    ],
    specs: { power: '571 hp', engine: '6.75L V12', year: 2023, km: 3200 },
    features: ['Bespoke Gallery Dashboard', 'Starlight Headliner', 'Lambswool Rugs', 'Commissioned Art', 'Champagne Cooler'],
    status: 'available' as const,
    featured: false,
  },

  // YACHTS
  {
    title: 'M/Y Aphrodite — 73m Superyacht',
    slug: 'my-aphrodite-73m-superyacht',
    category: 'yacht' as const,
    description: 'Delivered in 2022 from Lürssen\'s Rendsburg shipyard, Aphrodite represents the zenith of contemporary superyacht design. Her sweeping exterior by Espen Øino and interior by Reymond Langton accommodate 12 guests across six palatial staterooms. Range of 6,000 nautical miles.',
    price: null,
    priceDisplay: 'Price On Application',
    location: 'Monaco',
    country: 'France',
    images: [
      'https://images.unsplash.com/photo-1567899378494-47b22a2ae96a?w=1200&q=85',
    ],
    specs: { length: '73m', guests: 12, crew: 22, range: '6,000 nm', speed: '18 knots', year: 2022, builder: 'Lürssen' },
    features: ['6 Guest Staterooms', 'Spa & Gym', 'Beach Club', 'Helipad', 'Toy Garage', 'Zero-Speed Stabilisers'],
    status: 'available' as const,
    featured: true,
  },
  {
    title: 'S/Y Altair — 55m Sailing Ketch',
    slug: 'sy-altair-55m-sailing-ketch',
    category: 'yacht' as const,
    description: 'A masterpiece of the sailing world — Altair was conceived by Philippe Briand and built by Perini Navi as a performance sailing ketch capable of crossing oceans in extraordinary comfort. Fully carbon rig, hydraulic furling sails, and an interior that would not be out of place in a boutique hotel.',
    price: 18500000,
    priceDisplay: '$18,500,000',
    location: 'Palma de Mallorca',
    country: 'Spain',
    images: [
      'https://images.unsplash.com/photo-1605281317010-fe5ffe798166?w=1200&q=85',
    ],
    specs: { length: '55m', guests: 10, crew: 9, range: 'Unlimited', builder: 'Perini Navi', year: 2018 },
    features: ['Carbon Rig', 'Hydraulic Sails', '4 Guest Cabins', 'Zero-Emissions Mode', 'Stabilised', 'Full Race Record'],
    status: 'available' as const,
    featured: false,
  },

  // INTERIOR DECOR
  {
    title: 'Baccarat Crystal Chandelier — Grand Palais Edition',
    slug: 'baccarat-crystal-chandelier-grand-palais',
    category: 'decor' as const,
    description: 'A museum-quality chandelier crafted by Baccarat\'s master crystal artisans for the Grand Palais collection. 2,400 individually hand-cut crystals suspended across a 3-metre armature of gilded bronze. Designed for reception halls and grand residences requiring an defining centrepiece.',
    price: 380000,
    priceDisplay: '$380,000',
    location: 'Paris',
    country: 'France',
    images: [
      'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=1200&q=85',
    ],
    specs: { diameter: '3.2m', height: '2.8m', crystals: 2400, material: 'Lead Crystal & Gilded Bronze', edition: 'Grand Palais' },
    features: ['Hand-Cut Crystal', 'Gilded Bronze Frame', 'Baccarat Certificate', 'White Glove Installation', 'Dimmable LED'],
    status: 'available' as const,
    featured: false,
  },
  {
    title: 'Hermès Compagnie des Arts Armchair',
    slug: 'hermes-armchair-compagnie-des-arts',
    category: 'decor' as const,
    description: 'A singular armchair from Hermès Maison — part of the exclusive Compagnie des Arts Équestres collection. Saddle-stitched Barenia leather over a hand-carved walnut frame, with a seat cushion in the iconic H-weave pattern. One of just 12 produced globally.',
    price: 95000,
    priceDisplay: '$95,000',
    location: 'New York',
    country: 'United States',
    images: [
      'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=1200&q=85',
    ],
    specs: { material: 'Barenia Leather & Walnut', edition: 'Compagnie des Arts', pieces: 12 },
    features: ['Barenia Leather', 'Saddle-Stitched', 'Hand-Carved Walnut', '1 of 12', 'Hermès Certificate'],
    status: 'available' as const,
    featured: false,
  },

  // COMMERCIAL
  {
    title: 'Mayfair Mixed-Use Trophy Asset',
    slug: 'mayfair-mixed-use-trophy',
    category: 'commercial' as const,
    description: 'A landmark freehold building on Mount Street, Mayfair — comprising four retail units at ground floor, eight residential apartments above, and a lateral penthouse commanding rooftop views across Berkeley Square. Passing rent of £3.2m per annum with strong reversionary potential.',
    price: null,
    priceDisplay: 'Price On Application',
    location: 'Mayfair, London',
    country: 'United Kingdom',
    images: [
      'https://images.unsplash.com/photo-1486325212027-8081e485255e?w=1200&q=85',
    ],
    specs: { gia: '3,200 m²', tenure: 'Freehold', noi: '£3.2m pa', units: 12, yield: '4.2%' },
    features: ['Freehold', 'Mixed-Use', 'Prime Mayfair', 'Strong Rent Roll', 'Reversionary', 'Trophy Asset'],
    status: 'available' as const,
    featured: true,
  },
  {
    title: 'Dubai DIFC Grade-A Office Tower',
    slug: 'dubai-difc-office-tower',
    category: 'commercial' as const,
    description: 'A 42-storey fully-let Grade-A office tower in Dubai International Financial Centre — leased to a roster of sovereign wealth funds and global financial institutions. LEED Platinum certified, net income of AED 95m per annum, with leases averaging 7.5 years unexpired.',
    price: null,
    priceDisplay: 'Price On Application',
    location: 'DIFC, Dubai',
    country: 'UAE',
    images: [
      'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1200&q=85',
    ],
    specs: { floors: 42, gla: '82,000 m²', tenants: 18, noi: 'AED 95m pa', leed: 'Platinum', wault: '7.5 years' },
    features: ['LEED Platinum', 'Fully Let', 'Grade-A', 'Blue Chip Tenants', 'DIFC Jurisdiction', 'Below Replacement Cost'],
    status: 'available' as const,
    featured: false,
  },

  // LIFESTYLE
  {
    title: 'Airbus ACH130 Private Helicopter',
    slug: 'airbus-ach130-private-helicopter',
    category: 'lifestyle' as const,
    description: 'The Airbus ACH130 configured in ACH Corporate trim — the most refined single-engine helicopter available. Cabin finished in hand-stitched Nappa leather with polished Macassar Ebony accents. Based at Nice Côte d\'Azur with an approved maintenance contract through 2027.',
    price: 4200000,
    priceDisplay: '$4,200,000',
    location: 'Nice',
    country: 'France',
    images: [
      'https://images.unsplash.com/photo-1540979388789-6cee28a1cdc9?w=1200&q=85',
    ],
    specs: { seats: 5, range: '630 km', speed: '233 km/h', year: 2022, hours: 210, engine: 'Safran Arriel 2D' },
    features: ['ACH Corporate Trim', 'Nappa Leather', 'Macassar Ebony', 'EASA Certified', 'Maintenance Contract', 'Hangar Deal'],
    status: 'available' as const,
    featured: true,
  },
  {
    title: 'Private Members Club — St. Moritz',
    slug: 'private-members-club-st-moritz',
    category: 'lifestyle' as const,
    description: 'Lifetime founding membership in a newly established private members club at the Suvretta House, St. Moritz — offering ski-in access, a dedicated chalet suite allocation, Michelin-starred dining, and access to partner clubs across 22 cities including London, New York, and Tokyo.',
    price: 650000,
    priceDisplay: '$650,000',
    location: 'St. Moritz',
    country: 'Switzerland',
    images: [
      'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=1200&q=85',
    ],
    specs: { membership: 'Founding Lifetime', partnerClubs: 22, suitesAllocated: 4, diningStars: 2 },
    features: ['Ski-In Access', 'Chalet Suites', 'Michelin Dining', '22 Partner Clubs', 'Global Network', 'Lifetime'],
    status: 'available' as const,
    featured: false,
  },
]

async function main() {
  console.log('Seeding Lux Catalog database...')

  await prisma.inquiry.deleteMany()
  await prisma.savedListing.deleteMany()
  await prisma.listing.deleteMany()

  for (const listing of listings) {
    await prisma.listing.create({ data: listing })
    process.stdout.write('.')
  }

  console.log(`\nSeeded ${listings.length} listings.`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
