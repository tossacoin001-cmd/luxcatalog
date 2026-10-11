// LuxCatalog's catalogue structure: main categories (the Category enum) and
// the sub-collections customers actually shop for. One source of truth for
// admin forms, catalog filters and (later) the booking engine.

export type Mode = 'sale' | 'rent' | 'booking' | 'request'

export type Subcategory = {
  key: string
  label: string
  mode: Mode
  // For bookable sub-collections: how time is sold.
  unit?: 'night' | 'day' | 'hour' | 'slot' | 'session'
  // Private Services only: the group it is shown under, and one line that
  // tells a customer what they get.
  group?: ServiceGroupKey
  blurb?: string
}

export type ServiceGroupKey = 'dining' | 'wellness' | 'grooming' | 'hosting'

// Private Services: vetted professionals who come to the customer, booked
// by session. Standalone (not a shortlet add-on); approved 2026-10-10.
export const SERVICE_GROUPS: { key: ServiceGroupKey; label: string; tagline: string }[] = [
  { key: 'dining', label: 'Private Dining', tagline: 'A restaurant-grade evening without leaving home.' },
  { key: 'wellness', label: 'Wellness', tagline: 'Treatments and training on your schedule, in your space.' },
  { key: 'grooming', label: 'Grooming & Beauty', tagline: 'Camera-ready before you step out.' },
  { key: 'hosting', label: 'Home & Hosting', tagline: 'Your home kept, your moments captured.' },
]

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
  private_services: [
    { key: 'private_chef', label: 'Private Chef', mode: 'booking', unit: 'session', group: 'dining', blurb: 'Dinners, brunches and chef’s tables cooked in your home. Ingredients, service and clean-up included.' },
    { key: 'mixologist', label: 'Mixologist & Private Bar', mode: 'booking', unit: 'session', group: 'dining', blurb: 'A bartender, a cocktail menu and a fully dressed bar for your evening or celebration.' },
    { key: 'butler_staff', label: 'Butler & Event Staff', mode: 'booking', unit: 'session', group: 'dining', blurb: 'Trained butlers, hosts and waiters who serve your guests so you can enjoy them.' },
    { key: 'massage_spa', label: 'Massage & Spa', mode: 'booking', unit: 'session', group: 'wellness', blurb: 'Certified therapists bring the table, oils and calm: Swedish, deep tissue, facials and more.' },
    { key: 'personal_training', label: 'Personal Training & Yoga', mode: 'booking', unit: 'session', group: 'wellness', blurb: 'Certified trainers and yoga teachers for one-to-one sessions wherever you are staying.' },
    { key: 'barber', label: 'Private Barber', mode: 'booking', unit: 'session', group: 'grooming', blurb: 'A precise cut, shave or beard shape at home, with clean tools for every client.' },
    { key: 'hair_stylist', label: 'Hair Stylist', mode: 'booking', unit: 'session', group: 'grooming', blurb: 'Silk press, braids, wig installs and styling for the day or the event.' },
    { key: 'makeup_artist', label: 'Makeup Artist', mode: 'booking', unit: 'session', group: 'grooming', blurb: 'Soft glam to full bridal, applied where you are getting ready.' },
    { key: 'nail_technician', label: 'Nail Technician', mode: 'booking', unit: 'session', group: 'grooming', blurb: 'Manicures, pedicures and nail art with sanitised kit, at home.' },
    { key: 'housekeeping', label: 'Private Housekeeping', mode: 'booking', unit: 'session', group: 'hosting', blurb: 'Discreet deep cleans, turndown and the morning-after reset, by vetted teams.' },
    { key: 'photographer', label: 'Photographer & Content', mode: 'booking', unit: 'session', group: 'hosting', blurb: 'Birthday shoots, portraits and content for your stay, edited and delivered fast.' },
  ],
  commercial: [
    { key: 'for_sale', label: 'For Sale', mode: 'sale' },
    { key: 'for_lease', label: 'For Lease', mode: 'rent' },
  ],
  decor: [{ key: 'for_sale', label: 'For Sale', mode: 'sale' }],
}

export const SERVICE_KEYS: string[] = SUBCATEGORIES.private_services.map((s) => s.key)

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
  private_chef: ['Cuisine', 'Guests (min–max)', 'Menu Courses', 'Dietary Options', 'Coverage Area'],
  mixologist: ['Bar Style', 'Guests', 'Hours', 'Bar Equipment', 'Coverage Area'],
  butler_staff: ['Staff Provided', 'Hours', 'Uniform', 'Languages', 'Coverage Area'],
  massage_spa: ['Treatments', 'Session Length', 'Therapist', 'Equipment Brought', 'Certification', 'Coverage Area'],
  personal_training: ['Disciplines', 'Session Length', 'Equipment Brought', 'Certification', 'Coverage Area'],
  barber: ['Services', 'Session Length', 'Kit', 'Coverage Area'],
  hair_stylist: ['Services', 'Session Length', 'Hair Supplied', 'Coverage Area'],
  makeup_artist: ['Looks', 'Session Length', 'Products', 'Coverage Area'],
  nail_technician: ['Services', 'Session Length', 'Products', 'Coverage Area'],
  housekeeping: ['Services', 'Team Size', 'Hours', 'Supplies Brought', 'Coverage Area'],
  photographer: ['Shoot Types', 'Session Length', 'Edited Photos', 'Delivery Time', 'Coverage Area'],
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
  // Private Services: 20%, released after the session ends (approved 2026-10-10).
  ...SUBCATEGORIES.private_services.map((s) => ({ subcategory: s.key, ratePercent: 20, payoutTiming: 'after_completion', notes: 'Private Services default.' })),
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
