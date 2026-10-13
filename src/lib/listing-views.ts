// How a category is split into "views" (For Sale / For Rent / Short stays...)
// and how a price is worded for each kind of listing. Pure.

import { SUBCATEGORIES } from '@/lib/taxonomy'

export type View = { key: string; label: string }

// Tabs only for categories that mix buying with renting or booking. Other
// categories (Private Services, Chauffeur, Décor, Lifestyle) have their own
// page layouts and need none.
export function viewsFor(category: string): View[] {
  const subs = SUBCATEGORIES[category] ?? []
  if (subs.length < 2 || !subs.some((s) => s.key === 'for_sale')) return []
  return subs.map((s) => ({ key: s.key, label: s.label }))
}

// The view named in the page address, if it belongs to this category.
export function normalizeView(category: string, raw: string | string[] | null | undefined): string | null {
  const v = Array.isArray(raw) ? raw[0] : raw
  return v && viewsFor(category).some((x) => x.key === v) ? v : null
}

export type PriceCaption = { label: string; suffix: string }

// What the price means, in plain words.
export function priceCaption(category: string, subcategory: string | null, mode: string): PriceCaption {
  if (subcategory === 'for_rent' || subcategory === 'for_lease') return { label: 'Annual rent', suffix: 'per year' }
  if (subcategory === 'luxury_shortlets' || subcategory === 'aqua_homes') return { label: 'Nightly rate', suffix: 'per night' }
  if (subcategory === 'car_rental' || subcategory === 'chauffeur' || subcategory === 'close_protection') return { label: 'Daily rate', suffix: 'per day' }
  if (category === 'private_services') return { label: 'From', suffix: '' }
  if (!subcategory && mode === 'rent') return { label: 'Annual rent', suffix: 'per year' }
  return { label: 'Asking price', suffix: '' }
}

// A short label for cards. Nothing for categories that don't need one.
export function modeBadge(category: string, subcategory: string | null, mode: string): string | null {
  if (!['real_estate', 'commercial', 'supercar', 'yacht'].includes(category)) return null
  if (subcategory === 'for_sale') return 'For sale'
  if (subcategory === 'for_rent') return 'For rent'
  if (subcategory === 'for_lease') return 'For lease'
  if (subcategory === 'luxury_shortlets') return 'Short stay'
  if (subcategory === 'car_rental') return 'Rental'
  if (subcategory === 'boat_cruises') return 'Cruise'
  if (subcategory === 'aqua_homes') return 'Aqua home'
  if (!subcategory) return mode === 'rent' ? 'For rent' : mode === 'sale' ? 'For sale' : null
  return null
}

// Listings that belong in a view ("all" when the view is null).
export function inView<T extends { subcategory?: string | null }>(items: T[], view: string | null): T[] {
  return view ? items.filter((i) => i.subcategory === view) : items
}
