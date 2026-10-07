/**
 * One-time move of existing users out of Clerk into our own User table.
 *
 * Each user keeps their Clerk id ("user_...") as their id here, so every
 * existing reference (Listing.ownerId, PartnerProfile.userId, SavedListing,
 * Inquiry, Order) stays linked with no data rewrite. Roles come from the
 * Lux Catalog Clerk organization: org:admin -> admin, org:member with
 * partnerType=vendor -> partner, everyone else -> customer.
 *
 * Passwords can't be exported from Clerk. Imported users sign in by using
 * "Forgot password" once, which sets a password in our system.
 *
 * Usage (dry run, prints what would happen, writes nothing):
 *   CLERK_SECRET_KEY=sk_live_... DATABASE_URL=... npx tsx scripts/import-clerk-users.ts
 * Apply:
 *   ... npx tsx scripts/import-clerk-users.ts --apply
 */
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const LUX_CATALOG_ORG_ID = 'org_3GQXQNb9ygojG37baLMMn6JWlD9'
const apply = process.argv.includes('--apply')

interface ClerkUser {
  id: string
  first_name: string | null
  last_name: string | null
  primary_email_address_id: string | null
  email_addresses: { id: string; email_address: string; verification: { status: string } | null }[]
  phone_numbers: { phone_number: string }[]
  image_url: string | null
  created_at: number
}

interface ClerkMembership {
  role: string
  public_metadata: Record<string, unknown> | null
  public_user_data: { user_id: string }
}

async function clerk<T>(path: string): Promise<T> {
  const key = process.env.CLERK_SECRET_KEY
  if (!key) throw new Error('CLERK_SECRET_KEY is not set')
  const res = await fetch(`https://api.clerk.com/v1${path}`, { headers: { Authorization: `Bearer ${key}` } })
  if (!res.ok) throw new Error(`Clerk ${path} -> ${res.status} ${await res.text()}`)
  return res.json() as Promise<T>
}

async function fetchAllUsers(): Promise<ClerkUser[]> {
  const all: ClerkUser[] = []
  for (let offset = 0; ; offset += 100) {
    const page = await clerk<ClerkUser[]>(`/users?limit=100&offset=${offset}&order_by=created_at`)
    all.push(...page)
    if (page.length < 100) return all
  }
}

async function fetchRoles(): Promise<Map<string, 'admin' | 'partner'>> {
  const roles = new Map<string, 'admin' | 'partner'>()
  for (let offset = 0; ; offset += 100) {
    const page = await clerk<{ data: ClerkMembership[] }>(`/organizations/${LUX_CATALOG_ORG_ID}/memberships?limit=100&offset=${offset}`)
    for (const m of page.data) {
      const userId = m.public_user_data.user_id
      if (m.role === 'org:admin') roles.set(userId, 'admin')
      else if (m.public_metadata?.partnerType === 'vendor') roles.set(userId, 'partner')
    }
    if (page.data.length < 100) return roles
  }
}

async function main() {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) })
  try {
    const [users, roles] = await Promise.all([fetchAllUsers(), fetchRoles()])
    console.log(`${apply ? 'APPLYING' : 'DRY RUN'}: ${users.length} Clerk users, ${roles.size} staff memberships\n`)

    let created = 0
    let skipped = 0
    for (const u of users) {
      const primary = u.email_addresses.find((e) => e.id === u.primary_email_address_id) ?? u.email_addresses[0]
      if (!primary) {
        console.log(`  skip ${u.id}: no email address`)
        skipped++
        continue
      }
      const email = primary.email_address.toLowerCase()
      const role = roles.get(u.id) ?? 'customer'
      const name = [u.first_name, u.last_name].filter(Boolean).join(' ') || email.split('@')[0]

      const existing = await prisma.user.findFirst({ where: { OR: [{ id: u.id }, { email }] }, select: { id: true } })
      if (existing) {
        console.log(`  skip ${email}: already exists (${existing.id})`)
        skipped++
        continue
      }

      console.log(`  ${apply ? 'create' : 'would create'} ${email} as ${role} (id ${u.id})`)
      if (apply) {
        await prisma.user.create({
          data: {
            id: u.id,
            name,
            email,
            emailVerified: primary.verification?.status === 'verified',
            image: u.image_url,
            phone: u.phone_numbers[0]?.phone_number ?? null,
            role,
            createdAt: new Date(u.created_at),
          },
        })
      }
      created++
    }

    console.log(`\n${apply ? 'Created' : 'Would create'} ${created}, skipped ${skipped}.`)
    if (!apply) console.log('Nothing was written. Re-run with --apply to import.')
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
