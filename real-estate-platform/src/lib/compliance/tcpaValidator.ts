import { prisma } from '@/lib/db';
import { ConsentStatus, ContactMethod, Prisma } from '@prisma/client';
import { encryptPhone, hashPhoneForLookup } from './encryption';

/**
 * Thrown when a contact attempt violates TCPA rules.
 *
 * violationType:
 *   'DNC_LIST'     — Phone is on the Do Not Call list. Contact is BLOCKED (not logged).
 *   'NO_CONSENT'   — No consent obtained. Contact is LOGGED for audit but flagged as violation.
 *   'OPT_OUT_PENDING' — Opt-out received but not yet fully processed.
 */
export class TcpaViolationError extends Error {
  constructor(
    message: string,
    public readonly violationType: 'DNC_LIST' | 'NO_CONSENT' | 'OPT_OUT_PENDING'
  ) {
    super(message);
    this.name = 'TcpaViolationError';
  }
}

export interface ContactAttemptInput {
  propertyId: string;
  phoneNumber: string; // Plain text — will be encrypted before storage
  contactMethod: ContactMethod;
  consentStatus: ConsentStatus;
  consentTimestamp?: Date; // When user obtained written consent
  consentMedium?: string; // HOW consent was obtained (FORM, EMAIL_REPLY, etc.)
  consentDetails?: Record<string, unknown>; // Which disclosures were checked
  notes?: string;
  userId: string;
}

/**
 * Real-time DNC list check.
 *
 * Queries DoNotCallEntry by HMAC hash of the phone number (DoNotCallEntry.phoneEncrypted
 * stores the HMAC hash — NOT an AES-encrypted value — for fast O(1) indexed lookups).
 *
 * Throws TcpaViolationError('DNC_LIST') if the number is on an active DNC entry.
 * Active = expiryDate is null (permanent) OR expiryDate is in the future.
 */
export async function checkDncList(phoneNumber: string): Promise<void> {
  const hash = hashPhoneForLookup(phoneNumber);
  const dncEntry = await prisma.doNotCallEntry.findFirst({
    where: {
      phoneEncrypted: hash,
      OR: [{ expiryDate: null }, { expiryDate: { gt: new Date() } }],
    },
  });
  if (dncEntry) {
    throw new TcpaViolationError(
      'This phone number is on the Do Not Call list. Contact is not permitted.',
      'DNC_LIST'
    );
  }
}

/**
 * Validates a contact attempt against TCPA rules and logs it to the database.
 *
 * Execution order (CRITICAL — order matters for compliance):
 *   1. DNC check — if on DNC list, throw immediately WITHOUT logging. No record created.
 *   2. Encrypt phone number with AES-256-GCM before any DB write.
 *   3. Write ContactLog record (APPEND-ONLY — never UPDATE or DELETE compliance logs).
 *   4. If consentStatus === NO_CONSENT_OBTAINED, throw TcpaViolationError AFTER logging.
 *      The log MUST exist for audit trail even though the contact was a violation.
 *
 * Returns the created ContactLog record on success (consent was obtained).
 * Throws TcpaViolationError for DNC or no-consent cases.
 */
export async function validateContactAttempt(input: ContactAttemptInput) {
  const { phoneNumber, consentStatus, propertyId, userId } = input;

  // STEP 1: DNC check — no contact and no log if blocked
  await checkDncList(phoneNumber); // throws TcpaViolationError('DNC_LIST') if blocked

  // STEP 2: Encrypt phone before any DB write — plain text never touches the database
  const encryptedPhone = encryptPhone(phoneNumber);

  // STEP 3: Write to contact_logs (APPEND-ONLY)
  const log = await prisma.contactLog.create({
    data: {
      propertyId,
      userId,
      ownerPhoneEncrypted: encryptedPhone,
      contactTimestamp: new Date(),
      contactMethod: input.contactMethod,
      consentStatus,
      consentTimestamp: input.consentTimestamp,
      consentMedium: input.consentMedium,
      consentDetails: (input.consentDetails ?? {}) as Prisma.InputJsonValue,
      notes: input.notes,
      // createdAt is set by DB default — immutable after insert
    },
  });

  // STEP 4: If no consent, throw AFTER logging (audit trail must capture the violation)
  if (consentStatus === ConsentStatus.NO_CONSENT_OBTAINED) {
    throw new TcpaViolationError(
      'Contact logged with NO_CONSENT_OBTAINED status. This is a TCPA violation risk.',
      'NO_CONSENT'
    );
  }

  return log;
}
