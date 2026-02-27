'use client';

interface DataFreshnessAlertProps {
  dataFreshnessDate: Date | string;
  compact?: boolean;
}

function getAgeInDays(date: Date | string): number {
  const d = typeof date === 'string' ? new Date(date) : date;
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
}

export default function DataFreshnessAlert({
  dataFreshnessDate,
  compact = false,
}: DataFreshnessAlertProps) {
  const ageDays = getAgeInDays(dataFreshnessDate);

  if (ageDays < 7) {
    if (compact) return null;
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
        <span className="h-1.5 w-1.5 rounded-full bg-green-500"></span>
        Fresh
      </span>
    );
  }

  if (ageDays >= 7 && ageDays <= 14) {
    return (
      <div
        className={`rounded border border-yellow-400 bg-yellow-50 text-yellow-800 ${
          compact ? 'px-2 py-1 text-xs' : 'px-3 py-2 text-sm'
        }`}
      >
        <span className="font-medium">Data is {ageDays} days old</span>
        {!compact && <span className="ml-1 text-yellow-700">— review before making decisions</span>}
      </div>
    );
  }

  // > 14 days — stale
  return (
    <div
      className={`rounded border border-orange-400 bg-orange-50 text-orange-800 ${
        compact ? 'px-2 py-1 text-xs' : 'px-3 py-2 text-sm'
      }`}
    >
      <span className="font-medium">Data is stale ({ageDays} days old)</span>
      {!compact && (
        <span className="ml-1 text-orange-700">— verify before making offer</span>
      )}
    </div>
  );
}
