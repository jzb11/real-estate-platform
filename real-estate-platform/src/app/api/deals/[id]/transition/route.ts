import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { DealStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { transitionDeal } from '@/lib/deals/stateMachine';

// Zod schema for transition request body
const TransitionSchema = z.object({
  targetState: z.enum(Object.values(DealStatus) as [string, ...string[]]),
  notes: z.string().optional(),
  transitionData: z
    .object({
      estimatedProfit: z.number().positive().optional(),
      closedDate: z
        .string()
        .datetime({ message: 'closedDate must be an ISO 8601 datetime string' })
        .transform((val) => new Date(val))
        .optional(),
      rejectionReason: z.string().optional(),
    })
    .optional(),
});

/**
 * POST /api/deals/:id/transition
 * Enforces the deal state machine and writes DealHistory atomically.
 * Returns 422 (Unprocessable Entity) for invalid transitions — the request format is valid,
 * but the business rule (state machine) does not allow the transition.
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

  // Parse and validate body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = TransitionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const { targetState, notes, transitionData } = parsed.data;

  // Delegate to state machine (ownership check + transition validation + atomic write)
  const result = await transitionDeal({
    dealId: id,
    targetState: targetState as DealStatus,
    userId: user.id,
    notes,
    transitionData: transitionData
      ? {
          estimatedProfit: transitionData.estimatedProfit,
          closedDate: transitionData.closedDate,
          rejectionReason: transitionData.rejectionReason,
        }
      : undefined,
  });

  if (!result.success) {
    // 'Deal not found or access denied' → 404 (prevents existence leakage)
    if (result.error?.includes('not found') || result.error?.includes('access denied')) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
    }

    // All other failures are state machine rejections → 422
    return NextResponse.json({ error: result.error }, { status: 422 });
  }

  // Return updated deal with full detail
  const updatedDeal = await prisma.deal.findUnique({
    where: { id },
    include: {
      property: {
        select: {
          id: true,
          address: true,
          city: true,
          state: true,
          estimatedValue: true,
          dataFreshnessDate: true,
        },
      },
      history: {
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  return NextResponse.json(updatedDeal);
}
