import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { checkDncList, TcpaViolationError } from '@/lib/compliance/tcpaValidator';
import { decryptPhone } from '@/lib/compliance/encryption';

const schema = z.object({
  dealId: z.string().min(1, 'dealId is required'),
});

/**
 * POST /api/compliance/check-deal
 *
 * Pre-send compliance check for a deal. Checks whether the property owner's
 * phone number (if available from skip-trace) is on the Do Not Call list.
 *
 * Returns:
 *   { status: 'clear' }     — Phone checked, not on DNC list
 *   { status: 'flagged' }   — Phone IS on DNC list — warn before contacting
 *   { status: 'no_phone' }  — No owner phone on record (skip-trace not done)
 */
export async function POST(req: NextRequest) {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', details: parsed.error.issues }, { status: 400 });
  }

  const deal = await prisma.deal.findUnique({
    where: { id: parsed.data.dealId },
    include: { property: true },
  });

  if (!deal || deal.userId !== user.id) {
    return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
  }

  if (!deal.property?.ownershipPhone) {
    return NextResponse.json({ status: 'no_phone' });
  }

  try {
    const phone = decryptPhone(deal.property.ownershipPhone);
    await checkDncList(phone);
    return NextResponse.json({ status: 'clear' });
  } catch (err) {
    if (err instanceof TcpaViolationError && err.violationType === 'DNC_LIST') {
      return NextResponse.json({ status: 'flagged' });
    }
    console.error('Compliance check error:', err);
    return NextResponse.json({ error: 'Compliance check failed' }, { status: 500 });
  }
}
