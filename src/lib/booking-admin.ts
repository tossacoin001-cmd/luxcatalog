import { prisma } from '@/lib/prisma'
import { requireListingsApi } from '@/lib/admin-auth'

// Day-based units for hire; stays are priced per night.
export const DAY_SUBCATEGORIES = ['car_rental', 'chauffeur', 'close_protection']

// The listing, if the signed-in staff member may manage it: partners only
// their own listings; admins and team members with Listings any.
export async function manageableListing(listingId: string) {
  const staff = await requireListingsApi()
  if (!staff) return { error: 'Unauthorized' as const, status: 401 }
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    select: { id: true, title: true, ownerId: true, subcategory: true, mode: true, price: true, hireRatePerDay: true, bookingSettings: true },
  })
  if (!listing || (staff.role === 'partner' && listing.ownerId !== staff.userId)) return { error: 'Not found' as const, status: 404 }
  return { staff, listing }
}
