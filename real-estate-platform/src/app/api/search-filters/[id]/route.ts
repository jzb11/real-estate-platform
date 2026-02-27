import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * GET /api/search-filters/:id
 *
 * Returns a single saved search filter by ID.
 * Returns 404 if not found or not owned by the authenticated user.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const { id } = await params;

  const savedFilter = await prisma.savedSearchFilter.findFirst({
    where: { id, userId: user.id }, // ownership enforced
    select: {
      id: true,
      name: true,
      filters: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!savedFilter) {
    return NextResponse.json({ error: 'Filter not found' }, { status: 404 });
  }

  return NextResponse.json(savedFilter);
}

/**
 * DELETE /api/search-filters/:id
 *
 * Deletes a saved search filter by ID.
 * Verifies ownership before deletion — cannot delete another user's filters.
 * Returns 404 if not found or not owned (prevents existence leakage).
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const { id } = await params;

  // Verify ownership before delete — prevents cross-user deletion
  const savedFilter = await prisma.savedSearchFilter.findFirst({
    where: { id, userId: user.id },
    select: { id: true },
  });

  if (!savedFilter) {
    // 404 (not 403) to prevent leaking existence of other users' filters
    return NextResponse.json({ error: 'Filter not found' }, { status: 404 });
  }

  await prisma.savedSearchFilter.delete({ where: { id } });

  return NextResponse.json({ deleted: true, id }, { status: 200 });
}
