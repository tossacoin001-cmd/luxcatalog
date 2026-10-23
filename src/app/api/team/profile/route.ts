import { NextResponse } from 'next/server'
import { audit, requireStaffApi } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'
import { maskAccount } from '@/lib/payouts-server'
import { parseProfileEdit } from '@/lib/team-profile'

// A team member (or the administrator) keeps their own details. Only the name
// and phone can be sent; anything else is refused, so this route can never be
// used to change a role, an area or an email. The account is always the
// signed-in person's own, never one named in the request.
async function me() {
  const staff = await requireStaffApi()
  return staff && (staff.role === 'team' || staff.role === 'admin') ? staff : null
}

export async function GET() {
  const staff = await me()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const [user, payout] = await Promise.all([
    prisma.user.findUnique({ where: { id: staff.userId }, select: { name: true, email: true, phone: true } }),
    prisma.payoutAccount.findUnique({ where: { userId: staff.userId } }),
  ])
  return NextResponse.json({
    profile: user,
    payout: payout ? { bankName: payout.bankName, accountName: payout.accountName, account: maskAccount(payout.accountNumber) } : null,
  })
}

export async function PATCH(req: Request) {
  const staff = await me()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const parsed = parseProfileEdit(await req.json().catch(() => null))
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const before = await prisma.user.findUnique({ where: { id: staff.userId }, select: { name: true, phone: true } })
  const user = await prisma.user.update({ where: { id: staff.userId }, data: parsed.data, select: { name: true, email: true, phone: true } })
  await audit(staff.userId, 'team.profile.update', staff.userId, { changed: Object.keys(parsed.data), from: before })
  return NextResponse.json({ success: true, profile: user })
}
