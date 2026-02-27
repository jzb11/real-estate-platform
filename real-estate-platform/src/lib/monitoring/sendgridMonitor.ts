import { prisma } from '@/lib/db';
import type { Prisma } from '@prisma/client';

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;

export interface DeliverabilityMetrics {
  totalSent: number;
  bounced: number;
  bounceRate: number;
  complained: number;
  complaintRate: number;
  senderScore: number;
  opened: number;
  openRate: number;
}

/**
 * Aggregate webhook events to calculate bounce/complaint/open rates
 * Covers last 30 days of SendGrid webhook data
 */
export async function calculateDeliverabilityMetrics(): Promise<DeliverabilityMetrics> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [delivered, bounced, complained, opened] = await Promise.all([
    prisma.sendgridWebhook.count({
      where: {
        eventType: 'DELIVERED',
        timestamp: { gte: thirtyDaysAgo },
      },
    }),
    prisma.sendgridWebhook.count({
      where: {
        eventType: 'BOUNCE',
        timestamp: { gte: thirtyDaysAgo },
      },
    }),
    prisma.sendgridWebhook.count({
      where: {
        eventType: 'COMPLAINT',
        timestamp: { gte: thirtyDaysAgo },
      },
    }),
    prisma.sendgridWebhook.count({
      where: {
        eventType: 'OPEN',
        timestamp: { gte: thirtyDaysAgo },
      },
    }),
  ]);

  // Total sent = delivered + bounced (bounced never reached inbox)
  const totalSent = delivered + bounced;

  const senderScore = await fetchSenderScore();

  return {
    totalSent,
    bounced,
    bounceRate: totalSent > 0 ? (bounced / totalSent) * 100 : 0,
    complained,
    complaintRate: totalSent > 0 ? (complained / totalSent) * 100 : 0,
    senderScore,
    opened,
    openRate: totalSent > 0 ? (opened / totalSent) * 100 : 0,
  };
}

/**
 * Fetch sender reputation score from SendGrid Account API.
 * Score 0-100; >85 is excellent, <80 triggers an alert.
 * Returns 0 if API key is missing or request fails.
 */
async function fetchSenderScore(): Promise<number> {
  if (!SENDGRID_API_KEY) {
    console.warn('SENDGRID_API_KEY not set — sender score unavailable');
    return 0;
  }

  try {
    const response = await fetch('https://api.sendgrid.com/v3/user/account', {
      headers: {
        Authorization: `Bearer ${SENDGRID_API_KEY}`,
      },
    });

    if (!response.ok) {
      console.error('Failed to fetch sender score from SendGrid:', response.status);
      return 0;
    }

    const data = (await response.json()) as {
      reputation?: { reputation_score?: number };
      reputation_score?: number;
    };

    // SendGrid returns reputation_score at top level or nested under reputation
    const score = data.reputation?.reputation_score ?? data.reputation_score ?? null;

    if (score === null) {
      console.warn('SendGrid reputation score not found in response — defaulting to 85');
      return 85;
    }

    return score;
  } catch (error) {
    console.error('Error fetching sender score from SendGrid:', error);
    return 0;
  }
}

/**
 * Check current metrics against thresholds and generate alerts for violations.
 * Returns array of alert types that were triggered.
 *
 * Thresholds:
 * - Bounce rate > 5%
 * - Complaint rate > 0.1%
 * - Sender score < 80 (only when API returned non-zero score)
 */
export async function checkDeliverabilityMetrics(userId: string): Promise<string[]> {
  try {
    const metrics = await calculateDeliverabilityMetrics();
    const triggeredAlerts: string[] = [];

    if (metrics.bounceRate > 5) {
      triggeredAlerts.push('BOUNCE_RATE_HIGH');
      await generateAlert(
        userId,
        'BOUNCE_RATE_HIGH',
        `Bounce rate is ${metrics.bounceRate.toFixed(2)}% — exceeds 5% threshold`,
        metrics
      );
    }

    if (metrics.complaintRate > 0.1) {
      triggeredAlerts.push('COMPLAINT_RATE_HIGH');
      await generateAlert(
        userId,
        'COMPLAINT_RATE_HIGH',
        `Complaint rate is ${metrics.complaintRate.toFixed(3)}% — exceeds 0.1% threshold`,
        metrics
      );
    }

    // Only alert on low sender score if API returned a real value
    if (metrics.senderScore > 0 && metrics.senderScore < 80) {
      triggeredAlerts.push('SENDER_SCORE_LOW');
      await generateAlert(
        userId,
        'SENDER_SCORE_LOW',
        `Sender score is ${metrics.senderScore} — below 80 threshold`,
        metrics
      );
    }

    return triggeredAlerts;
  } catch (error) {
    console.error('Error checking deliverability metrics:', error);
    return [];
  }
}

/**
 * Persist an alert record to the database.
 * De-duplicates: only one alert per alertType per user per calendar day.
 * This prevents alert flooding while still ensuring daily visibility.
 */
export async function generateAlert(
  userId: string,
  alertType: string,
  message: string,
  metrics: DeliverabilityMetrics
): Promise<void> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existingAlert = await prisma.deliverabilityAlert.findFirst({
      where: {
        userId,
        alertType,
        createdAt: { gte: today },
      },
    });

    if (existingAlert) {
      // Already alerted today — no duplicate
      return;
    }

    await prisma.deliverabilityAlert.create({
      data: {
        userId,
        alertType,
        message,
        metrics: metrics as unknown as Prisma.InputJsonValue,
        acknowledged: false,
      },
    });

    console.log(`Deliverability alert created: [${alertType}] for user ${userId}`);
  } catch (error) {
    console.error('Error creating deliverability alert:', error);
    // Non-fatal — don't rethrow; alert failure should not block the monitoring check
  }
}

/**
 * Entry point for a daily scheduled task.
 * Returns triggered alert types so callers can log or notify further.
 */
export async function dailyMonitoringCheck(userId: string): Promise<string[]> {
  return checkDeliverabilityMetrics(userId);
}
