import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { renderOfferEmail } from '@/lib/email/offerTemplate';
import { sendOfferEmail } from '@/lib/email/sendgrid';
import { calculateMAO } from '@/lib/qualification/engine';
import { scheduleFollowUpSequence } from '@/lib/queue/jobs';

// Maximum number of offers per bulk-send request to prevent abuse
const BULK_SEND_LIMIT = 50;

const bulkSendItemSchema = z.object({
  dealId: z.string().min(1),
  recipientEmail: z.string().email('recipientEmail must be a valid email'),
  recipientName: z.string().max(200).optional(),
  repairCosts: z.number().min(0).optional().default(0),
  subject: z.string().max(200).optional(),
  sequenceId: z.string().optional(), // Optional: per-deal sequence override
});

const bulkSendSchema = z.object({
  offers: z
    .array(bulkSendItemSchema)
    .min(1, 'At least one offer is required')
    .max(BULK_SEND_LIMIT, `Cannot send more than ${BULK_SEND_LIMIT} offers at once`),
  sequenceId: z.string().optional(), // Global sequence — applied to all offers unless overridden per-item
});

type BulkSendResult = {
  dealId: string;
  success: boolean;
  offeredDealId?: string;
  sendgridMessageId?: string;
  scheduledSequenceId?: string;
  error?: string;
};

/**
 * POST /api/offers/bulk-send
 *
 * Send offer emails for multiple deals in a single request.
 * Processes each offer sequentially to avoid overwhelming SendGrid and
 * allow per-deal success/failure tracking.
 *
 * Features:
 * - Up to 50 deals per request
 * - Per-deal success/failure tracking (partial success allowed)
 * - Optional global sequenceId or per-deal sequenceId
 * - All deals must belong to the authenticated user
 *
 * Body:
 * {
 *   offers: [{
 *     dealId: string,
 *     recipientEmail: string,
 *     recipientName?: string,
 *     repairCosts?: number,
 *     subject?: string,
 *     sequenceId?: string     // per-deal sequence override
 *   }],
 *   sequenceId?: string       // global sequence (applied if no per-deal override)
 * }
 *
 * Response:
 * {
 *   summary: { total, succeeded, failed },
 *   results: [{ dealId, success, offeredDealId?, sendgridMessageId?, error? }]
 * }
 */
export async function POST(req: NextRequest) {
  const { userId: clerkId } = await auth();

  if (!clerkId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Resolve Clerk ID to internal user
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

  let parsed: z.infer<typeof bulkSendSchema>;
  try {
    parsed = bulkSendSchema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      );
    }
    throw error;
  }

  const { offers, sequenceId: globalSequenceId } = parsed;

  // Validate global sequence ownership if provided
  if (globalSequenceId) {
    const globalSeq = await prisma.followUpSequence.findUnique({
      where: { id: globalSequenceId },
    });
    if (!globalSeq || globalSeq.userId !== user.id) {
      return NextResponse.json(
        { error: 'Global sequenceId not found' },
        { status: 404 }
      );
    }
    if (!globalSeq.enabled) {
      return NextResponse.json(
        { error: 'Global sequence is disabled' },
        { status: 400 }
      );
    }
  }

  // Pre-load all deals in a single query to avoid N+1 lookups
  const dealIds = [...new Set(offers.map((o) => o.dealId))];
  const deals = await prisma.deal.findMany({
    where: { id: { in: dealIds }, userId: user.id },
    include: { property: true },
  });
  const dealMap = new Map(deals.map((d) => [d.id, d]));

  // Pre-validate per-deal sequenceIds (collect unique ids, excluding global)
  const perDealSequenceIds = [
    ...new Set(
      offers
        .map((o) => o.sequenceId)
        .filter((id): id is string => !!id && id !== globalSequenceId)
    ),
  ];

  const sequenceMap = new Map<string, boolean>(); // sequenceId -> enabled
  if (perDealSequenceIds.length > 0) {
    const sequences = await prisma.followUpSequence.findMany({
      where: { id: { in: perDealSequenceIds }, userId: user.id },
      select: { id: true, enabled: true },
    });
    for (const seq of sequences) {
      sequenceMap.set(seq.id, seq.enabled);
    }
  }
  // Also cache global sequence if provided
  if (globalSequenceId) {
    sequenceMap.set(globalSequenceId, true); // already validated above
  }

  // Process each offer sequentially
  const results: BulkSendResult[] = [];
  let succeeded = 0;
  let failed = 0;

  for (const offer of offers) {
    const { dealId, recipientEmail, recipientName, repairCosts, subject, sequenceId: itemSequenceId } = offer;

    // Resolve which sequence to use: per-deal override takes priority over global
    const resolvedSequenceId = itemSequenceId ?? globalSequenceId;

    const result: BulkSendResult = { dealId, success: false };

    try {
      // Look up pre-fetched deal
      const deal = dealMap.get(dealId);
      if (!deal) {
        result.error = 'Deal not found or not owned by user';
        results.push(result);
        failed++;
        continue;
      }

      if (!deal.property) {
        result.error = 'Deal missing property data';
        results.push(result);
        failed++;
        continue;
      }

      // Validate per-deal sequence if different from global
      if (resolvedSequenceId && resolvedSequenceId !== globalSequenceId) {
        const seqEnabled = sequenceMap.get(resolvedSequenceId);
        if (seqEnabled === undefined) {
          result.error = 'sequenceId not found or not owned by user';
          results.push(result);
          failed++;
          continue;
        }
        if (!seqEnabled) {
          result.error = 'Sequence is disabled';
          results.push(result);
          failed++;
          continue;
        }
      }

      // Calculate MAO and render email
      const maoResult = calculateMAO(
        deal.property.estimatedValue ?? 0,
        repairCosts
      );

      const offerData = {
        propertyAddress: deal.property.address,
        propertyCity: deal.property.city,
        propertyState: deal.property.state,
        propertyZip: deal.property.zip,
        estimatedValue: deal.property.estimatedValue ?? 0,
        repairCosts,
        mao: maoResult.mao,
        offerPrice: maoResult.mao * 0.95,
        equityPercent: deal.property.equityPercent ?? 0,
        realtor: {
          name: user.name ?? 'Deal Team',
          phone: process.env.REALTOR_PHONE ?? '+1-xxx-xxx-xxxx',
          email: user.email,
        },
      };

      const emailContent = renderOfferEmail(offerData);
      const emailSubject = subject ?? 'Professional Offer for Your Property';

      // Send via SendGrid
      const sendResult = await sendOfferEmail(
        recipientEmail,
        recipientName,
        emailContent.html,
        emailContent.text,
        emailSubject
      );

      // Create OfferedDeal record
      const offeredDeal = await prisma.offeredDeal.create({
        data: {
          dealId,
          userId: user.id,
          sentToEmail: recipientEmail,
          recipientName: recipientName ?? null,
          status: 'SENT',
          sentAt: new Date(),
          sendgridMessageId: sendResult.messageId ?? null,
        },
      });

      result.offeredDealId = offeredDeal.id;
      result.sendgridMessageId = sendResult.messageId ?? undefined;

      // Optionally trigger follow-up sequence
      if (resolvedSequenceId) {
        const scheduled = await prisma.followUpScheduled.create({
          data: {
            dealId,
            userId: user.id,
            sequenceId: resolvedSequenceId,
            currentStep: 0,
            nextStepAt: new Date(),
            status: 'ACTIVE',
          },
        });

        await scheduleFollowUpSequence(
          scheduled.id,
          dealId,
          user.id,
          resolvedSequenceId,
          recipientEmail,
          recipientName
        );

        result.scheduledSequenceId = scheduled.id;
      }

      result.success = true;
      succeeded++;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Bulk send failed for deal ${dealId}:`, error);
      result.error = message;
      failed++;
    }

    results.push(result);
  }

  return NextResponse.json(
    {
      summary: {
        total: offers.length,
        succeeded,
        failed,
      },
      results,
    },
    { status: 200 }
  );
}
