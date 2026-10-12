import { prisma } from '@/lib/prisma'

// Abuse protection for public endpoints (enquiries, Discover, booking
// holds). Sign-in has its own limits from the auth library.

// The visitor's address. On Vercel the platform sets x-forwarded-for, so the
// first entry is the real client; locally there is none.
export function clientIp(headers: Headers) {
  return headers.get('x-forwarded-for')?.split(',')[0]?.trim() || headers.get('x-real-ip') || 'local'
}

// Fixed-window limit stored in the shared RateLimit table (keys prefixed so
// they never collide with the auth library's). Returns false once `limit`
// requests have been made in the current window.
export async function rateLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
  const k = `lux:${key}`
  const now = Date.now()
  const row = await prisma.rateLimit.findUnique({ where: { key: k } })
  if (!row || now - Number(row.lastRequest) > windowMs) {
    await prisma.rateLimit.upsert({ where: { key: k }, create: { id: crypto.randomUUID(), key: k, count: 1, lastRequest: BigInt(now) }, update: { count: 1, lastRequest: BigInt(now) } })
    return true
  }
  if (row.count >= limit) return false
  await prisma.rateLimit.update({ where: { key: k }, data: { count: { increment: 1 } } })
  return true
}

// Cloudflare Turnstile check for forms used without an account. Passes when
// Turnstile isn't configured (local development), like the sign-in check.
export async function verifyHuman(token: unknown, ip: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) return true
  if (typeof token !== 'string' || !token) return false
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: new URLSearchParams({ secret, response: token, ...(ip !== 'local' ? { remoteip: ip } : {}) }),
    })
    const data = (await res.json()) as { success?: boolean }
    return data.success === true
  } catch {
    return false
  }
}
