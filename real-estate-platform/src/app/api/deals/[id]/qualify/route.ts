import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { evaluateDeal } from '@/lib/qualification/engine';
import type { PropertyForEvaluation, QualificationRule } from '@/lib/qualification/types';
import type { Operator, RuleType } from '@prisma/client';

/**
 * POST /api/deals/[id]/qualify
 *
 * Evaluates a deal against all of the user's enabled qualification rules.
 *
 * Steps:
 * 1. Load the deal + its property
 * 2. Load user's qualification rules
 * 3. Run evaluateDeal() (pure, no side effects)
 * 4. Update deal.status + deal.qualificationScore in DB
 * 5. Write RuleEvaluationLog entries for each rule result
 * 6. Return the EvaluationResult
 */
export async function POST(
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

  const { id: dealId } = await params;

  // Load deal with its property
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    include: { property: true },
  });

  if (!deal) {
    return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
  }

  // Ownership check — users can only qualify their own deals
  if (deal.userId !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Load user's enabled qualification rules
  const dbRules = await prisma.qualificationRule.findMany({
    where: { userId: user.id, enabled: true },
    orderBy: [{ ruleType: 'asc' }, { createdAt: 'asc' }],
  });

  // Map Prisma rules to engine types
  const rules: QualificationRule[] = dbRules.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    ruleType: r.ruleType as RuleType,
    fieldName: r.fieldName,
    operator: r.operator as Operator,
    value: r.value,
    weight: r.weight,
    enabled: r.enabled,
  }));

  // Build property evaluation object from deal's property
  const property: PropertyForEvaluation = {
    estimatedValue: deal.property.estimatedValue ?? undefined,
    lastSalePrice: deal.property.lastSalePrice ?? undefined,
    taxAssessedValue: deal.property.taxAssessedValue ?? undefined,
    distressSignals: deal.property.distressSignals as Record<string, unknown>,
    state: deal.property.state,
    city: deal.property.city,
    zip: deal.property.zip,
    propertyType: deal.property.propertyType ?? undefined,
    rawData: deal.property.rawData as Record<string, unknown>,
    // daysOnMarket derived from data freshness date if not directly available
    daysOnMarket: deal.property.dataFreshnessDate
      ? Math.floor((Date.now() - deal.property.dataFreshnessDate.getTime()) / (1000 * 60 * 60 * 24))
      : undefined,
  };

  // Run the pure evaluation engine
  const evalResult = evaluateDeal(property, rules);

  // Map engine status to Prisma DealStatus
  const newStatus =
    evalResult.status === 'QUALIFIED'
      ? 'QUALIFIED'
      : evalResult.status === 'REJECTED'
        ? 'REJECTED'
        : 'ANALYZING';

  // Persist results in a transaction
  await prisma.$transaction(async (tx) => {
    // Update the deal's status and score
    await tx.deal.update({
      where: { id: dealId },
      data: {
        status: newStatus,
        qualificationScore: evalResult.qualificationScore,
      },
    });

    // Write DealHistory for the status change
    await tx.dealHistory.create({
      data: {
        dealId,
        userId: user.id,
        fieldChanged: 'status',
        oldValue: deal.status,
        newValue: newStatus,
      },
    });

    // Write RuleEvaluationLog entries for each rule result
    if (evalResult.ruleBreakdown.length > 0) {
      await tx.ruleEvaluationLog.createMany({
        data: evalResult.ruleBreakdown.map((entry) => ({
          dealId,
          ruleId: entry.ruleId,
          evaluationResult: entry.result,
          scoreAwarded: entry.scored,
        })),
      });
    }
  });

  return NextResponse.json({
    dealId,
    status: newStatus,
    qualificationScore: evalResult.qualificationScore,
    ruleBreakdown: evalResult.ruleBreakdown,
  });
}
