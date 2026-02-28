'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface AnalyticsData {
  funnel: Record<string, number>;
  dealsTimeline: Record<string, number>;
  offersTimeline: Record<string, { sent: number; opened: number; clicked: number; bounced: number }>;
  offerPerformance: Record<string, number>;
  topProperties: Array<{
    title: string;
    status: string;
    qualificationScore: number;
    property: { address: string; city: string; estimatedValue: number | null; equityPercent: number | null };
  }>;
  scoreBuckets: number[];
  transitions: Record<string, number>;
}

const FUNNEL_STAGES = ['SOURCED', 'ANALYZING', 'QUALIFIED', 'UNDER_CONTRACT', 'CLOSED'] as const;
const FUNNEL_COLORS: Record<string, string> = {
  SOURCED: 'bg-gray-400',
  ANALYZING: 'bg-blue-400',
  QUALIFIED: 'bg-green-400',
  UNDER_CONTRACT: 'bg-yellow-400',
  CLOSED: 'bg-purple-400',
  REJECTED: 'bg-red-400',
};

function BarChart({ data, maxVal, color = 'bg-blue-500' }: { data: { label: string; value: number }[]; maxVal: number; color?: string }) {
  if (data.length === 0) return <p className="text-sm text-gray-400 py-4">No data yet</p>;
  return (
    <div className="space-y-2">
      {data.map((d) => (
        <div key={d.label} className="flex items-center gap-3">
          <span className="text-xs text-gray-500 w-20 text-right shrink-0 font-mono">{d.label}</span>
          <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
            <div
              className={`${color} h-full rounded-full transition-all duration-500`}
              style={{ width: maxVal > 0 ? `${(d.value / maxVal) * 100}%` : '0%' }}
            />
          </div>
          <span className="text-xs font-semibold text-gray-700 w-8 text-right">{d.value}</span>
        </div>
      ))}
    </div>
  );
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/analytics')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-8">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/4 animate-pulse" />
          <div className="grid grid-cols-2 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-48 bg-gray-200 rounded-xl animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500">Failed to load analytics data.</p>
      </div>
    );
  }

  const totalDeals = Object.values(data.funnel).reduce((a, b) => a + b, 0);
  const totalOffers = Object.values(data.offerPerformance).reduce((a, b) => a + b, 0);
  const openedOffers = (data.offerPerformance['OPENED'] ?? 0) + (data.offerPerformance['CLICKED'] ?? 0);
  const openRate = totalOffers > 0 ? ((openedOffers / totalOffers) * 100).toFixed(1) : '0.0';
  const bounceRate = totalOffers > 0
    ? (((data.offerPerformance['BOUNCED'] ?? 0) / totalOffers) * 100).toFixed(1)
    : '0.0';

  // Timeline data (last 14 days for display)
  const last14 = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    return d.toISOString().slice(0, 10);
  });

  const dealsChartData = last14.map((day) => ({
    label: day.slice(5), // MM-DD
    value: data.dealsTimeline[day] ?? 0,
  }));

  const offersChartData = last14.map((day) => ({
    label: day.slice(5),
    value: data.offersTimeline[day]?.sent ?? 0,
  }));

  const maxDeals = Math.max(1, ...dealsChartData.map((d) => d.value));
  const maxOffers = Math.max(1, ...offersChartData.map((d) => d.value));
  const maxFunnel = Math.max(1, ...FUNNEL_STAGES.map((s) => data.funnel[s] ?? 0));

  const scoreBucketLabels = ['0-20', '21-40', '41-60', '61-80', '81-100'];
  const maxScore = Math.max(1, ...data.scoreBuckets);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Analytics</h1>
            <p className="mt-1 text-sm text-gray-500">Last 30 days of deal and outreach performance</p>
          </div>
          <Link
            href="/dashboard"
            className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
          >
            &larr; Dashboard
          </Link>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-2xl font-bold text-gray-900">{totalDeals}</p>
            <p className="text-sm text-gray-500">Total Deals</p>
          </div>
          <div className="rounded-xl border border-green-200 bg-green-50 p-5 shadow-sm">
            <p className="text-2xl font-bold text-green-800">{data.funnel['QUALIFIED'] ?? 0}</p>
            <p className="text-sm text-green-700">Qualified</p>
          </div>
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
            <p className="text-2xl font-bold text-blue-800">{openRate}%</p>
            <p className="text-sm text-blue-700">Email Open Rate</p>
          </div>
          <div className="rounded-xl border border-red-200 bg-red-50 p-5 shadow-sm">
            <p className="text-2xl font-bold text-red-800">{bounceRate}%</p>
            <p className="text-sm text-red-700">Bounce Rate</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Deal Funnel */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Deal Funnel</h2>
            <div className="space-y-3">
              {FUNNEL_STAGES.map((stage) => {
                const count = data.funnel[stage] ?? 0;
                const pct = totalDeals > 0 ? ((count / totalDeals) * 100).toFixed(0) : '0';
                return (
                  <div key={stage} className="flex items-center gap-3">
                    <span className="text-xs text-gray-500 w-28 text-right shrink-0">
                      {stage.replace('_', ' ')}
                    </span>
                    <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden relative">
                      <div
                        className={`${FUNNEL_COLORS[stage]} h-full rounded-full transition-all duration-500`}
                        style={{ width: `${maxFunnel > 0 ? (count / maxFunnel) * 100 : 0}%` }}
                      />
                      <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-gray-700">
                        {count} ({pct}%)
                      </span>
                    </div>
                  </div>
                );
              })}
              {(data.funnel['REJECTED'] ?? 0) > 0 && (
                <div className="flex items-center gap-3 opacity-60">
                  <span className="text-xs text-gray-500 w-28 text-right shrink-0">REJECTED</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden relative">
                    <div
                      className="bg-red-400 h-full rounded-full"
                      style={{ width: `${((data.funnel['REJECTED'] ?? 0) / maxFunnel) * 100}%` }}
                    />
                    <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-gray-700">
                      {data.funnel['REJECTED']}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Offer Performance */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Offer Performance</h2>
            {totalOffers === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <p>No offers sent yet</p>
                <Link href="/offers" className="text-blue-600 text-sm hover:underline mt-1 block">
                  Send your first offer &rarr;
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {[
                  { label: 'Sent', count: data.offerPerformance['SENT'] ?? 0, color: 'bg-gray-400' },
                  { label: 'Opened', count: data.offerPerformance['OPENED'] ?? 0, color: 'bg-green-400' },
                  { label: 'Clicked', count: data.offerPerformance['CLICKED'] ?? 0, color: 'bg-blue-400' },
                  { label: 'Bounced', count: data.offerPerformance['BOUNCED'] ?? 0, color: 'bg-red-400' },
                  { label: 'Complained', count: data.offerPerformance['COMPLAINED'] ?? 0, color: 'bg-orange-400' },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-3">
                    <span className="text-xs text-gray-500 w-20 text-right shrink-0">{item.label}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                      <div
                        className={`${item.color} h-full rounded-full`}
                        style={{ width: `${totalOffers > 0 ? (item.count / totalOffers) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-gray-700 w-8 text-right">{item.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Deals Over Time */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Deals Created (14 days)</h2>
            <BarChart data={dealsChartData} maxVal={maxDeals} color="bg-blue-500" />
          </div>

          {/* Offers Over Time */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Offers Sent (14 days)</h2>
            <BarChart data={offersChartData} maxVal={maxOffers} color="bg-green-500" />
          </div>

          {/* Qualification Score Distribution */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Score Distribution</h2>
            <BarChart
              data={scoreBucketLabels.map((label, i) => ({ label, value: data.scoreBuckets[i] }))}
              maxVal={maxScore}
              color="bg-purple-500"
            />
          </div>

          {/* Stage Transitions */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Stage Transitions (30 days)</h2>
            {Object.keys(data.transitions).length === 0 ? (
              <p className="text-sm text-gray-400 py-4">No transitions recorded yet</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(data.transitions)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 8)
                  .map(([key, count]) => (
                    <div key={key} className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 font-mono text-xs">{key}</span>
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700">
                        {count}
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>

        {/* Top Properties */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Properties by Value</h2>
          {data.topProperties.length === 0 ? (
            <p className="text-sm text-gray-400 py-4">No properties in pipeline</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 px-2 font-medium text-gray-500">Property</th>
                    <th className="text-left py-2 px-2 font-medium text-gray-500">City</th>
                    <th className="text-right py-2 px-2 font-medium text-gray-500">Est. Value</th>
                    <th className="text-right py-2 px-2 font-medium text-gray-500">Equity %</th>
                    <th className="text-right py-2 px-2 font-medium text-gray-500">Score</th>
                    <th className="text-left py-2 px-2 font-medium text-gray-500">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {data.topProperties.map((p, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="py-2 px-2 font-medium text-gray-900 truncate max-w-[200px]">
                        {p.property.address}
                      </td>
                      <td className="py-2 px-2 text-gray-600">{p.property.city}</td>
                      <td className="py-2 px-2 text-right text-gray-900 font-mono">
                        {p.property.estimatedValue
                          ? `$${p.property.estimatedValue.toLocaleString()}`
                          : '—'}
                      </td>
                      <td className="py-2 px-2 text-right">
                        {p.property.equityPercent != null ? (
                          <span className={p.property.equityPercent >= 30 ? 'text-green-700 font-semibold' : 'text-gray-600'}>
                            {p.property.equityPercent.toFixed(0)}%
                          </span>
                        ) : '—'}
                      </td>
                      <td className="py-2 px-2 text-right font-semibold text-gray-900">{p.qualificationScore}</td>
                      <td className="py-2 px-2">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                          p.status === 'QUALIFIED' ? 'bg-green-100 text-green-800' :
                          p.status === 'UNDER_CONTRACT' ? 'bg-yellow-100 text-yellow-800' :
                          p.status === 'CLOSED' ? 'bg-purple-100 text-purple-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {p.status.replace('_', ' ')}
                        </span>
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
