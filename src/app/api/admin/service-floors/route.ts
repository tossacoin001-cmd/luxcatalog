import { NextResponse } from 'next/server'
import { audit, requireAdminApi } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'
import { SERVICE_KEYS } from '@/lib/taxonomy'
import { serviceFloors } from '@/lib/services-server'

// Private Services price floors. Admin only: they are pricing policy.
export async function GET() {
  const admin = await requireAdminApi()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json({ floors: await serviceFloors() })
}

export async function PUT(req: Request) {
  const admin = await requireAdminApi()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const input = body?.floors
  if (!input || typeof input !== 'object' || Array.isArray(input) || !Object.keys(input).length) {
    return NextResponse.json({ error: 'Nothing to save' }, { status: 400 })
  }
  const updates: { key: string; minPrice: number }[] = []
  for (const [key, raw] of Object.entries(input)) {
    if (!SERVICE_KEYS.includes(key)) return NextResponse.json({ error: `Unknown service: ${key}` }, { status: 400 })
    const n = Number(raw)
    if (!Number.isFinite(n) || n < 0 || n >= 1e12) return NextResponse.json({ error: 'Floors must be amounts of ₦0 or more' }, { status: 400 })
    updates.push({ key, minPrice: Math.round(n) })
  }

  const before = await serviceFloors()
  await prisma.$transaction(
    updates.map((u) =>
      prisma.servicePriceFloor.upsert({
        where: { subcategory: u.key },
        create: { subcategory: u.key, minPrice: u.minPrice, updatedById: admin.userId },
        update: { minPrice: u.minPrice, updatedById: admin.userId },
      })
    )
  )
  await audit(admin.userId, 'service_floors.update', undefined, {
    changes: updates.map((u) => ({ key: u.key, from: before.find((f) => f.key === u.key)?.minPrice, to: u.minPrice })),
  })
  return NextResponse.json({ floors: await serviceFloors() })
}
