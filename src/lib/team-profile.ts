// A person's own details: the rules for a name and a phone number, and which
// fields may be sent when someone edits their profile. Pure, so the same code
// guards the page, the API and the tests.

const INVISIBLE = /[​-‍⁠﻿­]/g

export function cleanName(input: unknown): string | null {
  if (typeof input !== 'string') return null
  const s = input.normalize('NFC').replace(INVISIBLE, '').replace(/\s+/g, ' ').trim()
  if (s.length < 2 || s.length > 80) return null
  // Letters (any language), accents, spaces, hyphens, apostrophes and full stops.
  if (!/^[\p{L}\p{M}][\p{L}\p{M}'’.\- ]*$/u.test(s)) return null
  return s
}

// One standard form (+<country><number>) so numbers can be compared and used
// for WhatsApp and calls. Nigerian numbers may be typed the way people type them.
export function normalisePhone(input: unknown): string | null {
  if (typeof input !== 'string') return null
  const s = input.replace(/[\s\-().]/g, '')
  if (!/^\+?\d+$/.test(s)) return null
  let digits = s.startsWith('+') ? s.slice(1) : s
  if (s.startsWith('+')) {
    if (digits.startsWith('2340')) digits = '234' + digits.slice(4)
  } else if (digits.startsWith('234')) {
    if (digits.startsWith('2340')) digits = '234' + digits.slice(4)
  } else if (digits.startsWith('0') && digits.length === 11) {
    digits = '234' + digits.slice(1)
  } else if (digits.length === 10 && /^[789]/.test(digits)) {
    digits = '234' + digits
  } else {
    return null
  }
  if (!/^[1-9]\d{9,14}$/.test(digits)) return null
  return '+' + digits
}

export type ProfileEdit = { name?: string; phone?: string }
type Parsed = { ok: true; data: ProfileEdit } | { ok: false; error: string }

function parseOnly(input: unknown, allowed: string[]): Parsed {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, error: 'Send the details you want to change.' }
  const body = input as Record<string, unknown>
  for (const key of Object.keys(body)) {
    if (!allowed.includes(key)) return { ok: false, error: `“${key}” is not allowed here. Only your name and phone can be changed.` }
  }
  const data: ProfileEdit = {}
  if ('name' in body) {
    const name = cleanName(body.name)
    if (!name) return { ok: false, error: 'Please enter your full name (2 to 80 letters, no symbols).' }
    data.name = name
  }
  if ('phone' in body) {
    const phone = normalisePhone(body.phone)
    if (!phone) return { ok: false, error: 'That phone number does not look right. Please check it (for example 0803 123 4567).' }
    data.phone = phone
  }
  if (!('name' in data) && !('phone' in data)) return { ok: false, error: 'Send the details you want to change.' }
  return { ok: true, data }
}

// What a person may change about themselves.
export const parseProfileEdit = (input: unknown): Parsed => parseOnly(input, ['name', 'phone'])
// What the administrator may correct for someone else (never role, areas or email).
export const parseDetailsEdit = (input: unknown): Parsed => parseOnly(input, ['name', 'phone'])
