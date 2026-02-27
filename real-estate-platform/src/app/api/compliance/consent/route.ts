import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { encryptPhone, hashPhoneForLookup } from '@/lib/compliance/encryption';

const ConsentSchema = z.object({
  phoneNumber: z.string().min(10).max(20),
  consentMethod: z.string().min(1), // FORM_SUBMISSION, EMAIL_REPLY, SMS_REPLY, IN_PERSON
  disclosuresAcknowledged: z.array(z.string()),
  notes: z.string().optional(),
});

/**
 * POST /api/compliance/consent
 *
 * Records written consent obtained from a property owner.
 *
 * TCPA 4-year retention: mustRetainUntil is set to now + 4 years per legal requirement.
 * Phone is stored as AES-256-GCM ciphertext in ownerPhoneEncrypted.
 * phoneHash (HMAC-SHA256) is stored separately for fast opt-out processing lookups.
 *
 * Returns 201 with consent record ID. Phone number is NOT returned in any response.
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

  const parsed = ConsentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', details: parsed.error.issues }, { status: 400 });
  }

  const data = parsed.data;

  // Encrypt phone (reversible AES-256-GCM) and hash (one-way HMAC-SHA256)
  const encryptedPhone = encryptPhone(data.phoneNumber);
  const phoneHash = hashPhoneForLookup(data.phoneNumber);

  // TCPA requires retaining consent records for 4 years
  const mustRetainUntil = new Date();
  mustRetainUntil.setFullYear(mustRetainUntil.getFullYear() + 4);

  try {
    const record = await prisma.consentRecord.create({
      data: {
        ownerPhoneEncrypted: encryptedPhone,
        phoneHash,
        originalConsentTimestamp: new Date(),
        originalConsentMethod: data.consentMethod,
        disclosuresAcknowledged: data.disclosuresAcknowledged as Prisma.InputJsonValue,
        mustRetainUntil,
        complianceStatus: 'COMPLIANT',
      },
    });

    return NextResponse.json(
      {
        id: record.id,
        consentMethod: record.originalConsentMethod,
        consentTimestamp: record.originalConsentTimestamp,
        mustRetainUntil: record.mustRetainUntil,
        complianceStatus: record.complianceStatus,
        createdAt: record.createdAt,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error('Error recording consent:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
