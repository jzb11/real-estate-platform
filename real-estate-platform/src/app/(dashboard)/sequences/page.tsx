'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FollowUpSequence } from '@prisma/client';

type SequenceWithCount = FollowUpSequence & {
  _count?: { scheduledSequences: number };
};

export default function SequencesPage() {
  const [sequences, setSequences] = useState<SequenceWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadSequences = () => {
    setLoading(true);
    fetch('/api/sequences')
      .then((res) => res.json())
      .then((data: { sequences: SequenceWithCount[] }) => setSequences(data.sequences ?? []))
      .catch((err: Error) => console.error('Failed to load sequences:', err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadSequences();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError('');
    try {
      const res = await fetch('/api/sequences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: createName,
          description: createDesc || undefined,
          steps: [{ type: 'EMAIL', subject: 'Follow-up' }],
        }),
      });
      if (!res.ok) {
        const err = await res.json() as { error?: string };
        setCreateError(err.error ?? 'Failed to create sequence');
        return;
      }
      setShowCreateModal(false);
      setCreateName('');
      setCreateDesc('');
      loadSequences();
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete sequence "${name}"? This cannot be undone.`)) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/sequences/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to delete' }));
        alert(err.error ?? 'Failed to delete sequence');
        return;
      }
      setSequences((prev) => prev.filter((s) => s.id !== id));
    } catch {
      alert('Network error — could not delete sequence');
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="p-4">
        <div className="animate-pulse space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-200 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Follow-up Sequences</h1>
          <p className="text-gray-600 text-sm mt-1">
            {sequences.length} template{sequences.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 text-sm font-medium transition-colors"
        >
          Create Sequence
        </button>
      </div>

      {sequences.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg font-medium">No sequences yet</p>
          <p className="text-sm mt-1">Create your first follow-up sequence template.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sequences.map((seq) => (
            <div key={seq.id} className="border border-gray-200 rounded-lg p-4 bg-white hover:border-blue-300 hover:bg-gray-50 transition-colors">
              <div className="flex justify-between items-start">
                <Link href={`/sequences/${seq.id}`} className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 hover:text-blue-600 transition-colors">{seq.name}</p>
                  {seq.description && (
                    <p className="text-sm text-gray-600 mt-0.5">{seq.description}</p>
                  )}
                </Link>
                <div className="flex items-center gap-3 text-xs text-gray-500 ml-3">
                  {seq._count?.scheduledSequences != null && (
                    <span>{seq._count.scheduledSequences} active</span>
                  )}
                  <span
                    className={`px-2 py-0.5 rounded ${seq.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}
                  >
                    {seq.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                  <button
                    onClick={() => handleDelete(seq.id, seq.name)}
                    disabled={deletingId === seq.id}
                    className="rounded p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
                    title="Delete sequence"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
            <h2 className="text-xl font-bold mb-4">Create Sequence</h2>
            {createError && (
              <div className="bg-red-100 text-red-800 p-3 rounded-md mb-4 text-sm">{createError}</div>
            )}
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Name</label>
                <input
                  type="text"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  required
                  placeholder="e.g. 5-day follow-up"
                  className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Description (optional)</label>
                <input
                  type="text"
                  value={createDesc}
                  onChange={(e) => setCreateDesc(e.target.value)}
                  placeholder="Brief description"
                  className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setCreateError('');
                  }}
                  className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !createName}
                  className="flex-1 bg-green-600 text-white py-2 rounded-md hover:bg-green-700 disabled:opacity-50"
                >
                  {creating ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
