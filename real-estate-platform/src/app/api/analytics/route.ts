import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * GET /api/analytics
 * Returns time-series and funnel data for the analytics dashboard.
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

  // Last 30 days boundary
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [
    dealsByStatus,
    dealsOverTime,
    offersOverTime,
    offerStats,
    topProperties,
    qualificationScores,
    recentHistory,
  ] = await Promise.all([
    // Deal funnel counts
    prisma.deal.groupBy({
      by: ['status'],
      where: { userId: user.id },
      _count: true,
    }),

    // Deals created per day (last 30 days)
    prisma.deal.findMany({
      where: { userId: user.id, createdAt: { gte: thirtyDaysAgo } },
      select: { createdAt: true, status: true },
      orderBy: { createdAt: 'asc' },
    }),

    // Offers sent per day (last 30 days)
    prisma.offeredDeal.findMany({
      where: { deal: { userId: user.id }, createdAt: { gte: thirtyDaysAgo } },
      select: { createdAt: true, status: true, emailOpenedAt: true, linkClickedAt: true, bouncedAt: true },
      orderBy: { createdAt: 'asc' },
    }),

    // Overall offer performance
    prisma.offeredDeal.groupBy({
      by: ['status'],
      where: { deal: { userId: user.id } },
      _count: true,
    }),

    // Top properties by estimated value (active deals)
    prisma.deal.findMany({
      where: { userId: user.id, status: { notIn: ['REJECTED'] } },
      select: {
        title: true,
        status: true,
        qualificationScore: true,
        property: { select: { address: true, city: true, estimatedValue: true, equityPercent: true } },
      },
      orderBy: { property: { estimatedValue: 'desc' } },
      take: 10,
    }),

    // Qualification score distribution
    prisma.deal.findMany({
      where: { userId: user.id, qualificationScore: { gt: 0 } },
      select: { qualificationScore: true },
    }),

    // Stage transitions (last 30 days)
    prisma.dealHistory.findMany({
      where: {
        userId: user.id,
        fieldChanged: 'status',
        createdAt: { gte: thirtyDaysAgo },
      },
      select: { oldValue: true, newValue: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  // Build funnel
  const funnel: Record<string, number> = {};
  for (const g of dealsByStatus) {
    funnel[g.status] = g._count;
  }

  // Build deals timeline (group by date)
  const dealsTimeline: Record<string, number> = {};
  for (const d of dealsOverTime) {
    const day = d.createdAt.toISOString().slice(0, 10);
    dealsTimeline[day] = (dealsTimeline[day] || 0) + 1;
  }

  // Build offers timeline
  const offersTimeline: Record<string, { sent: number; opened: number; clicked: number; bounced: number }> = {};
  for (const o of offersOverTime) {
    const day = o.createdAt.toISOString().slice(0, 10);
    if (!offersTimeline[day]) offersTimeline[day] = { sent: 0, opened: 0, clicked: 0, bounced: 0 };
    offersTimeline[day].sent++;
    if (o.emailOpenedAt) offersTimeline[day].opened++;
    if (o.linkClickedAt) offersTimeline[day].clicked++;
    if (o.bouncedAt) offersTimeline[day].bounced++;
  }

  // Offer performance summary
  const offerPerformance: Record<string, number> = {};
  for (const g of offerStats) {
    offerPerformance[g.status] = g._count;
  }

  // Score distribution buckets (0-20, 21-40, 41-60, 61-80, 81-100)
  const scoreBuckets = [0, 0, 0, 0, 0];
  for (const d of qualificationScores) {
    const s = d.qualificationScore;
    if (s <= 20) scoreBuckets[0]++;
    else if (s <= 40) scoreBuckets[1]++;
    else if (s <= 60) scoreBuckets[2]++;
    else if (s <= 80) scoreBuckets[3]++;
    else scoreBuckets[4]++;
  }

  // Stage transition counts
  const transitions: Record<string, number> = {};
  for (const h of recentHistory) {
    const key = `${h.oldValue ?? 'NEW'} → ${h.newValue}`;
    transitions[key] = (transitions[key] || 0) + 1;
  }

  return NextResponse.json({
    funnel,
    dealsTimeline,
    offersTimeline,
    offerPerformance,
    topProperties,
    scoreBuckets,
    transitions,
  });
}
