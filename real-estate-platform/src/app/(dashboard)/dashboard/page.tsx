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
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/deals', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json) setData(json);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  // Compute stats
  const totalDeals = data?.total ?? 0;
  const qualifiedDeals = data?.pipeline?.QUALIFIED?.length ?? 0;
  const underContract = data?.pipeline?.UNDER_CONTRACT?.length ?? 0;

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
  const topActivity = recentActivity.slice(0, 5);

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

        {/* Stats row */}
        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            {isLoading ? (
              <div className="h-8 w-12 animate-pulse rounded bg-gray-200"></div>
            ) : (
              <p className="text-3xl font-bold text-gray-900">{totalDeals}</p>
            )}
            <p className="mt-1 text-sm text-gray-500">Total Deals</p>
            <Link href="/pipeline" className="mt-3 block text-xs text-blue-600 hover:underline">
              View pipeline &rarr;
            </Link>
          </div>
          <div className="rounded-xl border border-green-200 bg-green-50 p-5 shadow-sm">
            {isLoading ? (
              <div className="h-8 w-12 animate-pulse rounded bg-green-200"></div>
            ) : (
              <p className="text-3xl font-bold text-green-800">{qualifiedDeals}</p>
            )}
            <p className="mt-1 text-sm text-green-700">Qualified</p>
            <Link
              href="/pipeline?qualified=true"
              className="mt-3 block text-xs text-green-700 hover:underline"
            >
              View qualified &rarr;
            </Link>
          </div>
          <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-5 shadow-sm">
            {isLoading ? (
              <div className="h-8 w-12 animate-pulse rounded bg-yellow-200"></div>
            ) : (
              <p className="text-3xl font-bold text-yellow-800">{underContract}</p>
            )}
            <p className="mt-1 text-sm text-yellow-700">Under Contract</p>
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
              Import CSV
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
