import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireListingsApi } from '@/lib/admin-auth'
import { resolvePlacement } from '@/lib/taxonomy'
import { revalidateCatalog } from '@/lib/revalidate'
import { checkServiceListing } from '@/lib/services-server'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireListingsApi()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const isVendor = staff.role === 'partner'

  try {
    const { id } = await params

    const existing = await prisma.listing.findUnique({
      where: { id },
      select: { ownerId: true, category: true, subcategory: true, title: true, description: true, features: true, specs: true, price: true },
    })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (isVendor && existing.ownerId !== staff.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const body = await req.json()
    const {
      title, category, description, priceDisplay, price,
      location, country, images, features, status, featured,
      hireAvailable, hireRatePerDay, hireRateDisplay, specs, published,
    } = body
    const placement = category ? resolvePlacement(category, body.subcategory, body.mode, { allowModeOverride: !isVendor }) : null

    // Private Services rules apply to the listing as it will be after this
    // edit (fields not sent keep their current values).
    if ((category ?? existing.category) === 'private_services') {
      const refused = await checkServiceListing(
        {
          subcategory: placement?.subcategory ?? existing.subcategory,
          title: title ?? existing.title,
          description: description ?? existing.description,
          features: features ?? existing.features,
          specs: specs ?? existing.specs,
          price: 'price' in body ? price : existing.price,
        },
        staff
      )
      if (refused) return NextResponse.json({ error: refused.error }, { status: refused.status })
    }

    const listing = await prisma.listing.update({
      where: { id },
      data: {
        title,
        category,
        ...(placement ? { subcategory: placement.subcategory, mode: placement.mode } : {}),
        description,
        priceDisplay,
        // Only touch the price when the request sends one: "Publish" sends
        // just { published: true } and must not wipe it.
        ...('price' in body ? { price: price ? Number(price) : null } : {}),
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

    revalidateCatalog()
    return NextResponse.json({ success: true, listing })
  } catch (err) {
    console.error('Update listing error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireListingsApi()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const isVendor = staff.role === 'partner'

  try {
    const { id } = await params

    if (isVendor) {
      const existing = await prisma.listing.findUnique({ where: { id }, select: { ownerId: true } })
      if (!existing || existing.ownerId !== staff.userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
      }
    }

    await prisma.listing.delete({ where: { id } })
    revalidateCatalog()
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Delete listing error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
