import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import { Badge } from '@/components/ui/badge'
import { categoryLabels } from '@/lib/utils'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Manage Listings — Admin' }

const mockListings = [
  { id: '1',  title: 'Cap Ferrat Clifftop Villa',        category: 'real_estate', priceDisplay: '$48,000,000', status: 'available', featured: true  },
  { id: '2',  title: 'Manhattan Sky Penthouse',           category: 'real_estate', priceDisplay: '$35,000,000', status: 'available', featured: true  },
  { id: '3',  title: 'Maldives Overwater Estate',         category: 'real_estate', priceDisplay: 'POA',         status: 'available', featured: true  },
  { id: '4',  title: 'Belgravia Garden Townhouse',        category: 'real_estate', priceDisplay: '£22,500,000', status: 'available', featured: false },
  { id: '5',  title: 'Bugatti Chiron Super Sport 300+',   category: 'supercar',    priceDisplay: '$5,200,000',  status: 'available', featured: true  },
  { id: '6',  title: 'Ferrari LaFerrari Aperta',          category: 'supercar',    priceDisplay: '$7,800,000',  status: 'under_offer', featured: true },
  { id: '7',  title: 'Koenigsegg Regera',                 category: 'supercar',    priceDisplay: '$6,400,000',  status: 'available', featured: false },
  { id: '8',  title: 'Rolls-Royce Phantom Bespoke',       category: 'supercar',    priceDisplay: '$850,000',    status: 'available', featured: false },
  { id: '9',  title: 'M/Y Aphrodite — 73m Superyacht',    category: 'yacht',       priceDisplay: 'POA',         status: 'available', featured: true  },
  { id: '10', title: 'S/Y Altair — 55m Sailing Ketch',    category: 'yacht',       priceDisplay: '$18,500,000', status: 'available', featured: false },
  { id: '11', title: 'Baccarat Crystal Chandelier',        category: 'decor',       priceDisplay: '$380,000',    status: 'available', featured: false },
  { id: '12', title: 'Hermès Armchair — Compagnie',        category: 'decor',       priceDisplay: '$95,000',     status: 'available', featured: false },
  { id: '13', title: 'Mayfair Mixed-Use Trophy Asset',     category: 'commercial',  priceDisplay: 'POA',         status: 'available', featured: true  },
  { id: '14', title: 'Dubai DIFC Grade-A Office Tower',    category: 'commercial',  priceDisplay: 'POA',         status: 'available', featured: false },
  { id: '15', title: 'Airbus ACH130 Private Helicopter',   category: 'lifestyle',   priceDisplay: '$4,200,000',  status: 'available', featured: true  },
  { id: '16', title: 'Private Members Club — St. Moritz',  category: 'lifestyle',   priceDisplay: '$650,000',    status: 'available', featured: false },
]

export default async function AdminListingsPage() {
  const { userId, sessionClaims } = await auth()
  if (!userId) redirect('/sign-in')
  const role = (sessionClaims?.metadata as { role?: string })?.role
  if (role !== 'admin') redirect('/')

  return (
    <div style={{ background: '#080c08', minHeight: '100vh' }}>
      <Navbar />

      <div className="pt-32 pb-10 px-6 md:px-12" style={{ borderBottom: '1px solid rgba(201,168,76,0.1)' }}>
        <div className="max-w-7xl mx-auto flex items-end justify-between">
          <div>
            <Link href="/admin" className="text-[10px] tracking-[0.2em] uppercase mb-4 block hover:text-lux-gold transition-colors" style={{ color: '#5a5248', fontFamily: 'var(--font-inter)' }}>
              ← Admin
            </Link>
            <h1 className="text-4xl" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>
              All Listings
            </h1>
          </div>
          <Link
            href="/admin/listings/new"
            className="inline-flex items-center px-7 py-3 text-xs tracking-[0.18em] uppercase"
            style={{ background: '#C9A84C', color: '#080c08', fontFamily: 'var(--font-inter)' }}
          >
            + Add Listing
          </Link>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 md:px-12 py-8">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #1e2e1f' }}>
                {['Title', 'Category', 'Price', 'Status', 'Featured', 'Actions'].map((h) => (
                  <th
                    key={h}
                    className="text-left pb-3 pr-6 text-[10px] tracking-[0.15em] uppercase"
                    style={{ color: '#5a5248', fontFamily: 'var(--font-inter)' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {mockListings.map((listing, i) => (
                <tr
                  key={listing.id}
                  style={{ borderBottom: '1px solid #1e2e1f' }}
                  className="hover:bg-lux-surface transition-colors group"
                >
                  <td className="py-4 pr-6">
                    <span style={{ color: '#f5f0e8', fontFamily: 'var(--font-inter)' }}>
                      {listing.title}
                    </span>
                  </td>
                  <td className="py-4 pr-6">
                    <span className="text-[10px] tracking-wider uppercase" style={{ color: '#9a8f7a', fontFamily: 'var(--font-inter)' }}>
                      {categoryLabels[listing.category]}
                    </span>
                  </td>
                  <td className="py-4 pr-6">
                    <span className="text-xs" style={{ color: '#C9A84C', fontFamily: 'var(--font-inter)', fontStyle: listing.priceDisplay === 'POA' ? 'italic' : 'normal' }}>
                      {listing.priceDisplay}
                    </span>
                  </td>
                  <td className="py-4 pr-6">
                    <Badge variant={listing.status as 'available' | 'under_offer' | 'sold'}>
                      {listing.status === 'under_offer' ? 'Under Offer' : listing.status}
                    </Badge>
                  </td>
                  <td className="py-4 pr-6">
                    <span className="text-xs" style={{ color: listing.featured ? '#C9A84C' : '#3a3028', fontFamily: 'var(--font-inter)' }}>
                      {listing.featured ? '★ Yes' : '—'}
                    </span>
                  </td>
                  <td className="py-4">
                    <div className="flex gap-4">
                      <Link
                        href={`/admin/listings/${listing.id}/edit`}
                        className="text-xs tracking-wider hover:text-lux-gold transition-colors"
                        style={{ color: '#9a8f7a', fontFamily: 'var(--font-inter)' }}
                      >
                        Edit
                      </Link>
                      <button
                        className="text-xs tracking-wider transition-colors hover:text-lux-sold"
                        style={{ color: '#5a5248', fontFamily: 'var(--font-inter)' }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
