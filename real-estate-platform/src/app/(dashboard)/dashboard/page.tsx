'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useUser, UserButton } from '@clerk/nextjs';
import { DealStatus } from '@prisma/client';

interface PipelineData {
  pipeline: Record<DealStatus, Array<{
    id: string;
    title: string;
    status: DealStatus;
    qualificationScore: number;
    updatedAt: string;
    property: {
      address: string;
      city: string;
      state: string;
    };
    history: Array<{
      id: string;
      fieldChanged: string;
      oldValue: string | null;
      newValue: string | null;
      createdAt: string;
    }>;
  }>>;
  total: number;
}

interface DashboardStats {
  totalDeals: number;
  dealsByStatus: Record<string, number>;
  propertiesCount: number;
  offersCount: number;
  closedDeals: number;
  conversionRate: number;
  openRate: number;
  activeSequences: number;
}

interface RecentActivity {
  id: string;
  dealTitle: string;
  dealId: string;
  fieldChanged: string;
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;
}

function formatTimeAgo(date: string): string {
  const diffMs = Date.now() - new Date(date).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export default function DashboardPage() {
  const { user } = useUser();
  const [data, setData] = useState<PipelineData | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/deals', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)),
      fetch('/api/dashboard/stats', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([dealsJson, statsJson]) => {
        if (dealsJson) setData(dealsJson);
        if (statsJson) setStats(statsJson);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  // Compute stats from pipeline data (fallback if stats API not available)
  const totalDeals = stats?.totalDeals ?? data?.total ?? 0;
  const qualifiedDeals = stats?.dealsByStatus?.QUALIFIED ?? data?.pipeline?.QUALIFIED?.length ?? 0;
  const underContract = stats?.dealsByStatus?.UNDER_CONTRACT ?? data?.pipeline?.UNDER_CONTRACT?.length ?? 0;
  const closedDeals = stats?.closedDeals ?? stats?.dealsByStatus?.CLOSED ?? 0;
  const propertiesCount = stats?.propertiesCount ?? 0;
  const offersCount = stats?.offersCount ?? 0;
  const conversionRate = stats?.conversionRate ?? 0;

  // Collect recent activity across all deals (last 5 history entries)
  const recentActivity: RecentActivity[] = [];
  if (data) {
    for (const stage of Object.values(data.pipeline)) {
      for (const deal of stage) {
        for (const entry of deal.history) {
          recentActivity.push({
            id: entry.id,
            dealTitle: deal.title,
            dealId: deal.id,
            fieldChanged: entry.fieldChanged,
            oldValue: entry.oldValue,
            newValue: entry.newValue,
            createdAt: entry.createdAt,
          });
        }
      }
    }
  }
  recentActivity.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  const topActivity = recentActivity.slice(0, 8);

  const firstName = user?.firstName ?? user?.username ?? 'there';

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Welcome back, {firstName}
            </h1>
            <p className="mt-1 text-gray-500">
              {user?.primaryEmailAddress?.emailAddress}
            </p>
          </div>
          <UserButton />
        </div>

        {/* Stats grid */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            value={totalDeals}
            label="Total Deals"
            loading={isLoading}
            href="/pipeline"
            linkText="View pipeline"
          />
          <StatCard
            value={qualifiedDeals}
            label="Qualified"
            loading={isLoading}
            href="/pipeline?qualified=true"
            linkText="View qualified"
            variant="green"
          />
          <StatCard
            value={underContract}
            label="Under Contract"
            loading={isLoading}
            variant="yellow"
          />
          <StatCard
            value={closedDeals}
            label="Closed"
            loading={isLoading}
            variant="blue"
          />
        </div>

        {/* Secondary stats */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            {isLoading ? (
              <div className="h-7 w-12 animate-pulse rounded bg-gray-200"></div>
            ) : (
              <p className="text-2xl font-bold text-gray-900">{propertiesCount.toLocaleString()}</p>
            )}
            <p className="mt-1 text-sm text-gray-500">Properties Tracked</p>
            <Link href="/properties" className="mt-2 block text-xs text-blue-600 hover:underline">
              Browse properties &rarr;
            </Link>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            {isLoading ? (
              <div className="h-7 w-12 animate-pulse rounded bg-gray-200"></div>
            ) : (
              <p className="text-2xl font-bold text-gray-900">{offersCount.toLocaleString()}</p>
            )}
            <p className="mt-1 text-sm text-gray-500">Offers Sent</p>
            <Link href="/offers/tracking" className="mt-2 block text-xs text-blue-600 hover:underline">
              View tracking &rarr;
            </Link>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            {isLoading ? (
              <div className="h-7 w-12 animate-pulse rounded bg-gray-200"></div>
            ) : (
              <p className="text-2xl font-bold text-gray-900">{stats?.openRate ?? 0}%</p>
            )}
            <p className="mt-1 text-sm text-gray-500">Open Rate</p>
            <p className="mt-2 text-xs text-gray-400">Emails opened / sent</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            {isLoading ? (
              <div className="h-7 w-12 animate-pulse rounded bg-gray-200"></div>
            ) : (
              <p className="text-2xl font-bold text-gray-900">{stats?.activeSequences ?? 0}</p>
            )}
            <p className="mt-1 text-sm text-gray-500">Active Sequences</p>
            <Link href="/sequences" className="mt-2 block text-xs text-blue-600 hover:underline">
              View sequences &rarr;
            </Link>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            {isLoading ? (
              <div className="h-7 w-12 animate-pulse rounded bg-gray-200"></div>
            ) : (
              <p className="text-2xl font-bold text-gray-900">{conversionRate}%</p>
            )}
            <p className="mt-1 text-sm text-gray-500">Conversion Rate</p>
            <p className="mt-2 text-xs text-gray-400">Deals sourced to closed</p>
          </div>
        </div>

        {/* Quick actions */}
        <div className="mb-8">
          <h2 className="mb-3 text-lg font-semibold text-gray-800">Quick Actions</h2>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/import"
              className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors"
            >
              Import Properties
            </Link>
            <Link
              href="/offers"
              className="rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-green-700 transition-colors"
            >
              Send Offers
            </Link>
            <Link
              href="/pipeline"
              className="rounded-lg border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
            >
              View Pipeline
            </Link>
            <Link
              href="/properties"
              className="rounded-lg border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
            >
              Browse Properties
            </Link>
            <Link
              href="/rules"
              className="rounded-lg border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
            >
              Manage Rules
            </Link>
          </div>
        </div>

        {/* Recent activity */}
        <div>
          <h2 className="mb-3 text-lg font-semibold text-gray-800">Recent Activity</h2>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-12 animate-pulse rounded-lg bg-gray-200"></div>
              ))}
            </div>
          ) : topActivity.length === 0 ? (
            <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
              <p className="text-gray-500">No recent activity.</p>
              <p className="mt-1 text-sm text-gray-400">
                Import a CSV or create deals to get started.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm divide-y divide-gray-100">
              {topActivity.map((entry) => (
                <div key={entry.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/deals/${entry.dealId}`}
                      className="text-sm font-medium text-gray-900 hover:text-blue-600 truncate block"
                    >
                      {entry.dealTitle}
                    </Link>
                    <p className="text-xs text-gray-500 truncate">
                      {entry.fieldChanged}:{' '}
                      {entry.oldValue ? (
                        <>
                          <span className="line-through">{entry.oldValue}</span>
                          {' '}
                          &rarr; {entry.newValue}
                        </>
                      ) : (
                        <span>{entry.newValue}</span>
                      )}
                    </p>
                  </div>
                  <span className="text-xs text-gray-400 whitespace-nowrap">
                    {formatTimeAgo(entry.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  value,
  label,
  loading,
  href,
  linkText,
  variant,
}: {
  value: number;
  label: string;
  loading: boolean;
  href?: string;
  linkText?: string;
  variant?: 'green' | 'yellow' | 'blue';
}) {
  const styles = {
    green: { border: 'border-green-200', bg: 'bg-green-50', text: 'text-green-800', link: 'text-green-700' },
    yellow: { border: 'border-yellow-200', bg: 'bg-yellow-50', text: 'text-yellow-800', link: 'text-yellow-700' },
    blue: { border: 'border-blue-200', bg: 'bg-blue-50', text: 'text-blue-800', link: 'text-blue-700' },
  };
  const s = variant ? styles[variant] : { border: 'border-gray-200', bg: 'bg-white', text: 'text-gray-900', link: 'text-blue-600' };

  return (
    <div className={`rounded-xl border ${s.border} ${s.bg} p-5 shadow-sm`}>
      {loading ? (
        <div className="h-8 w-12 animate-pulse rounded bg-gray-200"></div>
      ) : (
        <p className={`text-3xl font-bold ${s.text}`}>{value}</p>
      )}
      <p className={`mt-1 text-sm ${variant ? s.link : 'text-gray-500'}`}>{label}</p>
      {href && linkText && (
        <Link href={href} className={`mt-3 block text-xs ${s.link} hover:underline`}>
          {linkText} &rarr;
        </Link>
      )}
    </div>
  );
}
