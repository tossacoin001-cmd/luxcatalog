import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireStaffApi } from '@/lib/admin-auth'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaffApi()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const isVendor = staff.role === 'org:vendor'

  try {
    const { id } = await params

    if (isVendor) {
      const existing = await prisma.listing.findUnique({ where: { id }, select: { ownerId: true } })
      if (!existing || existing.ownerId !== staff.userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
      }
    }

    const body = await req.json()
    const {
      title, category, description, priceDisplay, price,
      location, country, images, features, status, featured,
      hireAvailable, hireRatePerDay, hireRateDisplay, specs, published,
    } = body

    const listing = await prisma.listing.update({
      where: { id },
      data: {
        title,
        category,
        description,
        priceDisplay,
        price: price ? Number(price) : null,
        location,
        country,
        images: Array.isArray(images) ? images : undefined,
        features: Array.isArray(features) ? features : undefined,
        status,
        // A partner editing their own listing sends it back to review rather
        // than silently staying live with unreviewed changes. Featured, hire
        // terms, and publish state are admin-only levers.
        ...(isVendor
          ? { published: false }
          : {
              featured: !!featured,
              hireAvailable: !!hireAvailable,
              hireRatePerDay: hireRatePerDay ? Number(hireRatePerDay) : null,
              hireRateDisplay: hireRateDisplay || null,
              published: typeof published === 'boolean' ? published : undefined,
            }),
        specs: specs && typeof specs === 'object' ? specs : undefined,
      },
    })

    return NextResponse.json({ success: true, listing })
  } catch (err) {
    console.error('Update listing error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaffApi()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const isVendor = staff.role === 'org:vendor'

  try {
    const { id } = await params

    if (isVendor) {
      const existing = await prisma.listing.findUnique({ where: { id }, select: { ownerId: true } })
      if (!existing || existing.ownerId !== staff.userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
      }
    }

    await prisma.listing.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Delete listing error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
