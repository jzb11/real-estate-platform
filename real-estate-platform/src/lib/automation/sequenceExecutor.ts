import { prisma } from '@/lib/db';
import { sendOfferEmail } from '@/lib/email/sendgrid';
import { enqueueFollowUpSequence } from '@/lib/queue/jobs';
import type { FollowUpJobPayload } from '@/lib/queue/jobs';

/**
 * Execute one step of a follow-up sequence.
 * Called by the BullMQ job handler for each queued job.
 *
 * Flow:
 * 1. Check if sequence is paused/completed (skip if so)
 * 2. Execute step based on type (EMAIL | SMS | WAIT)
 * 3. Log execution to FollowUpEvent (immutable append-only)
 * 4. Enqueue next step if current succeeded and more steps remain
 * 5. Mark sequence COMPLETED if this was the last step
 */
export async function executeSequenceStep(payload: FollowUpJobPayload) {
  const {
    scheduledId,
    dealId,
    userId,
    sequenceId,
    stepIndex,
    recipientEmail,
    recipientName,
    stepData,
  } = payload;

  try {
    // Fetch scheduled instance to check current status
    const scheduled = await prisma.followUpScheduled.findUnique({
      where: { id: scheduledId },
    });

    if (!scheduled) {
      throw new Error(`FollowUpScheduled ${scheduledId} not found`);
    }

    // Skip if paused or completed — BullMQ job is a no-op in these states
    if (scheduled.status === 'PAUSED') {
      console.log(`Sequence ${scheduledId} is paused, skipping step ${stepIndex}`);
      return { skipped: true, reason: 'PAUSED' };
    }

    if (scheduled.status === 'COMPLETED') {
      console.log(`Sequence ${scheduledId} is completed, skipping step ${stepIndex}`);
      return { skipped: true, reason: 'COMPLETED' };
    }

    // Fetch the sequence template to get all steps
    const sequence = await prisma.followUpSequence.findUnique({
      where: { id: sequenceId },
    });

    if (!sequence) {
      throw new Error(`Sequence ${sequenceId} not found`);
    }

    const steps = sequence.steps as Array<{
      type: 'EMAIL' | 'SMS' | 'WAIT';
      delayDays?: number;
      subject?: string;
      htmlContent?: string;
      plainText?: string;
      phoneNumber?: string;
    }>;

    const nextStep = steps[stepIndex + 1];

    // Execute the step based on its type
    let executionResult: Record<string, unknown> = {};
    let eventStatus = 'SUCCESS';

    try {
      switch (stepData.type) {
        case 'EMAIL':
          executionResult = await executeEmailStep(
            dealId,
            recipientEmail,
            recipientName,
            stepData
          );
          break;

        case 'SMS':
          // SMS deferred to Phase 2.1 (Twilio integration not yet configured)
          executionResult = {
            skipped: true,
            reason: 'SMS not implemented in Phase 2 — requires Twilio integration (Phase 2.1)',
          };
          break;

        case 'WAIT':
          // WAIT steps don't perform any action; the delay was applied at job enqueue time
          executionResult = {
            waited: true,
            delayDays: stepData.delayDays,
          };
          break;

        default:
          throw new Error(`Unknown step type: ${(stepData as { type: string }).type}`);
      }
    } catch (error: unknown) {
      eventStatus = 'FAILED';
      executionResult.error = error instanceof Error ? error.message : String(error);
    }

    // Immutable event log — append-only record for this step execution
    // Cast to Prisma.InputJsonValue to satisfy Json field typing
    const eventContent = {
      type: stepData.type,
      subject: stepData.subject ?? null,
      status: eventStatus,
      executionResult: executionResult as Record<string, string | number | boolean | null>,
    };

    await prisma.followUpEvent.create({
      data: {
        scheduledId,
        sequenceId,
        stepIndex,
        eventType: getEventType(stepData.type, eventStatus),
        content: eventContent as unknown as import('@prisma/client').Prisma.InputJsonValue,
        status: eventStatus,
        failureReason: eventStatus === 'FAILED' ? String(executionResult.error ?? '') : null,
        sentAt: new Date(),
      },
    });

    // Chain next step or mark sequence complete
    if (eventStatus === 'SUCCESS' && nextStep) {
      // Enqueue next step with delay if WAIT type
      await enqueueFollowUpSequence({
        scheduledId,
        dealId,
        userId,
        sequenceId,
        stepIndex: stepIndex + 1,
        recipientEmail,
        recipientName,
        stepData: nextStep,
      });

      // Advance the currentStep pointer
      await prisma.followUpScheduled.update({
        where: { id: scheduledId },
        data: {
          currentStep: stepIndex + 1,
          nextStepAt: calculateNextStepTime(nextStep),
        },
      });

      return { success: true, nextStepQueued: true };
    } else if (eventStatus === 'SUCCESS' && !nextStep) {
      // All steps complete — mark sequence as COMPLETED
      await prisma.followUpScheduled.update({
        where: { id: scheduledId },
        data: {
          status: 'COMPLETED',
          currentStep: stepIndex + 1,
        },
      });

      return { success: true, sequenceCompleted: true };
    } else {
      // Execution failed — throw so BullMQ retries with exponential backoff
      throw new Error(`Step execution failed: ${String(executionResult.error ?? 'unknown error')}`);
    }
  } catch (error) {
    console.error('Sequence step execution error:', error);
    throw error;
  }
}

async function executeEmailStep(
  dealId: string,
  recipientEmail: string,
  recipientName: string | undefined,
  stepData: {
    type: 'EMAIL' | 'SMS' | 'WAIT';
    subject?: string;
    htmlContent?: string;
    plainText?: string;
  }
) {
  // Fetch deal with property for context in follow-up content
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    include: { property: true },
  });

  if (!deal || !deal.property) {
    throw new Error('Deal or property not found');
  }

  // Use provided step content or fall back to default follow-up template
  const subject = stepData.subject || 'Follow-up: Your Property Offer';
  const htmlContent = stepData.htmlContent || getDefaultFollowUpHtml(deal);
  const plainText = stepData.plainText || getDefaultFollowUpText(deal);

  // Send via SendGrid
  const sendResult = await sendOfferEmail(
    recipientEmail,
    recipientName,
    htmlContent,
    plainText,
    subject
  );

  return {
    sent: true,
    messageId: sendResult.messageId,
    statusCode: sendResult.statusCode,
  };
}

function getEventType(stepType: string, status: string): string {
  if (status === 'FAILED') return 'EMAIL_FAILED';

  switch (stepType) {
    case 'EMAIL':
      return 'EMAIL_SENT';
    case 'SMS':
      return 'SMS_SENT';
    case 'WAIT':
      return 'WAIT_COMPLETED';
    default:
      return 'UNKNOWN';
  }
}

function calculateNextStepTime(nextStep: { type: string; delayDays?: number }): Date {
  const now = new Date();
  if (nextStep.type === 'WAIT' && nextStep.delayDays) {
    now.setDate(now.getDate() + nextStep.delayDays);
  }
  return now;
}

function getDefaultFollowUpHtml(deal: { property: { address: string } }): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .property { background: #f5f5f5; padding: 12px; border-radius: 4px; margin: 16px 0; }
    .footer { margin-top: 32px; font-size: 12px; color: #999; }
  </style>
</head>
<body>
  <div class="container">
    <h2>Follow-up: Our Professional Offer</h2>
    <p>We wanted to follow up on our recent offer for your property:</p>
    <div class="property">
      <strong>${deal.property.address}</strong>
    </div>
    <p>We remain very interested and are ready to move forward quickly. If you have any questions or would like to discuss the offer in more detail, please don't hesitate to reach out.</p>
    <p>We look forward to hearing from you.</p>
    <div class="footer">
      <p>You are receiving this email because you received a property offer. To unsubscribe from future communications, reply with "UNSUBSCRIBE".</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

function getDefaultFollowUpText(deal: { property: { address: string } }): string {
  return `
Follow-up: Our Professional Offer

We wanted to follow up on our recent offer for your property:

${deal.property.address}

We remain very interested and are ready to move forward quickly. If you have any questions or would like to discuss the offer in more detail, please don't hesitate to reach out.

We look forward to hearing from you.

---
To unsubscribe from future communications, reply with "UNSUBSCRIBE".
  `.trim();
}
