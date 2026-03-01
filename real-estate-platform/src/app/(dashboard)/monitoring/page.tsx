'use client';

import { useEffect, useState } from 'react';

interface Metrics {
  totalSent: number;
  bounceRate: number;
  complaintRate: number;
  senderScore: number;
  openRate: number;
}

interface Alert {
  id: string;
  alertType: string;
  message: string;
  acknowledged: boolean;
  createdAt: string;
  metrics: Record<string, number>;
}

const alertTypeLabels: Record<string, string> = {
  BOUNCE_RATE_HIGH: 'Bounce Rate High',
  COMPLAINT_RATE_HIGH: 'Complaint Rate High',
  SENDER_SCORE_LOW: 'Sender Score Low',
};

const alertRemediation: Record<string, string[]> = {
  BOUNCE_RATE_HIGH: [
    'Verify email addresses before sending (use email validation service)',
    'Remove hard-bounced addresses from your contact lists',
    'Consider re-importing your property data with updated owner emails',
    'Pause bulk sends until bounce rate drops below 5%',
  ],
  COMPLAINT_RATE_HIGH: [
    'Review your email content for misleading subject lines or content',
    'Ensure you have an easy-to-find unsubscribe link in all emails',
    'Consider reducing send frequency to contacts who have not engaged',
    'Check that your "from" address matches your brand identity',
  ],
  SENDER_SCORE_LOW: [
    'Reduce email volume temporarily to let your reputation recover',
    'Focus on sending to engaged contacts only (opened/clicked before)',
    'Ensure SPF, DKIM, and DMARC records are properly configured',
    'Monitor bounce and complaint rates — they directly impact sender score',
  ],
};

export default function MonitoringPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [healthStatus, setHealthStatus] = useState<string>('');
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [alertsLoading, setAlertsLoading] = useState(true);
  const [showAcknowledged, setShowAcknowledged] = useState(false);

  useEffect(() => {
    fetch('/api/monitoring/status')
      .then((res) => res.json())
      .then((data: { metrics: Metrics; healthStatus: string }) => {
        setMetrics(data.metrics);
        setHealthStatus(data.healthStatus);
      })
      .catch((err: Error) => console.error('Failed to load monitoring status:', err.message))
      .finally(() => setLoading(false));

    fetch('/api/monitoring/alerts')
      .then((res) => res.json())
      .then((data: { alerts: Alert[] }) => setAlerts(data.alerts ?? []))
      .catch((err: Error) => console.error('Failed to load alerts:', err.message))
      .finally(() => setAlertsLoading(false));
  }, []);

  const acknowledgeAlert = async (alertId: string) => {
    const res = await fetch('/api/monitoring/alerts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alertId }),
    });
    if (res.ok) {
      setAlerts((prev) =>
        prev.map((a) => (a.id === alertId ? { ...a, acknowledged: true } : a))
      );
    }
  };

  const unacknowledgedCount = alerts.filter((a) => !a.acknowledged).length;

  const acknowledgeAll = async () => {
    const unacked = alerts.filter((a) => !a.acknowledged);
    await Promise.all(unacked.map((a) => acknowledgeAlert(a.id)));
  };

  if (loading) {
    return (
      <div className="p-4">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4" />
          <div className="grid grid-cols-3 gap-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-28 bg-gray-200 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="p-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Email Health</h1>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <svg className="h-16 w-16 text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <h3 className="text-lg font-semibold text-gray-900">No monitoring data yet</h3>
          <p className="mt-2 max-w-sm text-sm text-gray-500">
            Email health metrics will appear here once you start sending offers. Configure your SendGrid API key in settings to enable deliverability tracking.
          </p>
          <a
            href="/settings"
            className="mt-5 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors"
          >
            Configure Email Settings
          </a>
        </div>
      </div>
    );
  }

  const healthColor =
    healthStatus === 'HEALTHY'
      ? 'text-green-600 bg-green-50 border-green-200'
      : 'text-yellow-600 bg-yellow-50 border-yellow-200';

  return (
    <div className="p-4 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Email Health</h1>
        <div className={`px-4 py-2 rounded-lg border font-bold text-lg ${healthColor}`}>
          {healthStatus}
        </div>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="border border-gray-200 rounded-lg p-4 bg-white">
          <p className="text-sm text-gray-600 mb-2">Total Sent (30 days)</p>
          <p className="text-3xl font-bold text-gray-900">{metrics.totalSent.toLocaleString()}</p>
        </div>

        <div className="border border-gray-200 rounded-lg p-4 bg-white">
          <p className="text-sm text-gray-600 mb-2">Bounce Rate</p>
          <p
            className={`text-3xl font-bold ${
              metrics.bounceRate > 5 ? 'text-red-600' : 'text-green-600'
            }`}
          >
            {metrics.bounceRate.toFixed(2)}%
          </p>
          <p className="text-xs text-gray-400 mt-1">Threshold: &lt;5%</p>
          {metrics.bounceRate > 5 && (
            <p className="text-xs text-red-500 mt-0.5 font-medium">Above threshold</p>
          )}
        </div>

        <div className="border border-gray-200 rounded-lg p-4 bg-white">
          <p className="text-sm text-gray-600 mb-2">Complaint Rate</p>
          <p
            className={`text-3xl font-bold ${
              metrics.complaintRate > 0.1 ? 'text-red-600' : 'text-green-600'
            }`}
          >
            {metrics.complaintRate.toFixed(3)}%
          </p>
          <p className="text-xs text-gray-400 mt-1">Threshold: &lt;0.1%</p>
          {metrics.complaintRate > 0.1 && (
            <p className="text-xs text-red-500 mt-0.5 font-medium">Above threshold</p>
          )}
        </div>

        <div className="border border-gray-200 rounded-lg p-4 bg-white">
          <p className="text-sm text-gray-600 mb-2">Sender Score</p>
          <p
            className={`text-3xl font-bold ${
              metrics.senderScore === 0
                ? 'text-gray-400'
                : metrics.senderScore < 80
                ? 'text-red-600'
                : 'text-green-600'
            }`}
          >
            {metrics.senderScore === 0 ? 'N/A' : metrics.senderScore}
          </p>
          <p className="text-xs text-gray-400 mt-1">Target: &gt;80</p>
          {metrics.senderScore === 0 && (
            <p className="text-xs text-gray-400 mt-0.5">API unavailable</p>
          )}
        </div>

        <div className="border border-gray-200 rounded-lg p-4 bg-white">
          <p className="text-sm text-gray-600 mb-2">Open Rate</p>
          <p className="text-3xl font-bold text-blue-600">{metrics.openRate.toFixed(1)}%</p>
          <p className="text-xs text-gray-400 mt-1">Industry avg: 20-25%</p>
        </div>
      </div>

      {/* Alerts section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-gray-900">Alerts</h2>
            {unacknowledgedCount > 0 && (
              <span className="bg-red-100 text-red-700 text-sm px-2 py-0.5 rounded-full font-medium">
                {unacknowledgedCount} unacknowledged
              </span>
            )}
          </div>
          <div className="flex gap-2">
            {unacknowledgedCount > 1 && (
              <button
                onClick={acknowledgeAll}
                className="text-xs font-medium px-3 py-1.5 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 transition-colors"
              >
                Acknowledge All
              </button>
            )}
            <button
              onClick={() => setShowAcknowledged((v) => !v)}
              className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                showAcknowledged
                  ? 'bg-gray-100 text-gray-700 border-gray-300'
                  : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {showAcknowledged ? 'Hide Acknowledged' : 'Show Acknowledged'}
            </button>
          </div>
        </div>

        {alertsLoading ? (
          <div className="animate-pulse h-16 bg-gray-200 rounded" />
        ) : alerts.length === 0 ? (
          <div className="text-gray-500 text-sm py-4 border border-gray-200 rounded-lg text-center">
            No alerts — your email health looks good.
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.filter((a) => showAcknowledged || !a.acknowledged).map((alert) => {
              const steps = alertRemediation[alert.alertType];
              return (
                <div
                  key={alert.id}
                  className={`border rounded-lg p-4 ${
                    alert.acknowledged
                      ? 'border-gray-200 bg-gray-50 opacity-60'
                      : 'border-yellow-200 bg-yellow-50'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">
                        {alertTypeLabels[alert.alertType] ?? alert.alertType}
                      </p>
                      <p className="text-sm text-gray-700 mt-0.5">{alert.message}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(alert.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                    {!alert.acknowledged && (
                      <button
                        onClick={() => acknowledgeAlert(alert.id)}
                        className="text-xs text-blue-600 hover:text-blue-800 border border-blue-200 px-2 py-1 rounded ml-4 whitespace-nowrap shrink-0"
                      >
                        Acknowledge
                      </button>
                    )}
                  </div>
                  {steps && !alert.acknowledged && (
                    <div className="mt-3 pt-3 border-t border-yellow-200">
                      <p className="text-xs font-semibold text-gray-700 mb-1.5">Recommended Actions:</p>
                      <ul className="space-y-1">
                        {steps.map((step, i) => (
                          <li key={i} className="text-xs text-gray-600 flex items-start gap-1.5">
                            <span className="text-yellow-600 mt-0.5 shrink-0">&#x2022;</span>
                            {step}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
