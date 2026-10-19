// One administrator: the owner. Pure rules, no database.
//
// Lux Catalog has a single administrator, identified by the address in the
// OWNER_EMAIL setting. Anyone else who somehow holds the admin role in the
// database (a leftover, a typo, an attacker with a stray write) is not trusted
// as an admin: they get no admin pages and no admin APIs. The team page can
// invite team members only; admin access can never be granted from the site.
//
// When OWNER_EMAIL is not set the old rule applies (any account with the admin
// role is trusted), so a fresh setup and the test suites still work; the admin
// dashboard shows a plain warning until it is set.

export const ONLY_ONE_ADMIN = 'There is one administrator: the owner. Admin access cannot be granted to anyone else.'

const ADDRESS = /^[^\s@,;*]+@[^\s@,;*]+\.[^\s@,;*]+$/

export function ownerEmailFromEnv(raw: string | null | undefined): string | null {
  const cleaned = String(raw ?? '').replace(/^﻿/, '').trim().toLowerCase()
  return ADDRESS.test(cleaned) ? cleaned : null
}

export function isTrustedAdmin(user: { role: string; email: string }, ownerEmail: string | null): boolean {
  if (user.role !== 'admin') return false
  if (!ownerEmail) return true
  return String(user.email ?? '').trim().toLowerCase() === ownerEmail
}
