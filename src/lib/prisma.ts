import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

function createPrismaClient() {
  // pg treats sslmode=require as verify-full anyway and logs a warning on
  // every connection (shown as an error in Vercel logs, burying real ones).
  // Ask for verify-full explicitly: same security, no noise.
  const connectionString = process.env.DATABASE_URL!.replace(/sslmode=(require|prefer|verify-ca)/, 'sslmode=verify-full')
  // DATABASE_POOL_MAX caps connections per instance. Unset in production;
  // the local test database (prisma dev / PGlite) needs 1.
  const max = Number(process.env.DATABASE_POOL_MAX) || undefined
  const adapter = new PrismaPg({ connectionString, ...(max ? { max } : {}) })
  return new PrismaClient({ adapter })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
