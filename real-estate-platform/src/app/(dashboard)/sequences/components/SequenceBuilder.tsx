'use client';

import { useState } from 'react';

interface Step {
  type: 'EMAIL' | 'SMS' | 'WAIT';
  delayDays?: number;
  subject?: string;
  htmlContent?: string;
}

interface SequenceBuilderProps {
  initialSteps?: Step[];
  onSave: (steps: Step[]) => Promise<void>;
}

export function SequenceBuilder({ initialSteps = [], onSave }: SequenceBuilderProps) {
  const [steps, setSteps] = useState<Step[]>(initialSteps);
  const [loading, setLoading] = useState(false);

  const addStep = (type: Step['type']) => {
    const newStep: Step = { type };
    if (type === 'WAIT') newStep.delayDays = 3;
    if (type === 'EMAIL') {
      newStep.subject = 'Follow-up';
      newStep.htmlContent = '';
    }
    setSteps([...steps, newStep]);
  };

  const updateStep = (idx: number, updates: Partial<Step>) => {
    const updated = [...steps];
    updated[idx] = { ...updated[idx], ...updates };
    setSteps(updated);
  };

  const removeStep = (idx: number) => {
    setSteps(steps.filter((_, i) => i !== idx));
  };

  const moveStep = (idx: number, direction: 'up' | 'down') => {
    const newSteps = [...steps];
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= newSteps.length) return;
    [newSteps[idx], newSteps[targetIdx]] = [newSteps[targetIdx], newSteps[idx]];
    setSteps(newSteps);
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await onSave(steps);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {steps.length === 0 && (
        <div className="text-center py-6 border-2 border-dashed border-gray-200 rounded-lg text-gray-500 text-sm">
          No steps yet. Add an EMAIL, WAIT, or SMS step below.
        </div>
      )}

      {steps.map((step, idx) => (
        <div key={idx} className="border border-gray-200 rounded-lg p-4 bg-white space-y-3">
          <div className="flex justify-between items-center">
            <span className="font-semibold text-gray-900">
              Step {idx + 1} &mdash; {step.type}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => moveStep(idx, 'up')}
                disabled={idx === 0}
                className="text-gray-400 hover:text-gray-600 disabled:opacity-30 text-xs px-1"
                title="Move up"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => moveStep(idx, 'down')}
                disabled={idx === steps.length - 1}
                className="text-gray-400 hover:text-gray-600 disabled:opacity-30 text-xs px-1"
                title="Move down"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => removeStep(idx)}
                className="text-red-500 hover:text-red-700 text-sm ml-2"
              >
                Remove
              </button>
            </div>
          </div>

          {step.type === 'EMAIL' && (
            <div className="space-y-2">
              <div>
                <label className="text-sm text-gray-600">Email subject</label>
                <input
                  type="text"
                  value={step.subject ?? ''}
                  onChange={(e) => updateStep(idx, { subject: e.target.value })}
                  placeholder="Follow-up email subject"
                  className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-sm text-gray-600">Email body (HTML)</label>
                <textarea
                  value={step.htmlContent ?? ''}
                  onChange={(e) => updateStep(idx, { htmlContent: e.target.value })}
                  placeholder="<p>Hi, following up on our offer...</p>"
                  rows={3}
                  className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          {step.type === 'WAIT' && (
            <div>
              <label className="text-sm text-gray-600">Days to wait</label>
              <input
                type="number"
                value={step.delayDays ?? 1}
                onChange={(e) =>
                  updateStep(idx, { delayDays: Math.max(1, parseInt(e.target.value) || 1) })
                }
                min={1}
                max={365}
                className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {step.type === 'SMS' && (
            <div className="text-sm text-gray-500 italic">
              SMS steps are triggered automatically by the sequence executor.
            </div>
          )}
        </div>
      ))}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => addStep('EMAIL')}
          className="flex-1 border border-blue-500 text-blue-600 py-2 rounded-md hover:bg-blue-50 text-sm font-medium transition-colors"
        >
          + Email
        </button>
        <button
          type="button"
          onClick={() => addStep('WAIT')}
          className="flex-1 border border-gray-400 text-gray-600 py-2 rounded-md hover:bg-gray-50 text-sm font-medium transition-colors"
        >
          + Wait
        </button>
        <button
          type="button"
          onClick={() => addStep('SMS')}
          className="flex-1 border border-green-500 text-green-600 py-2 rounded-md hover:bg-green-50 text-sm font-medium transition-colors"
        >
          + SMS
        </button>
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={loading || steps.length === 0}
        className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
      >
        {loading ? 'Saving...' : 'Save Sequence'}
      </button>
    </div>
  );
}
