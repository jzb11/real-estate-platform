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

const createSequenceSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  steps: z.array(stepSchema).min(1, 'Sequence must have at least one step'),
});


/**
 * GET /api/sequences
 * Returns all follow-up sequence templates for the authenticated user.
 * Ordered by creation date (newest first).
 */
export async function GET(req: NextRequest) {
  void req; // unused but required by Next.js route signature
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Resolve clerkId to internal userId
    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const sequences = await prisma.followUpSequence.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        name: true,
        description: true,
        enabled: true,
        createdAt: true,
        steps: true,
        _count: {
          select: {
            scheduledSequences: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ sequences });
  } catch (error) {
    console.error('Fetch sequences error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sequences' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/sequences
 * Create a new follow-up sequence template.
 * Body: { name, description?, steps: [{type, delayDays?, subject?, htmlContent?, plainText?, phoneNumber?}] }
 */
export async function POST(req: NextRequest) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body: unknown = await req.json();
    const parsed = createSequenceSchema.parse(body);

    const sequence = await prisma.followUpSequence.create({
      data: {
        userId: user.id,
        name: parsed.name,
        description: parsed.description,
        steps: parsed.steps,
        enabled: true,
      },
    });

    return NextResponse.json({ sequence }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      );
    }
    console.error('Create sequence error:', error);
    return NextResponse.json(
      { error: 'Failed to create sequence' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/sequences
 * Not supported at collection level — use /api/sequences/[id] for updates.
 */
export async function PUT() {
  return NextResponse.json(
    { error: 'Use PUT /api/sequences/[id] to update a specific sequence' },
    { status: 405 }
  );
}

/**
 * DELETE /api/sequences
 * Not supported at collection level — use /api/sequences/[id] for deletion.
 */
export async function DELETE() {
  return NextResponse.json(
    { error: 'Use DELETE /api/sequences/[id] to delete a specific sequence' },
    { status: 405 }
  );
}

