import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'AI Discovery is not configured in this environment' }, { status: 503 })
    }

    const { preferences } = await req.json()

    const listings = await prisma.listing.findMany({
      where: { status: { not: 'sold' } },
      select: {
        title: true, slug: true, category: true, priceDisplay: true, location: true, country: true, description: true,
      },
      take: 100,
    })

    if (listings.length === 0) {
      return NextResponse.json({
        summary: "We're still building out the catalog, no assets are listed yet. Reach out directly and a specialist will help you find what you're after.",
        matches: [],
      })
    }

    const client = new Anthropic()

    const prompt = `You are a luxury asset advisor for Lux Catalog, a Nigeria-based luxury marketplace (real estate, shortlets, supercars, yachts, executive chauffeur/security services, interior decor, commercial property, lifestyle) serving Lagos, Abuja, and the wider Nigerian market, with a global client base including diaspora Nigerians. Prices are in Nigerian Naira (₦) unless marked otherwise. Based on the client's preferences below, analyse our actual current catalog and return the most suitable assets for this client.

CLIENT PREFERENCES:
- Categories of interest: ${(preferences.categories ?? []).join(', ') || 'any'}
- Budget range: ${(preferences.budget ?? ['not specified'])[0]}
- Preferred regions: ${(preferences.location ?? []).join(', ') || 'any'}
- Lifestyle descriptors: ${(preferences.lifestyle ?? []).join(', ') || 'not specified'}

OUR CURRENT CATALOG (only recommend assets from this list, do not invent assets):
${listings.map((a, i) => `${i + 1}. ${a.title} | Category: ${a.category} | Price: ${a.priceDisplay} | Location: ${a.location}, ${a.country} | ${a.description}`).join('\n')}

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
- Return up to 5 matches, ordered by relevance (best first). If fewer than 5 catalog items genuinely fit, return fewer rather than padding with weak matches.
- matchScore is an integer 60-99 (no two the same)
- reason must be specific and refer to the client's actual preferences
- Only use slugs, titles, categories, and priceDisplays that exist verbatim in the catalog above
- Respond with ONLY the JSON, no markdown, no explanation`

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
