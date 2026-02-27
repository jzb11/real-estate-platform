import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Operator, RuleType } from '@prisma/client';
import { prisma } from '@/lib/db';

// Zod schema for partial update (all fields optional)
const UpdateRuleSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional().nullable(),
  ruleType: z.nativeEnum(RuleType).optional(),
  fieldName: z.string().min(1).optional(),
  operator: z.nativeEnum(Operator).optional(),
  value: z.unknown().optional(),
  weight: z.number().int().min(0).max(100).optional(),
  enabled: z.boolean().optional(),
});

/**
 * PATCH /api/rules/[id]
 * Update a qualification rule. Verifies ownership before updating.
 */
export async function PATCH(
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

  // Verify ownership
  const existingRule = await prisma.qualificationRule.findUnique({ where: { id } });
  if (!existingRule) {
    return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
  }
  if (existingRule.userId !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = UpdateRuleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const { value, ...rest } = parsed.data;

  const updatedRule = await prisma.qualificationRule.update({
    where: { id },
    data: {
      ...rest,
      ...(value !== undefined ? { value: value as object } : {}),
    },
  });

  return NextResponse.json(updatedRule);
}

/**
 * DELETE /api/rules/[id]
 * Delete a qualification rule. Verifies ownership before deleting.
 */
export async function DELETE(
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

  // Verify ownership
  const existingRule = await prisma.qualificationRule.findUnique({ where: { id } });
  if (!existingRule) {
    return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
  }
  if (existingRule.userId !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await prisma.qualificationRule.delete({ where: { id } });

  return NextResponse.json({ message: 'Rule deleted successfully' });
}
