import { prisma } from '@/lib/prisma'
import { SUBCATEGORIES, SERVICE_KEYS } from '@/lib/taxonomy'
import { SERVICE_FLOOR_DEFAULTS, bannedTermsMessage, findBannedTerms, floorMessage } from '@/lib/services'

export type ServiceFloor = { key: string; label: string; minPrice: number; custom: boolean }

// Current floor for every service: the admin's value, else the default.
export async function serviceFloors(): Promise<ServiceFloor[]> {
  const rows = await prisma.servicePriceFloor.findMany()
  const set = new Map(rows.map((r) => [r.subcategory, Number(r.minPrice)]))
  return SUBCATEGORIES.private_services.map((s) => ({
    key: s.key,
    label: s.label,
    minPrice: set.get(s.key) ?? SERVICE_FLOOR_DEFAULTS[s.key],
    custom: set.has(s.key),
  }))
}

type ServiceListingInput = {
  subcategory: string | null
  title: unknown
  description: unknown
  features: unknown
  specs: unknown
  price: unknown
}

// The Private Services rules a listing must pass before it is saved:
// - partners: approved as a Service Professional for this exact service,
//   and priced at or above its floor (admins may price house listings freely);
// - everyone: a clear price, and none of the banned words anywhere.
// Returns an error for the API to send, or null when the listing may be saved.
export async function checkServiceListing(
  input: ServiceListingInput,
  staff: { userId: string; role: string }
): Promise<{ status: number; error: string } | null> {
  const key = input.subcategory ?? ''
  const label = SUBCATEGORIES.private_services.find((s) => s.key === key)?.label ?? 'this service'
  if (!SERVICE_KEYS.includes(key)) return { status: 400, error: 'Choose which service you offer.' }

  if (staff.role === 'partner') {
    const app = await prisma.partnerApplication.findUnique({
      where: { userId: staff.userId },
      select: { partnerType: true, status: true, collections: true },
    })
    if (!app || app.partnerType !== 'service_professional' || app.status !== 'approved') {
      return { status: 403, error: 'Private Services can only be listed by an approved service professional. Apply as a service professional first.' }
    }
    if (!app.collections.includes(key)) {
      return { status: 403, error: `You are not approved to offer ${label} yet. Ask the Lux Catalog team to add it to your approved services.` }
    }
  }

  const banned = findBannedTerms(input.title, input.description, input.features, input.specs)
  if (banned.length) return { status: 400, error: bannedTermsMessage(banned) }

  const price = Number(input.price)
  if (!input.price || !Number.isFinite(price) || price <= 0) return { status: 400, error: 'Private Services must show a starting price.' }

  if (staff.role === 'partner') {
    const floor = (await serviceFloors()).find((f) => f.key === key)!.minPrice
    if (price < floor) return { status: 400, error: floorMessage(label, floor) }
  }
  return null
}
