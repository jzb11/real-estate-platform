'use client';

interface Step {
  type: 'EMAIL' | 'SMS' | 'WAIT';
  delayDays?: number;
  subject?: string;
}

const stepTypeColors: Record<string, string> = {
  EMAIL: 'bg-blue-600',
  SMS: 'bg-green-600',
  WAIT: 'bg-gray-400',
};

const stepTypeLabels: Record<string, string> = {
  EMAIL: 'Email',
  SMS: 'SMS',
  WAIT: 'Wait',
};

export function SequenceTimeline({ steps }: { steps: Step[] }) {
  if (!steps || steps.length === 0) {
    return (
      <div className="text-gray-500 text-sm py-4 text-center">
        No steps yet. Use the editor to add steps.
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {steps.map((step, idx) => (
        <div key={idx} className="flex gap-4">
          <div className="flex flex-col items-center">
            <div
              className={`w-8 h-8 rounded-full ${stepTypeColors[step.type] ?? 'bg-gray-400'} text-white flex items-center justify-center text-sm font-bold shrink-0`}
            >
              {idx + 1}
            </div>
            {idx < steps.length - 1 && (
              <div className="w-0.5 h-10 bg-gray-200 my-1" />
            )}
          </div>
          <div className="flex-1 pt-1 pb-4">
            <p className="font-semibold text-gray-900">
              {stepTypeLabels[step.type] ?? step.type} Step
            </p>
            {step.type === 'WAIT' && step.delayDays != null && (
              <p className="text-sm text-gray-600">
                Wait {step.delayDays} day{step.delayDays !== 1 ? 's' : ''}
              </p>
            )}
            {step.type === 'EMAIL' && (
              <p className="text-sm text-gray-600">{step.subject ?? 'Follow-up email'}</p>
            )}
            {step.type === 'SMS' && (
              <p className="text-sm text-gray-600">Send SMS message</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
