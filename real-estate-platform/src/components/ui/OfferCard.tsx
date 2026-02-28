'use client';

import { OfferedDeal } from '@prisma/client';

const statusColors: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-800',
  SENT: 'bg-blue-100 text-blue-800',
  OPENED: 'bg-green-100 text-green-800',
  CLICKED: 'bg-green-100 text-green-800',
  BOUNCED: 'bg-red-100 text-red-800',
  COMPLAINED: 'bg-red-100 text-red-800',
  UNSUBSCRIBED: 'bg-gray-100 text-gray-800',
};

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function timeSince(date: Date | string): string {
  const ms = Date.now() - new Date(date).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

interface OfferCardProps {
  offer: OfferedDeal;
  onResend?: (offer: OfferedDeal) => void;
}

export function OfferCard({ offer, onResend }: OfferCardProps) {
  // Engagement milestones
  const milestones = [
    { label: 'Sent', done: true, time: offer.sentAt },
    { label: 'Opened', done: !!offer.emailOpenedAt, time: offer.emailOpenedAt },
    { label: 'Clicked', done: !!offer.linkClickedAt, time: offer.linkClickedAt },
  ];

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm hover:border-gray-300 transition-colors">
      <div className="flex justify-between items-start mb-2">
        <div>
          <p className="font-semibold text-gray-900">{offer.sentToEmail}</p>
          {offer.recipientName && (
            <p className="text-xs text-gray-500">{offer.recipientName}</p>
          )}
        </div>
        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusColors[offer.status] ?? 'bg-gray-100 text-gray-800'}`}>
          {offer.status}
        </span>
      </div>

      {/* Engagement timeline bar */}
      {!offer.bouncedAt && (
        <div className="flex items-center gap-1 my-3">
          {milestones.map((m, i) => (
            <div key={m.label} className="flex items-center">
              <div className={`flex items-center gap-1 ${m.done ? 'text-green-600' : 'text-gray-300'}`}>
                <div className={`h-2 w-2 rounded-full ${m.done ? 'bg-green-500' : 'bg-gray-200'}`} />
                <span className="text-xs font-medium">{m.label}</span>
                {m.done && m.time && (
                  <span className="text-xs text-gray-400">({timeSince(m.time)})</span>
                )}
              </div>
              {i < milestones.length - 1 && (
                <div className={`h-px w-6 mx-1 ${milestones[i + 1].done ? 'bg-green-400' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Bounce info */}
      {offer.bouncedAt && (
        <div className="mt-2 flex items-center justify-between">
          <div className="text-xs text-red-600">
            Bounced: {formatDate(offer.bouncedAt)}
            {offer.bouncetype ? ` (${offer.bouncetype})` : ''}
          </div>
          {onResend && (
            <button
              onClick={() => onResend(offer)}
              className="text-xs font-medium text-blue-600 hover:text-blue-800 border border-blue-200 rounded px-2 py-1 hover:bg-blue-50 transition-colors"
            >
              Resend
            </button>
          )}
        </div>
      )}

      {/* Sent timestamp */}
      <p className="text-xs text-gray-400 mt-2">
        Sent {formatDate(offer.sentAt)}
      </p>
    </div>
  );
}
