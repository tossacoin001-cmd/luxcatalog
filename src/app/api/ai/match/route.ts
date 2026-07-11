import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const catalog = [
  { title: 'Cap Ferrat Clifftop Villa',        slug: 'cap-ferrat-clifftop-villa',         category: 'real_estate', priceDisplay: '$48,000,000',          location: 'France',          description: 'Clifftop villa, 5 bedrooms, infinity pool, private beach, Côte d\'Azur' },
  { title: 'Manhattan Sky Penthouse',           slug: 'manhattan-sky-penthouse',           category: 'real_estate', priceDisplay: '$35,000,000',          location: 'New York, USA',   description: 'Duplex penthouse, 4 beds, 270° panorama, Central Park & Hudson River views' },
  { title: 'Maldives Overwater Estate',         slug: 'maldives-overwater-estate',         category: 'real_estate', priceDisplay: 'Price On Application', location: 'Maldives',        description: 'Overwater estate on private sandbank, 6 bedrooms, private lagoon, jetty' },
  { title: 'Belgravia Garden Townhouse',        slug: 'belgravia-garden-townhouse',        category: 'real_estate', priceDisplay: '£22,500,000',          location: 'London, UK',      description: 'Grade II listed stucco townhouse, 7 bedrooms, 100ft garden, Belgravia' },
  { title: 'Bugatti Chiron Super Sport 300+',   slug: 'bugatti-chiron-super-sport-300',    category: 'supercar',    priceDisplay: '$5,200,000',           location: 'Geneva',          description: '1 of 30 units, 1600hp, 304mph, Deep Blue Carbon, 312km from new' },
  { title: 'Ferrari LaFerrari Aperta',          slug: 'ferrari-laferrari-aperta',          category: 'supercar',    priceDisplay: '$7,800,000',           location: 'Monaco',          description: 'Open-top hypercar, 963hp V12 HY-KERS, Rosso Corsa, 1840km, Ferrari Classiche' },
  { title: 'Koenigsegg Regera',                 slug: 'koenigsegg-regera',                 category: 'supercar',    priceDisplay: '$6,400,000',           location: 'London, UK',      description: '1500hp, Direct Drive, 1 of 80, Liquid Silver, blue carbon fibre' },
  { title: 'Rolls-Royce Phantom Bespoke',       slug: 'rolls-royce-phantom-bespoke',       category: 'supercar',    priceDisplay: '$850,000',             location: 'Dubai, UAE',      description: 'Gallery dashboard with celestial map, Starlight headliner, bespoke commission' },
  { title: 'M/Y Aphrodite — 73m Superyacht',    slug: 'my-aphrodite-73m-superyacht',       category: 'yacht',       priceDisplay: 'Price On Application', location: 'Monaco, France',  description: '73m Lürssen, 12 guests, spa, beach club, helipad, 2022 delivery' },
  { title: 'S/Y Altair — 55m Sailing Ketch',    slug: 'sy-altair-55m-sailing-ketch',       category: 'yacht',       priceDisplay: '$18,500,000',          location: 'Palma, Spain',    description: '55m Perini Navi sailing ketch, 10 guests, carbon rig, unlimited range' },
  { title: 'Baccarat Crystal Chandelier',       slug: 'baccarat-crystal-chandelier-grand-palais', category: 'decor', priceDisplay: '$380,000',           location: 'Paris, France',   description: '2,400 hand-cut crystals, gilded bronze, 3.2m diameter, Grand Palais edition' },
  { title: 'Hermès Armchair — Compagnie des Arts', slug: 'hermes-armchair-compagnie-des-arts', category: 'decor',   priceDisplay: '$95,000',            location: 'New York, USA',   description: 'Barenia leather, saddle-stitched, hand-carved walnut, 1 of 12' },
  { title: 'Mayfair Mixed-Use Trophy Asset',    slug: 'mayfair-mixed-use-trophy',          category: 'commercial',  priceDisplay: 'Price On Application', location: 'Mayfair, London', description: 'Freehold, Mount Street, £3.2m pa income, 12 units, 4.2% yield' },
  { title: 'Dubai DIFC Grade-A Office Tower',   slug: 'dubai-difc-office-tower',           category: 'commercial',  priceDisplay: 'Price On Application', location: 'DIFC, Dubai',     description: '42 floors, 82,000m², LEED Platinum, AED 95m income, sovereign tenants' },
  { title: 'Airbus ACH130 Private Helicopter',  slug: 'airbus-ach130-private-helicopter',  category: 'lifestyle',   priceDisplay: '$4,200,000',           location: 'Nice, France',    description: 'ACH Corporate trim, 5 seats, 630km range, Nappa leather, 210 hours' },
  { title: 'Private Members Club — St. Moritz', slug: 'private-members-club-st-moritz',    category: 'lifestyle',   priceDisplay: '$650,000',             location: 'St. Moritz',      description: 'Founding lifetime membership, ski-in, 22 partner clubs, Michelin dining' },
]

export async function POST(req: Request) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'AI Discovery is not configured in this environment' }, { status: 503 })
    }
    const client = new Anthropic()

    const { preferences } = await req.json()

    const prompt = `You are a luxury asset advisor for Lux Catalog. Based on the client's preferences below, analyse our catalog and return the top 5 most suitable assets for this client.

CLIENT PREFERENCES:
- Categories of interest: ${(preferences.categories ?? []).join(', ') || 'any'}
- Budget range: ${(preferences.budget ?? ['not specified'])[0]}
- Preferred regions: ${(preferences.location ?? []).join(', ') || 'global'}
- Lifestyle descriptors: ${(preferences.lifestyle ?? []).join(', ') || 'not specified'}

OUR CATALOG (all available assets):
${catalog.map((a, i) => `${i + 1}. ${a.title} | Category: ${a.category} | Price: ${a.priceDisplay} | Location: ${a.location} | ${a.description}`).join('\n')}

Return a JSON object with this exact structure:
{
  "summary": "One elegant sentence summarising your recommendation approach for this client.",
  "matches": [
    {
      "title": "exact title from catalog",
      "slug": "exact slug from catalog",
      "category": "exact category from catalog",
      "priceDisplay": "exact priceDisplay from catalog",
      "matchScore": 95,
      "reason": "Two sentences explaining precisely why this asset suits this client's preferences."
    }
  ]
}

Rules:
- Return exactly 5 matches, ordered by relevance (best first)
- matchScore is an integer 60-99 (no two the same)
- reason must be specific and refer to the client's actual preferences
- Only use slugs, titles, categories, and priceDisplays that exist verbatim in the catalog above
- Respond with ONLY the JSON — no markdown, no explanation`

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    const data = JSON.parse(text)

    return NextResponse.json(data)
  } catch (err) {
    console.error('AI match error:', err)
    return NextResponse.json({ error: 'Matching failed' }, { status: 500 })
  }
}
