import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { slugify } from '@/lib/utils'
import { requireListingsApi } from '@/lib/admin-auth'
import { optimizeListingDraft } from '@/lib/ai-optimize'
import { resolvePlacement } from '@/lib/taxonomy'
import { revalidateCatalog } from '@/lib/revalidate'
import { partnerMustSign } from '@/lib/agreements-server'

export async function POST(req: Request) {
  const staff = await requireListingsApi()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const isVendor = staff.role === 'partner'
  if (isVendor && (await partnerMustSign(staff.userId))) {
    return NextResponse.json({ error: 'Sign your partner agreement before adding listings', signUrl: '/partners/agreement' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const {
      title, category, description, price,
      location, country, images, features, status, featured,
      hireAvailable, hireRatePerDay, hireRateDisplay, specs, marginRequested,
    } = body
    const placement = resolvePlacement(category, body.subcategory, body.mode, { allowModeOverride: !isVendor })

    // The Quick List form (partners) doesn't collect a display string, just a
    // number, so derive one when it's missing rather than requiring it.
    const priceDisplay: string =
      body.priceDisplay || (price ? `₦${Number(price).toLocaleString('en-NG')}` : 'Price On Application')

    if (!title || !category || !description || !location || !country) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    if (isVendor && (!Array.isArray(images) || images.length === 0)) {
      return NextResponse.json({ error: 'At least one photo is required' }, { status: 400 })
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
    let finalFeatures: string[] = Array.isArray(features) ? features.map((f: unknown) => String(f).trim()).filter(Boolean) : []

    if (isVendor) {
      const optimized = await optimizeListingDraft({ title, category, description, priceDisplay, location, country })
      finalDescription = optimized.description
      finalPriceDisplay = optimized.priceDisplay
      finalSpecs = { ...finalSpecs, ...optimized.specs }
      // The partner's own highlights win; otherwise use the outline the AI
      // extracted from their description (customers see a list, not prose).
      if (!finalFeatures.length) finalFeatures = optimized.highlights
    }

    const listing = await prisma.listing.create({
      data: {
        title,
        slug,
        category,
        subcategory: placement.subcategory,
        mode: placement.mode,
        description: finalDescription,
        priceDisplay: finalPriceDisplay,
        price: price ? Number(price) : null,
        location,
        country,
        images: Array.isArray(images) ? images : [],
        features: finalFeatures,
        status: isVendor ? 'available' : (status || 'available'),
        featured: isVendor ? false : !!featured,
        hireAvailable: !!hireAvailable,
        hireRatePerDay: hireRatePerDay ? Number(hireRatePerDay) : null,
        hireRateDisplay: hireRateDisplay || null,
        specs: finalSpecs,
        ownerId: isVendor ? staff.userId : null,
        published: !isVendor,
        marginRequested: isVendor ? !!marginRequested : false,
        partnerRequestedPrice: isVendor && price ? Number(price) : null,
      },
    })

    revalidateCatalog()
    return NextResponse.json({ success: true, listing })
  } catch (err) {
    console.error('Create listing error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
