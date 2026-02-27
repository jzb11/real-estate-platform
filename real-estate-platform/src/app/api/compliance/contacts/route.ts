import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { validateContactAttempt, TcpaViolationError } from '@/lib/compliance/tcpaValidator';

const ContactSchema = z.object({
  propertyId: z.string().uuid(),
  phoneNumber: z.string().min(10).max(20),
  contactMethod: z.enum(['EMAIL', 'CALL', 'SMS', 'LETTER']),
  consentStatus: z.enum([
    'NO_CONSENT_OBTAINED',
    'EXPRESS_WRITTEN_CONSENT',
    'PRIOR_EXPRESS_CONSENT',
    'DO_NOT_CALL',
  ]),
  consentTimestamp: z.string().datetime().optional(),
  consentMedium: z.string().optional(),
  consentDetails: z.record(z.string(), z.unknown()).optional(),
  notes: z.string().max(1000).optional(),
});

/**
 * POST /api/compliance/contacts
 *
 * Logs a contact attempt with mandatory consent verification.
 *
 * Response behaviors:
 *   403 DNC_LIST_BLOCKED — phone is on DNC list, contact NOT logged
 *   200 violation:true   — NO_CONSENT_OBTAINED, contact IS logged for audit
 *   201 success          — contact logged with valid consent
 *
 * Phone numbers are NEVER returned in any response — not encrypted, not plain text.
 */
export async function POST(req: NextRequest) {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Resolve internal user ID from Clerk ID
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

  const parsed = ContactSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', details: parsed.error.issues }, { status: 400 });
  }

  const data = parsed.data;

  try {
    const log = await validateContactAttempt({
      propertyId: data.propertyId,
      phoneNumber: data.phoneNumber,
      contactMethod: data.contactMethod,
      consentStatus: data.consentStatus,
      consentTimestamp: data.consentTimestamp ? new Date(data.consentTimestamp) : undefined,
      consentMedium: data.consentMedium,
      consentDetails: data.consentDetails,
      notes: data.notes,
      userId: user.id,
    });

    // Success — return contact log without phone number
    return NextResponse.json(
      {
        id: log.id,
        propertyId: log.propertyId,
        contactTimestamp: log.contactTimestamp,
        contactMethod: log.contactMethod,
        consentStatus: log.consentStatus,
        notes: log.notes,
        createdAt: log.createdAt,
      },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof TcpaViolationError) {
      if (err.violationType === 'DNC_LIST') {
        // DNC block — contact was NOT logged
        return NextResponse.json(
          { error: 'DNC_LIST_BLOCKED', message: err.message },
          { status: 403 }
        );
      }

      if (err.violationType === 'NO_CONSENT') {
        // No consent — contact WAS logged (for audit), but flagged as violation
        // Fetch the log that was just written to return the ID
        const logs = await prisma.contactLog.findMany({
          where: { userId: user.id, propertyId: data.propertyId },
          orderBy: { createdAt: 'desc' },
          take: 1,
        });
        const log = logs[0];
        return NextResponse.json(
          {
            id: log?.id,
            propertyId: data.propertyId,
            contactTimestamp: log?.contactTimestamp,
            contactMethod: data.contactMethod,
            consentStatus: data.consentStatus,
            notes: data.notes,
            createdAt: log?.createdAt,
            violation: true,
            violationType: 'NO_CONSENT',
            message: err.message,
          },
          { status: 200 }
        );
      }
    }

    console.error('Unexpected error in POST /api/compliance/contacts:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
