import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// The stored NEXT_PUBLIC_APP_URL value has a stray leading byte-order-mark
// (likely pasted from a Windows editor), which was silently corrupting every
// URL built from it, including Stripe checkout redirect URLs. Stripping it
// here guards every call site without needing to touch the env var itself.
const BOM = String.fromCharCode(0xfeff)

export function getAppUrl(fallback = 'https://luxcatalog.vercel.app'): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL || fallback
  return (raw.startsWith(BOM) ? raw.slice(1) : raw).trim()
}

// Listing prices are stored in NGN (the source of truth). This formats for
// display in whichever currency the visitor has toggled to, converting via
// the cached FxRate when USD is selected. Falls back to priceDisplay (e.g.
// "Price On Application") when there's no numeric price, or the rate hasn't
// loaded yet for a USD conversion.
export function formatListingPrice(
  price: number | null | undefined,
  priceDisplay: string | null | undefined,
  currency: 'NGN' | 'USD',
  rate: number | null
): string {
  if (!price) return priceDisplay || 'Price On Application'

  if (currency === 'NGN') {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(price)
  }

  if (rate == null) return priceDisplay || 'Price On Application'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(price * rate)
}

export function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export const categoryLabels: Record<string, string> = {
  real_estate:        'Real Estate',
  supercar:           'Supercars',
  yacht:               'Yachts',
  decor:               'Interior Decor',
  commercial:          'Commercial',
  lifestyle:           'Lifestyle',
  shortlet:            'Shortlets',
  executive_services:  'Chauffeur & Security',
}

export const categoryHrefs: Record<string, string> = {
  real_estate:        '/catalog/real-estate',
  supercar:           '/catalog/supercars',
  yacht:               '/catalog/yachts',
  decor:               '/catalog/decor',
  commercial:          '/catalog/commercial',
  lifestyle:           '/catalog/lifestyle',
  shortlet:            '/catalog/shortlets',
  executive_services:  '/catalog/executive-services',
}

export const categoryImages: Record<string, string> = {
  real_estate:        'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=80',
  supercar:           'https://images.unsplash.com/photo-1544636331-e26879cd4d9b?w=800&q=80',
  yacht:               'https://images.unsplash.com/photo-1567899378494-47b22a2ae96a?w=800&q=80',
  decor:               'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=800&q=80',
  commercial:          'https://images.unsplash.com/photo-1486325212027-8081e485255e?w=800&q=80',
  lifestyle:           'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800&q=80',
  shortlet:            'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800&q=80',
  executive_services:  'https://images.unsplash.com/photo-1563720223185-11003d516935?w=800&q=80',
}
