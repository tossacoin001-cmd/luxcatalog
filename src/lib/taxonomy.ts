// LuxCatalog's catalogue structure: main categories (the Category enum) and
// the sub-collections customers actually shop for. One source of truth for
// admin forms, catalog filters and (later) the booking engine.

export type Mode = 'sale' | 'rent' | 'booking' | 'request'

export type Subcategory = {
  key: string
  label: string
  mode: Mode
  // For bookable sub-collections: how time is sold.
  unit?: 'night' | 'day' | 'hour' | 'slot'
}

export const MODE_LABELS: Record<Mode, string> = {
  sale: 'For Sale',
  rent: 'For Rent',
  booking: 'Book Online',
  request: 'On Request',
}

export const SUBCATEGORIES: Record<string, Subcategory[]> = {
  real_estate: [
    { key: 'for_sale', label: 'For Sale', mode: 'sale' },
    { key: 'for_rent', label: 'For Rent', mode: 'rent' },
    { key: 'luxury_shortlets', label: 'Luxury Shortlets', mode: 'booking', unit: 'night' },
  ],
  // Legacy top-level category kept so existing URLs work; it belongs to the
  // Prime Real Estate pillar as the Luxury Shortlets sub-collection.
  shortlet: [{ key: 'luxury_shortlets', label: 'Luxury Shortlets', mode: 'booking', unit: 'night' }],
  supercar: [
    { key: 'for_sale', label: 'For Sale', mode: 'sale' },
    { key: 'car_rental', label: 'Private Car Rental', mode: 'booking', unit: 'day' },
  ],
  yacht: [
    { key: 'for_sale', label: 'For Sale', mode: 'sale' },
    { key: 'boat_cruises', label: 'Boat Cruises & Charters', mode: 'booking', unit: 'slot' },
    { key: 'aqua_homes', label: 'Aqua Homes', mode: 'booking', unit: 'night' },
  ],
  executive_services: [
    { key: 'chauffeur', label: 'Chauffeur', mode: 'booking', unit: 'day' },
    { key: 'close_protection', label: 'Close Protection', mode: 'booking', unit: 'day' },
  ],
  lifestyle: [
    { key: 'private_jets', label: 'Private Jets', mode: 'request' },
    { key: 'experiences', label: 'Experiences', mode: 'request' },
  ],
  commercial: [
    { key: 'for_sale', label: 'For Sale', mode: 'sale' },
    { key: 'for_lease', label: 'For Lease', mode: 'rent' },
  ],
  decor: [{ key: 'for_sale', label: 'For Sale', mode: 'sale' }],
}

export function subcategoriesFor(category: string): Subcategory[] {
  return SUBCATEGORIES[category] ?? []
}

export function findSubcategory(category: string, key: string | null | undefined): Subcategory | undefined {
  return key ? subcategoriesFor(category).find((s) => s.key === key) : undefined
}

// The mode a listing gets when nothing else says otherwise.
export function defaultMode(category: string, subcategory?: string | null): Mode {
  return findSubcategory(category, subcategory)?.mode ?? subcategoriesFor(category)[0]?.mode ?? 'sale'
}

// Ready-made spec fields per sub-collection so partners describe like with
// like and customers can compare. Stored in Listing.specs under these labels.
export const SPEC_TEMPLATES: Record<string, string[]> = {
  luxury_shortlets: ['Bedrooms', 'Bathrooms', 'Max Guests', 'Check-in', 'Check-out', 'Power Supply'],
  aqua_homes: ['Bedrooms', 'Max Guests', 'Marina / Jetty', 'Check-in', 'Check-out'],
  for_rent: ['Bedrooms', 'Bathrooms', 'Lease Term', 'Service Charge', 'Furnished'],
  car_rental: ['Make & Model', 'Year', 'Seats', 'Chauffeur Included', 'Daily Hours', 'Pickup Area'],
  boat_cruises: ['Vessel', 'Capacity', 'Duration', 'Departure Jetty', 'Crew', 'Life Jackets'],
  chauffeur: ['Vehicle', 'Hours per Day', 'Languages', 'Coverage Area'],
  close_protection: ['Team Size', 'Vehicles', 'Coverage Area', 'Licence (NSCDC)'],
  private_jets: ['Aircraft', 'Seats', 'Range'],
}

export function specTemplate(subcategory: string | null | undefined): string[] {
  return subcategory ? SPEC_TEMPLATES[subcategory] ?? [] : []
}

// Default commission (percent of the client price), approved by the founder
// 2026-10-08. Real values live in CommissionRule rows and can
// be changed per category or per partner by an admin; these only seed them.
export const DEFAULT_COMMISSION: { category?: string; subcategory?: string; mode?: Mode; ratePercent: number; payoutTiming: string; notes: string }[] = [
  { subcategory: 'luxury_shortlets', ratePercent: 15, payoutTiming: 'after_checkin', notes: 'Self-managed host. Lux Managed: 20-25% (set per partner).' },
  { subcategory: 'aqua_homes', ratePercent: 15, payoutTiming: 'after_checkin', notes: 'As shortlets.' },
  { subcategory: 'car_rental', ratePercent: 18, payoutTiming: 'after_checkin', notes: 'Chauffeur-driven first; 15-20% range.' },
  { subcategory: 'chauffeur', ratePercent: 18, payoutTiming: 'after_checkin', notes: '15-20% range.' },
  { subcategory: 'close_protection', ratePercent: 18, payoutTiming: 'after_completion', notes: '15-20% range; paid after the assignment ends.' },
  { subcategory: 'boat_cruises', ratePercent: 13, payoutTiming: 'after_checkin', notes: '12-15% if the operator holds marine insurance.' },
  { subcategory: 'for_rent', ratePercent: 5, payoutTiming: 'on_completion_of_sale', notes: 'Max 5% of annual rent (Lagos tenancy reform).' },
  { mode: 'sale', ratePercent: 3, payoutTiming: 'on_completion_of_sale', notes: 'Success fee; negotiate per deal or Lux Partner Pro subscription.' },
]

const MODES: Mode[] = ['sale', 'rent', 'booking', 'request']

// Server-side: turn whatever the form sent into a valid category placement.
// Unknown sub-collections fall back to the category's first; only admins may
// override the mode (e.g. a car both for sale and bookable is two listings,
// but a one-off "request only" sale is an admin call).
export function resolvePlacement(
  category: string,
  subcategory: unknown,
  mode: unknown,
  { allowModeOverride }: { allowModeOverride: boolean }
): { subcategory: string | null; mode: Mode } {
  const sub = typeof subcategory === 'string' ? findSubcategory(category, subcategory) : undefined
  const resolvedSub = sub?.key ?? subcategoriesFor(category)[0]?.key ?? null
  const natural = defaultMode(category, resolvedSub)
  const requested = typeof mode === 'string' && (MODES as string[]).includes(mode) ? (mode as Mode) : natural
  return { subcategory: resolvedSub, mode: allowModeOverride ? requested : natural }
}
