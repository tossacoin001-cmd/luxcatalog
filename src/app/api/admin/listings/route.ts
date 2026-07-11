import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { slugify } from '@/lib/utils'

async function requireAdmin() {
  const { userId, sessionClaims } = await auth()
  if (!userId) return null
  const role = (sessionClaims?.metadata as { role?: string })?.role
  if (role !== 'admin') return null
  return userId
}

export async function POST(req: Request) {
  const userId = await requireAdmin()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const {
      title, category, description, priceDisplay, price,
      location, country, images, features, status, featured,
      hireAvailable, hireRatePerDay, hireRateDisplay, specs,
    } = body

    if (!title || !category || !description || !priceDisplay || !location || !country) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const baseSlug = slugify(title)
    let slug = baseSlug
    let n = 1
    while (await prisma.listing.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${++n}`
    }

    const listing = await prisma.listing.create({
      data: {
        title,
        slug,
        category,
        description,
        priceDisplay,
        price: price ? Number(price) : null,
        location,
        country,
        images: Array.isArray(images) ? images : [],
        features: Array.isArray(features) ? features : [],
        status: status || 'available',
        featured: !!featured,
        hireAvailable: !!hireAvailable,
        hireRatePerDay: hireRatePerDay ? Number(hireRatePerDay) : null,
        hireRateDisplay: hireRateDisplay || null,
        specs: specs && typeof specs === 'object' ? specs : {},
      },
    })

    return NextResponse.json({ success: true, listing })
  } catch (err) {
    console.error('Create listing error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
