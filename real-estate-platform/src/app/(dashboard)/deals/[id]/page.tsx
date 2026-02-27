'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { DealStatus } from '@prisma/client';
import DataFreshnessAlert from '@/components/ui/DataFreshnessAlert';

// ── Types ──────────────────────────────────────────────────────────────────────

interface DealHistory {
  id: string;
  fieldChanged: string;
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;
}

interface RuleEval {
  id: string;
  evaluationResult: string;
  scoreAwarded: number;
  evaluatedAt: string;
  rule: {
    id: string;
    name: string;
    ruleType: string;
    fieldName: string;
  };
}

interface DealDetail {
  id: string;
  title: string;
  status: DealStatus;
  qualificationScore: number;
  estimatedProfit: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  property: {
    id: string;
    address: string;
    city: string;
    state: string;
    zip: string;
    propertyType: string | null;
    estimatedValue: number | null;
    lastSalePrice: number | null;
    lastSaleDate: string | null;
    taxAssessedValue: number | null;
    ownershipName: string | null;
    distressSignals: Record<string, unknown>;
    dataFreshnessDate: string;
  };
  history: DealHistory[];
  ruleEvals: RuleEval[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<DealStatus, string> = {
  SOURCED: 'bg-gray-100 text-gray-700',
  ANALYZING: 'bg-blue-100 text-blue-700',
  QUALIFIED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
  UNDER_CONTRACT: 'bg-yellow-100 text-yellow-800',
  CLOSED: 'bg-emerald-100 text-emerald-700',
};

const NEXT_STAGE: Partial<Record<DealStatus, DealStatus>> = {
  SOURCED: 'ANALYZING',
  ANALYZING: 'QUALIFIED',
  QUALIFIED: 'UNDER_CONTRACT',
  UNDER_CONTRACT: 'CLOSED',
};

const NEXT_STAGE_LABEL: Partial<Record<DealStatus, string>> = {
  SOURCED: 'Move to Analyzing',
  ANALYZING: 'Move to Qualified',
  QUALIFIED: 'Move to Under Contract',
  UNDER_CONTRACT: 'Mark as Closed',
};

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return '—';
  return '$' + value.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function DealDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [deal, setDeal] = useState<DealDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Local repair cost for MAO calculator (not persisted)
  const [repairCost, setRepairCost] = useState<string>('0');

  // Notes editing
  const [notesDraft, setNotesDraft] = useState<string>('');
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  // Stage transition
  const [isTransitioning, setIsTransitioning] = useState(false);

  // ── Data fetching ────────────────────────────────────────────────────────────

  async function fetchDeal() {
    try {
      setError(null);
      const res = await fetch(`/api/deals/${id}`, { cache: 'no-store' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to load deal' }));
        setError(err.error ?? 'Failed to load deal');
        return;
      }
      const data: DealDetail = await res.json();
      setDeal(data);
      setNotesDraft(data.notes ?? '');
    } catch {
      setError('Network error — could not load deal');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchDeal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // ── MAO calculation ──────────────────────────────────────────────────────────

  const arv = deal?.property.estimatedValue ?? 0;
  const repairs = parseFloat(repairCost.replace(/[^0-9.]/g, '')) || 0;
  const mao = arv * 0.7 - repairs;

  // ── Handlers ─────────────────────────────────────────────────────────────────

  async function handleTransition() {
    if (!deal) return;
    const nextStage = NEXT_STAGE[deal.status];
    if (!nextStage) return;

    setIsTransitioning(true);
    try {
      const res = await fetch(`/api/deals/${id}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetState: nextStage }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Transition failed' }));
        alert(err.error ?? 'Transition failed');
        return;
      }
      await fetchDeal();
    } catch {
      alert('Network error — could not complete transition');
    } finally {
      setIsTransitioning(false);
    }
  }

  async function handleSaveNotes() {
    if (!deal) return;
    setIsSavingNotes(true);
    try {
      const res = await fetch(`/api/deals/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: notesDraft }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to save notes' }));
        alert(err.error ?? 'Failed to save notes');
        return;
      }
      setIsEditingNotes(false);
      await fetchDeal();
    } catch {
      alert('Network error — could not save notes');
    } finally {
      setIsSavingNotes(false);
    }
  }

  // ── Distress signals ─────────────────────────────────────────────────────────

  const DISTRESS_COLORS: Record<string, string> = {
    foreclosure: 'bg-red-100 text-red-800 border-red-300',
    preforeclosure: 'bg-orange-100 text-orange-800 border-orange-300',
    auction: 'bg-red-100 text-red-800 border-red-300',
    taxLien: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    probate: 'bg-purple-100 text-purple-800 border-purple-300',
    divorce: 'bg-pink-100 text-pink-800 border-pink-300',
    vacant: 'bg-gray-100 text-gray-800 border-gray-300',
  };

  function getDistressBadgeClass(signal: string): string {
    return DISTRESS_COLORS[signal] ?? 'bg-gray-100 text-gray-700 border-gray-300';
  }

  function getDistressSignals(signals: Record<string, unknown>): string[] {
    return Object.entries(signals)
      .filter(([, v]) => v === true || v === 1 || v === 'true')
      .map(([k]) => k);
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
          <span className="text-gray-600">Loading deal...</span>
        </div>
      </div>
    );
  }

  if (error || !deal) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <Link
            href="/pipeline"
            className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 hover:underline mb-6 block"
          >
            &larr; Back to Pipeline
          </Link>
          <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-800">
            <p className="font-semibold">Failed to load deal</p>
            <p className="mt-1 text-sm">{error ?? 'Deal not found'}</p>
            <button
              onClick={() => { setIsLoading(true); fetchDeal(); }}
              className="mt-3 text-sm text-red-600 underline hover:text-red-800"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  const nextStage = NEXT_STAGE[deal.status];
  const nextLabel = nextStage ? NEXT_STAGE_LABEL[deal.status] : undefined;
  const distressSignals = getDistressSignals(deal.property.distressSignals);
  // Reverse history so most recent is first
  const historyDesc = [...deal.history].reverse();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">

        {/* Back link */}
        <div className="mb-6">
          <Link
            href="/pipeline"
            className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 hover:underline"
          >
            &larr; Back to Pipeline
          </Link>
        </div>

        {/* Header */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{deal.property.address}</h1>
            <p className="mt-1 text-sm text-gray-500">
              {deal.property.city}, {deal.property.state} {deal.property.zip}
            </p>
          </div>
          <span
            className={`self-start inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${STATUS_BADGE[deal.status]}`}
          >
            {deal.status.replace('_', ' ')}
          </span>
        </div>

        <div className="space-y-6">

          {/* ── Section: Property Details ────────────────────────────────── */}
          <section className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-gray-100 px-6 py-4">
              <h2 className="text-base font-semibold text-gray-900">Property Details</h2>
            </div>
            <div className="px-6 py-5">
              <dl className="grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Property Type</dt>
                  <dd className="mt-1 text-sm text-gray-900">{deal.property.propertyType ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Owner</dt>
                  <dd className="mt-1 text-sm text-gray-900">{deal.property.ownershipName ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Estimated Value (ARV)</dt>
                  <dd className="mt-1 text-sm font-semibold text-gray-900">{formatCurrency(deal.property.estimatedValue)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Tax Assessed Value</dt>
                  <dd className="mt-1 text-sm text-gray-900">{formatCurrency(deal.property.taxAssessedValue)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Last Sale Price</dt>
                  <dd className="mt-1 text-sm text-gray-900">{formatCurrency(deal.property.lastSalePrice)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Last Sale Date</dt>
                  <dd className="mt-1 text-sm text-gray-900">{formatDate(deal.property.lastSaleDate)}</dd>
                </div>
              </dl>

              {/* Distress signals */}
              {distressSignals.length > 0 && (
                <div className="mt-4">
                  <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Distress Signals</dt>
                  <div className="flex flex-wrap gap-2">
                    {distressSignals.map((signal) => (
                      <span
                        key={signal}
                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${getDistressBadgeClass(signal)}`}
                      >
                        {signal}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Data freshness */}
              <div className="mt-4">
                <DataFreshnessAlert dataFreshnessDate={deal.property.dataFreshnessDate} />
              </div>
            </div>
          </section>

          {/* ── Section: Deal Analysis ───────────────────────────────────── */}
          <section className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-gray-100 px-6 py-4">
              <h2 className="text-base font-semibold text-gray-900">Deal Analysis</h2>
            </div>
            <div className="px-6 py-5 space-y-6">

              {/* Qualification score */}
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Qualification Score</p>
                <div className="flex items-center gap-3">
                  <span
                    className={`text-4xl font-bold ${
                      deal.qualificationScore >= 50 ? 'text-green-600' : 'text-orange-500'
                    }`}
                  >
                    {deal.qualificationScore}
                  </span>
                  <span className="text-lg text-gray-400">/100</span>
                  {deal.qualificationScore > 0 && (
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        deal.qualificationScore >= 50
                          ? 'bg-green-100 text-green-800'
                          : 'bg-orange-100 text-orange-800'
                      }`}
                    >
                      {deal.qualificationScore >= 50 ? 'Qualified' : 'Needs Review'}
                    </span>
                  )}
                </div>
              </div>

              {/* MAO Calculator */}
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">MAO Calculator</p>
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">ARV (Estimated Value)</span>
                    <span className="font-semibold text-gray-900">{formatCurrency(arv || null)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">ARV &times; 70%</span>
                    <span className="font-medium text-gray-700">{formatCurrency(arv * 0.7)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <label htmlFor="repairCost" className="text-gray-600">
                      Repair Estimate
                    </label>
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                      <input
                        id="repairCost"
                        type="number"
                        min="0"
                        step="1000"
                        value={repairCost}
                        onChange={(e) => setRepairCost(e.target.value)}
                        className="w-32 rounded border border-gray-300 bg-white pl-6 pr-2 py-1.5 text-sm text-right text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div className="border-t border-gray-300 pt-3 flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">
                      MAO = (ARV &times; 70%) &minus; Repairs
                    </span>
                    <span
                      className={`text-xl font-bold ${
                        mao > 0 ? 'text-blue-700' : 'text-red-600'
                      }`}
                    >
                      {formatCurrency(mao)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">
                    Repair cost is not saved — it&apos;s a local estimate for this session only.
                  </p>
                </div>
              </div>

              {/* Rule Evaluation Breakdown */}
              {deal.ruleEvals.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Rule Evaluation Breakdown</p>
                  <div className="overflow-x-auto rounded-lg border border-gray-200">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Rule</th>
                          <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                          <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Result</th>
                          <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 uppercase">Score</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        {deal.ruleEvals.map((ev) => (
                          <tr key={ev.id}>
                            <td className="px-4 py-2.5 text-gray-900">{ev.rule.name}</td>
                            <td className="px-4 py-2.5 text-gray-500 text-xs">{ev.rule.ruleType}</td>
                            <td className="px-4 py-2.5">
                              <span
                                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                  ev.evaluationResult === 'PASS'
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-red-100 text-red-800'
                                }`}
                              >
                                {ev.evaluationResult}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-right font-medium text-gray-900">
                              {ev.scoreAwarded > 0 ? `+${ev.scoreAwarded}` : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* ── Section: Stage History ───────────────────────────────────── */}
          <section className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-gray-100 px-6 py-4">
              <h2 className="text-base font-semibold text-gray-900">Stage History</h2>
            </div>
            <div className="px-6 py-5">
              {historyDesc.length === 0 ? (
                <p className="text-sm text-gray-400 italic">No history recorded yet.</p>
              ) : (
                <ol className="relative border-l border-gray-200 space-y-4 ml-3">
                  {historyDesc.map((entry) => (
                    <li key={entry.id} className="ml-4">
                      <div className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border-2 border-white bg-blue-500"></div>
                      <p className="text-sm font-medium text-gray-900">
                        {entry.fieldChanged === 'status' ? (
                          <>
                            Status:{' '}
                            <span className="text-gray-500 line-through">{entry.oldValue ?? 'none'}</span>
                            {' '}&rarr;{' '}
                            <span className="font-semibold text-blue-700">{entry.newValue}</span>
                          </>
                        ) : (
                          <>
                            {entry.fieldChanged}:{' '}
                            {entry.oldValue && (
                              <span className="text-gray-500 line-through">{entry.oldValue}</span>
                            )}
                            {entry.oldValue && ' '}&rarr; <span className="text-gray-900">{entry.newValue}</span>
                          </>
                        )}
                      </p>
                      <time className="text-xs text-gray-400">{formatDateTime(entry.createdAt)}</time>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </section>

          {/* ── Section: Notes ───────────────────────────────────────────── */}
          <section className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-gray-100 px-6 py-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">Notes</h2>
              {!isEditingNotes && (
                <button
                  onClick={() => setIsEditingNotes(true)}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  {deal.notes ? 'Edit' : 'Add Note'}
                </button>
              )}
            </div>
            <div className="px-6 py-5">
              {isEditingNotes ? (
                <div className="space-y-3">
                  <textarea
                    value={notesDraft}
                    onChange={(e) => setNotesDraft(e.target.value)}
                    rows={4}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="Add notes about this deal..."
                  />
                  <div className="flex gap-3">
                    <button
                      onClick={handleSaveNotes}
                      disabled={isSavingNotes}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      {isSavingNotes ? 'Saving...' : 'Save Notes'}
                    </button>
                    <button
                      onClick={() => { setIsEditingNotes(false); setNotesDraft(deal.notes ?? ''); }}
                      className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : deal.notes ? (
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{deal.notes}</p>
              ) : (
                <p className="text-sm text-gray-400 italic">No notes yet. Click &quot;Add Note&quot; to add one.</p>
              )}
            </div>
          </section>

          {/* ── Section: Actions ─────────────────────────────────────────── */}
          <section className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-gray-100 px-6 py-4">
              <h2 className="text-base font-semibold text-gray-900">Actions</h2>
            </div>
            <div className="px-6 py-5 flex flex-wrap gap-3">
              {nextStage && nextLabel ? (
                <button
                  onClick={handleTransition}
                  disabled={isTransitioning}
                  className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
                >
                  {isTransitioning ? 'Moving...' : nextLabel}
                </button>
              ) : (
                <span className="rounded-lg border border-gray-200 bg-gray-50 px-5 py-2.5 text-sm text-gray-400">
                  {deal.status === 'CLOSED' ? 'Deal closed' : deal.status === 'REJECTED' ? 'Deal rejected' : 'No further stages'}
                </span>
              )}
              <Link
                href="/pipeline"
                className="rounded-lg border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
              >
                Back to Pipeline
              </Link>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
