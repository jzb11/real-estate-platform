import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { hashPhoneForLookup } from '@/lib/compliance/encryption';

const OptOutSchema = z.object({
  phoneNumber: z.string().min(10).max(20),
  optOutMethod: z.string().min(1), // CONSUMER_REQUEST, SMS_STOP, WEB_FORM, CALL_REQUEST, etc.
  notes: z.string().optional(),
});

/**
 * POST /api/compliance/opt-out
 *
 * Processes a consumer opt-out request immediately.
 *
 * CRITICAL: Per FCC rules, opt-outs must be honored immediately — no queuing.
 * - Adds phone to DoNotCallEntry with permanent expiry (expiryDate = null)
 * - Updates any existing ConsentRecord for this phone to set revocationTimestamp = now
 * - DoNotCallEntry.phoneEncrypted stores the HMAC-SHA256 hash (NOT AES-encrypted value)
 *   for consistent O(1) lookup without decryption
 *
 * Returns 200 with processed:true and effectiveDate. Phone NOT returned in response.
 */
export async function POST(req: NextRequest) {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = OptOutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', details: parsed.error.issues }, { status: 400 });
  }

  const data = parsed.data;
  const phoneHash = hashPhoneForLookup(data.phoneNumber);
  const effectiveDate = new Date();

  try {
    // Add to DNC list (upsert — idempotent if called multiple times for same number)
    // DoNotCallEntry.phoneEncrypted = HMAC hash (one-way, not reversible)
    await prisma.doNotCallEntry.upsert({
      where: { phoneEncrypted: phoneHash },
      create: {
        phoneEncrypted: phoneHash,
        addedReason: `Consumer opt-out via ${data.optOutMethod}${data.notes ? ': ' + data.notes : ''}`,
        expiryDate: null, // Permanent — no expiry
      },
      update: {
        addedReason: `Consumer opt-out via ${data.optOutMethod}${data.notes ? ': ' + data.notes : ''} (re-processed at ${effectiveDate.toISOString()})`,
        expiryDate: null, // Ensure permanent
      },
    });

    // Revoke any existing consent records for this phone number (via HMAC hash lookup)
    await prisma.consentRecord.updateMany({
      where: {
        phoneHash,
        revocationTimestamp: null, // Only revoke active (non-revoked) records
      },
      data: {
        revocationTimestamp: effectiveDate,
        revocationMethod: data.optOutMethod,
        revocationProcessedDate: effectiveDate,
        complianceStatus: 'REVOKED',
      },
    });

    return NextResponse.json(
      {
        processed: true,
        effectiveDate: effectiveDate.toISOString(),
        message: 'Opt-out processed immediately. Number added to Do Not Call list permanently.',
      },
      { status: 200 }
    );
  } catch (err) {
    console.error('Error processing opt-out:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
