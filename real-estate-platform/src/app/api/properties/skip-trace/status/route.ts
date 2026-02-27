/**
 * GET /api/properties/skip-trace/status
 *
 * Returns skip-trace request status and results for a property or request ID.
 *
 * Query params (provide one):
 *   propertyId — get all requests for a specific property (most recent first)
 *   requestId  — get a specific request by ID
 *
 * Response:
 *   { requests: SkipTraceRequestRecord[] }
 *
 * Each request record includes:
 *   id, propertyId, status, requestedAt, completedAt,
 *   phoneFound, emailFound, errorMessage
 *   (rawResponse is excluded — it may contain PII from REISkip)
 *
 * The caller can use phoneFound/emailFound to know whether to re-fetch
 * the property record for updated ownershipPhone/ownershipEmail.
 */

import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const propertyId = searchParams.get('propertyId');
  const requestId = searchParams.get('requestId');

  if (!propertyId && !requestId) {
    return NextResponse.json(
      { error: 'Provide either propertyId or requestId query parameter' },
      { status: 400 }
    );
  }

  if (requestId) {
    // Single request lookup
    const req = await prisma.skipTraceRequest.findFirst({
      where: {
        id: requestId,
        userId: user.id, // Ownership enforcement
      },
      select: {
        id: true,
        propertyId: true,
        status: true,
        requestedAt: true,
        completedAt: true,
        phoneFound: true,
        emailFound: true,
        errorMessage: true,
        createdAt: true,
        updatedAt: true,
        // rawResponse intentionally excluded — may contain PII from REISkip
      },
    });

    if (!req) {
      return NextResponse.json(
        { error: 'Skip-trace request not found or not owned by this user' },
        { status: 404 }
      );
    }

    return NextResponse.json({ requests: [req] });
  }

  // Property-level lookup — all requests for this property
  // First verify user has access to this property via Deal
  const propertyAccess = await prisma.property.findFirst({
    where: {
      id: propertyId!,
      deals: { some: { userId: user.id } },
    },
    select: { id: true },
  });

  if (!propertyAccess) {
    return NextResponse.json(
      { error: 'Property not found or not accessible to this user' },
      { status: 404 }
    );
  }

  const requests = await prisma.skipTraceRequest.findMany({
    where: {
      propertyId: propertyId!,
      userId: user.id,
    },
    select: {
      id: true,
      propertyId: true,
      status: true,
      requestedAt: true,
      completedAt: true,
      phoneFound: true,
      emailFound: true,
      errorMessage: true,
      createdAt: true,
      updatedAt: true,
      // rawResponse intentionally excluded
    },
    orderBy: { requestedAt: 'desc' },
  });

  return NextResponse.json({ requests });
}
