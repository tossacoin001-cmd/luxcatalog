import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'

async function requireAdmin() {
  const { userId, sessionClaims } = await auth()
  if (!userId) return null
  const role = (sessionClaims?.metadata as { role?: string })?.role
  if (role !== 'admin') return null
  return userId
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireAdmin()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const body = await req.json()
    const {
      title, category, description, priceDisplay, price,
      location, country, images, features, status, featured,
      hireAvailable, hireRatePerDay, hireRateDisplay, specs,
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
        featured: !!featured,
        hireAvailable: !!hireAvailable,
        hireRatePerDay: hireRatePerDay ? Number(hireRatePerDay) : null,
        hireRateDisplay: hireRateDisplay || null,
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
  const userId = await requireAdmin()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    await prisma.listing.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Delete listing error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
