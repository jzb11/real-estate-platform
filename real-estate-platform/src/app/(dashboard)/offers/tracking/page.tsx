'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { OfferedDeal } from '@prisma/client';
import { OfferCard } from '@/components/ui/OfferCard';

type OfferWithDeal = OfferedDeal & {
  deal?: {
    title: string;
    property: { address: string; city: string; state: string };
  };
};

function TrackingContent() {
  const searchParams = useSearchParams();
  const showSuccess = searchParams.get('success') === 'true';

  const [offers, setOffers] = useState<OfferWithDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');

  const loadOffers = (status?: string) => {
    const qs = status ? `?status=${status}` : '';
    fetch(`/api/offers${qs}`)
      .then((res) => res.json())
      .then((data: { offers: OfferWithDeal[] }) => setOffers(data.offers ?? []))
      .catch((err: Error) => console.error('Failed to load offers:', err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadOffers(statusFilter || undefined);
  }, [statusFilter]);

  const stats = {
    total: offers.length,
    opened: offers.filter((o) => o.emailOpenedAt).length,
    clicked: offers.filter((o) => o.linkClickedAt).length,
    bounced: offers.filter((o) => o.bouncedAt).length,
  };

  const openRate = stats.total > 0 ? ((stats.opened / stats.total) * 100).toFixed(1) : '0.0';

  if (loading) {
    return (
      <div className="p-4">
        <div className="animate-pulse space-y-3">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-200 rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-3xl font-bold">Offer Tracking</h1>

      {showSuccess && (
        <div className="bg-green-100 text-green-800 p-3 rounded-md text-sm font-medium">
          Offer sent successfully.
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg">
          <p className="text-sm text-gray-600">Total Sent</p>
          <p className="text-2xl font-bold text-blue-700">{stats.total}</p>
        </div>
        <div className="bg-green-50 border border-green-100 p-4 rounded-lg">
          <p className="text-sm text-gray-600">Opened</p>
          <p className="text-2xl font-bold text-green-700">{stats.opened}</p>
          <p className="text-xs text-gray-500">{openRate}% rate</p>
        </div>
        <div className="bg-purple-50 border border-purple-100 p-4 rounded-lg">
          <p className="text-sm text-gray-600">Clicked</p>
          <p className="text-2xl font-bold text-purple-700">{stats.clicked}</p>
        </div>
        <div className="bg-red-50 border border-red-100 p-4 rounded-lg">
          <p className="text-sm text-gray-600">Bounced</p>
          <p className="text-2xl font-bold text-red-700">{stats.bounced}</p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-gray-700">Filter by status:</label>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All</option>
          <option value="SENT">Sent</option>
          <option value="OPENED">Opened</option>
          <option value="CLICKED">Clicked</option>
          <option value="BOUNCED">Bounced</option>
          <option value="COMPLAINED">Complained</option>
          <option value="UNSUBSCRIBED">Unsubscribed</option>
        </select>
      </div>

      {/* Offer list */}
      {offers.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg font-medium">No offers found</p>
          <p className="text-sm mt-1">
            {statusFilter ? 'Try changing the filter.' : 'Send your first offer to get started.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {offers.map((offer) => (
            <div key={offer.id}>
              {offer.deal && (
                <Link
                  href={`/deals/${offer.dealId}`}
                  className="text-xs text-blue-600 hover:text-blue-800 hover:underline mb-1 ml-1 block"
                >
                  {offer.deal.property.address}, {offer.deal.property.city} &rarr;
                </Link>
              )}
              <OfferCard offer={offer} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function TrackingPage() {
  return (
    <Suspense fallback={<div className="p-4">Loading...</div>}>
      <TrackingContent />
    </Suspense>
  );
}
