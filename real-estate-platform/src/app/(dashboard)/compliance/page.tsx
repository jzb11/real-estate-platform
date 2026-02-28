'use client';

import { useEffect, useState } from 'react';

interface AuditEntry {
  id: string;
  contactMethod: string;
  phoneHash: string;
  consentStatus: string;
  outcome: string;
  notes: string | null;
  createdAt: string;
  property: {
    address: string;
    city: string;
    state: string;
  } | null;
}

interface ConsentRecord {
  id: string;
  phoneHash: string;
  consentStatus: string;
  consentMethod: string | null;
  consentDate: string;
  retentionExpiresAt: string;
}

interface DncEntry {
  id: string;
  phoneHash: string;
  reason: string | null;
  permanent: boolean;
  expiresAt: string | null;
  createdAt: string;
}

type Tab = 'audit' | 'consent' | 'dnc';

export default function CompliancePage() {
  const [tab, setTab] = useState<Tab>('audit');
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [consentRecords, setConsentRecords] = useState<ConsentRecord[]>([]);
  const [dncEntries, setDncEntries] = useState<DncEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // DNC add form
  const [dncPhone, setDncPhone] = useState('');
  const [dncReason, setDncReason] = useState('');
  const [addingDnc, setAddingDnc] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/compliance/audit');
        if (res.ok) {
          const data = await res.json();
          setAuditEntries(data.entries ?? []);
          setConsentRecords(data.consents ?? []);
          setDncEntries(data.dncEntries ?? []);
        } else {
          setError('Failed to load compliance data');
        }
      } catch {
        setError('Network error');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleAddDnc() {
    if (!dncPhone.trim()) return;
    setAddingDnc(true);
    try {
      const res = await fetch('/api/compliance/opt-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: dncPhone.trim(),
          reason: dncReason.trim() || 'Manual DNC entry',
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? 'Failed to add to DNC list');
        return;
      }
      setDncPhone('');
      setDncReason('');
      // Refresh
      const refreshRes = await fetch('/api/compliance/audit');
      if (refreshRes.ok) {
        const data = await refreshRes.json();
        setDncEntries(data.dncEntries ?? []);
      }
    } catch {
      alert('Network error');
    } finally {
      setAddingDnc(false);
    }
  }

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'audit', label: 'Contact Log', count: auditEntries.length },
    { key: 'consent', label: 'Consent Records', count: consentRecords.length },
    { key: 'dnc', label: 'Do Not Call', count: dncEntries.length },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Compliance</h1>
          <p className="mt-1 text-sm text-gray-500">
            TCPA compliance dashboard — contact logs, consent records, and Do Not Call list management.
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 text-sm">{error}</div>
        )}

        {/* Tabs */}
        <div className="mb-6 flex gap-1 rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                tab === t.key
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {t.label}
              <span className={`ml-1.5 text-xs ${tab === t.key ? 'text-blue-200' : 'text-gray-400'}`}>
                ({t.count})
              </span>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="rounded-xl border border-gray-200 bg-white p-12 text-center shadow-sm">
            <div className="animate-pulse text-gray-400">Loading compliance data...</div>
          </div>
        ) : (
          <>
            {/* Audit Trail */}
            {tab === 'audit' && (
              <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                {auditEntries.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">No contact attempts logged yet.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Property</th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Method</th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Consent</th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Outcome</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {auditEntries.map((entry) => (
                          <tr key={entry.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                              {new Date(entry.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </td>
                            <td className="px-4 py-3 text-gray-900 text-sm">
                              {entry.property ? `${entry.property.address}, ${entry.property.city}` : '--'}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                                {entry.contactMethod}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                                entry.consentStatus === 'EXPRESS_WRITTEN_CONSENT'
                                  ? 'bg-green-100 text-green-700'
                                  : entry.consentStatus === 'DO_NOT_CALL'
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-yellow-100 text-yellow-700'
                              }`}>
                                {entry.consentStatus.replace(/_/g, ' ')}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center text-xs text-gray-600">
                              {entry.outcome}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Consent Records */}
            {tab === 'consent' && (
              <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                {consentRecords.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">No consent records on file.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Consent Date</th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Status</th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Method</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Retention Expires</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {consentRecords.map((rec) => {
                          const expired = new Date(rec.retentionExpiresAt) < new Date();
                          return (
                            <tr key={rec.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3 text-sm text-gray-900">
                                {new Date(rec.consentDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                                  rec.consentStatus === 'EXPRESS_WRITTEN_CONSENT'
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-yellow-100 text-yellow-700'
                                }`}>
                                  {rec.consentStatus.replace(/_/g, ' ')}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center text-sm text-gray-600">
                                {rec.consentMethod ?? '--'}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <span className={`text-xs font-medium ${expired ? 'text-red-600' : 'text-gray-500'}`}>
                                  {new Date(rec.retentionExpiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                  {expired && ' (EXPIRED)'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Do Not Call */}
            {tab === 'dnc' && (
              <div className="space-y-4">
                {/* Add to DNC */}
                <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Add to Do Not Call List</h3>
                  <div className="flex flex-wrap gap-3">
                    <input
                      type="tel"
                      value={dncPhone}
                      onChange={(e) => setDncPhone(e.target.value)}
                      placeholder="Phone number"
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm w-48 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                    <input
                      type="text"
                      value={dncReason}
                      onChange={(e) => setDncReason(e.target.value)}
                      placeholder="Reason (optional)"
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm flex-1 min-w-48 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                    <button
                      onClick={handleAddDnc}
                      disabled={addingDnc || !dncPhone.trim()}
                      className="rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                    >
                      {addingDnc ? 'Adding...' : 'Add to DNC'}
                    </button>
                  </div>
                </div>

                {/* DNC list */}
                <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                  {dncEntries.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">Do Not Call list is empty.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200 text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Added</th>
                            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Type</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Reason</th>
                            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Expires</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {dncEntries.map((entry) => (
                            <tr key={entry.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3 text-sm text-gray-900">
                                {new Date(entry.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                                  entry.permanent ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                                }`}>
                                  {entry.permanent ? 'Permanent' : 'Temporary'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600">
                                {entry.reason ?? '--'}
                              </td>
                              <td className="px-4 py-3 text-right text-xs text-gray-500">
                                {entry.expiresAt
                                  ? new Date(entry.expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                  : 'Never'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
