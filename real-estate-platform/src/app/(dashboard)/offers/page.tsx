'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Deal, Property, FollowUpSequence } from '@prisma/client';

type DealWithProperty = Deal & { property: Property };

interface BulkOfferEntry {
  dealId: string;
  recipientEmail: string;
  recipientName: string;
}

interface BulkSendResult {
  summary: { total: number; succeeded: number; failed: number };
  results: { dealId: string; success: boolean; error?: string }[];
}

const OFFER_STAGES = ['QUALIFIED', 'ANALYZING', 'SOURCED', 'UNDER_CONTRACT'] as const;
type OfferStage = typeof OFFER_STAGES[number];

const STAGE_LABELS: Record<OfferStage, string> = {
  QUALIFIED: 'Qualified',
  ANALYZING: 'Analyzing',
  SOURCED: 'Sourced',
  UNDER_CONTRACT: 'Under Contract',
};

export default function OffersPage() {
  const [deals, setDeals] = useState<DealWithProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stageFilter, setStageFilter] = useState<OfferStage>('QUALIFIED');

  // Selection state
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Bulk send modal
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkEntries, setBulkEntries] = useState<BulkOfferEntry[]>([]);
  const [bulkSequenceId, setBulkSequenceId] = useState('');
  const [sequences, setSequences] = useState<FollowUpSequence[]>([]);
  const [bulkSending, setBulkSending] = useState(false);
  const [bulkResult, setBulkResult] = useState<BulkSendResult | null>(null);

  useEffect(() => {
    setLoading(true);
    setSelected(new Set());
    fetch(`/api/deals?status=${stageFilter}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load deals (${res.status})`);
        return res.json();
      })
      .then((data: { deals: DealWithProperty[] }) => setDeals(data.deals ?? []))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [stageFilter]);

  function toggleSelect(dealId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(dealId)) next.delete(dealId);
      else next.add(dealId);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === deals.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(deals.map((d) => d.id)));
    }
  }

  function openBulkModal() {
    // Load sequences
    fetch('/api/sequences')
      .then((r) => r.json())
      .then((data: { sequences: FollowUpSequence[] }) => setSequences(data.sequences ?? []))
      .catch(() => {});

    // Pre-populate entries for selected deals
    const entries = deals
      .filter((d) => selected.has(d.id))
      .map((d) => ({
        dealId: d.id,
        recipientEmail: '',
        recipientName: d.property.ownershipName ?? '',
      }));
    setBulkEntries(entries);
    setBulkResult(null);
    setShowBulkModal(true);
  }

  function updateBulkEntry(index: number, field: 'recipientEmail' | 'recipientName', value: string) {
    setBulkEntries((prev) =>
      prev.map((entry, i) => (i === index ? { ...entry, [field]: value } : entry))
    );
  }

  async function handleBulkSend() {
    const validEntries = bulkEntries.filter((e) => e.recipientEmail.trim());
    if (validEntries.length === 0) return;

    setBulkSending(true);
    setBulkResult(null);
    try {
      const res = await fetch('/api/offers/bulk-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          offers: validEntries.map((e) => ({
            dealId: e.dealId,
            recipientEmail: e.recipientEmail.trim(),
            recipientName: e.recipientName.trim() || undefined,
            repairCosts: 0,
          })),
          ...(bulkSequenceId ? { sequenceId: bulkSequenceId } : {}),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Bulk send failed');
        return;
      }
      setBulkResult(data as BulkSendResult);
    } catch {
      setError('Network error during bulk send');
    } finally {
      setBulkSending(false);
    }
  }

  const allFilled = bulkEntries.every((e) => e.recipientEmail.trim());

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 py-8">
          <div className="animate-pulse space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-200 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error && !showBulkModal) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 py-8">
          <div className="bg-red-100 text-red-800 p-4 rounded-md">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Send Offers</h1>
            <p className="mt-1 text-sm text-gray-500">
              {deals.length} deal{deals.length !== 1 ? 's' : ''} in {STAGE_LABELS[stageFilter]}
              {selected.size > 0 && (
                <span className="text-blue-600 font-medium ml-2">
                  ({selected.size} selected)
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-3">
            {selected.size > 0 && (
              <button
                onClick={openBulkModal}
                className="rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-green-700 transition-colors"
              >
                Bulk Send ({selected.size})
              </button>
            )}
            <Link
              href="/offers/tracking"
              className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
            >
              View Tracking
            </Link>
          </div>
        </div>

        {/* Stage filter tabs */}
        <div className="mb-6 flex gap-1 rounded-lg border border-gray-200 bg-gray-100 p-1">
          {OFFER_STAGES.map((stage) => (
            <button
              key={stage}
              onClick={() => setStageFilter(stage)}
              className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                stageFilter === stage
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {STAGE_LABELS[stage]}
            </button>
          ))}
        </div>

        {deals.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white p-12 text-center shadow-sm">
            <p className="text-gray-500 font-medium">No qualified deals yet</p>
            <p className="mt-1 text-sm text-gray-400">
              Deals that pass qualification rules will appear here.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            {/* Select all header */}
            <div className="border-b border-gray-100 bg-gray-50 px-4 py-3 flex items-center gap-3">
              <input
                type="checkbox"
                checked={selected.size === deals.length && deals.length > 0}
                onChange={toggleSelectAll}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-xs font-medium text-gray-500 uppercase">
                {selected.size === deals.length ? 'Deselect All' : 'Select All'}
              </span>
            </div>

            <div className="divide-y divide-gray-100">
              {deals.map((deal) => (
                <div
                  key={deal.id}
                  className={`flex items-center gap-4 px-4 py-4 hover:bg-gray-50 transition-colors ${
                    selected.has(deal.id) ? 'bg-blue-50' : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(deal.id)}
                    onChange={() => toggleSelect(deal.id)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900">{deal.property.address}</p>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {deal.property.city}, {deal.property.state}
                    </p>
                    <div className="flex gap-4 mt-1 text-xs text-gray-400">
                      <span>Score: {deal.qualificationScore}</span>
                      {deal.property.equityPercent != null && (
                        <span>Equity: {deal.property.equityPercent.toFixed(0)}%</span>
                      )}
                      {deal.property.estimatedValue != null && (
                        <span>ARV: ${deal.property.estimatedValue.toLocaleString()}</span>
                      )}
                      {deal.property.ownershipName && (
                        <span>Owner: {deal.property.ownershipName}</span>
                      )}
                    </div>
                  </div>
                  <Link
                    href={`/offers/${deal.id}/compose`}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0"
                  >
                    Send Offer
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bulk Send Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  Bulk Send Offers
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {bulkEntries.length} deals selected
                </p>
              </div>
              <button
                onClick={() => setShowBulkModal(false)}
                className="rounded-lg p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Bulk result */}
            {bulkResult && (
              <div className={`mx-6 mt-4 rounded-lg border p-4 text-sm ${
                bulkResult.summary.failed === 0
                  ? 'border-green-200 bg-green-50 text-green-800'
                  : 'border-yellow-200 bg-yellow-50 text-yellow-800'
              }`}>
                <p className="font-semibold">
                  {bulkResult.summary.succeeded} of {bulkResult.summary.total} offers sent successfully
                </p>
                {bulkResult.summary.failed > 0 && (
                  <ul className="mt-2 space-y-1 text-xs">
                    {bulkResult.results
                      .filter((r) => !r.success)
                      .map((r) => (
                        <li key={r.dealId}>Deal {r.dealId.slice(0, 8)}...: {r.error}</li>
                      ))}
                  </ul>
                )}
              </div>
            )}

            {/* Recipient list */}
            <div className="flex-1 overflow-auto px-6 py-4">
              <div className="space-y-3">
                {bulkEntries.map((entry, i) => {
                  const deal = deals.find((d) => d.id === entry.dealId);
                  return (
                    <div key={entry.dealId} className="rounded-lg border border-gray-200 p-3">
                      <p className="text-sm font-medium text-gray-900 mb-2">
                        {deal?.property.address ?? entry.dealId}
                        <span className="text-xs text-gray-400 ml-2">
                          {deal?.property.city}, {deal?.property.state}
                        </span>
                      </p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <input
                          type="email"
                          value={entry.recipientEmail}
                          onChange={(e) => updateBulkEntry(i, 'recipientEmail', e.target.value)}
                          placeholder="owner@example.com"
                          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        />
                        <input
                          type="text"
                          value={entry.recipientName}
                          onChange={(e) => updateBulkEntry(i, 'recipientName', e.target.value)}
                          placeholder="Recipient name (optional)"
                          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-gray-100 px-6 py-4 flex items-center justify-between gap-4">
              <div className="flex-1 max-w-xs">
                <label className="block text-xs font-medium text-gray-500 mb-1">Follow-up Sequence</label>
                <select
                  value={bulkSequenceId}
                  onChange={(e) => setBulkSequenceId(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm bg-white focus:border-blue-500"
                >
                  <option value="">None</option>
                  {sequences.map((seq) => (
                    <option key={seq.id} value={seq.id}>{seq.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowBulkModal(false)}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBulkSend}
                  disabled={bulkSending || !allFilled || bulkResult !== null}
                  className="rounded-lg bg-green-600 px-5 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  {bulkSending ? 'Sending...' : `Send ${bulkEntries.length} Offers`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
