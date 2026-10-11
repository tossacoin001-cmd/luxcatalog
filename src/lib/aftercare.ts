// After a booking is made: session reminders, guests reporting a concern,
// and linking a service to a guest's Lux Catalog stay. Pure: no database.

// The daily job (07:00 Lagos) reminds every paid session starting within
// this many hours, so each session is reminded between 0 and 36 hours ahead.
export const REMINDER_HOURS = 36

export function reminderDue(start: Date, now = new Date()) {
  const h = (start.getTime() - now.getTime()) / 3_600_000
  return h > 0 && h <= REMINDER_HOURS
}

export const CONCERN_KINDS = [
  { key: 'safety', label: 'Safety or conduct', urgent: true },
  { key: 'no_show', label: 'Late or didn’t arrive', urgent: false },
  { key: 'quality', label: 'Quality of the service', urgent: false },
  { key: 'billing', label: 'Payment or refund', urgent: false },
  { key: 'other', label: 'Something else', urgent: false },
] as const

export type ConcernKind = (typeof CONCERN_KINDS)[number]['key']
export const MAX_CONCERNS_PER_BOOKING = 5

export const concernKind = (key: string) => CONCERN_KINDS.find((k) => k.key === key)

export function validateConcern(kind: unknown, message: unknown): string | null {
  if (typeof kind !== 'string' || !concernKind(kind)) return 'Choose what the concern is about'
  const m = typeof message === 'string' ? message.trim() : ''
  if (m.length < 10) return 'Tell us what happened (a sentence or two)'
  if (m.length > 2000) return 'Please keep it under 2,000 characters'
  return null
}

export type StayRef = { reference: string; title: string; location: string }

// Prefilled address for a service at the guest's Lux Catalog stay. The guest
// adds their flat or unit after it.
export const stayAddress = (s: StayRef) => `${s.title}, ${s.location} (Lux Catalog stay ${s.reference}). Flat/unit: `

const ALIASES: Record<string, string[]> = { 'Victoria Island': ['VI', 'V.I.'] }

// The served area a stay's location falls in, if any (longest name wins,
// so "Lekki Phase 1" beats "Lekki").
export function areaFromLocation(location: string, areas: string[]): string | null {
  const words = ` ${location.toLowerCase().replace(/[^a-z0-9.]+/g, ' ')} `
  const hit = (name: string) => words.includes(` ${name.toLowerCase().replace(/[^a-z0-9.]+/g, ' ').trim()} `)
  const found = areas.filter((a) => hit(a) || (ALIASES[a] ?? []).some(hit))
  return found.sort((a, b) => b.length - a.length)[0] ?? null
}
