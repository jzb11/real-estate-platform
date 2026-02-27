import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * GET /api/compliance/audit
 *
 * Read-only audit trail of all contact attempts for the authenticated user.
 * Satisfies TC-05: user can view full audit trail of all contact actions.
 *
 * Query params:
 *   page          — page number, 1-based (default: 1)
 *   limit         — results per page, max 100 (default: 20)
 *   startDate     — ISO 8601 date filter (inclusive)
 *   endDate       — ISO 8601 date filter (inclusive)
 *   contactMethod — EMAIL | CALL | SMS | LETTER
 *   consentStatus — NO_CONSENT_OBTAINED | EXPRESS_WRITTEN_CONSENT | PRIOR_EXPRESS_CONSENT | DO_NOT_CALL
 *
 * CRITICAL: ownerPhoneEncrypted is NEVER included in any response field.
 * Property address is included for context (not PII).
 */
export async function GET(req: NextRequest) {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const searchParams = req.nextUrl.searchParams;

  // Parse pagination params
  const rawPage = parseInt(searchParams.get('page') ?? '1', 10);
  const rawLimit = parseInt(searchParams.get('limit') ?? '20', 10);
  const page = isNaN(rawPage) || rawPage < 1 ? 1 : rawPage;
  const limit = isNaN(rawLimit) || rawLimit < 1 ? 20 : Math.min(rawLimit, 100);
  const skip = (page - 1) * limit;

  // Parse filter params
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const contactMethod = searchParams.get('contactMethod');
  const consentStatus = searchParams.get('consentStatus');

  // Build where clause
  const where: Record<string, unknown> = { userId: user.id };

  if (startDate || endDate) {
    const dateFilter: Record<string, Date> = {};
    if (startDate) {
      const d = new Date(startDate);
      if (!isNaN(d.getTime())) dateFilter['gte'] = d;
    }
    if (endDate) {
      const d = new Date(endDate);
      if (!isNaN(d.getTime())) dateFilter['lte'] = d;
    }
    if (Object.keys(dateFilter).length > 0) {
      where['contactTimestamp'] = dateFilter;
    }
  }

  const validContactMethods = ['EMAIL', 'CALL', 'SMS', 'LETTER'];
  if (contactMethod && validContactMethods.includes(contactMethod)) {
    where['contactMethod'] = contactMethod;
  }

  const validConsentStatuses = [
    'NO_CONSENT_OBTAINED',
    'EXPRESS_WRITTEN_CONSENT',
    'PRIOR_EXPRESS_CONSENT',
    'DO_NOT_CALL',
  ];
  if (consentStatus && validConsentStatuses.includes(consentStatus)) {
    where['consentStatus'] = consentStatus;
  }

  try {
    const [logs, total] = await Promise.all([
      prisma.contactLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { contactTimestamp: 'desc' },
        select: {
          id: true,
          contactTimestamp: true,
          contactMethod: true,
          consentStatus: true,
          consentTimestamp: true,
          consentMedium: true,
          notes: true,
          createdAt: true,
          propertyId: true,
          // ownerPhoneEncrypted deliberately excluded — never expose PII
          property: {
            select: {
              address: true,
              city: true,
              state: true,
              zip: true,
            },
          },
        },
      }),
      prisma.contactLog.count({ where }),
    ]);

    return NextResponse.json({
      logs,
      total,
      page,
      limit,
      hasMore: skip + logs.length < total,
    });
  } catch (err) {
    console.error('Error fetching audit log:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
