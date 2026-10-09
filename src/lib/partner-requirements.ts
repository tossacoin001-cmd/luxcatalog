// What each kind of partner must provide before they can list on Lux Catalog.
// One source of truth for the application form, the admin review screen and
// the Watchdog (document expiry). Grounded in Nigerian requirements researched
// 2026-10-08: CAC registration, NSCDC private guard licensing, LASWA/NIWA
// waterways rules (certified captains, life jackets, no commercial trips after
// 7pm), Lagos tenancy reform. Not legal advice; reviewed with the founder's
// lawyer as part of Step 3.

export type PartnerTypeKey =
  | 'property_host'
  | 'fleet_owner'
  | 'marine_operator'
  | 'chauffeur_service'
  | 'security_company'
  | 'brand_retailer'
  | 'agent'

export type DocRequirement = {
  kind: string
  label: string
  help: string
  required: boolean | 'company'
  // Licences and insurance: we record the expiry and the Watchdog reminds
  // the partner before it lapses.
  expires?: boolean
}

export type Declaration = { key: string; text: string }

export type PartnerTypeSpec = {
  key: PartnerTypeKey
  label: string
  tagline: string
  // Sub-collections (src/lib/taxonomy.ts) this partner may list in.
  collections: string[]
  docs: DocRequirement[]
  declarations: Declaration[]
}

const IDENTITY: DocRequirement[] = [
  {
    kind: 'government_id',
    label: 'Government ID',
    help: 'NIN slip, international passport or driver’s licence of the owner or a director.',
    required: true,
  },
  {
    kind: 'cac_certificate',
    label: 'CAC certificate',
    help: 'Certificate of incorporation or business name registration.',
    required: 'company',
  },
]

const COMMON_DECLARATIONS: Declaration[] = [
  { key: 'accurate', text: 'Everything in this application and my listings is true and up to date.' },
  { key: 'standards', text: 'I will meet the Lux Catalog standard: punctual, discreet, clean and exactly as listed.' },
  {
    key: 'no_circumvention',
    text: 'I will not take clients introduced by Lux Catalog off the platform to avoid its commission.',
  },
]

export const PARTNER_TYPES: PartnerTypeSpec[] = [
  {
    key: 'property_host',
    label: 'Property owner / Shortlet host',
    tagline: 'Luxury shortlets, homes for rent or for sale',
    collections: ['luxury_shortlets', 'for_rent', 'for_sale'],
    docs: [
      ...IDENTITY,
      {
        kind: 'proof_of_authority',
        label: 'Proof of ownership or authority to let',
        help: 'Title document, lease that permits subletting, or a management agreement with the owner.',
        required: true,
      },
      {
        kind: 'shortlet_registration',
        label: 'Short-let registration (where applicable)',
        help: 'Lagos State short-let registration or permit, if your property requires one.',
        required: false,
      },
    ],
    declarations: [
      ...COMMON_DECLARATIONS,
      { key: 'safety', text: 'Each property has working smoke alarms, a fire extinguisher and secure locks.' },
    ],
  },
  {
    key: 'fleet_owner',
    label: 'Car owner / Fleet',
    tagline: 'Supercars for sale or private car rental',
    collections: ['car_rental', 'for_sale'],
    docs: [
      ...IDENTITY,
      {
        kind: 'vehicle_papers',
        label: 'Vehicle registration papers',
        help: 'Proof of ownership for at least one vehicle you will list (add the rest with each listing).',
        required: true,
      },
      {
        kind: 'hire_insurance',
        label: 'Insurance covering hire',
        help: 'Comprehensive insurance that covers commercial hire, not private use only.',
        required: true,
        expires: true,
      },
      { kind: 'roadworthiness', label: 'Roadworthiness certificate', help: 'Current certificate for the vehicle above.', required: true, expires: true },
      { kind: 'driver_licences', label: 'Chauffeur licences', help: 'If you provide drivers: their valid licences.', required: false, expires: true },
    ],
    declarations: [
      ...COMMON_DECLARATIONS,
      { key: 'maintained', text: 'Vehicles are serviced on schedule and inspected before every hire.' },
    ],
  },
  {
    key: 'marine_operator',
    label: 'Boat / Yacht operator',
    tagline: 'Boat cruises, charters, Aqua Homes and yacht sales',
    collections: ['boat_cruises', 'aqua_homes', 'for_sale'],
    docs: [
      ...IDENTITY,
      { kind: 'vessel_registration', label: 'Vessel registration', help: 'Registration of at least one vessel you will list.', required: true },
      {
        kind: 'waterways_permit',
        label: 'Waterways operating permit',
        help: 'LASWA and/or NIWA permit to carry passengers.',
        required: true,
        expires: true,
      },
      { kind: 'captain_licence', label: 'Captain’s licence', help: 'Certified captain for every passenger trip.', required: true, expires: true },
      { kind: 'passenger_insurance', label: 'Passenger insurance', help: 'Cover for guests on board.', required: true, expires: true },
    ],
    declarations: [
      ...COMMON_DECLARATIONS,
      {
        key: 'marine_safety',
        text: 'Certified life jackets for every passenger, a passenger manifest on each trip, and no commercial trips after 7pm (LASWA).',
      },
    ],
  },
  {
    key: 'chauffeur_service',
    label: 'Chauffeur service',
    tagline: 'Professional drivers with or without vehicles',
    collections: ['chauffeur'],
    docs: [
      ...IDENTITY,
      { kind: 'driver_licences', label: 'Driver licences', help: 'Valid licences for each chauffeur.', required: true, expires: true },
      { kind: 'vehicle_insurance', label: 'Vehicle insurance', help: 'If you provide vehicles: insurance covering hire.', required: false, expires: true },
      { kind: 'police_clearance', label: 'Police clearance', help: 'Police character certificate for each chauffeur, if available.', required: false },
    ],
    declarations: [...COMMON_DECLARATIONS, { key: 'vetted', text: 'Every chauffeur is vetted, trained and represents Lux Catalog with discretion.' }],
  },
  {
    key: 'security_company',
    label: 'Security company',
    tagline: 'Close protection and private guards',
    collections: ['close_protection'],
    docs: [
      { ...IDENTITY[0] },
      { ...IDENTITY[1], required: true },
      {
        kind: 'nscdc_licence',
        label: 'NSCDC private guard licence',
        help: 'Operating licence issued through the Nigeria Security and Civil Defence Corps.',
        required: true,
        expires: true,
      },
      { kind: 'guard_vetting', label: 'Guard vetting records', help: 'Police clearance or vetting summary for your guards.', required: false },
    ],
    declarations: [
      ...COMMON_DECLARATIONS,
      {
        key: 'unarmed',
        text: 'We provide unarmed protection only. Any armed escort is arranged lawfully through the Nigeria Police, never by our guards.',
      },
    ],
  },
  {
    key: 'brand_retailer',
    label: 'Luxury brand / Retailer',
    tagline: 'Interior décor, furniture, lighting and lifestyle',
    collections: ['for_sale'],
    docs: [
      ...IDENTITY,
      {
        kind: 'authenticity',
        label: 'Authorised reseller or trademark proof',
        help: 'Dealer agreement, trademark registration, or proof you make the products yourself.',
        required: true,
      },
    ],
    declarations: [...COMMON_DECLARATIONS, { key: 'authentic', text: 'Every item I list is genuine, as described, and backed by my returns policy.' }],
  },
  {
    key: 'agent',
    label: 'Agent / Broker',
    tagline: 'Representing owners of property, cars or yachts',
    collections: ['for_sale', 'for_rent'],
    docs: [
      ...IDENTITY,
      { kind: 'mandate', label: 'Owner’s mandate', help: 'Letter from the owner authorising you to market their asset.', required: true },
      { kind: 'lasrera', label: 'LASRERA registration', help: 'Lagos real estate agent registration, if you list property in Lagos.', required: false },
    ],
    declarations: [
      ...COMMON_DECLARATIONS,
      { key: 'fees', text: 'I will not charge clients agency fees above the legal limit or any fee not shown on Lux Catalog.' },
    ],
  },
]

export function partnerTypeSpec(key: string | null | undefined): PartnerTypeSpec | undefined {
  return PARTNER_TYPES.find((t) => t.key === key)
}

export function isDocRequired(doc: DocRequirement, legalForm: string): boolean {
  return doc.required === true || (doc.required === 'company' && legalForm === 'company')
}

export const MAX_DOC_BYTES = 10 * 1024 * 1024
export const ALLOWED_DOC_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']

// ---------------------------------------------------------------------------
// Completeness
// ---------------------------------------------------------------------------

type AppForCheck = {
  partnerType: string
  legalForm: string
  businessName: string
  contactName: string
  phone: string
  city: string
  about: string
  cacNumber: string | null
  collections: string[]
  declarations: unknown
  documents: { kind: string; expiresAt: Date | string | null }[]
}

// Everything still missing before an application can be submitted, as
// plain sentences the applicant can act on.
export function missingForSubmit(app: AppForCheck): string[] {
  const spec = partnerTypeSpec(app.partnerType)
  if (!spec) return ['Choose what kind of partner you are.']
  const missing: string[] = []
  if (!app.businessName.trim()) missing.push(app.legalForm === 'company' ? 'Company name' : 'Trading or brand name')
  if (!app.contactName.trim()) missing.push('Contact person')
  if (!/^\+?[0-9 ()-]{7,}$/.test(app.phone.trim())) missing.push('A reachable phone number')
  if (!app.city.trim()) missing.push('City')
  if (app.about.trim().length < 40) missing.push('A short description of what you offer (at least a couple of sentences)')
  if (app.legalForm === 'company' && !app.cacNumber?.trim()) missing.push('CAC registration number')
  if (!app.collections.length) missing.push('At least one collection you will list in')
  for (const doc of spec.docs) {
    if (!isDocRequired(doc, app.legalForm)) continue
    const uploaded = app.documents.find((d) => d.kind === doc.kind)
    if (!uploaded) missing.push(`Upload: ${doc.label}`)
    else if (doc.expires && !uploaded.expiresAt) missing.push(`Expiry date for ${doc.label}`)
    else if (doc.expires && uploaded.expiresAt && new Date(uploaded.expiresAt) < new Date()) missing.push(`${doc.label} has expired, upload the current one`)
  }
  const accepted = (app.declarations ?? {}) as Record<string, string>
  for (const d of spec.declarations) if (!accepted[d.key]) missing.push(`Accept: “${d.text}”`)
  return missing
}


// What an applicant may see of their own application. Never includes the
// admin-only fields (internalNote, reviewedById). Use for every applicant-
// facing query so private notes can't leak through a new endpoint.
export const APPLICANT_APPLICATION_SELECT = {
  id: true,
  partnerType: true,
  status: true,
  legalForm: true,
  businessName: true,
  contactName: true,
  phone: true,
  city: true,
  country: true,
  website: true,
  socialHandle: true,
  cacNumber: true,
  collections: true,
  about: true,
  yearsOperating: true,
  declarations: true,
  submittedAt: true,
  reviewedAt: true,
  reviewNote: true,
  createdAt: true,
  updatedAt: true,
  documents: {
    select: { id: true, kind: true, fileName: true, contentType: true, size: true, expiresAt: true, status: true, note: true, createdAt: true },
    orderBy: { createdAt: 'asc' as const },
  },
} as const
