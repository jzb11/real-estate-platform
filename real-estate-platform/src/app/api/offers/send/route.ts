import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { renderOfferEmail } from '@/lib/email/offerTemplate';
import { sendOfferEmail } from '@/lib/email/sendgrid';
import { calculateMAO } from '@/lib/qualification/engine';
import { scheduleFollowUpSequence } from '@/lib/queue/jobs';

const sendOfferSchema = z.object({
  dealId: z.string().min(1, 'dealId is required'),
  recipientEmail: z.string().email('recipientEmail must be a valid email'),
  recipientName: z.string().max(200).optional(),
  repairCosts: z.number().min(0).optional().default(0),
  subject: z.string().max(200).optional(),
  sequenceId: z.string().optional(), // Optional: trigger a follow-up sequence after sending
});

/**
 * POST /api/offers/send
 *
 * Send an offer email for a deal.
 *
 * Flow:
 * 1. Validate input (dealId, recipientEmail, repairCosts?, sequenceId?)
 * 2. Fetch deal + property, verify ownership
 * 3. Calculate MAO and render offer email
 * 4. Send via SendGrid
 * 5. Create OfferedDeal record (immutable delivery tracking record)
 * 6. Optionally trigger a follow-up sequence
 *
 * Body:
 * {
 *   dealId: string,
 *   recipientEmail: string,
 *   recipientName?: string,
 *   repairCosts?: number,       // defaults to 0
 *   subject?: string,           // defaults to standard subject line
 *   sequenceId?: string         // if set, triggers a follow-up sequence
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

  let parsed: z.infer<typeof sendOfferSchema>;
  try {
    parsed = sendOfferSchema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      );
    }
    throw error;
  }

  const { dealId, recipientEmail, recipientName, repairCosts, subject, sequenceId } = parsed;

  try {
    // Fetch deal with property, verify ownership
    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      include: { property: true },
    });

    if (!deal || deal.userId !== user.id) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
    }

    if (!deal.property) {
      return NextResponse.json(
        { error: 'Deal missing property data' },
        { status: 400 }
      );
    }

    // Validate sequence ownership if provided
    if (sequenceId) {
      const sequence = await prisma.followUpSequence.findUnique({
        where: { id: sequenceId },
      });
      if (!sequence || sequence.userId !== user.id) {
        return NextResponse.json(
          { error: 'Sequence not found' },
          { status: 404 }
        );
      }
      if (!sequence.enabled) {
        return NextResponse.json(
          { error: 'Sequence is disabled' },
          { status: 400 }
        );
      }
    }

    // Calculate MAO using 70% rule
    const maoResult = calculateMAO(
      deal.property.estimatedValue ?? 0,
      repairCosts
    );

    // Build offer email data
    const offerData = {
      propertyAddress: deal.property.address,
      propertyCity: deal.property.city,
      propertyState: deal.property.state,
      propertyZip: deal.property.zip,
      estimatedValue: deal.property.estimatedValue ?? 0,
      repairCosts,
      mao: maoResult.mao,
      offerPrice: maoResult.mao * 0.95, // 5% below MAO — standard offer price
      equityPercent: deal.property.equityPercent ?? 0,
      realtor: {
        name: user.name ?? 'Deal Team',
        phone: process.env.REALTOR_PHONE ?? '+1-xxx-xxx-xxxx',
        email: user.email,
      },
    };

    // Render email (HTML + plain text)
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

    // Create OfferedDeal record (immutable delivery tracking record)
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

    // Optionally trigger a follow-up sequence
    let scheduledSequence: { id: string } | null = null;
    if (sequenceId) {
      // Create FollowUpScheduled instance
      const scheduled = await prisma.followUpScheduled.create({
        data: {
          dealId,
          userId: user.id,
          sequenceId,
          currentStep: 0,
          nextStepAt: new Date(),
          status: 'ACTIVE',
        },
      });

      // Enqueue step 0 in BullMQ
      await scheduleFollowUpSequence(
        scheduled.id,
        dealId,
        user.id,
        sequenceId,
        recipientEmail,
        recipientName
      );

      scheduledSequence = { id: scheduled.id };
    }

    return NextResponse.json(
      {
        success: true,
        offeredDeal: {
          id: offeredDeal.id,
          dealId: offeredDeal.dealId,
          sentToEmail: offeredDeal.sentToEmail,
          recipientName: offeredDeal.recipientName,
          status: offeredDeal.status,
          sentAt: offeredDeal.sentAt,
          sendgridMessageId: offeredDeal.sendgridMessageId,
        },
        offerSummary: {
          propertyAddress: offerData.propertyAddress,
          estimatedValue: offerData.estimatedValue,
          repairCosts: offerData.repairCosts,
          mao: offerData.mao,
          maoFormula: maoResult.formula,
          offerPrice: offerData.offerPrice,
        },
        ...(scheduledSequence ? { scheduledSequence } : {}),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Offer send error:', error);
    return NextResponse.json(
      { error: 'Failed to send offer' },
      { status: 500 }
    );
  }
}
