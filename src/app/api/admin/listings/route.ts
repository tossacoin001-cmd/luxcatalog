import { NextResponse, after } from 'next/server'
import { prisma } from '@/lib/prisma'
import { slugify } from '@/lib/utils'
import { requireListingsApi, audit } from '@/lib/admin-auth'
import { rateLimit } from '@/lib/protect'
import { createRules, APPROVAL_MESSAGE } from '@/lib/listing-policy'
import { notifyListingPending } from '@/lib/listing-review'
import { optimizeListingDraft } from '@/lib/ai-optimize'
import { resolvePlacement } from '@/lib/taxonomy'
import { revalidateCatalog } from '@/lib/revalidate'
import { partnerMustSign } from '@/lib/agreements-server'
import { checkServiceListing } from '@/lib/services-server'
import { bannedTermsMessage, findBannedTerms } from '@/lib/services'

export async function POST(req: Request) {
  const staff = await requireListingsApi()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const isVendor = staff.role === 'partner'
  const rules = createRules(staff.role)
  // A runaway script or a stolen staff session cannot flood the review queue.
  if (!(await rateLimit(`staff-create:${staff.userId}`, 40, 3_600_000))) {
    return NextResponse.json({ error: 'You have added a lot of listings in a short time. Please wait a little.' }, { status: 429 })
  }
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
    const isService = category === 'private_services'
    if (isService) {
      const refused = await checkServiceListing({ subcategory: placement.subcategory, title, description, features, specs, price }, staff)
      if (refused) return NextResponse.json({ error: refused.error }, { status: refused.status })
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
    // The polished copy is checked again: nothing banned may reach the page.
    if (isService) {
      const banned = findBannedTerms(finalDescription, finalFeatures, finalSpecs, finalPriceDisplay)
      if (banned.length) return NextResponse.json({ error: bannedTermsMessage(banned) }, { status: 400 })
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
        status: rules.status(status),
        featured: rules.canPromote ? !!featured : false,
        hireAvailable: rules.canPromote ? !!hireAvailable : false,
        hireRatePerDay: rules.canPromote && hireRatePerDay ? Number(hireRatePerDay) : null,
        hireRateDisplay: rules.canPromote ? hireRateDisplay || null : null,
        specs: finalSpecs,
        ownerId: isVendor ? staff.userId : null,
        published: rules.published,
        marginRequested: isVendor ? !!marginRequested : false,
        partnerRequestedPrice: isVendor && price ? Number(price) : null,
      },
    })

    await audit(staff.userId, 'listing.create', listing.id, { role: staff.role, published: listing.published, title: listing.title })
    if (rules.needsApproval) after(() => notifyListingPending(listing.id, staff.userId, 'new'))
    revalidateCatalog()
    return NextResponse.json({ success: true, listing, needsApproval: rules.needsApproval, ...(rules.needsApproval ? { message: APPROVAL_MESSAGE } : {}) })
  } catch (err) {
    console.error('Create listing error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
