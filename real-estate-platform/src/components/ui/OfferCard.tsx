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

export function OfferCard({ offer }: { offer: OfferedDeal }) {
  return (
    <div className="border rounded-lg p-4 bg-white shadow-sm">
      <div className="flex justify-between items-start mb-2">
        <div className="font-semibold">{offer.sentToEmail}</div>
        <span className={`px-2 py-1 rounded text-sm ${statusColors[offer.status] ?? 'bg-gray-100 text-gray-800'}`}>
          {offer.status}
        </span>
      </div>
      {offer.recipientName && (
        <p className="text-sm text-gray-600 mb-2">{offer.recipientName}</p>
      )}
      <div className="text-xs text-gray-500 space-y-1">
        <p>Sent: {formatDate(offer.sentAt)}</p>
        {offer.emailOpenedAt && (
          <p>Opened: {formatDate(offer.emailOpenedAt)}</p>
        )}
        {offer.linkClickedAt && (
          <p>Clicked: {formatDate(offer.linkClickedAt)}</p>
        )}
        {offer.bouncedAt && (
          <p>
            Bounced: {formatDate(offer.bouncedAt)}
            {offer.bouncetype ? ` (${offer.bouncetype})` : ''}
          </p>
        )}
      </div>
    </div>
  );
}
