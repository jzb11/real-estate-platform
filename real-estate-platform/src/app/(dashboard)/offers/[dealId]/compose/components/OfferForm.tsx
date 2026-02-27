'use client';

import { useState } from 'react';
import { Deal, Property, FollowUpSequence } from '@prisma/client';
import { calculateMAO } from '@/lib/qualification/engine';

interface OfferFormProps {
  deal: Deal & { property: Property };
  sequences: FollowUpSequence[];
  onSubmit: (data: {
    dealId: string;
    recipientEmail: string;
    recipientName?: string;
    repairCosts: number;
    sequenceId?: string;
  }) => Promise<void>;
  loading?: boolean;
}

export function OfferForm({ deal, sequences, onSubmit, loading }: OfferFormProps) {
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [repairCosts, setRepairCosts] = useState(0);
  const [sequenceId, setSequenceId] = useState('');

  const maoResult = calculateMAO(deal.property.estimatedValue ?? 0, repairCosts);
  const offerPrice = Math.round(maoResult.mao * 0.95);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit({
      dealId: deal.id,
      recipientEmail,
      recipientName: recipientName || undefined,
      repairCosts,
      sequenceId: sequenceId || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">Property</label>
        <p className="text-sm text-gray-600 mt-1">{deal.property.address}</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Recipient Email</label>
        <input
          type="email"
          value={recipientEmail}
          onChange={(e) => setRecipientEmail(e.target.value)}
          required
          placeholder="owner@example.com"
          className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Recipient Name (optional)</label>
        <input
          type="text"
          value={recipientName}
          onChange={(e) => setRecipientName(e.target.value)}
          placeholder="John Smith"
          className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Estimated Repair Costs ($)</label>
        <input
          type="number"
          value={repairCosts}
          onChange={(e) => setRepairCosts(parseFloat(e.target.value) || 0)}
          min={0}
          step={1000}
          className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="bg-gray-50 border border-gray-200 p-4 rounded-md space-y-1 text-sm">
        <p className="text-gray-600">
          Estimated ARV:{' '}
          <span className="font-medium text-gray-900">
            ${(deal.property.estimatedValue ?? 0).toLocaleString()}
          </span>
        </p>
        <p className="text-gray-600">
          MAO (70% Rule):{' '}
          <span className="font-medium text-gray-900">${maoResult.mao.toLocaleString()}</span>
        </p>
        <p className="text-gray-600 font-medium">
          Our Offer (95% MAO):{' '}
          <span className="text-blue-700 font-bold">${offerPrice.toLocaleString()}</span>
        </p>
        <p className="text-xs text-gray-400 mt-1">{maoResult.formula}</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Follow-up Sequence (optional)</label>
        <select
          value={sequenceId}
          onChange={(e) => setSequenceId(e.target.value)}
          className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">None — send offer only</option>
          {sequences.map((seq) => (
            <option key={seq.id} value={seq.id}>
              {seq.name}
            </option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        disabled={loading || !recipientEmail}
        className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
      >
        {loading ? 'Sending...' : 'Send Offer'}
      </button>
    </form>
  );
}
