import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPrice(price: number | null | undefined, display?: string | null): string {
  if (display) return display
  if (!price) return 'Price On Application'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(price)
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
