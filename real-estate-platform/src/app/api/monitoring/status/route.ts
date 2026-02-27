import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';
import {
  calculateDeliverabilityMetrics,
  checkDeliverabilityMetrics,
} from '@/lib/monitoring/sendgridMonitor';

export async function GET(_req: NextRequest) {
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
    // Fetch current metrics
    const metrics = await calculateDeliverabilityMetrics();

    // Trigger alert generation (creates DB records for threshold violations)
    const activeAlerts = await checkDeliverabilityMetrics(user.id);

    // Determine overall health status
    const isHealthy =
      metrics.bounceRate <= 5 &&
      metrics.complaintRate <= 0.1 &&
      (metrics.senderScore === 0 || metrics.senderScore >= 80);

    return NextResponse.json({
      metrics,
      activeAlerts,
      healthStatus: isHealthy ? 'HEALTHY' : 'WARNING',
    });
  } catch (error) {
    console.error('Monitoring status error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch deliverability metrics' },
      { status: 500 }
    );
  }
}
