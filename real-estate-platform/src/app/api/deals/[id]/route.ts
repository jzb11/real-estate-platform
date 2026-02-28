import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';

// Only mutable fields allowed via PATCH (status changes go through /transition)
const UpdateDealSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  notes: z.string().nullable().optional(),
  pipelinePosition: z.number().int().min(0).optional(),
  customFields: z.record(z.string(), z.unknown()).optional(),
});

// Property fields to include in deal detail responses
const PROPERTY_SELECT = {
  id: true,
  address: true,
  city: true,
  state: true,
  zip: true,
  propertyType: true,
  estimatedValue: true,
  lastSalePrice: true,
  lastSaleDate: true,
  taxAssessedValue: true,
  ownershipName: true,
  equityPercent: true,
  debtOwed: true,
  interestRate: true,
  yearBuilt: true,
  squareFootage: true,
  bedrooms: true,
  bathrooms: true,
  unitCount: true,
  lotSize: true,
  annualPropertyTax: true,
  distressSignals: true,
  dataFreshnessDate: true,
};

/**
 * GET /api/deals/:id
 * Returns full deal detail with complete DealHistory and qualification rule evaluations.
 * Returns 404 if deal not found or belongs to different user (prevents existence leakage).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const { id } = await params;

  const deal = await prisma.deal.findFirst({
    where: { id, userId: user.id },
    include: {
      property: { select: PROPERTY_SELECT },
      history: {
        orderBy: { createdAt: 'asc' },
      },
      ruleEvals: {
        orderBy: { evaluatedAt: 'desc' },
      },
    },
  });

  if (!deal) {
    // 404 (not 403) to prevent leaking deal existence to other users
    return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
  }

  return NextResponse.json(deal);
}

/**
 * PATCH /api/deals/:id
 * Updates mutable fields: title, notes, pipelinePosition, customFields.
 * Status changes are NOT allowed here — use POST /api/deals/:id/transition instead.
 * Every changed field writes a DealHistory row (oldValue → newValue).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const { id } = await params;

  // Load existing deal with ownership check
  const deal = await prisma.deal.findFirst({
    where: { id, userId: user.id },
  });

  if (!deal) {
    return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
  }

  // Parse and validate body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = UpdateDealSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 400 }
    );
  }

  // Reject attempts to change status via PATCH
  if (body && typeof body === 'object' && 'status' in body) {
    return NextResponse.json(
      { error: 'Cannot update status via PATCH. Use POST /api/deals/:id/transition instead.' },
      { status: 422 }
    );
  }

  const updates = parsed.data;

  // Build update data and history entries for changed fields
  const updateData: Record<string, unknown> = {};
  const historyEntries: Array<{
    dealId: string;
    userId: string;
    fieldChanged: string;
    oldValue: string | null;
    newValue: string | null;
  }> = [];

  if (updates.title !== undefined && updates.title !== deal.title) {
    updateData.title = updates.title;
    historyEntries.push({
      dealId: id,
      userId: user.id,
      fieldChanged: 'title',
      oldValue: deal.title,
      newValue: updates.title,
    });
  }

  if (updates.notes !== undefined && updates.notes !== deal.notes) {
    updateData.notes = updates.notes;
    historyEntries.push({
      dealId: id,
      userId: user.id,
      fieldChanged: 'notes',
      oldValue: deal.notes,
      newValue: updates.notes,
    });
  }

  if (updates.pipelinePosition !== undefined && updates.pipelinePosition !== deal.pipelinePosition) {
    updateData.pipelinePosition = updates.pipelinePosition;
    historyEntries.push({
      dealId: id,
      userId: user.id,
      fieldChanged: 'pipelinePosition',
      oldValue: String(deal.pipelinePosition),
      newValue: String(updates.pipelinePosition),
    });
  }

  if (updates.customFields !== undefined) {
    updateData.customFields = updates.customFields;
    historyEntries.push({
      dealId: id,
      userId: user.id,
      fieldChanged: 'customFields',
      oldValue: JSON.stringify(deal.customFields),
      newValue: JSON.stringify(updates.customFields),
    });
  }

  // No changes — return deal as-is
  if (Object.keys(updateData).length === 0) {
    return NextResponse.json(deal);
  }

  // Atomically update deal and write DealHistory rows
  const updatedDeal = await prisma.$transaction(async (tx) => {
    const updated = await tx.deal.update({
      where: { id },
      data: updateData,
      include: {
        property: {
          select: {
            id: true,
            address: true,
            city: true,
            state: true,
            estimatedValue: true,
            dataFreshnessDate: true,
          },
        },
      },
    });

    if (historyEntries.length > 0) {
      await tx.dealHistory.createMany({ data: historyEntries });
    }

    return updated;
  });

  return NextResponse.json(updatedDeal);
}
