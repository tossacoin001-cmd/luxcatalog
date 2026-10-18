import { NextResponse, after } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireListingsApi, audit } from '@/lib/admin-auth'
import { rateLimit } from '@/lib/protect'
import { editRules, editAction, deleteRule } from '@/lib/listing-policy'
import { notifyListingPending } from '@/lib/listing-review'
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

    if (!(await rateLimit(`staff-edit:${staff.userId}`, 300, 3_600_000))) {
      return NextResponse.json({ error: 'You have made a lot of changes in a short time. Please wait a little.' }, { status: 429 })
    }
    const body = await req.json()
    const {
      title, category, description, priceDisplay, price,
      location, country, images, features, status, specs,
    } = body
    // The gate: who may publish or promote, and what an edit may change.
    const decision = editRules(staff.role, body)
    if (!decision.ok) return NextResponse.json({ error: decision.error }, { status: decision.status })
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
        // Anything a partner or team member changes goes back to an admin
        // before customers see it. Only an admin's request can publish,
        // unpublish or promote, and only the fields it actually sends change.
        ...(decision.sendToReview ? { published: false } : decision.write),
        specs: specs && typeof specs === 'object' ? specs : undefined,
      },
    })

    await audit(staff.userId, editAction(decision.write), id, { role: staff.role, fields: Object.keys(body), ...(decision.sendToReview ? { sentToReview: true } : {}) })
    if (decision.sendToReview) after(() => notifyListingPending(id, staff.userId, 'edited'))
    revalidateCatalog()
    return NextResponse.json({ success: true, listing, ...(decision.sendToReview ? { needsApproval: true } : {}) })
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

    const existing = await prisma.listing.findUnique({ where: { id }, select: { ownerId: true, published: true, title: true } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (isVendor && existing.ownerId !== staff.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    const allowed = deleteRule(staff.role, existing)
    if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: allowed.status })

    await prisma.listing.delete({ where: { id } })
    await audit(staff.userId, 'listing.delete', id, { role: staff.role, title: existing.title, wasLive: existing.published })
    revalidateCatalog()
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Delete listing error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
