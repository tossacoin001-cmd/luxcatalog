import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { slugify } from '@/lib/utils'
import { requireStaffApi } from '@/lib/admin-auth'
import { optimizeListingDraft } from '@/lib/ai-optimize'

export async function POST(req: Request) {
  const staff = await requireStaffApi()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const isVendor = staff.role === 'org:vendor'

  try {
    const body = await req.json()
    const {
      title, category, description, price,
      location, country, images, features, status, featured,
      hireAvailable, hireRatePerDay, hireRateDisplay, specs,
    } = body

    // The Quick List form (partners) doesn't collect a display string, just a
    // number, so derive one when it's missing rather than requiring it.
    const priceDisplay: string =
      body.priceDisplay || (price ? `₦${Number(price).toLocaleString('en-NG')}` : 'Price On Application')

    if (!title || !category || !description || !location || !country) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const baseSlug = slugify(title)
    let slug = baseSlug
    let n = 1
    while (await prisma.listing.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${++n}`
    }

    // Partner submissions go through AI polish and always start unpublished,
    // pending admin review, regardless of what the request body sends. Admin
    // submissions publish immediately as before.
    let finalDescription = description
    let finalPriceDisplay = priceDisplay
    let finalSpecs = specs && typeof specs === 'object' ? specs : {}

    if (isVendor) {
      const optimized = await optimizeListingDraft({ title, category, description, priceDisplay, location, country })
      finalDescription = optimized.description
      finalPriceDisplay = optimized.priceDisplay
      finalSpecs = { ...finalSpecs, ...optimized.specs }
    }

    const listing = await prisma.listing.create({
      data: {
        title,
        slug,
        category,
        description: finalDescription,
        priceDisplay: finalPriceDisplay,
        price: price ? Number(price) : null,
        location,
        country,
        images: Array.isArray(images) ? images : [],
        features: Array.isArray(features) ? features : [],
        status: isVendor ? 'available' : (status || 'available'),
        featured: isVendor ? false : !!featured,
        hireAvailable: isVendor ? false : !!hireAvailable,
        hireRatePerDay: isVendor ? null : (hireRatePerDay ? Number(hireRatePerDay) : null),
        hireRateDisplay: isVendor ? null : (hireRateDisplay || null),
        specs: finalSpecs,
        ownerId: isVendor ? staff.userId : null,
        published: !isVendor,
      },
    })

    return NextResponse.json({ success: true, listing })
  } catch (err) {
    console.error('Create listing error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
