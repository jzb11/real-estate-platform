import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';
import { z } from 'zod';

const stepSchema = z.object({
  type: z.enum(['EMAIL', 'SMS', 'WAIT']),
  delayDays: z.number().int().positive().optional(),
  subject: z.string().max(200).optional(),
  htmlContent: z.string().optional(),
  plainText: z.string().optional(),
  phoneNumber: z.string().optional(),
});

const updateSequenceSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  steps: z.array(stepSchema).min(1).optional(),
  enabled: z.boolean().optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

const patchActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('pause'),
    scheduledId: z.string().uuid(),
  }),
  z.object({
    action: z.literal('resume'),
    scheduledId: z.string().uuid(),
  }),
]);

/**
 * GET /api/sequences/[id]
 * Returns a single sequence template with its active scheduled instances.
 */
export async function GET(req: NextRequest, context: RouteContext) {
  void req;
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const sequence = await prisma.followUpSequence.findUnique({
      where: { id },
      include: {
        scheduledSequences: {
          where: { status: 'ACTIVE' },
          select: {
            id: true,
            dealId: true,
            nextStepAt: true,
            currentStep: true,
            status: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!sequence || sequence.userId !== user.id) {
      return NextResponse.json({ error: 'Sequence not found' }, { status: 404 });
    }

    return NextResponse.json({ sequence });
  } catch (error) {
    console.error('Fetch sequence error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sequence' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/sequences/[id]
 * Update a sequence template (name, description, steps, enabled).
 * Only updates provided fields (partial update).
 */
export async function PUT(req: NextRequest, context: RouteContext) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify ownership
    const existing = await prisma.followUpSequence.findUnique({ where: { id } });
    if (!existing || existing.userId !== user.id) {
      return NextResponse.json({ error: 'Sequence not found' }, { status: 404 });
    }

    const body: unknown = await req.json();
    const parsed = updateSequenceSchema.parse(body);

    const updated = await prisma.followUpSequence.update({
      where: { id },
      data: {
        ...(parsed.name !== undefined && { name: parsed.name }),
        ...(parsed.description !== undefined && { description: parsed.description }),
        ...(parsed.steps !== undefined && { steps: parsed.steps }),
        ...(parsed.enabled !== undefined && { enabled: parsed.enabled }),
      },
    });

    return NextResponse.json({ sequence: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      );
    }
    console.error('Update sequence error:', error);
    return NextResponse.json(
      { error: 'Failed to update sequence' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/sequences/[id]
 * Delete a sequence template. Cascades to FollowUpScheduled and FollowUpEvent.
 */
export async function DELETE(req: NextRequest, context: RouteContext) {
  void req;
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify ownership before deleting
    const existing = await prisma.followUpSequence.findUnique({ where: { id } });
    if (!existing || existing.userId !== user.id) {
      return NextResponse.json({ error: 'Sequence not found' }, { status: 404 });
    }

    await prisma.followUpSequence.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete sequence error:', error);
    return NextResponse.json(
      { error: 'Failed to delete sequence' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/sequences/[id]
 * Pause or resume a specific scheduled instance of this sequence for a deal.
 * Body: { action: 'pause' | 'resume', scheduledId: string }
 *
 * pause: Sets FollowUpScheduled.status = 'PAUSED' — executor skips jobs in PAUSED state
 * resume: Sets FollowUpScheduled.status = 'ACTIVE' — executor processes jobs again
 */
export async function PATCH(req: NextRequest, context: RouteContext) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify sequence ownership
    const sequence = await prisma.followUpSequence.findUnique({ where: { id } });
    if (!sequence || sequence.userId !== user.id) {
      return NextResponse.json({ error: 'Sequence not found' }, { status: 404 });
    }

    const body: unknown = await req.json();
    const parsed = patchActionSchema.parse(body);

    // Verify the scheduled instance belongs to this user and sequence
    const scheduled = await prisma.followUpScheduled.findUnique({
      where: { id: parsed.scheduledId },
    });

    if (!scheduled || scheduled.sequenceId !== id || scheduled.userId !== user.id) {
      return NextResponse.json(
        { error: 'Scheduled instance not found' },
        { status: 404 }
      );
    }

    const newStatus = parsed.action === 'pause' ? 'PAUSED' : 'ACTIVE';

    const updated = await prisma.followUpScheduled.update({
      where: { id: parsed.scheduledId },
      data: { status: newStatus },
    });

    return NextResponse.json({
      success: true,
      scheduled: updated,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid action or missing scheduledId', details: error.issues },
        { status: 400 }
      );
    }
    console.error('Patch sequence error:', error);
    return NextResponse.json(
      { error: 'Failed to update sequence' },
      { status: 500 }
    );
  }
}
