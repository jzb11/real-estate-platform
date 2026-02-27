/**
 * POST /api/properties/skip-trace
 *
 * Initiates a skip-trace lookup for a single property via REISkip API.
 * The lookup is queued via BullMQ and processed asynchronously.
 *
 * Request body:
 *   { propertyId: string }
 *
 * Response (202 Accepted):
 *   { requestId, propertyId, status: 'PENDING', message }
 *
 * Response (409 Conflict — already pending/in-progress):
 *   { error, existingRequestId }
 *
 * The caller can poll GET /api/properties/skip-trace/status?propertyId= to check progress.
 */

import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { enqueueSkipTrace } from '@/lib/skiptrace/queue';
import { isSkipTraceAvailable } from '@/lib/skiptrace/reiskip';

const RequestSchema = z.object({
  propertyId: z.string().min(1, 'propertyId is required'),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check API key before doing any DB work
  if (!isSkipTraceAvailable()) {
    return NextResponse.json(
      { error: 'Skip-trace service is not configured. Set SKIP_TRACE_API_KEY to enable.' },
      { status: 503 }
    );
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

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const { propertyId } = parsed.data;

  // Verify property exists
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { id: true, address: true, city: true, state: true, zip: true, ownershipName: true },
  });

  if (!property) {
    return NextResponse.json({ error: 'Property not found' }, { status: 404 });
  }

  // Prevent duplicate active requests (PENDING or IN_PROGRESS)
  const existingActive = await prisma.skipTraceRequest.findFirst({
    where: {
      propertyId,
      status: { in: ['PENDING', 'IN_PROGRESS'] },
    },
    select: { id: true, status: true },
  });

  if (existingActive) {
    return NextResponse.json(
      {
        error: `A skip-trace request is already ${existingActive.status} for this property`,
        existingRequestId: existingActive.id,
      },
      { status: 409 }
    );
  }

  // Create SkipTraceRequest record
  const skipTraceRequest = await prisma.skipTraceRequest.create({
    data: {
      propertyId,
      userId: user.id,
      status: 'PENDING',
    },
  });

  // Enqueue BullMQ job
  await enqueueSkipTrace({
    skipTraceRequestId: skipTraceRequest.id,
    propertyId,
    userId: user.id,
    address: property.address,
    city: property.city,
    state: property.state,
    zip: property.zip,
    ownerName: property.ownershipName ?? undefined,
  });

  return NextResponse.json(
    {
      requestId: skipTraceRequest.id,
      propertyId,
      status: 'PENDING',
      message: 'Skip-trace lookup queued. Poll /api/properties/skip-trace/status?propertyId= for results.',
    },
    { status: 202 }
  );
}
