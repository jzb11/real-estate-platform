import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * GET /api/properties/[id]
 *
 * Returns a single property with its associated deals.
 * Only accessible if the authenticated user has at least one deal
 * on the property (multi-tenant isolation).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const { id } = await params;

  const property = await prisma.property.findUnique({
    where: { id },
    include: {
      deals: {
        where: { userId: user.id },
        select: {
          id: true,
          title: true,
          status: true,
          qualificationScore: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!property) {
    return NextResponse.json({ error: 'Property not found' }, { status: 404 });
  }

  // Multi-tenant check: user must have at least one deal on this property
  if (property.deals.length === 0) {
    return NextResponse.json({ error: 'Property not found' }, { status: 404 });
  }

  // Staleness check
  const STALE_THRESHOLD_DAYS = 14;
  const ageMs = Date.now() - new Date(property.dataFreshnessDate).getTime();
  const isStale = ageMs > STALE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;

  return NextResponse.json({ ...property, isStale });
}
