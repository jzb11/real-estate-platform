import { DealStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import type { DealTransitionInput, TransitionResult, DealState } from './types';

type ValidTransition = {
  from: DealStatus;
  to: DealStatus;
  requiredFields?: ('estimatedProfit' | 'closedDate')[];
};

export const VALID_TRANSITIONS: ValidTransition[] = [
  { from: 'SOURCED',        to: 'ANALYZING' },
  { from: 'SOURCED',        to: 'REJECTED' },
  { from: 'ANALYZING',      to: 'QUALIFIED' },
  { from: 'ANALYZING',      to: 'REJECTED' },
  { from: 'QUALIFIED',      to: 'UNDER_CONTRACT', requiredFields: ['estimatedProfit'] },
  { from: 'QUALIFIED',      to: 'REJECTED' },
  { from: 'UNDER_CONTRACT', to: 'CLOSED',         requiredFields: ['closedDate'] },
  { from: 'UNDER_CONTRACT', to: 'REJECTED' },
];

export function canTransition(from: DealStatus, to: DealStatus): boolean {
  return VALID_TRANSITIONS.some(t => t.from === from && t.to === to);
}

export async function transitionDeal(input: DealTransitionInput): Promise<TransitionResult> {
  const { dealId, targetState, userId, notes, transitionData } = input;

  // Load deal with ownership check
  const deal = await prisma.deal.findFirst({
    where: { id: dealId, userId },
  });
  if (!deal) return { success: false, error: 'Deal not found or access denied' };

  // Validate transition
  const transition = VALID_TRANSITIONS.find(
    t => t.from === deal.status && t.to === targetState
  );
  if (!transition) {
    return {
      success: false,
      error: `Invalid transition: ${deal.status} → ${targetState}. Valid next states: ${
        VALID_TRANSITIONS.filter(t => t.from === deal.status).map(t => t.to).join(', ') || 'none (terminal state)'
      }`,
    };
  }

  // Check required fields
  if (transition.requiredFields) {
    const missing = transition.requiredFields.filter(
      f => transitionData?.[f] === undefined || transitionData[f] === null
    );
    if (missing.length > 0) {
      return { success: false, error: `Missing required fields for this transition: ${missing.join(', ')}` };
    }
  }

  // Execute transition in transaction: update deal + write DealHistory
  const updateData: Record<string, unknown> = { status: targetState };
  if (transitionData?.estimatedProfit !== undefined) updateData.estimatedProfit = transitionData.estimatedProfit;
  if (transitionData?.closedDate !== undefined) updateData.closedDate = transitionData.closedDate;
  if (notes !== undefined) updateData.notes = notes;

  await prisma.$transaction([
    prisma.deal.update({ where: { id: dealId }, data: updateData }),
    prisma.dealHistory.create({
      data: {
        dealId,
        userId,
        fieldChanged: 'status',
        oldValue: deal.status,
        newValue: targetState,
      },
    }),
    // Log notes change if provided
    ...(notes !== undefined ? [prisma.dealHistory.create({
      data: { dealId, userId, fieldChanged: 'notes', oldValue: deal.notes, newValue: notes },
    })] : []),
  ]);

  const updatedDeal = await prisma.deal.findUnique({ where: { id: dealId } });
  return {
    success: true,
    deal: updatedDeal
      ? { id: updatedDeal.id, status: updatedDeal.status as DealState, updatedAt: updatedDeal.updatedAt }
      : undefined,
  };
}

