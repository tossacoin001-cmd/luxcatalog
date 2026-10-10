import { createHmac, timingSafeEqual } from 'node:crypto'

// Minimal Paystack client (server only). Amounts are in kobo (NGN x 100).
// Test or live mode follows the key in PAYSTACK_SECRET_KEY.
const API = 'https://api.paystack.co'

export const paystackConfigured = () => !!process.env.PAYSTACK_SECRET_KEY

// Errors where the request never reached Paystack, so retrying can't charge
// or create anything twice.
const NEVER_CONNECTED = ['UND_ERR_CONNECT_TIMEOUT', 'ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', 'ECONNRESET']
const neverConnected = (err: unknown) => {
  const code = (err as { cause?: { code?: string } })?.cause?.code
  return !!code && NEVER_CONNECTED.includes(code)
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const key = process.env.PAYSTACK_SECRET_KEY
  if (!key) throw new Error('Payments are not configured')
  let res: Response | undefined
  for (let attempt = 1; ; attempt++) {
    try {
      res = await fetch(API + path, {
        ...init,
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
        signal: AbortSignal.timeout(20_000),
        cache: 'no-store',
      })
      break
    } catch (err) {
      if (attempt >= 3 || !neverConnected(err)) throw err
      await new Promise((r) => setTimeout(r, 800 * attempt))
    }
  }
  const reply = res!
  const body = (await reply.json().catch(() => ({}))) as { status?: boolean; message?: string; data?: T }
  if (!reply.ok || !body.status) throw new Error(body.message || `Paystack error ${reply.status}`)
  return body.data as T
}

export const toKobo = (naira: number) => Math.round(naira * 100)

// Starts a payment and returns Paystack's hosted checkout URL.
export async function initializeTransaction(input: {
  email: string
  amountKobo: number
  reference: string
  callbackUrl: string
  metadata?: Record<string, unknown>
}) {
  return call<{ authorization_url: string; access_code: string; reference: string }>('/transaction/initialize', {
    method: 'POST',
    body: JSON.stringify({
      email: input.email,
      amount: input.amountKobo,
      currency: 'NGN',
      reference: input.reference,
      callback_url: input.callbackUrl,
      metadata: input.metadata,
    }),
  })
}

export type PaystackTransaction = {
  status: string // "success", "failed", "abandoned", ...
  reference: string
  amount: number // kobo
  currency: string
  channel?: string
  paid_at?: string | null
  customer?: { email?: string }
}

export async function verifyTransaction(reference: string) {
  return call<PaystackTransaction>(`/transaction/verify/${encodeURIComponent(reference)}`)
}

// Webhooks are signed with HMAC-SHA512 of the raw body using the secret key.
export function validSignature(rawBody: string, signature: string | null) {
  const key = process.env.PAYSTACK_SECRET_KEY
  if (!key || !signature) return false
  const expected = createHmac('sha512', key).update(rawBody).digest('hex')
  const a = Buffer.from(expected)
  const b = Buffer.from(signature)
  return a.length === b.length && timingSafeEqual(a, b)
}

export type PaystackRefund = { id?: number; status?: string; amount?: number; transaction?: { reference?: string } }

// Ask Paystack to return money from a successful payment (whole or part).
export async function createRefund(input: { reference: string; amountKobo: number; note: string }) {
  return call<PaystackRefund>('/refund', {
    method: 'POST',
    body: JSON.stringify({ transaction: input.reference, amount: input.amountKobo, currency: 'NGN', merchant_note: input.note.slice(0, 200) }),
  })
}
