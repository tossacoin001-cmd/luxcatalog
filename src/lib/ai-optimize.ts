import Anthropic from '@anthropic-ai/sdk'
import { betaJSONSchemaOutputFormat } from '@anthropic-ai/sdk/helpers/beta/json-schema'
import { categoryLabels, splitHighlights } from '@/lib/utils'

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
  // Short, scannable outline points ("4 en-suite bedrooms", "24/7 power").
  highlights: string[]
}

// Structured output: the API guarantees the response matches this schema, so
// there is no JSON.parse of free text to go wrong. Specs are an array of
// label/value pairs (structured outputs need a fixed shape, not a free map).
const OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    description: { type: 'string' },
    priceDisplay: { type: 'string' },
    specs: {
      type: 'array',
      items: {
        type: 'object',
        properties: { label: { type: 'string' }, value: { type: 'string' } },
        required: ['label', 'value'],
        additionalProperties: false,
      },
    },
    highlights: { type: 'array', items: { type: 'string' } },
  },
  required: ['description', 'priceDisplay', 'specs', 'highlights'],
  additionalProperties: false,
} as const

// Runs a partner's plain-language submission through Claude to produce
// on-brand copy, structured specs and an outline of highlights before an
// admin reviews it. Never throws: if the key is missing or the call fails,
// the caller gets the draft's own values back so submission is never blocked
// by an AI outage, matching the WhatsApp-fallback pattern used elsewhere.
export async function optimizeListingDraft(draft: ListingDraft): Promise<OptimizedListing> {
  const fallback: OptimizedListing = {
    description: draft.description,
    specs: {},
    priceDisplay: draft.priceDisplay,
    highlights: splitHighlights(draft.description),
  }

  if (!process.env.ANTHROPIC_API_KEY) return fallback

  try {
    const client = new Anthropic()
    const categoryLabel = categoryLabels[draft.category] ?? draft.category

    const prompt = `You are the editorial copywriter for Lux Catalog, a luxury marketplace (Lagos first, expanding worldwide). A partner submitted a listing in plain language. Polish it and structure it, using only facts present in their text.

LISTING SUBMITTED BY PARTNER
- Category: ${categoryLabel}
- Title: ${draft.title}
- Location: ${draft.location}, ${draft.country}
- Price display: ${draft.priceDisplay}
- Description (raw): ${draft.description}

Produce:
- description: an elegant 2-4 sentence description in Lux Catalog's voice. Tell the story; leave itemised facts to highlights.
- highlights: the concrete things a client gets, one per item, each short and scannable (2-8 words, no trailing full stop), most important first. Example: "4 en-suite bedrooms", "Private chef on request", "24/7 power and security". Up to 12 items.
- specs: short label/value facts genuinely stated or clearly implied (e.g. Bedrooms: 4, Year: 2023, Capacity: 12 guests). Empty if nothing fits.
- priceDisplay: the price tidied (thousands separators, currency symbol), otherwise unchanged.

Never add amenities, measurements or claims the partner did not mention. A shorter honest listing beats an embellished one.`

    const response = await client.beta.messages.parse({
      model: 'claude-opus-5-5',
      max_tokens: 4000,
      output_config: { effort: 'low', format: betaJSONSchemaOutputFormat(OUTPUT_SCHEMA) },
      // If the primary model declines, the API re-runs on the fallback model
      // within the same call.
      betas: ['server-side-fallback-2026-06-01'],
      fallbacks: [{ model: 'claude-opus-4-8' }],
      messages: [{ role: 'user', content: prompt }],
    })

    const data = response.stop_reason === 'refusal' ? null : response.parsed_output
    if (!data) return fallback

    const specs = Object.fromEntries(
      data.specs.filter((s) => s.label.trim() && s.value.trim()).map((s) => [s.label.trim(), s.value.trim()])
    )
    const highlights = data.highlights.map((h) => h.trim()).filter(Boolean).slice(0, 12)

    return {
      description: data.description.trim() || fallback.description,
      specs,
      priceDisplay: data.priceDisplay.trim() || fallback.priceDisplay,
      highlights: highlights.length ? highlights : fallback.highlights,
    }
  } catch (err) {
    console.error('AI listing optimization error:', err)
    return fallback
  }
}
