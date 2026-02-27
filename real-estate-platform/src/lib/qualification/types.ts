// Operator types — mirrors the Prisma Operator enum
export type Operator =
  | 'GT'
  | 'LT'
  | 'EQ'
  | 'IN'
  | 'CONTAINS'
  | 'RANGE'
  | 'NOT_CONTAINS';

// Rule type — mirrors Prisma RuleType enum
export type RuleType = 'FILTER' | 'SCORE_COMPONENT';

// A single qualification rule (mirrors Prisma QualificationRule shape, without relations)
export interface QualificationRule {
  id: string;
  name: string;
  description: string | null;
  ruleType: RuleType;
  fieldName: string;
  operator: Operator;
  value: unknown;
  weight: number;
  /** Creative finance deal type — null means this is a standard FILTER/SCORE rule */
  ruleSubtype?: string | null;
  enabled: boolean;
}

// The property data structure used by the engine (flexible for CSV-sourced data)
export interface PropertyForEvaluation {
  estimatedValue?: number | null;
  lastSalePrice?: number | null;
  taxAssessedValue?: number | null;
  distressSignals?: Record<string, unknown>;
  daysOnMarket?: number | null;
  ownerOccupied?: boolean | null;
  state?: string | null;
  city?: string | null;
  zip?: string | null;
  propertyType?: string | null;
  rawData?: Record<string, unknown>;
  [key: string]: unknown;
}

// Result of evaluating a single rule
export interface RuleBreakdownEntry {
  ruleId: string;
  ruleName: string;
  result: 'PASS' | 'FAIL';
  scored: number;
}

// Final result of evaluating all rules against a deal
export interface EvaluationResult {
  status: 'QUALIFIED' | 'ANALYZING' | 'REJECTED';
  qualificationScore: number;
  ruleBreakdown: RuleBreakdownEntry[];
  /** Creative finance deal types matched (null if no CF rules matched) */
  creativeFinanceTypes: string[] | null;
}

// Input for MAO calculation
export interface MAOInput {
  arv: number;
  repairCosts: number;
}

// Result of MAO calculation
export interface MAOResult {
  mao: number;
  formula: string;
}

// Range value type for RANGE operator
export interface RangeValue {
  min: number;
  max: number;
}
