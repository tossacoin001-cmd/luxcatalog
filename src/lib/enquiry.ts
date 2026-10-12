// Enquiry and viewing-request rules shared by the form and the API. Pure.
// Guests don't need an account to enquire; the API adds a bot check and a
// rate limit on top of these rules.

export const VIEWING_TIMES = [
  { key: 'morning', label: 'Morning (9am–12pm)' },
  { key: 'afternoon', label: 'Afternoon (12pm–4pm)' },
  { key: 'evening', label: 'Evening (4pm–7pm)' },
] as const

export const VIEWING_MODES = [
  { key: 'in_person', label: 'In person' },
  { key: 'video', label: 'Video call' },
] as const

export const VIEWING_MAX_DAYS = 90

export type EnquiryData = {
  kind: 'enquiry' | 'viewing'
  name: string
  email: string
  phone: string | null
  message: string
  preferredDate: Date | null
  preferredTime: string | null
  viewingMode: string | null
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
const lagosDay = (d: Date) => new Date(d.getTime() + 3_600_000).toISOString().slice(0, 10)

export function validateEnquiry(body: Record<string, unknown>, now = new Date()): { ok: true; data: EnquiryData } | { ok: false; error: string } {
  const name = str(body.name), email = str(body.email).toLowerCase(), phone = str(body.phone), message = str(body.message)
  if (!name) return { ok: false, error: 'Please add your name' }
  if (name.length > 120) return { ok: false, error: 'Please shorten your name' }
  if (!EMAIL.test(email) || email.length > 200) return { ok: false, error: 'Please add a valid email address' }
  if (phone.length > 40) return { ok: false, error: 'Please check your phone number' }
  if (message.length < 5) return { ok: false, error: 'Please tell us a little about what you need' }
  if (message.length > 3000) return { ok: false, error: 'Please keep your message under 3,000 characters' }

  const kind = body.kind === 'viewing' ? 'viewing' : 'enquiry'
  let preferredDate: Date | null = null, preferredTime: string | null = null, viewingMode: string | null = null
  if (kind === 'viewing') {
    const d = str(body.preferredDate)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || Number.isNaN(Date.parse(`${d}T00:00:00Z`))) return { ok: false, error: 'Choose a day for the viewing' }
    const today = lagosDay(now)
    const days = Math.round((Date.parse(`${d}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000)
    if (days < 1) return { ok: false, error: 'Viewings can be booked from tomorrow' }
    if (days > VIEWING_MAX_DAYS) return { ok: false, error: `Viewings can be booked up to ${VIEWING_MAX_DAYS} days ahead` }
    if (!VIEWING_TIMES.some((t) => t.key === body.preferredTime)) return { ok: false, error: 'Choose a time of day' }
    if (!VIEWING_MODES.some((m) => m.key === body.viewingMode)) return { ok: false, error: 'Choose in person or video call' }
    preferredDate = new Date(`${d}T00:00:00Z`)
    preferredTime = String(body.preferredTime)
    viewingMode = String(body.viewingMode)
  }
  return { ok: true, data: { kind, name, email, phone: phone || null, message, preferredDate, preferredTime, viewingMode } }
}

export const viewingTimeLabel = (k: string | null) => VIEWING_TIMES.find((t) => t.key === k)?.label ?? k ?? ''
export const viewingModeLabel = (k: string | null) => VIEWING_MODES.find((m) => m.key === k)?.label ?? k ?? ''
