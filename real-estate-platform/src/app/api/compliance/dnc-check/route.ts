import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkDncList, TcpaViolationError } from '@/lib/compliance/tcpaValidator';

const DncCheckSchema = z.object({
  phoneNumber: z.string().min(10).max(20),
});

/**
 * POST /api/compliance/dnc-check
 *
 * Real-time DNC list check before attempting contact.
 * Satisfies TC-06: flag TCPA violations before contact occurs.
 *
 * Always returns 200 regardless of DNC status (the check itself succeeded).
 * The response body communicates whether the number is on the DNC list.
 *
 * On DNC:     { onDncList: true, message: '...' }
 * Not on DNC: { onDncList: false }
 *
 * Phone is NOT stored or returned — only a transient HMAC hash is computed for lookup.
 * Expected response time: <100ms (single indexed lookup by HMAC hash).
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

  const parsed = DncCheckSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', details: parsed.error.issues }, { status: 400 });
  }

  const { phoneNumber } = parsed.data;

  try {
    await checkDncList(phoneNumber);
    // checkDncList resolves without throwing — number is NOT on DNC list
    return NextResponse.json({ onDncList: false });
  } catch (err) {
    if (err instanceof TcpaViolationError && err.violationType === 'DNC_LIST') {
      return NextResponse.json({
        onDncList: true,
        message: 'This number is on the Do Not Call list',
      });
    }
    console.error('Error checking DNC list:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
