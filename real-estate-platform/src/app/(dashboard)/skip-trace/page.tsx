'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

interface SkipTraceRequest {
  id: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'NOT_FOUND' | 'FAILED';
  phonesFound: string[];
  emailsFound: string[];
  createdAt: string;
  completedAt: string | null;
  property: {
    id: string;
    address: string;
    city: string;
    state: string;
    skipTraced: boolean;
    ownershipName: string | null;
  };
}

interface BulkResult {
  queued: number;
  skipped: number;
  errors: string[];
}

const STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-gray-100 text-gray-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-green-100 text-green-700',
  NOT_FOUND: 'bg-yellow-100 text-yellow-700',
  FAILED: 'bg-red-100 text-red-700',
};

export default function SkipTracePage() {
  const [requests, setRequests] = useState<SkipTraceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkResult, setBulkResult] = useState<BulkResult | null>(null);
  const [singlePropertyId, setSinglePropertyId] = useState('');
  const [singleRunning, setSingleRunning] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/properties/skip-trace/status');
      if (!res.ok) {
        setError('Failed to load skip-trace status');
        return;
      }
      const data = await res.json();
      setRequests(data.requests ?? []);
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Auto-refresh if any are pending/in-progress
  useEffect(() => {
    const hasPending = requests.some((r) => r.status === 'PENDING' || r.status === 'IN_PROGRESS');
    if (!hasPending) return;
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [requests, fetchStatus]);

  async function handleBulkEnrich() {
    setBulkRunning(true);
    setBulkResult(null);
    try {
      const res = await fetch('/api/properties/skip-trace/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Bulk enrich failed');
        return;
      }
      setBulkResult(data);
      await fetchStatus();
    } catch {
      setError('Network error');
    } finally {
      setBulkRunning(false);
    }
  }

  async function handleSingleEnrich() {
    if (!singlePropertyId.trim()) return;
    setSingleRunning(true);
    try {
      const res = await fetch('/api/properties/skip-trace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId: singlePropertyId.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error ?? 'Skip-trace failed');
        return;
      }
      setSinglePropertyId('');
      await fetchStatus();
    } catch {
      alert('Network error');
    } finally {
      setSingleRunning(false);
    }
  }

  // Stats
  const completed = requests.filter((r) => r.status === 'COMPLETED').length;
  const pending = requests.filter((r) => r.status === 'PENDING' || r.status === 'IN_PROGRESS').length;
  const failed = requests.filter((r) => r.status === 'FAILED').length;
  const notFound = requests.filter((r) => r.status === 'NOT_FOUND').length;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Skip Trace</h1>
          <p className="mt-1 text-sm text-gray-500">
            Enrich property records with owner phone numbers and email addresses via REISkip.
          </p>
        </div>

        {/* Stats */}
        <div className="mb-6 grid gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-2xl font-bold text-gray-900">{requests.length}</p>
            <p className="text-sm text-gray-500">Total Requests</p>
          </div>
          <div className="rounded-xl border border-green-200 bg-green-50 p-4 shadow-sm">
            <p className="text-2xl font-bold text-green-800">{completed}</p>
            <p className="text-sm text-green-700">Completed</p>
          </div>
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 shadow-sm">
            <p className="text-2xl font-bold text-blue-800">{pending}</p>
            <p className="text-sm text-blue-700">In Progress</p>
          </div>
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 shadow-sm">
            <p className="text-2xl font-bold text-red-800">{failed + notFound}</p>
            <p className="text-sm text-red-700">Failed / Not Found</p>
          </div>
        </div>

        {/* Actions */}
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Enrich Properties</h2>
          <div className="flex flex-wrap gap-4">
            <button
              onClick={handleBulkEnrich}
              disabled={bulkRunning}
              className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {bulkRunning ? 'Queuing...' : 'Bulk Enrich All (Missing Phones)'}
            </button>
            <div className="flex gap-2">
              <input
                type="text"
                value={singlePropertyId}
                onChange={(e) => setSinglePropertyId(e.target.value)}
                placeholder="Property ID"
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm w-64 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
              <button
                onClick={handleSingleEnrich}
                disabled={singleRunning || !singlePropertyId.trim()}
                className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                {singleRunning ? 'Running...' : 'Enrich Single'}
              </button>
            </div>
          </div>

          {bulkResult && (
            <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
              Queued {bulkResult.queued} properties for enrichment.
              {bulkResult.skipped > 0 && ` Skipped ${bulkResult.skipped} (already have data).`}
            </div>
          )}
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 text-sm">
            {error}
          </div>
        )}

        {/* Request history */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-gray-100 px-5 py-4">
            <h2 className="text-base font-semibold text-gray-900">
              Request History
              {pending > 0 && (
                <span className="ml-2 text-xs font-normal text-blue-600">(auto-refreshing)</span>
              )}
            </h2>
          </div>

          {loading ? (
            <div className="p-8 text-center text-gray-400">Loading...</div>
          ) : requests.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-500">No skip-trace requests yet.</p>
              <p className="mt-1 text-sm text-gray-400">Use bulk enrich to start enriching property data.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Property</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Owner</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Phones</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Emails</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {requests.map((req) => (
                    <tr key={req.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <Link
                          href={`/properties/${req.property.id}`}
                          className="font-medium text-gray-900 hover:text-blue-600"
                        >
                          {req.property.address}
                        </Link>
                        <p className="text-xs text-gray-400">{req.property.city}, {req.property.state}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-sm">
                        {req.property.ownershipName ?? '--'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[req.status]}`}>
                          {req.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-sm">
                        {req.status === 'COMPLETED' ? (
                          <span className="font-semibold text-green-700">{req.phonesFound?.length ?? 0}</span>
                        ) : '--'}
                      </td>
                      <td className="px-4 py-3 text-center text-sm">
                        {req.status === 'COMPLETED' ? (
                          <span className="font-semibold text-green-700">{req.emailsFound?.length ?? 0}</span>
                        ) : '--'}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-gray-400">
                        {new Date(req.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
