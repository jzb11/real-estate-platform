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

export default function MonitoringPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [healthStatus, setHealthStatus] = useState<string>('');
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [alertsLoading, setAlertsLoading] = useState(true);

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
        <div className="bg-red-100 text-red-800 p-4 rounded-md">
          Error loading monitoring metrics. Check your SendGrid configuration.
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
        <div className="flex items-center gap-3 mb-3">
          <h2 className="text-xl font-bold text-gray-900">Alerts</h2>
          {unacknowledgedCount > 0 && (
            <span className="bg-red-100 text-red-700 text-sm px-2 py-0.5 rounded-full font-medium">
              {unacknowledgedCount} unacknowledged
            </span>
          )}
        </div>

        {alertsLoading ? (
          <div className="animate-pulse h-16 bg-gray-200 rounded" />
        ) : alerts.length === 0 ? (
          <div className="text-gray-500 text-sm py-4 border border-gray-200 rounded-lg text-center">
            No alerts — your email health looks good.
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.map((alert) => (
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
                      className="text-xs text-blue-600 hover:text-blue-800 border border-blue-200 px-2 py-1 rounded ml-4 whitespace-nowrap"
                    >
                      Acknowledge
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
