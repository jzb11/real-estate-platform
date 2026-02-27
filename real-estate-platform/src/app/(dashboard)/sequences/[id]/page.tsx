'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { FollowUpSequence } from '@prisma/client';
import { SequenceBuilder } from '../components/SequenceBuilder';
import { SequenceTimeline } from '@/components/ui/SequenceTimeline';

interface Step {
  type: 'EMAIL' | 'SMS' | 'WAIT';
  delayDays?: number;
  subject?: string;
  htmlContent?: string;
}

type SequenceDetail = FollowUpSequence & {
  scheduledSequences?: {
    id: string;
    dealId: string;
    nextStepAt: string;
    currentStep: number;
    status: string;
    createdAt: string;
  }[];
};

export default function SequenceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const sequenceId = params.id as string;

  const [sequence, setSequence] = useState<SequenceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    fetch(`/api/sequences/${sequenceId}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Sequence not found (${res.status})`);
        return res.json();
      })
      .then((data: { sequence: SequenceDetail }) => setSequence(data.sequence))
      .catch((err: Error) => {
        console.error('Failed to load sequence:', err.message);
        router.push('/sequences');
      })
      .finally(() => setLoading(false));
  }, [sequenceId, router]);

  const handleSave = async (steps: Step[]) => {
    setSaveError('');
    setSaveSuccess(false);
    const res = await fetch(`/api/sequences/${sequenceId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ steps }),
    });
    if (!res.ok) {
      const err = await res.json() as { error?: string };
      setSaveError(err.error ?? 'Failed to save');
      return;
    }
    const data = await res.json() as { sequence: SequenceDetail };
    setSequence(data.sequence);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-4">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="grid grid-cols-2 gap-6">
            <div className="h-64 bg-gray-200 rounded" />
            <div className="h-64 bg-gray-200 rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (!sequence) return null;

  const steps = (sequence.steps ?? []) as unknown as Step[];

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">{sequence.name}</h1>
          {sequence.description && (
            <p className="text-gray-600 mt-1">{sequence.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`px-3 py-1 rounded-full text-sm font-medium ${
              sequence.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
            }`}
          >
            {sequence.enabled ? 'Enabled' : 'Disabled'}
          </span>
        </div>
      </div>

      {saveError && (
        <div className="bg-red-100 text-red-800 p-3 rounded-md mb-4 text-sm">{saveError}</div>
      )}
      {saveSuccess && (
        <div className="bg-green-100 text-green-800 p-3 rounded-md mb-4 text-sm">
          Sequence saved successfully.
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">
        <div>
          <h2 className="text-xl font-bold mb-4 text-gray-900">Sequence Timeline</h2>
          <div className="border border-gray-200 rounded-lg p-4 bg-white min-h-32">
            <SequenceTimeline steps={steps} />
          </div>

          {sequence.scheduledSequences && sequence.scheduledSequences.length > 0 && (
            <div className="mt-6">
              <h3 className="text-base font-semibold text-gray-700 mb-2">
                Active Instances ({sequence.scheduledSequences.length})
              </h3>
              <div className="space-y-2">
                {sequence.scheduledSequences.map((s) => (
                  <div
                    key={s.id}
                    className="border border-gray-200 rounded-md p-3 text-sm bg-white"
                  >
                    <div className="flex justify-between">
                      <span className="text-gray-600">Step {s.currentStep + 1}</span>
                      <span
                        className={`font-medium ${
                          s.status === 'ACTIVE' ? 'text-green-600' : 'text-yellow-600'
                        }`}
                      >
                        {s.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Next:{' '}
                      {new Date(s.nextStepAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div>
          <h2 className="text-xl font-bold mb-4 text-gray-900">Edit Steps</h2>
          <SequenceBuilder initialSteps={steps} onSave={handleSave} />
        </div>
      </div>
    </div>
  );
}
