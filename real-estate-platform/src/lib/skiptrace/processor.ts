/**
 * Skip-trace job processor.
 *
 * Handles one SkipTraceJobPayload at a time:
 *   1. Mark SkipTraceRequest as IN_PROGRESS
 *   2. Call REISkip API via lookupProperty()
 *   3. Write results back to Property (phone encrypted, email plain)
 *   4. Mark SkipTraceRequest as COMPLETED or FAILED
 *
 * Called by the BullMQ worker in queue.ts.
 */

import { prisma } from '@/lib/db';
import { lookupProperty } from './reiskip';
import { encryptPhone } from '@/lib/compliance/encryption';
import type { SkipTraceJobPayload } from './types';
import type { Prisma } from '@prisma/client';

/**
 * Process a single skip-trace job.
 *
 * Phone numbers from REISkip are encrypted with AES-256-GCM before storage
 * (matching the same encryption pattern used for CSV-imported phones).
 * The primary phone (or first phone if no isPrimary) is written to Property.ownershipPhone.
 *
 * Email addresses are stored in plain text in Property.ownershipEmail.
 * Emails are not PII-classified the same way as phone numbers in this system
 * (they're business contact addresses, not financial/consumer data).
 *
 * If the property already has a phone from CSV import, the skip-trace phone
 * overwrites it only when confidence > 70 or it's the only source.
 */
export async function processSkipTraceJob(payload: SkipTraceJobPayload): Promise<void> {
  const { skipTraceRequestId, propertyId, userId } = payload;

  // Mark as IN_PROGRESS
  await prisma.skipTraceRequest.update({
    where: { id: skipTraceRequestId },
    data: { status: 'IN_PROGRESS' },
  });

  try {
    // Call REISkip API
    const result = await lookupProperty({
      propertyId,
      address: payload.address,
      city: payload.city,
      state: payload.state,
      zip: payload.zip,
      ownerName: payload.ownerName,
    });

    // Determine primary phone (isPrimary flag, or highest confidence, or first)
    let primaryPhone: string | null = null;
    if (result.phones.length > 0) {
      const primary =
        result.phones.find((p) => p.isPrimary) ??
        result.phones.sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))[0];

      if (primary?.number) {
        // Encrypt phone before writing to Property — same AES-256-GCM pattern as CSV import
        try {
          primaryPhone = encryptPhone(primary.number);
        } catch (encryptErr) {
          console.error(
            `[SkipTrace] Failed to encrypt phone for property ${propertyId}:`,
            encryptErr
          );
          primaryPhone = null;
        }
      }
    }

    // Determine primary email (isPrimary flag, or highest confidence, or first)
    let primaryEmail: string | null = null;
    if (result.emails.length > 0) {
      const primary =
        result.emails.find((e) => e.isPrimary) ??
        result.emails.sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))[0];

      primaryEmail = primary?.address ?? null;
    }

    const phoneFound = result.phones.length > 0;
    const emailFound = result.emails.length > 0;

    // Write enriched contact data back to Property
    // updatedAt is managed automatically by Prisma @updatedAt directive
    if (primaryPhone !== null || primaryEmail !== null || result.found) {
      const propertyUpdate: Prisma.PropertyUpdateInput = {
        skipTraced: true,
      };

      if (primaryPhone !== null) {
        propertyUpdate.ownershipPhone = primaryPhone;
      }

      if (primaryEmail !== null) {
        propertyUpdate.ownershipEmail = primaryEmail;
      }

      await prisma.property.update({
        where: { id: propertyId },
        data: propertyUpdate,
      });
    } else {
      // NOT_FOUND — still mark skipTraced=true so we don't retry indefinitely
      await prisma.property.update({
        where: { id: propertyId },
        data: { skipTraced: true },
      });
    }

    // Mark request COMPLETED (or NOT_FOUND)
    const finalStatus = result.found ? 'COMPLETED' : 'NOT_FOUND';

    await prisma.skipTraceRequest.update({
      where: { id: skipTraceRequestId },
      data: {
        status: finalStatus,
        completedAt: new Date(),
        phoneFound,
        emailFound,
        rawResponse: result.rawResponse as Prisma.InputJsonValue,
      },
    });

    console.log(
      `[SkipTrace] ${finalStatus} for property ${propertyId} ` +
        `(phones: ${result.phones.length}, emails: ${result.emails.length}, userId: ${userId})`
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : `Unknown error: ${String(error)}`;

    console.error(`[SkipTrace] FAILED for property ${propertyId}:`, errorMessage);

    // Mark request FAILED with error message
    await prisma.skipTraceRequest.update({
      where: { id: skipTraceRequestId },
      data: {
        status: 'FAILED',
        completedAt: new Date(),
        errorMessage,
      },
    });

    // Rethrow so BullMQ triggers retry logic
    throw error;
  }
}
