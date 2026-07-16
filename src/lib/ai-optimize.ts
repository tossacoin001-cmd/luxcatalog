import Anthropic from '@anthropic-ai/sdk'
import { categoryLabels } from '@/lib/utils'

export interface ListingDraft {
  title: string
  category: string
  description: string
  priceDisplay: string
  location: string
  country: string
}

export interface OptimizedListing {
  description: string
  specs: Record<string, string>
  priceDisplay: string
}

// Runs a partner's plain-language submission through Claude to produce
// on-brand copy and structured specs before the listing is ever shown to an
// admin for review. Never throws, if the key is missing or the call fails,
// the caller gets the draft's own values back unchanged so submission is
// never blocked by an AI outage, matching the WhatsApp-fallback pattern used
// elsewhere on this site.
export async function optimizeListingDraft(draft: ListingDraft): Promise<OptimizedListing> {
  const fallback: OptimizedListing = {
    description: draft.description,
    specs: {},
    priceDisplay: draft.priceDisplay,
  }

  if (!process.env.ANTHROPIC_API_KEY) return fallback

  try {
    const client = new Anthropic()
    const categoryLabel = categoryLabels[draft.category] ?? draft.category

    const prompt = `You are the editorial copywriter for Lux Catalog, a Nigeria-based luxury marketplace. A partner has submitted a new listing in plain language. Polish it into on-brand copy and extract structured specs, without inventing facts that aren't implied by their text.

LISTING SUBMITTED BY PARTNER:
- Category: ${categoryLabel}
- Title: ${draft.title}
- Location: ${draft.location}, ${draft.country}
- Price display: ${draft.priceDisplay}
- Description (raw, as written by the partner): ${draft.description}

Return a JSON object with this exact structure:
{
  "description": "A polished, elegant 2-4 sentence description in Lux Catalog's voice, based only on what the partner actually wrote, no invented features or claims",
  "specs": { "key": "value" },
  "priceDisplay": "cleaned-up price display string, e.g. proper thousands separators and currency symbol"
}

Rules:
- specs should be short key-value pairs genuinely inferable from the description (e.g. material, size, brand, condition), use as few or as many as are actually supported, an empty object is fine if nothing is inferable
- Do not add features, measurements, or claims the partner didn't mention
- Keep the tone consistent with a luxury brand, but factual
- Respond with ONLY the JSON, no markdown, no explanation`

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    const data = JSON.parse(text)

    return {
      description: typeof data.description === 'string' && data.description.trim() ? data.description : fallback.description,
      specs: data.specs && typeof data.specs === 'object' ? data.specs : fallback.specs,
      priceDisplay: typeof data.priceDisplay === 'string' && data.priceDisplay.trim() ? data.priceDisplay : fallback.priceDisplay,
    }
  } catch (err) {
    console.error('AI listing optimization error:', err)
    return fallback
  }
}
