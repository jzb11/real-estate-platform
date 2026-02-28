import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { DealStatus } from '@prisma/client';
import { prisma } from '@/lib/db';

// Zod schema for POST /api/deals body validation
const CreateDealSchema = z.object({
  propertyId: z.string().min(1, 'propertyId is required'),
  title: z.string().min(1, 'title is required').max(200, 'title must be 200 characters or fewer'),
  notes: z.string().optional(),
});

// Property fields to include in deal responses
const PROPERTY_SELECT = {
  id: true,
  address: true,
  city: true,
  state: true,
  estimatedValue: true,
  yearBuilt: true,
  squareFootage: true,
  unitCount: true,
  dataFreshnessDate: true,
};

/**
 * GET /api/deals
 * Returns deals grouped by pipeline stage (no ?status param)
 * Returns flat paginated list if ?status param is provided
 */
export async function GET(request: NextRequest) {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Look up internal user
  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const { searchParams } = request.nextUrl;
  const statusParam = searchParams.get('status');
  const pageParam = parseInt(searchParams.get('page') ?? '1', 10);
  const limitParam = parseInt(searchParams.get('limit') ?? '50', 10);
  const page = Math.max(1, isNaN(pageParam) ? 1 : pageParam);
  const limit = Math.min(100, Math.max(1, isNaN(limitParam) ? 50 : limitParam));

  // Validate status param if provided
  if (statusParam && !Object.values(DealStatus).includes(statusParam as DealStatus)) {
    return NextResponse.json(
      { error: `Invalid status. Must be one of: ${Object.values(DealStatus).join(', ')}` },
      { status: 400 }
    );
  }

  const where = {
    userId: user.id,
    ...(statusParam ? { status: statusParam as DealStatus } : {}),
  };

  // Flat paginated mode (status filter provided)
  if (statusParam) {
    const [deals, total] = await prisma.$transaction([
      prisma.deal.findMany({
        where,
        include: {
          property: { select: PROPERTY_SELECT },
          history: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
        orderBy: { pipelinePosition: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.deal.count({ where }),
    ]);

    return NextResponse.json({
      deals,
      total,
      page,
      hasMore: total > page * limit,
    });
  }

  // Grouped pipeline mode (no status filter)
  const allDeals = await prisma.deal.findMany({
    where,
    include: {
      property: { select: PROPERTY_SELECT },
      history: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
    orderBy: { pipelinePosition: 'asc' },
    take: limit,
  });

  // Group by status
  const pipeline: Record<DealStatus, typeof allDeals> = {
    SOURCED: [],
    ANALYZING: [],
    QUALIFIED: [],
    UNDER_CONTRACT: [],
    CLOSED: [],
    REJECTED: [],
  };

  for (const deal of allDeals) {
    pipeline[deal.status].push(deal);
  }

  return NextResponse.json({
    pipeline,
    total: allDeals.length,
  });
}

/**
 * POST /api/deals
 * Create a deal from an existing property (starts in SOURCED state)
 */
export async function POST(request: NextRequest) {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Look up internal user
  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Parse and validate body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = CreateDealSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const { propertyId, title, notes } = parsed.data;

  // Verify property exists
  const property = await prisma.property.findUnique({ where: { id: propertyId } });
  if (!property) {
    return NextResponse.json({ error: 'Property not found' }, { status: 404 });
  }

  // Prevent duplicate active deal for the same property (by this user)
  const existingActiveDeal = await prisma.deal.findFirst({
    where: {
      propertyId,
      userId: user.id,
      status: { notIn: ['CLOSED', 'REJECTED'] },
    },
  });
  if (existingActiveDeal) {
    return NextResponse.json(
      { error: 'An active deal already exists for this property', dealId: existingActiveDeal.id },
      { status: 409 }
    );
  }

  // Get current count of SOURCED deals to set pipelinePosition
  const sourcedCount = await prisma.deal.count({
    where: { userId: user.id, status: 'SOURCED' },
  });

  // Create deal and initial DealHistory in a transaction
  const deal = await prisma.$transaction(async (tx) => {
    const newDeal = await tx.deal.create({
      data: {
        propertyId,
        userId: user.id,
        title,
        notes,
        status: 'SOURCED',
        qualificationScore: 0,
        pipelinePosition: sourcedCount,
      },
      include: {
        property: { select: PROPERTY_SELECT },
      },
    });

    // Write initial DealHistory entry (null → SOURCED)
    await tx.dealHistory.create({
      data: {
        dealId: newDeal.id,
        userId: user.id,
        fieldChanged: 'status',
        oldValue: null,
        newValue: 'SOURCED',
      },
    });

    return newDeal;
  });

  return NextResponse.json(deal, { status: 201 });
}
