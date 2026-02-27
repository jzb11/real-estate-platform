import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  const { userId: clerkId } = await auth();

  if (!clerkId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Resolve internal user ID from Clerk
  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  try {
    const limitParam = req.nextUrl.searchParams.get('limit');
    const limit = limitParam ? Math.min(parseInt(limitParam, 10) || 30, 100) : 30;
    const unreadOnly = req.nextUrl.searchParams.get('unreadOnly') === 'true';

    const alerts = await prisma.deliverabilityAlert.findMany({
      where: {
        userId: user.id,
        ...(unreadOnly ? { acknowledged: false } : {}),
      },
      select: {
        id: true,
        alertType: true,
        message: true,
        metrics: true,
        acknowledged: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return NextResponse.json({ alerts });
  } catch (error) {
    console.error('Fetch alerts error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch alerts' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  const { userId: clerkId } = await auth();

  if (!clerkId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Resolve internal user ID from Clerk
  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { alertId, acknowledged } = body as {
    alertId?: string;
    acknowledged?: boolean;
  };

  if (!alertId || typeof acknowledged !== 'boolean') {
    return NextResponse.json(
      { error: 'alertId and acknowledged (boolean) are required' },
      { status: 400 }
    );
  }

  // Verify the alert belongs to this user before updating
  const alert = await prisma.deliverabilityAlert.findUnique({
    where: { id: alertId },
  });

  if (!alert || alert.userId !== user.id) {
    return NextResponse.json({ error: 'Alert not found' }, { status: 404 });
  }

  try {
    const updated = await prisma.deliverabilityAlert.update({
      where: { id: alertId },
      data: { acknowledged },
    });

    return NextResponse.json({ alert: updated });
  } catch (error) {
    console.error('Update alert error:', error);
    return NextResponse.json(
      { error: 'Failed to update alert' },
      { status: 500 }
    );
  }
}
