import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * GET /api/dashboard/stats
 *
 * Returns aggregate stats for the authenticated user's dashboard:
 * deal counts by stage, properties imported, offers sent, conversion rates.
 */
export async function GET() {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const [dealCounts, propertiesCount, offersCount, closedDeals, openedOffers, activeSequences, pipelineDeals] = await Promise.all([
    // Deal counts by status
    prisma.deal.groupBy({
      by: ['status'],
      where: { userId: user.id },
      _count: true,
    }),
    // Total properties the user has deals on
    prisma.property.count({
      where: { deals: { some: { userId: user.id } } },
    }),
    // Total offers sent
    prisma.offeredDeal.count({
      where: { deal: { userId: user.id } },
    }),
    // Closed deals (for conversion rate)
    prisma.deal.count({
      where: { userId: user.id, status: 'CLOSED' },
    }),
    // Opened offers
    prisma.offeredDeal.count({
      where: { deal: { userId: user.id }, emailOpenedAt: { not: null } },
    }),
    // Active follow-up sequences
    prisma.followUpScheduled.count({
      where: { userId: user.id, status: 'ACTIVE' },
    }),
    // Pipeline deals with estimated values for pipeline value calc + stage age
    prisma.deal.findMany({
      where: {
        userId: user.id,
        status: { notIn: ['CLOSED', 'REJECTED'] },
      },
      select: {
        status: true,
        createdAt: true,
        property: {
          select: { estimatedValue: true },
        },
      },
    }),
  ]);

  const dealsByStatus: Record<string, number> = {};
  let totalDeals = 0;
  for (const group of dealCounts) {
    dealsByStatus[group.status] = group._count;
    totalDeals += group._count;
  }

  const conversionRate = totalDeals > 0
    ? Math.round((closedDeals / totalDeals) * 100)
    : 0;

  const openRate = offersCount > 0
    ? Math.round((openedOffers / offersCount) * 100)
    : 0;

  // Pipeline value: sum of estimated property values for active deals
  let pipelineValue = 0;
  const stageAges: Record<string, number[]> = {};
  const now = Date.now();
  for (const deal of pipelineDeals) {
    pipelineValue += deal.property?.estimatedValue ?? 0;
    if (!stageAges[deal.status]) stageAges[deal.status] = [];
    stageAges[deal.status].push(Math.floor((now - deal.createdAt.getTime()) / (1000 * 60 * 60 * 24)));
  }

  // Average days in pipeline per stage
  const avgDaysPerStage: Record<string, number> = {};
  for (const [stage, ages] of Object.entries(stageAges)) {
    avgDaysPerStage[stage] = Math.round(ages.reduce((a, b) => a + b, 0) / ages.length);
  }

  return NextResponse.json({
    totalDeals,
    dealsByStatus,
    propertiesCount,
    offersCount,
    closedDeals,
    conversionRate,
    openRate,
    activeSequences,
    pipelineValue,
    avgDaysPerStage,
    activeDealsCount: pipelineDeals.length,
  });
}
