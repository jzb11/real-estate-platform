import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';

/**
 * Validation schema for saved search filter creation.
 * All filter fields are optional — a filter can target any combination of dimensions.
 */
const SavedFilterSchema = z.object({
  name: z.string().min(1).max(100),
  filters: z.object({
    minDaysOnMarket: z.number().min(0).optional(),
    maxDaysOnMarket: z.number().min(0).optional(),
    minEquityPercent: z.number().min(0).max(100).optional(),
    maxEquityPercent: z.number().min(0).max(100).optional(),
    maxDebtOwed: z.number().min(0).optional(),
    maxInterestRate: z.number().min(0).max(100).optional(),
    city: z.string().optional(),
    state: z.string().length(2).optional(),
    propertyType: z.string().optional(),
  }),
});

/**
 * GET /api/search-filters
 *
 * Returns all saved search filters for the authenticated user.
 * Each filter includes id, name, filters criteria, and timestamps.
 */
export async function GET(_request: NextRequest): Promise<NextResponse> {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const savedFilters = await prisma.savedSearchFilter.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      filters: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json(savedFilters);
}

/**
 * POST /api/search-filters
 *
 * Creates a new saved search filter for the authenticated user.
 * Body: { name: string, filters: PropertySearchFilters }
 * Returns the created filter with its ID.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = SavedFilterSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const savedFilter = await prisma.savedSearchFilter.create({
    data: {
      userId: user.id,
      name: parsed.data.name,
      filters: parsed.data.filters,
    },
    select: {
      id: true,
      name: true,
      filters: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json(savedFilter, { status: 201 });
}
