import { CreativeFinanceType } from '@prisma/client';
import get from 'lodash/get';
import { evaluateOperator } from './operators';
import type { Operator } from './types';

/**
 * Human-readable descriptions for each creative finance deal type.
 * Used in rule explanations and pipeline badge tooltips.
 */
export const CREATIVE_FINANCE_DESCRIPTIONS: Record<CreativeFinanceType, string> = {
  SUBJECT_TO: 'Property with existing mortgage — buyer takes title subject to existing financing',
  SELLER_FINANCE: 'Owner willing to carry financing — seller acts as lender, no bank required',
  OWNER_OCCUPIED_VACATED: 'Owner-occupied or recently vacated — motivated seller, less competition',
  LEASE_OPTION: 'Property suitable for lease-option — rent with right to purchase later',
  BRRRR: 'Buy-Renovate-Rent-Refinance-Repeat — value-add rental play',
  WHOLESALE: 'High-discount wholesale — assign contract to end buyer',
  LAND_CONTRACT: 'Installment sale / land contract — seller retains title until payoff',
  RENT_TO_OWN: 'Rent-to-own / lease-purchase — tenant builds equity toward purchase',
};

/**
 * Result of evaluating a single creative finance rule against a property.
 */
export interface CreativeFinanceResult {
  ruleId: string;
  ruleName: string;
  type: CreativeFinanceType;
  matched: boolean;
  /** +20 score bonus when matched, 0 when not matched */
  scoreBonus: number;
  explanation: string;
}

/**
 * Aggregated result of all creative finance rules evaluated for a property.
 */
export interface CreativeFinanceEvaluation {
  /** True if at least one CF rule matched */
  matched: boolean;
  /** Array of CF types that matched (deduplicated) */
  matchedTypes: CreativeFinanceType[];
  /** Total score bonus to add to qualificationScore (+20 per matched rule) */
  totalBonus: number;
  /** Per-rule breakdown for debugging and UI display */
  results: CreativeFinanceResult[];
}

/**
 * Minimal shape of a QualificationRule needed by this module.
 * Avoids importing full Prisma types to keep engine pure.
 */
export interface CreativeFinanceRule {
  id: string;
  name: string;
  ruleSubtype: CreativeFinanceType;
  fieldName: string;
  operator: Operator;
  value: unknown;
  enabled: boolean;
}

/**
 * Evaluates a single creative finance rule against a property.
 *
 * Pure function — no side effects.
 * Returns null if the rule is not a creative finance rule (ruleSubtype is null).
 */
export function evaluateCreativeFinanceRule(
  property: Record<string, unknown>,
  rule: CreativeFinanceRule,
): CreativeFinanceResult {
  const fieldValue = get(property, rule.fieldName);
  let matched = false;

  try {
    matched = evaluateOperator(fieldValue, rule.operator, rule.value);
  } catch {
    // Evaluation errors are treated as non-match — rule condition not satisfied
    matched = false;
  }

  return {
    ruleId: rule.id,
    ruleName: rule.name,
    type: rule.ruleSubtype,
    matched,
    scoreBonus: matched ? 20 : 0,
    explanation: matched
      ? `Matched "${rule.name}": ${CREATIVE_FINANCE_DESCRIPTIONS[rule.ruleSubtype]}`
      : `Did not match "${rule.name}"`,
  };
}

/**
 * Evaluates all enabled creative finance rules against a property.
 *
 * Pure function — no side effects, no DB access.
 * Called by evaluateDeal() after standard FILTER/SCORE rules complete.
 *
 * Score bonus: +20 per matched CF rule (can stack if multiple rules match).
 * matchedTypes is deduplicated — same type from multiple rules counted once in the array.
 */
export function evaluateAllCreativeFinanceRules(
  property: Record<string, unknown>,
  rules: CreativeFinanceRule[],
): CreativeFinanceEvaluation {
  const enabledCFRules = rules.filter((r) => r.enabled);

  const results: CreativeFinanceResult[] = enabledCFRules.map((rule) =>
    evaluateCreativeFinanceRule(property, rule),
  );

  const matchedResults = results.filter((r) => r.matched);

  // Deduplicate matched types (multiple rules can have the same ruleSubtype)
  const matchedTypesSet = new Set<CreativeFinanceType>(matchedResults.map((r) => r.type));
  const matchedTypes = Array.from(matchedTypesSet);

  const totalBonus = matchedResults.reduce((sum, r) => sum + r.scoreBonus, 0);

  return {
    matched: matchedTypes.length > 0,
    matchedTypes,
    totalBonus,
    results,
  };
}
