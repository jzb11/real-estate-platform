import { DealStatus } from '@prisma/client';

export type DealState = DealStatus; // SOURCED | ANALYZING | QUALIFIED | REJECTED | UNDER_CONTRACT | CLOSED

export interface DealTransitionInput {
  dealId: string;
  targetState: DealState;
  userId: string;
  notes?: string;
  transitionData?: {
    estimatedProfit?: number;   // Required for UNDER_CONTRACT transition
    closedDate?: Date;          // Required for CLOSED transition
    rejectionReason?: string;   // Optional for REJECTED
  };
}

export interface TransitionResult {
  success: boolean;
  deal?: { id: string; status: DealState; updatedAt: Date };
  error?: string;
}

export interface CreateDealInput {
  propertyId: string;
  title: string;
  notes?: string;
}

export interface DealWithHistory {
  id: string;
  propertyId: string;
  userId: string;
  title: string;
  status: DealState;
  qualificationScore: number;
  estimatedProfit: number | null;
  notes: string | null;
  pipelinePosition: number;
  createdAt: Date;
  updatedAt: Date;
  property: {
    id: string;
    address: string;
    city: string;
    state: string;
    estimatedValue: number | null;
    equityPercent: number | null;
    dataFreshnessDate: Date;
  };
  history: Array<{
    id: string;
    fieldChanged: string;
    oldValue: string | null;
    newValue: string | null;
    createdAt: Date;
  }>;
}
