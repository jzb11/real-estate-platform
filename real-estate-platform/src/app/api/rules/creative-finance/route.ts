import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { CreativeFinanceType, Operator, RuleType } from '@prisma/client';
import { prisma } from '@/lib/db';

/**
 * Validation schema for creating a creative finance rule.
 * CF rules are always SCORE_COMPONENT type with a non-null ruleSubtype.
 */
const CreateCFRuleSchema = z.object({
  name: z.string().min(1, 'name is required').max(200),
  description: z.string().optional().nullable(),
  fieldName: z.string().min(1, 'fieldName is required'),
  operator: z.nativeEnum(Operator),
  value: z.unknown(),
  ruleSubtype: z.nativeEnum(CreativeFinanceType),
  enabled: z.boolean().default(true),
});

/**
 * Validation schema for updating a creative finance rule.
 * All fields optional — partial update.
 */
const UpdateCFRuleSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().nullable().optional(),
  fieldName: z.string().min(1).optional(),
  operator: z.nativeEnum(Operator).optional(),
  value: z.unknown().optional(),
  ruleSubtype: z.nativeEnum(CreativeFinanceType).optional(),
  enabled: z.boolean().optional(),
});

/**
 * GET /api/rules/creative-finance
 * Returns all creative finance rules for the authenticated user.
 * CF rules have a non-null ruleSubtype.
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

  const rules = await prisma.qualificationRule.findMany({
    where: {
      userId: user.id,
      ruleSubtype: { not: null },
    },
    orderBy: [{ ruleSubtype: 'asc' }, { createdAt: 'asc' }],
  });

  return NextResponse.json({ rules, total: rules.length });
}

/**
 * POST /api/rules/creative-finance
 * Create a new creative finance rule for the authenticated user.
 *
 * CF rules are always SCORE_COMPONENT type — the ruleSubtype drives
 * the +20 score bonus in the engine (standard weight field is 0).
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

  const parsed = CreateCFRuleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const rule = await prisma.qualificationRule.create({
    data: {
      userId: user.id,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      ruleType: RuleType.SCORE_COMPONENT,
      fieldName: parsed.data.fieldName,
      operator: parsed.data.operator,
      value: parsed.data.value as object,
      weight: 0, // CF rules use fixed +20 bonus via ruleSubtype — standard weight unused
      ruleSubtype: parsed.data.ruleSubtype,
      enabled: parsed.data.enabled,
    },
  });

  return NextResponse.json(rule, { status: 201 });
}

/**
 * PATCH /api/rules/creative-finance
 * Partial update a creative finance rule by ruleId in request body.
 * Verifies ownership before updating.
 */
export async function PATCH(request: NextRequest) {
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

  // Extract ruleId from body — required for PATCH
  if (typeof body !== 'object' || body === null || !('ruleId' in body)) {
    return NextResponse.json({ error: 'ruleId is required' }, { status: 400 });
  }

  const { ruleId, ...updateFields } = body as { ruleId: string; [key: string]: unknown };

  const parsed = UpdateCFRuleSchema.safeParse(updateFields);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  // Ownership check — findFirst prevents existence leakage (404 not 403)
  const existing = await prisma.qualificationRule.findFirst({
    where: { id: ruleId, userId: user.id, ruleSubtype: { not: null } },
  });
  if (!existing) {
    return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
  }

  const updated = await prisma.qualificationRule.update({
    where: { id: ruleId },
    data: {
      ...(parsed.data.name !== undefined && { name: parsed.data.name }),
      ...(parsed.data.description !== undefined && { description: parsed.data.description }),
      ...(parsed.data.fieldName !== undefined && { fieldName: parsed.data.fieldName }),
      ...(parsed.data.operator !== undefined && { operator: parsed.data.operator }),
      ...(parsed.data.value !== undefined && { value: parsed.data.value as object }),
      ...(parsed.data.ruleSubtype !== undefined && { ruleSubtype: parsed.data.ruleSubtype }),
      ...(parsed.data.enabled !== undefined && { enabled: parsed.data.enabled }),
    },
  });

  return NextResponse.json(updated);
}

/**
 * DELETE /api/rules/creative-finance
 * Delete a creative finance rule by ruleId in request body.
 * Verifies ownership before deleting.
 */
export async function DELETE(request: NextRequest) {
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

  if (typeof body !== 'object' || body === null || !('ruleId' in body)) {
    return NextResponse.json({ error: 'ruleId is required' }, { status: 400 });
  }

  const { ruleId } = body as { ruleId: string };

  // Ownership check — findFirst prevents existence leakage (404 not 403)
  const existing = await prisma.qualificationRule.findFirst({
    where: { id: ruleId, userId: user.id, ruleSubtype: { not: null } },
  });
  if (!existing) {
    return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
  }

  await prisma.qualificationRule.delete({ where: { id: ruleId } });

  return NextResponse.json({ deleted: true, ruleId });
}
