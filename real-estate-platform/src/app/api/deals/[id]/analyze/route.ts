import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { analyzeDeal } from '@/lib/qualification/dealAnalysis';

/**
 * POST /api/deals/:id/analyze
 *
 * Runs Level 2 advanced deal analysis (comp validation, rehab traps,
 * multifamily liquidity, transaction strategy, creative finance risks, tax warnings).
 *
 * Body (optional): { repairCosts?: number, purchasePrice?: number }
 */
export async function POST(
  request: NextRequest,
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

  const deal = await prisma.deal.findFirst({
    where: { id, userId: user.id },
    include: {
      property: true,
    },
  });

  if (!deal) {
    return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
  }

  // Parse optional body
  let repairCosts = 0;
  let purchasePrice: number | undefined;
  try {
    const body = await request.json().catch(() => ({}));
    if (typeof body.repairCosts === 'number') repairCosts = body.repairCosts;
    if (typeof body.purchasePrice === 'number') purchasePrice = body.purchasePrice;
  } catch {
    // No body is fine — defaults to 0 repair costs
  }

  const propertyForAnalysis = {
    ...deal.property,
    distressSignals: (deal.property.distressSignals as Record<string, unknown>) ?? {},
  };
  const analysis = analyzeDeal(propertyForAnalysis, repairCosts, purchasePrice);

  return NextResponse.json({
    dealId: deal.id,
    propertyId: deal.property.id,
    analysis,
  });
}
