import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { buildPropertyFilter, mergeFilters } from '@/lib/propstream/searchFilters';
import type { PropertySearchFilters } from '@/lib/propstream/types';

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;
const STALE_THRESHOLD_DAYS = 14;

/**
 * GET /api/properties/search
 *
 * Returns filtered, paginated properties associated with the authenticated user.
 * Uses typed DB columns (equityPercent, debtOwed, interestRate, daysOnMarket) for
 * efficient index-backed filtering.
 *
 * Query params:
 *   minDays, maxDays         — days on market range
 *   minEquity                — minimum equity percent (0-100)
 *   maxEquity                — maximum equity percent (0-100)
 *   maxDebt                  — maximum debt owed (dollars)
 *   maxRate                  — maximum interest rate
 *   city, state              — geographic filters (case-insensitive)
 *   propertyType             — property type filter
 *   filterId                 — load a saved filter preset (merged with above params)
 *   page                     — page number (1-indexed, default 1)
 *   limit                    — results per page (default 50, max 200)
 *
 * Response:
 *   { properties, total, page, hasMore }
 *   Each property includes isStale: true when dataFreshnessDate > 14 days old.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);

  // Parse pagination
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1);
  const limit = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, parseInt(searchParams.get('limit') ?? String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE)
  );
  const offset = (page - 1) * limit;

  // Parse filter params from query string
  const queryFilters: PropertySearchFilters = {};

  const minDays = searchParams.get('minDays');
  if (minDays !== null) queryFilters.minDaysOnMarket = parseFloat(minDays);

  const maxDays = searchParams.get('maxDays');
  if (maxDays !== null) queryFilters.maxDaysOnMarket = parseFloat(maxDays);

  const minEquity = searchParams.get('minEquity');
  if (minEquity !== null) queryFilters.minEquityPercent = parseFloat(minEquity);

  const maxEquity = searchParams.get('maxEquity');
  if (maxEquity !== null) queryFilters.maxEquityPercent = parseFloat(maxEquity);

  const maxDebt = searchParams.get('maxDebt');
  if (maxDebt !== null) queryFilters.maxDebtOwed = parseFloat(maxDebt);

  const maxRate = searchParams.get('maxRate');
  if (maxRate !== null) queryFilters.maxInterestRate = parseFloat(maxRate);

  const city = searchParams.get('city');
  if (city) queryFilters.city = city;

  const state = searchParams.get('state');
  if (state) queryFilters.state = state;

  const propertyType = searchParams.get('propertyType');
  if (propertyType) queryFilters.propertyType = propertyType;

  // Free-text search query (searches address, city, owner name)
  const searchQuery = searchParams.get('q')?.trim();

  // If filterId provided, load saved filter and merge with query params
  let baseFilters: PropertySearchFilters = {};
  const filterId = searchParams.get('filterId');
  if (filterId) {
    const savedFilter = await prisma.savedSearchFilter.findFirst({
      where: { id: filterId, userId: user.id }, // enforce ownership
    });
    if (!savedFilter) {
      return NextResponse.json(
        { error: 'Saved filter not found or not owned by this user' },
        { status: 404 }
      );
    }
    baseFilters = savedFilter.filters as PropertySearchFilters;
  }

  // Merge: saved filter base + query param overrides
  const mergedFilters = mergeFilters(baseFilters, queryFilters);

  // Build WHERE clause from merged filters
  const filterWhere = buildPropertyFilter(mergedFilters);

  // User-scope: properties are accessed through deals (Deal has userId).
  // Query properties that the user has at least one deal on.
  // This enforces multi-tenant isolation — no cross-user data leakage.
  const userWhere: Record<string, unknown> = {
    ...filterWhere,
    deals: {
      some: { userId: user.id },
    },
  };

  // Apply free-text search across address, city, and owner name
  if (searchQuery) {
    userWhere.OR = [
      { address: { contains: searchQuery, mode: 'insensitive' } },
      { city: { contains: searchQuery, mode: 'insensitive' } },
      { ownershipName: { contains: searchQuery, mode: 'insensitive' } },
      { zip: { startsWith: searchQuery } },
    ];
  }

  // Execute count + data queries in parallel
  const [total, rawProperties] = await Promise.all([
    prisma.property.count({ where: userWhere }),
    prisma.property.findMany({
      where: userWhere,
      select: {
        id: true,
        address: true,
        city: true,
        state: true,
        zip: true,
        propertyType: true,
        estimatedValue: true,
        equityPercent: true,
        debtOwed: true,
        interestRate: true,
        daysOnMarket: true,
        dataFreshnessDate: true,
        distressSignals: true,
        ownershipName: true,
        dataSource: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [{ daysOnMarket: 'desc' }, { createdAt: 'desc' }],
      skip: offset,
      take: limit,
    }),
  ]);

  // Add isStale flag: data older than STALE_THRESHOLD_DAYS is considered stale
  const staleThreshold = new Date(Date.now() - STALE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000);
  const properties = rawProperties.map((p) => ({
    ...p,
    isStale: p.dataFreshnessDate < staleThreshold,
  }));

  return NextResponse.json({
    properties,
    total,
    page,
    limit,
    hasMore: offset + properties.length < total,
  });
}
