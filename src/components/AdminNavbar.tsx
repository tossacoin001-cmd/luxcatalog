import AdminNavbarClient, { type NavLink } from '@/components/AdminNavbarClient'
import { currentStaff } from '@/lib/admin-auth'
import type { Area } from '@/lib/access'

const AREA_LINKS: { area: Area; label: string; href: string }[] = [
  { area: 'listings', label: 'Listings', href: '/admin/listings' },
  { area: 'bookings', label: 'Bookings', href: '/admin/bookings' },
  { area: 'enquiries', label: 'Enquiries', href: '/admin/inquiries' },
  { area: 'orders', label: 'Orders', href: '/admin/orders' },
  { area: 'applications', label: 'Applications', href: '/admin/applications' },
  { area: 'partners', label: 'Partners', href: '/admin/partners' },
  { area: 'partners', label: 'Agreements', href: '/admin/agreements' },
]

// The admin menu, built from the signed-in person's actual access so nobody
// sees a link they can't open. (The `role` prop is accepted for older call
// sites but ignored: access is always read from the database.)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default async function AdminNavbar(_props: { role?: string | null }) {
  const staff = await currentStaff()
  let links: NavLink[]
  let badge = 'Admin'
  if (staff?.role === 'partner') {
    badge = 'Partner'
    links = [
      { label: 'Dashboard', href: '/admin' },
      { label: 'My Listings', href: '/admin/listings' },
      { label: 'Bookings', href: '/admin/bookings' },
      { label: 'Payouts', href: '/admin/payouts' },
      { label: 'My Profile', href: '/admin/profile' },
      { label: 'Agreement', href: '/partners/agreement' },
    ]
  } else {
    const areas = staff?.areas ?? []
    links = [{ label: 'Dashboard', href: '/admin' }, ...AREA_LINKS.filter((l) => areas.includes(l.area)).map(({ label, href }) => ({ label, href }))]
    if (staff?.role === 'admin') links.push({ label: 'Team', href: '/admin/team' })
    else badge = 'Team'
  }
  return <AdminNavbarClient links={links} badge={badge} />
}
