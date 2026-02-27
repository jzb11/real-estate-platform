import { followUpQueue } from './bullmq';
import { prisma } from '@/lib/db';

export interface FollowUpJobPayload {
  scheduledId: string;      // FollowUpScheduled.id
  dealId: string;
  userId: string;
  sequenceId: string;
  stepIndex: number;        // Which step in the sequence (0-indexed)
  recipientEmail: string;
  recipientName?: string;
  stepData: {
    type: 'EMAIL' | 'SMS' | 'WAIT';
    delayDays?: number;
    subject?: string;
    htmlContent?: string;
    plainText?: string;
    phoneNumber?: string;
  };
}

/**
 * Enqueue the next step of a follow-up sequence.
 * Calculates delay based on step configuration:
 * - WAIT steps: scheduled X days in the future (converted to milliseconds)
 * - EMAIL/SMS steps: executed immediately (delay = 0)
 */
export async function enqueueFollowUpSequence(payload: FollowUpJobPayload) {
  const { stepData, stepIndex, scheduledId } = payload;

  let delayMs = 0;

  if (stepData.type === 'WAIT' && stepData.delayDays) {
    // Schedule this job to run X days from now
    delayMs = stepData.delayDays * 24 * 60 * 60 * 1000;
  } else if (stepData.type === 'EMAIL' || stepData.type === 'SMS') {
    // Execute immediately (queued but no delay)
    delayMs = 0;
  }

  try {
    const job = await followUpQueue.add(
      'execute-step',
      payload,
      {
        delay: delayMs,
        jobId: `${scheduledId}-step-${stepIndex}-${Date.now()}`,
      }
    );

    console.log(`Enqueued follow-up job: ${job.id} (step ${stepIndex}, delay: ${delayMs}ms)`);
    return job;
  } catch (error) {
    console.error('Failed to enqueue follow-up job:', error);
    throw error;
  }
}

/**
 * Schedule the entire sequence by enqueueing the first step.
 * The executor handles chaining subsequent steps after each completes.
 */
export async function scheduleFollowUpSequence(
  scheduledId: string,
  dealId: string,
  userId: string,
  sequenceId: string,
  recipientEmail: string,
  recipientName: string | undefined
) {
  try {
    // Fetch sequence template
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

    if (steps.length === 0) {
      throw new Error('Sequence has no steps');
    }

    // Enqueue first step (executor chains the rest)
    const firstStep = steps[0];
    await enqueueFollowUpSequence({
      scheduledId,
      dealId,
      userId,
      sequenceId,
      stepIndex: 0,
      recipientEmail,
      recipientName,
      stepData: firstStep,
    });

    return true;
  } catch (error) {
    console.error('Failed to schedule follow-up sequence:', error);
    throw error;
  }
}
