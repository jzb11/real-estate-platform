import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * GET /api/settings
 * Returns the authenticated user's settings from their customFields JSON.
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

  // Settings are stored in the user record — we use a convention of
  // storing them as a JSON blob. Since the User model doesn't have a
  // dedicated settings column, we'll use a lightweight approach:
  // store in a SavedSearchFilter with a special name.
  const settingsRecord = await prisma.savedSearchFilter.findFirst({
    where: { userId: user.id, name: '__user_settings__' },
  });

  const settings = settingsRecord
    ? (settingsRecord.filters as Record<string, unknown>)
    : {};

  return NextResponse.json({ settings });
}

/**
 * PUT /api/settings
 * Saves the authenticated user's settings.
 */
export async function PUT(request: NextRequest) {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const body = await request.json();
  const settings = body.settings;
  if (!settings || typeof settings !== 'object') {
    return NextResponse.json({ error: 'Invalid settings payload' }, { status: 400 });
  }

  // Upsert settings record
  const existing = await prisma.savedSearchFilter.findFirst({
    where: { userId: user.id, name: '__user_settings__' },
  });

  if (existing) {
    await prisma.savedSearchFilter.update({
      where: { id: existing.id },
      data: { filters: settings },
    });
  } else {
    await prisma.savedSearchFilter.create({
      data: {
        userId: user.id,
        name: '__user_settings__',
        filters: settings,
      },
    });
  }

  return NextResponse.json({ ok: true });
}
