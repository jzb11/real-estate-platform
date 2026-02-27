/**
 * POST /api/properties/skip-trace/bulk
 *
 * Queues skip-trace lookups for multiple properties at once.
 * Designed for the common use case: "enrich all properties without phone numbers".
 *
 * Request body:
 *   { propertyIds?: string[], skipAlreadyTraced?: boolean }
 *
 *   If propertyIds is omitted, defaults to ALL user-accessible properties
 *   that have no ownershipPhone (the primary use case).
 *
 *   skipAlreadyTraced (default: true) — skip properties where skipTraced=true.
 *
 * Response (202 Accepted):
 *   { queued, skipped, errors[], requestIds[] }
 *
 * Rate limiting: Max 500 properties per bulk request.
 * Each property is enqueued as a separate BullMQ job (concurrency: 1 worker).
 */

import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { enqueueSkipTrace } from '@/lib/skiptrace/queue';
import { isSkipTraceAvailable } from '@/lib/skiptrace/reiskip';
import type { BulkSkipTraceResult } from '@/lib/skiptrace/types';

const MAX_BULK_SIZE = 500;

const BulkRequestSchema = z.object({
  propertyIds: z.array(z.string().min(1)).max(MAX_BULK_SIZE).optional(),
  skipAlreadyTraced: z.boolean().default(true),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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
    // Empty body is fine — means "enrich all properties without phones"
    body = {};
  }

  const parsed = BulkRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const { propertyIds: requestedIds, skipAlreadyTraced } = parsed.data;

  // Determine which properties to process
  let properties: Array<{
    id: string;
    address: string;
    city: string;
    state: string;
    zip: string;
    ownershipName: string | null;
    skipTraced: boolean;
  }>;

  if (requestedIds && requestedIds.length > 0) {
    // Explicit list — verify ownership via Deal relation
    properties = await prisma.property.findMany({
      where: {
        id: { in: requestedIds },
        deals: { some: { userId: user.id } },
      },
      select: {
        id: true,
        address: true,
        city: true,
        state: true,
        zip: true,
        ownershipName: true,
        skipTraced: true,
      },
    });
  } else {
    // Default: all user-accessible properties without a phone number
    properties = await prisma.property.findMany({
      where: {
        deals: { some: { userId: user.id } },
        ownershipPhone: null,
      },
      select: {
        id: true,
        address: true,
        city: true,
        state: true,
        zip: true,
        ownershipName: true,
        skipTraced: true,
      },
      take: MAX_BULK_SIZE,
    });
  }

  const result: BulkSkipTraceResult = {
    queued: 0,
    skipped: 0,
    errors: [],
    requestIds: [],
  };

  for (const property of properties) {
    // Skip already-traced properties if requested
    if (skipAlreadyTraced && property.skipTraced) {
      result.skipped++;
      continue;
    }

    // Skip if already has an active request
    const activeRequest = await prisma.skipTraceRequest.findFirst({
      where: {
        propertyId: property.id,
        status: { in: ['PENDING', 'IN_PROGRESS'] },
      },
      select: { id: true },
    });

    if (activeRequest) {
      result.skipped++;
      continue;
    }

    try {
      // Create SkipTraceRequest record
      const skipTraceRequest = await prisma.skipTraceRequest.create({
        data: {
          propertyId: property.id,
          userId: user.id,
          status: 'PENDING',
        },
      });

      // Enqueue job
      await enqueueSkipTrace({
        skipTraceRequestId: skipTraceRequest.id,
        propertyId: property.id,
        userId: user.id,
        address: property.address,
        city: property.city,
        state: property.state,
        zip: property.zip,
        ownerName: property.ownershipName ?? undefined,
      });

      result.queued++;
      result.requestIds.push(skipTraceRequest.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      result.errors.push(`Property ${property.id}: ${message}`);
    }
  }

  return NextResponse.json(result, { status: 202 });
}
