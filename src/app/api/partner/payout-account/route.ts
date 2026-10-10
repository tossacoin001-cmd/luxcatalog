import { NextResponse } from 'next/server'
import { audit, requireStaffApi } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'
import { listBanks, paystackConfigured, resolveAccount } from '@/lib/paystack'
import { PayoutError, maskAccount, savePayoutAccount } from '@/lib/payouts-server'

// A partner's own bank details for payouts.
async function partner() {
  const staff = await requireStaffApi()
  return staff?.role === 'partner' ? staff : null
}

export async function GET(req: Request) {
  const p = await partner()
  if (!p) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const url = new URL(req.url)
  if (url.searchParams.get('banks') === '1') {
    if (!paystackConfigured()) return NextResponse.json({ banks: [] })
    try {
      return NextResponse.json({ banks: await listBanks() }, { headers: { 'Cache-Control': 'private, max-age=3600' } })
    } catch (err) {
      console.error('Bank list failed:', err)
      return NextResponse.json({ error: 'Could not load the list of banks. Please try again.' }, { status: 502 })
    }
  }
  const a = await prisma.payoutAccount.findUnique({ where: { userId: p.userId } })
  return NextResponse.json({ account: a ? { bankName: a.bankName, accountName: a.accountName, account: maskAccount(a.accountNumber) } : null })
}

// Check an account with the bank: returns the account holder's name.
export async function POST(req: Request) {
  const p = await partner()
  if (!p) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { bankCode, accountNumber } = await req.json().catch(() => ({}))
  if (!/^\d{10}$/.test(String(accountNumber)) || !bankCode) return NextResponse.json({ error: 'Choose your bank and enter the 10-digit account number' }, { status: 400 })
  try {
    const r = await resolveAccount(String(accountNumber), String(bankCode))
    return NextResponse.json({ accountName: r.account_name })
  } catch {
    return NextResponse.json({ error: 'That account number doesn’t match the bank. Please check both.' }, { status: 400 })
  }
}

// Save: re-checked with the bank on the server; the name always comes from the bank.
export async function PUT(req: Request) {
  const p = await partner()
  if (!p) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { bankCode, bankName, accountNumber } = await req.json().catch(() => ({}))
  try {
    const a = await savePayoutAccount(p.userId, String(bankCode ?? ''), String(bankName ?? '').slice(0, 100), String(accountNumber ?? ''))
    await audit(p.userId, 'payout_account.save', p.userId, { bank: a.bankName, account: maskAccount(a.accountNumber) })
    return NextResponse.json({ account: { bankName: a.bankName, accountName: a.accountName, account: maskAccount(a.accountNumber) } })
  } catch (e) {
    if (e instanceof PayoutError) return NextResponse.json({ error: e.message }, { status: e.status })
    console.error('Payout account save failed:', e)
    return NextResponse.json({ error: 'Could not save your bank details. Please try again.' }, { status: 502 })
  }
}
