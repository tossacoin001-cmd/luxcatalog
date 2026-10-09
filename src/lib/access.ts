// What a Lux Catalog team member can be given access to. Client-safe.
// Admins always have every area plus team management and bulk email;
// partners never use these (they only see their own listings).

export const AREAS = [
  { key: 'listings', label: 'Listings', help: 'Add, edit and publish any listing' },
  { key: 'enquiries', label: 'Enquiries', help: 'Read and answer client enquiries' },
  { key: 'orders', label: 'Orders', help: 'Orders and payments' },
  { key: 'applications', label: 'Applications', help: 'Review partner applications and their private documents' },
  { key: 'partners', label: 'Partners', help: 'Partner accounts, agreements and signed copies' },
] as const

export type Area = (typeof AREAS)[number]['key']

export const AREA_KEYS = AREAS.map((a) => a.key) as Area[]

export const PRESETS: { label: string; areas: Area[] }[] = [
  { label: 'Operations manager', areas: ['listings', 'enquiries', 'orders', 'applications', 'partners'] },
  { label: 'Listings manager', areas: ['listings'] },
  { label: 'Concierge / sales', areas: ['enquiries', 'orders'] },
  { label: 'Partner onboarding', areas: ['applications', 'partners'] },
]

export const cleanAreas = (v: unknown): Area[] => (Array.isArray(v) ? AREA_KEYS.filter((k) => v.includes(k)) : [])

export const areaLabel = (k: string) => AREAS.find((a) => a.key === k)?.label ?? k
