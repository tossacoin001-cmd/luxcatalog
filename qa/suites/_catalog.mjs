// Catalogue pages are cached for five minutes. A suite that inserts listings
// straight into the database would otherwise wait for that cache to expire.
// This signs in a throwaway admin and creates then deletes a draft through the
// admin API, which refreshes the cached pages exactly as the real site does.
import { createHmac } from 'node:crypto'

function totp(secret) {
  const alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = ''
  for (const ch of secret.replace(/=+$/, '').toUpperCase()) bits += alpha.indexOf(ch).toString(2).padStart(5, '0')
  const key = Buffer.from(bits.match(/.{8}/g).map((b) => parseInt(b, 2)))
  const buf = Buffer.alloc(8)
  buf.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)))
  const h = createHmac('sha1', key).update(buf).digest()
  const o = h[h.length - 1] & 0xf
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1e6).padStart(6, '0')
}

export async function refreshCatalog(BASE, q) {
  const jar = new Map()
  const req = async (path, { method = 'GET', body } = {}) => {
    const headers = { origin: BASE, cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; ') }
    if (body) headers['content-type'] = 'application/json'
    const res = await fetch(BASE + path, { method, redirect: 'manual', headers, body: body ? JSON.stringify(body) : undefined })
    for (const c of res.headers.getSetCookie()) {
      const [p] = c.split(';')
      const i = p.indexOf('=')
      jar.set(p.slice(0, i), p.slice(i + 1))
    }
    let json = null
    try { json = JSON.parse(await res.text()) } catch {}
    return { status: res.status, json }
  }
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1e4)}`
  const email = `catalog.refresh.${stamp}@test.local`
  const pw = 'correct-horse-battery-9'
  await q('delete from "RateLimit"')
  await req('/api/auth/sign-up/email', { method: 'POST', body: { name: 'Catalog Refresh', email, password: pw } })
  await q(`update "User" set role='admin' where email=$1`, [email])
  const en = await req('/api/auth/two-factor/enable', { method: 'POST', body: { password: pw } })
  await req('/api/auth/two-factor/verify-totp', { method: 'POST', body: { code: totp(new URL(en.json.totpURI).searchParams.get('secret')) } })
  const made = await req('/api/admin/listings', {
    method: 'POST',
    body: { title: `Refresh ${stamp}`, category: 'decor', description: 'Temporary listing used to refresh cached pages.', location: 'Lagos', country: 'Nigeria', price: 1000, images: ['https://example.com/a.jpg'] },
  })
  if (made.json?.listing?.id) await req(`/api/admin/listings/${made.json.listing.id}`, { method: 'DELETE' })
  await q('delete from "RateLimit"')
  return !!made.json?.listing?.id
}
