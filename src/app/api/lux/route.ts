import { NextResponse } from 'next/server'
import { clientIp, rateLimit } from '@/lib/protect'
import { luxAnswer, type LuxMessage } from '@/lib/lux-server'

export const maxDuration = 30

const MAX_BODY = 30_000
const MAX_MESSAGES = 20
const MAX_CHARS = 600

// Lux, the chat. Reads the conversation, answers from real listings, never
// takes payment or documents, and is rate limited per visitor.
export async function POST(req: Request) {
  if (!(await rateLimit(`lux:${clientIp(req.headers)}`, 30, 3_600_000))) {
    return NextResponse.json({ error: 'That is a lot of messages in a short time. Please give me a moment and try again, or ask for a person.' }, { status: 429 })
  }
  const raw = await req.text()
  if (raw.length > MAX_BODY) return NextResponse.json({ error: 'That message is too large.' }, { status: 413 })
  let body: unknown
  try {
    body = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: 'Please send a message.' }, { status: 400 })
  }
  const input = (body as { messages?: unknown })?.messages
  if (!Array.isArray(input) || input.length === 0) return NextResponse.json({ error: 'Please send a message.' }, { status: 400 })

  const messages: LuxMessage[] = []
  for (const m of input.slice(-MAX_MESSAGES)) {
    const role = (m as { role?: unknown })?.role
    const content = (m as { content?: unknown })?.content
    if ((role !== 'user' && role !== 'assistant') || typeof content !== 'string') return NextResponse.json({ error: 'Please send a message.' }, { status: 400 })
    messages.push({ role, content: content.slice(0, MAX_CHARS) })
  }
  const last = messages[messages.length - 1]
  if (last.role !== 'user' || !last.content.trim()) return NextResponse.json({ error: 'Please send a message.' }, { status: 400 })

  const ctx = (body as { context?: { listingSlug?: unknown } }).context
  const listingSlug = typeof ctx?.listingSlug === 'string' && /^[a-z0-9-]{1,160}$/.test(ctx.listingSlug) ? ctx.listingSlug : undefined

  try {
    return NextResponse.json(await luxAnswer(messages, listingSlug))
  } catch (err) {
    console.error('Lux error:', err)
    return NextResponse.json({ error: 'Something went wrong on my side. Please try again, or ask for a person.' }, { status: 500 })
  }
}
