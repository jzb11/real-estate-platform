'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Deal, Property } from '@prisma/client';

type DealWithProperty = Deal & { property: Property };

export default function OffersPage() {
  const [deals, setDeals] = useState<DealWithProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/deals?status=QUALIFIED')
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load deals (${res.status})`);
        return res.json();
      })
      .then((data: { deals: DealWithProperty[] }) => setDeals(data.deals ?? []))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-4">
        <div className="animate-pulse space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 bg-gray-200 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="bg-red-100 text-red-800 p-4 rounded-md">{error}</div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Qualified Deals</h1>
          <p className="text-gray-600 text-sm mt-1">
            {deals.length} deal{deals.length !== 1 ? 's' : ''} ready for offers
          </p>
        </div>
        <Link href="/offers/tracking">
          <button className="border border-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-50 text-sm">
            View Tracking
          </button>
        </Link>
      </div>

      {deals.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg font-medium">No qualified deals yet</p>
          <p className="text-sm mt-1">Deals that pass qualification rules will appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {deals.map((deal) => (
            <div
              key={deal.id}
              className="border border-gray-200 rounded-lg p-4 bg-white flex justify-between items-center hover:border-blue-300 transition-colors"
            >
              <div>
                <p className="font-semibold text-gray-900">{deal.property.address}</p>
                <p className="text-sm text-gray-500 mt-0.5">
                  {deal.property.city}, {deal.property.state}
                </p>
                <div className="flex gap-4 mt-2 text-xs text-gray-500">
                  <span>Score: {deal.qualificationScore}</span>
                  {deal.property.equityPercent != null && (
                    <span>Equity: {deal.property.equityPercent.toFixed(0)}%</span>
                  )}
                  {deal.property.estimatedValue != null && (
                    <span>ARV: ${deal.property.estimatedValue.toLocaleString()}</span>
                  )}
                </div>
              </div>
              <Link href={`/offers/${deal.id}/compose`}>
                <button className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm font-medium transition-colors whitespace-nowrap">
                  Send Offer
                </button>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
