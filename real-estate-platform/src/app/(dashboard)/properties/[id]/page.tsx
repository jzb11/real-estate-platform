'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface Deal {
  id: string;
  title: string;
  status: string;
  qualificationScore: number;
  createdAt: string;
}

interface PropertyDetail {
  id: string;
  externalId: string;
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
  equityPercent: number | null;
  debtOwed: number | null;
  interestRate: number | null;
  daysOnMarket: number | null;
  yearBuilt: number | null;
  squareFootage: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  unitCount: number | null;
  lotSize: number | null;
  annualPropertyTax: number | null;
  distressSignals: Record<string, boolean>;
  dataSource: string;
  dataFreshnessDate: string;
  isStale: boolean;
  deals: Deal[];
  createdAt: string;
  updatedAt: string;
}

function fmt(value: number | null | undefined): string {
  if (value == null) return '--';
  return '$' + value.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function fmtPct(value: number | null | undefined): string {
  if (value == null) return '--';
  return value.toFixed(1) + '%';
}

function fmtDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '--';
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

const STATUS_COLORS: Record<string, string> = {
  SOURCED: 'bg-gray-100 text-gray-700',
  ANALYZING: 'bg-yellow-100 text-yellow-800',
  QUALIFIED: 'bg-blue-100 text-blue-800',
  UNDER_CONTRACT: 'bg-purple-100 text-purple-800',
  CLOSED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-700',
};

export default function PropertyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [property, setProperty] = useState<PropertyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/properties/${id}`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error ?? 'Failed to load property');
          return;
        }
        setProperty(await res.json());
      } catch {
        setError('Network error');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-pulse text-gray-400">Loading property...</div>
      </div>
    );
  }

  if (error || !property) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 py-12">
          <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
            <p className="text-red-800 font-medium">{error ?? 'Property not found'}</p>
            <Link href="/properties" className="mt-3 inline-block text-sm text-red-600 underline">
              Back to Properties
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const distressEntries = Object.entries(property.distressSignals).filter(
    ([, v]) => v === true
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Back link */}
        <Link
          href="/properties"
          className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 hover:underline mb-6"
        >
          &larr; Back to Properties
        </Link>

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">{property.address}</h1>
          <p className="text-gray-500">
            {property.city}, {property.state} {property.zip}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {property.propertyType && (
              <span className="inline-block rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                {property.propertyType}
              </span>
            )}
            <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
              property.dataSource === 'SCRAPER' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'
            }`}>
              {property.dataSource}
            </span>
            {property.isStale && (
              <span className="inline-block rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                Stale Data
              </span>
            )}
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <StatCard label="Estimated Value" value={fmt(property.estimatedValue)} />
          <StatCard label="Equity" value={fmtPct(property.equityPercent)} highlight={property.equityPercent != null && property.equityPercent >= 30} />
          <StatCard label="Debt Owed" value={fmt(property.debtOwed)} />
          <StatCard label="Interest Rate" value={property.interestRate != null ? property.interestRate + '%' : '--'} />
          <StatCard label="Last Sale Price" value={fmt(property.lastSalePrice)} />
          <StatCard label="Last Sale Date" value={fmtDate(property.lastSaleDate)} />
          <StatCard label="Tax Assessed" value={fmt(property.taxAssessedValue)} />
          <StatCard label="Days on Market" value={property.daysOnMarket != null ? String(property.daysOnMarket) : '--'} />
        </div>

        {/* Physical Details */}
        <div className="mb-8 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Physical Details</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-gray-500">Year Built</p>
              <p className="text-sm font-medium text-gray-900">{property.yearBuilt ?? '--'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Sq Ft</p>
              <p className="text-sm font-medium text-gray-900">{property.squareFootage ? property.squareFootage.toLocaleString() : '--'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Beds / Baths</p>
              <p className="text-sm font-medium text-gray-900">{property.bedrooms ?? '--'} / {property.bathrooms ?? '--'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Units</p>
              <p className="text-sm font-medium text-gray-900">{property.unitCount ?? '1'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Lot Size</p>
              <p className="text-sm font-medium text-gray-900">{property.lotSize ? property.lotSize.toLocaleString() + ' sq ft' : '--'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Annual Tax</p>
              <p className="text-sm font-medium text-gray-900">{fmt(property.annualPropertyTax)}</p>
            </div>
          </div>
        </div>

        {/* Owner info */}
        {property.ownershipName && (
          <div className="mb-8 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Owner Information</h2>
            <p className="text-gray-900 font-medium">{property.ownershipName}</p>
          </div>
        )}

        {/* Distress signals */}
        {distressEntries.length > 0 && (
          <div className="mb-8 rounded-xl border border-orange-200 bg-orange-50 p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-orange-800 uppercase tracking-wide mb-3">Distress Signals</h2>
            <div className="flex flex-wrap gap-2">
              {distressEntries.map(([key]) => (
                <span key={key} className="inline-block rounded-full bg-orange-200 px-3 py-1 text-xs font-semibold text-orange-900">
                  {key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase()).trim()}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Linked deals */}
        <div className="mb-8 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Deals ({property.deals.length})
          </h2>
          {property.deals.length === 0 ? (
            <p className="text-sm text-gray-400">No deals on this property.</p>
          ) : (
            <div className="space-y-2">
              {property.deals.map((deal) => (
                <Link
                  key={deal.id}
                  href={`/deals/${deal.id}`}
                  className="flex items-center justify-between rounded-lg border border-gray-100 px-4 py-3 hover:bg-gray-50 transition-colors"
                >
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{deal.title}</p>
                    <p className="text-xs text-gray-400">{fmtDate(deal.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold text-gray-500">Score: {deal.qualificationScore}</span>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLORS[deal.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {deal.status}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Metadata footer */}
        <div className="text-xs text-gray-400 space-y-1">
          <p>Data freshness: {fmtDate(property.dataFreshnessDate)}</p>
          <p>Imported: {fmtDate(property.createdAt)}</p>
          <p>Last updated: {fmtDate(property.updatedAt)}</p>
          <p>External ID: {property.externalId}</p>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
      <p className={`text-lg font-bold ${highlight ? 'text-green-700' : 'text-gray-900'}`}>{value}</p>
    </div>
  );
}
