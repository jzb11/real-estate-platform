export interface KbLink {
  title: string;
  slug: string;
}

export const CONTEXTUAL_KB_LINKS: Record<string, KbLink[]> = {
  'deal-detail': [
    { title: 'How to Calculate MAO (70% Rule)', slug: 'deal-analysis-70-percent-rule' },
    { title: 'Reading Property Distress Signals', slug: 'reading-distress-signals' },
  ],
  pipeline: [
    { title: 'Understanding Pipeline Stages', slug: 'deal-pipeline-stages' },
  ],
  import: [
    { title: 'Quick Start Guide', slug: 'platform-quick-start' },
  ],
};
