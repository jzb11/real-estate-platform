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

interface PreviewDraft {
  subject: string;
  html: string;
  offerData: {
    propertyAddress: string;
    estimatedValue: number;
    repairCosts: number;
    mao: number;
    maoFormula: string;
    offerPrice: number;
  };
}

export function OfferForm({ deal, sequences, onSubmit, loading }: OfferFormProps) {
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [repairCosts, setRepairCosts] = useState(0);
  const [sequenceId, setSequenceId] = useState('');

  // Preview state
  const [preview, setPreview] = useState<PreviewDraft | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  const maoResult = calculateMAO(deal.property.estimatedValue ?? 0, repairCosts);
  const offerPrice = Math.round(maoResult.mao * 0.95);

  async function handlePreview() {
    setPreviewLoading(true);
    setPreviewError('');
    try {
      const res = await fetch('/api/offers/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dealId: deal.id,
          recipientEmail: recipientEmail || 'preview@example.com',
          recipientName: recipientName || undefined,
          repairCosts,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Preview failed' }));
        setPreviewError(err.error ?? 'Failed to generate preview');
        return;
      }
      const data = await res.json();
      setPreview(data.draft);
      setShowPreview(true);
    } catch {
      setPreviewError('Network error');
    } finally {
      setPreviewLoading(false);
    }
  }

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
    <>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Property</label>
          <p className="text-sm text-gray-600 mt-1">
            {deal.property.address}, {deal.property.city}, {deal.property.state}
          </p>
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

        <div className="flex gap-3">
          <button
            type="button"
            onClick={handlePreview}
            disabled={previewLoading}
            className="flex-1 border border-blue-200 bg-blue-50 text-blue-700 py-2 px-4 rounded-md hover:bg-blue-100 disabled:opacity-50 font-medium transition-colors"
          >
            {previewLoading ? 'Generating...' : 'Preview Email'}
          </button>
          <button
            type="submit"
            disabled={loading || !recipientEmail}
            className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
          >
            {loading ? 'Sending...' : 'Send Offer'}
          </button>
        </div>
      </form>

      {previewError && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {previewError}
        </div>
      )}

      {/* Preview Modal */}
      {showPreview && preview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Email Preview</h2>
                <p className="text-xs text-gray-500 mt-0.5">Subject: {preview.subject}</p>
              </div>
              <button
                onClick={() => setShowPreview(false)}
                className="rounded-lg p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Offer summary bar */}
            <div className="bg-gray-50 border-b border-gray-100 px-6 py-3 flex flex-wrap gap-4 text-xs">
              <span className="text-gray-500">
                ARV: <span className="font-semibold text-gray-900">${preview.offerData.estimatedValue.toLocaleString()}</span>
              </span>
              <span className="text-gray-500">
                Repairs: <span className="font-semibold text-gray-900">${preview.offerData.repairCosts.toLocaleString()}</span>
              </span>
              <span className="text-gray-500">
                MAO: <span className="font-semibold text-gray-900">${preview.offerData.mao.toLocaleString()}</span>
              </span>
              <span className="text-blue-600 font-semibold">
                Offer: ${preview.offerData.offerPrice.toLocaleString()}
              </span>
            </div>

            {/* Email HTML preview */}
            <div className="flex-1 overflow-auto p-6">
              <div
                className="prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: preview.html }}
              />
            </div>

            <div className="border-t border-gray-100 px-6 py-4 flex justify-end gap-3">
              <button
                onClick={() => setShowPreview(false)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
