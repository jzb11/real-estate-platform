import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Operator, RuleType } from '@prisma/client';
import { prisma } from '@/lib/db';

// Zod validation for creating/updating a qualification rule
const CreateRuleSchema = z.object({
  name: z.string().min(1, 'name is required').max(200),
  description: z.string().optional().nullable(),
  ruleType: z.nativeEnum(RuleType),
  fieldName: z.string().min(1, 'fieldName is required'),
  operator: z.nativeEnum(Operator),
  value: z.unknown(),
  weight: z.number().int().min(0).max(100).default(0),
  enabled: z.boolean().default(true),
});

// Default system rules seeded for new users on first GET /api/rules
const DEFAULT_SYSTEM_RULES = [
  {
    name: 'Minimum ARV',
    description: 'Reject deals where estimated value (ARV) is under $50,000',
    ruleType: RuleType.FILTER,
    fieldName: 'estimatedValue',
    operator: Operator.GT,
    value: 50000,
    weight: 0,
    enabled: true,
  },
  {
    name: 'Foreclosure Signal',
    description: 'Award 25 points when the property has an active foreclosure signal',
    ruleType: RuleType.SCORE_COMPONENT,
    fieldName: 'distressSignals',
    operator: Operator.CONTAINS,
    value: 'foreclosure',
    weight: 25,
    enabled: true,
  },
  {
    name: 'Days on Market',
    description: 'Award 20 points for properties on market over 60 days (motivated sellers)',
    ruleType: RuleType.SCORE_COMPONENT,
    fieldName: 'daysOnMarket',
    operator: Operator.GT,
    value: 60,
    weight: 20,
    enabled: true,
  },
] as const;

/**
 * GET /api/rules
 * Returns all qualification rules for the authenticated user.
 * If the user has no rules yet, seeds 3 default system rules.
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

  let rules = await prisma.qualificationRule.findMany({
    where: { userId: user.id },
    orderBy: [{ ruleType: 'asc' }, { createdAt: 'asc' }],
  });

  // Seed default rules for new users (no rules yet)
  if (rules.length === 0) {
    await prisma.qualificationRule.createMany({
      data: DEFAULT_SYSTEM_RULES.map((rule) => ({
        ...rule,
        userId: user.id,
        value: rule.value as unknown as object,
      })),
    });

    rules = await prisma.qualificationRule.findMany({
      where: { userId: user.id },
      orderBy: [{ ruleType: 'asc' }, { createdAt: 'asc' }],
    });
  }

  return NextResponse.json({ rules, total: rules.length });
}

/**
 * POST /api/rules
 * Create a new qualification rule for the authenticated user.
 */
export async function POST(request: NextRequest) {
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

  const parsed = CreateRuleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const rule = await prisma.qualificationRule.create({
    data: {
      ...parsed.data,
      userId: user.id,
      value: parsed.data.value as object,
    },
  });

  return NextResponse.json(rule, { status: 201 });
}
