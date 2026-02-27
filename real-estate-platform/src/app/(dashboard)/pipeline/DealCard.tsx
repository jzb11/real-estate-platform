'use client';

import Link from 'next/link';
import { DealStatus } from '@prisma/client';
import DataFreshnessAlert from '@/components/ui/DataFreshnessAlert';

export interface DealWithPipeline {
  id: string;
  title: string;
  status: DealStatus;
  qualificationScore: number;
  pipelinePosition: number;
  property: {
    id: string;
    address: string;
    city: string;
    state: string;
    estimatedValue: number | null;
    dataFreshnessDate: string | Date;
  };
  history: Array<{
    id: string;
    fieldChanged: string;
    oldValue: string | null;
    newValue: string | null;
    createdAt: string | Date;
  }>;
}

const NEXT_STAGE: Partial<Record<DealStatus, DealStatus>> = {
  SOURCED: 'ANALYZING',
  ANALYZING: 'QUALIFIED',
  QUALIFIED: 'UNDER_CONTRACT',
  UNDER_CONTRACT: 'CLOSED',
};

const STATUS_BADGE_CLASSES: Record<DealStatus, string> = {
  SOURCED: 'bg-gray-100 text-gray-700',
  ANALYZING: 'bg-blue-100 text-blue-700',
  QUALIFIED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
  UNDER_CONTRACT: 'bg-yellow-100 text-yellow-800',
  CLOSED: 'bg-emerald-100 text-emerald-700',
};

const NEXT_STAGE_LABELS: Partial<Record<DealStatus, string>> = {
  SOURCED: 'Move to Analyzing',
  ANALYZING: 'Move to Qualified',
  QUALIFIED: 'Move to Under Contract',
  UNDER_CONTRACT: 'Mark as Closed',
};

interface DealCardProps {
  deal: DealWithPipeline;
  onTransition: (dealId: string, targetState: DealStatus) => void;
  isTransitioning?: boolean;
}

export default function DealCard({ deal, onTransition, isTransitioning = false }: DealCardProps) {
  const nextStage = NEXT_STAGE[deal.status];
  const nextLabel = nextStage ? NEXT_STAGE_LABELS[deal.status] : undefined;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm hover:shadow-md transition-shadow">
      {/* Address */}
      <Link href={`/deals/${deal.id}`} className="group block">
        <p className="font-semibold text-gray-900 text-sm leading-tight group-hover:text-blue-600 transition-colors">
          {deal.property.address}
        </p>
        <p className="text-xs text-gray-500 mt-0.5">
          {deal.property.city}, {deal.property.state}
        </p>
      </Link>

      {/* Status badge */}
      <div className="mt-2 flex items-center gap-2 flex-wrap">
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_CLASSES[deal.status]}`}
        >
          {deal.status.replace('_', ' ')}
        </span>
        {deal.qualificationScore > 0 && (
          <span className="text-xs text-gray-500">Score: {deal.qualificationScore}/100</span>
        )}
      </div>

      {/* Estimated value */}
      {deal.property.estimatedValue != null && (
        <p className="mt-1.5 text-xs text-gray-600">
          ARV:{' '}
          <span className="font-medium text-gray-800">
            ${deal.property.estimatedValue.toLocaleString()}
          </span>
        </p>
      )}

      {/* Data freshness */}
      <div className="mt-2">
        <DataFreshnessAlert dataFreshnessDate={deal.property.dataFreshnessDate} compact />
      </div>

      {/* Actions */}
      <div className="mt-3 flex gap-2">
        {nextStage && nextLabel ? (
          <button
            onClick={() => onTransition(deal.id, nextStage)}
            disabled={isTransitioning}
            className="flex-1 rounded bg-blue-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
          >
            {isTransitioning ? 'Moving...' : nextLabel}
          </button>
        ) : (
          <span className="flex-1 rounded bg-gray-50 px-2 py-1.5 text-center text-xs text-gray-400 border border-gray-200">
            No further stages
          </span>
        )}
        <Link
          href={`/deals/${deal.id}`}
          className="rounded border border-gray-200 px-2 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
        >
          View
        </Link>
      </div>
    </div>
  );
}
