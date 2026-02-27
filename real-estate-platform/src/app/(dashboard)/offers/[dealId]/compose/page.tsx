'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Deal, Property, FollowUpSequence } from '@prisma/client';
import { OfferForm } from './components/OfferForm';

type DealWithProperty = Deal & { property: Property };

export default function ComposePage() {
  const params = useParams();
  const router = useRouter();
  const dealId = params.dealId as string;

  const [deal, setDeal] = useState<DealWithProperty | null>(null);
  const [sequences, setSequences] = useState<FollowUpSequence[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    // GET /api/deals/[id] returns deal directly (not wrapped in { deal: ... })
    fetch(`/api/deals/${dealId}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Deal not found (${res.status})`);
        return res.json();
      })
      .then((data: DealWithProperty) => setDeal(data))
      .catch((err: Error) => setFetchError(err.message));

    // GET /api/sequences returns { sequences: [...] }
    fetch('/api/sequences')
      .then((res) => res.json())
      .then((data: { sequences: FollowUpSequence[] }) => setSequences(data.sequences ?? []))
      .catch((err: Error) => console.error('Failed to load sequences:', err.message));
  }, [dealId]);

  const handleSubmit = async (data: {
    dealId: string;
    recipientEmail: string;
    recipientName?: string;
    repairCosts: number;
    sequenceId?: string;
  }) => {
    setLoading(true);
    setSubmitError('');
    try {
      const response = await fetch('/api/offers/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const err = await response.json() as { error?: string };
        setSubmitError(err.error ?? 'Failed to send offer');
        return;
      }

      router.push('/offers/tracking?success=true');
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  if (fetchError) {
    return (
      <div className="max-w-2xl mx-auto p-4">
        <div className="bg-red-100 text-red-800 p-4 rounded-md">
          <p className="font-medium">Error loading deal</p>
          <p className="text-sm">{fetchError}</p>
        </div>
      </div>
    );
  }

  if (!deal) {
    return (
      <div className="max-w-2xl mx-auto p-4">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="h-64 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-3xl font-bold mb-2">Compose Offer</h1>
      <p className="text-gray-600 mb-6">{deal.title}</p>
      {submitError && (
        <div className="bg-red-100 text-red-800 p-3 rounded-md mb-4">{submitError}</div>
      )}
      <OfferForm deal={deal} sequences={sequences} onSubmit={handleSubmit} loading={loading} />
    </div>
  );
}
