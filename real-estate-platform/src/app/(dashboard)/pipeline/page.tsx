'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { DealStatus } from '@prisma/client';
import { CONTEXTUAL_KB_LINKS } from '@/lib/kb/contextualLinks';
import PipelineColumn from './PipelineColumn';
import DealCard, { type DealWithPipeline } from './DealCard';

// Pipeline stages to display (excluding REJECTED — shown separately if needed)
const PIPELINE_STAGES: DealStatus[] = [
  'SOURCED',
  'ANALYZING',
  'QUALIFIED',
  'UNDER_CONTRACT',
  'CLOSED',
];

interface PipelineData {
  pipeline: Record<DealStatus, DealWithPipeline[]>;
  total: number;
}

export default function PipelinePage() {
  const helpLinks = CONTEXTUAL_KB_LINKS['pipeline'] ?? [];

  const [data, setData] = useState<PipelineData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qualifiedOnly, setQualifiedOnly] = useState(false);
  const [transitioningDealId, setTransitioningDealId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchDeals = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch('/api/deals', { cache: 'no-store' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to load deals' }));
        setError(err.error ?? 'Failed to load deals');
        return;
      }
      const json = await res.json();
      setData(json);
    } catch {
      setError('Network error — could not load deals');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDeals();
  }, [fetchDeals]);

  async function handleTransition(dealId: string, targetState: DealStatus) {
    setTransitioningDealId(dealId);
    try {
      const res = await fetch(`/api/deals/${dealId}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetState }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Transition failed' }));
        alert(err.error ?? 'Transition failed');
        return;
      }
      await fetchDeals();
    } catch {
      alert('Network error — could not complete transition');
    } finally {
      setTransitioningDealId(null);
    }
  }

  const [showRejected, setShowRejected] = useState(false);

  // Search filter — applied client-side across all stages
  const searchLower = searchQuery.toLowerCase().trim();
  function matchesSearch(deal: DealWithPipeline): boolean {
    if (!searchLower) return true;
    return (
      deal.property.address.toLowerCase().includes(searchLower) ||
      deal.property.city.toLowerCase().includes(searchLower) ||
      deal.title.toLowerCase().includes(searchLower)
    );
  }

  // Filtered pipeline data
  function getFilteredDeals(stage: DealStatus): DealWithPipeline[] {
    return (data?.pipeline[stage] ?? []).filter(matchesSearch);
  }

  // Qualified-only flat list
  const qualifiedDeals = getFilteredDeals('QUALIFIED');
  const rejectedDeals = getFilteredDeals('REJECTED');

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-screen-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Deal Pipeline</h1>
            {data && (
              <p className="mt-1 text-sm text-gray-500">{data.total} total deals</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search deals..."
                className="w-48 rounded-lg border border-gray-200 bg-white pl-8 pr-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <Link
              href="/import"
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm transition-colors"
            >
              Import CSV
            </Link>
            <button
              onClick={() => setQualifiedOnly((v) => !v)}
              className={`rounded-lg px-4 py-2 text-sm font-medium shadow-sm transition-colors ${
                qualifiedOnly
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              {qualifiedOnly ? 'Showing: Qualified Only' : 'Show Qualified Only'}
            </button>
          </div>
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
            <span className="ml-3 text-gray-600">Loading pipeline...</span>
          </div>
        )}

        {/* Error state */}
        {error && !isLoading && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
            <p className="font-medium">Failed to load deals</p>
            <p className="mt-1 text-sm">{error}</p>
            <button
              onClick={() => { setIsLoading(true); fetchDeals(); }}
              className="mt-3 text-sm text-red-600 underline hover:text-red-800"
            >
              Try again
            </button>
          </div>
        )}

        {/* Qualified Only flat view */}
        {!isLoading && !error && qualifiedOnly && data && (
          <div>
            <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
              <p className="text-sm font-medium text-green-800">
                Showing {qualifiedDeals.length} qualified deal{qualifiedDeals.length !== 1 ? 's' : ''}
              </p>
            </div>
            {qualifiedDeals.length === 0 ? (
              <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
                <p className="text-gray-500">No qualified deals yet.</p>
                <p className="mt-1 text-sm text-gray-400">
                  Move deals through ANALYZING and run qualification to promote them.
                </p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {qualifiedDeals.map((deal) => (
                  <DealCard
                    key={deal.id}
                    deal={deal}
                    onTransition={handleTransition}
                    isTransitioning={transitioningDealId === deal.id}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Full Kanban board */}
        {!isLoading && !error && !qualifiedOnly && data && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5 overflow-x-auto">
            {PIPELINE_STAGES.map((stage) => (
              <PipelineColumn
                key={stage}
                stage={stage}
                deals={getFilteredDeals(stage)}
                onTransition={handleTransition}
                transitioningDealId={transitioningDealId}
              />
            ))}
          </div>
        )}

        {/* Rejected deals (collapsible) */}
        {!isLoading && !error && !qualifiedOnly && rejectedDeals.length > 0 && (
          <div className="mt-6">
            <button
              onClick={() => setShowRejected((v) => !v)}
              className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
            >
              <svg
                className={`h-4 w-4 transition-transform ${showRejected ? 'rotate-90' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              Rejected Deals ({rejectedDeals.length})
            </button>
            {showRejected && (
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
                {rejectedDeals.map((deal) => (
                  <DealCard
                    key={deal.id}
                    deal={deal}
                    onTransition={handleTransition}
                    isTransitioning={transitioningDealId === deal.id}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* KB Help links */}
        {helpLinks.length > 0 && (
          <div className="mt-8 rounded-lg bg-blue-50 border border-blue-200 p-4">
            <h3 className="text-sm font-semibold text-blue-900 mb-2">Need help?</h3>
            <ul className="space-y-1">
              {helpLinks.map((link) => (
                <li key={link.slug}>
                  <Link
                    href={`/kb/${link.slug}`}
                    className="text-sm text-blue-700 hover:text-blue-900 hover:underline"
                  >
                    {link.title} &rarr;
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
