'use client';

import { DealStatus } from '@prisma/client';
import DealCard, { type DealWithPipeline } from './DealCard';

const COLUMN_HEADER_CLASSES: Record<DealStatus, string> = {
  SOURCED: 'border-gray-400 bg-gray-100 text-gray-700',
  ANALYZING: 'border-blue-400 bg-blue-100 text-blue-700',
  QUALIFIED: 'border-green-400 bg-green-100 text-green-700',
  REJECTED: 'border-red-400 bg-red-100 text-red-700',
  UNDER_CONTRACT: 'border-yellow-400 bg-yellow-100 text-yellow-800',
  CLOSED: 'border-emerald-400 bg-emerald-100 text-emerald-700',
};

const COLUMN_LABELS: Record<DealStatus, string> = {
  SOURCED: 'Sourced',
  ANALYZING: 'Analyzing',
  QUALIFIED: 'Qualified',
  REJECTED: 'Rejected',
  UNDER_CONTRACT: 'Under Contract',
  CLOSED: 'Closed',
};

interface PipelineColumnProps {
  stage: DealStatus;
  deals: DealWithPipeline[];
  onTransition: (dealId: string, targetState: DealStatus) => void;
  transitioningDealId?: string | null;
}

export default function PipelineColumn({
  stage,
  deals,
  onTransition,
  transitioningDealId,
}: PipelineColumnProps) {
  const headerClass = COLUMN_HEADER_CLASSES[stage];
  const label = COLUMN_LABELS[stage];

  return (
    <div className="flex flex-col rounded-lg border border-gray-200 bg-gray-50 overflow-hidden">
      {/* Column header */}
      <div className={`border-b-2 px-3 py-2 ${headerClass}`}>
        <div className="flex items-center justify-between">
          <span className="font-semibold text-sm">{label}</span>
          <span className="rounded-full bg-white bg-opacity-70 px-2 py-0.5 text-xs font-bold">
            {deals.length}
          </span>
        </div>
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-2 p-2 overflow-y-auto" style={{ minHeight: '200px' }}>
        {deals.length === 0 ? (
          <div className="flex flex-1 items-center justify-center py-8">
            <p className="text-sm text-gray-400 italic">No deals in this stage</p>
          </div>
        ) : (
          deals.map((deal) => (
            <DealCard
              key={deal.id}
              deal={deal}
              onTransition={onTransition}
              isTransitioning={transitioningDealId === deal.id}
            />
          ))
        )}
      </div>
    </div>
  );
}
