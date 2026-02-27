import get from 'lodash/get';
import { evaluateOperator } from './operators';
import type {
  QualificationRule,
  PropertyForEvaluation,
  EvaluationResult,
  RuleBreakdownEntry,
  MAOResult,
} from './types';

/**
 * Evaluates a deal against a set of qualification rules.
 *
 * Execution order:
 * 1. Disabled rules are skipped entirely
 * 2. FILTER rules are evaluated first — first failure causes immediate REJECTED
 * 3. SCORE_COMPONENT rules accumulate their weights
 * 4. Final score >= 50 → QUALIFIED, < 50 → ANALYZING
 *
 * Pure function — no side effects, no DB access.
 * The caller (qualify API route) is responsible for persisting results.
 */
export function evaluateDeal(
  property: PropertyForEvaluation,
  rules: QualificationRule[],
): EvaluationResult {
  const enabledRules = rules.filter((rule) => rule.enabled);
  const breakdown: RuleBreakdownEntry[] = [];
  let score = 0;

  // Evaluate FILTER rules first — short-circuit on first failure
  const filterRules = enabledRules.filter((r) => r.ruleType === 'FILTER');
  for (const rule of filterRules) {
    const fieldValue = get(property, rule.fieldName);
    const passed = evaluateOperator(fieldValue, rule.operator, rule.value);

    breakdown.push({
      ruleId: rule.id,
      ruleName: rule.name,
      result: passed ? 'PASS' : 'FAIL',
      scored: 0,
    });

    if (!passed) {
      return {
        status: 'REJECTED',
        qualificationScore: 0,
        ruleBreakdown: breakdown,
      };
    }
  }

  // Accumulate SCORE_COMPONENT rules
  const scoreRules = enabledRules.filter((r) => r.ruleType === 'SCORE_COMPONENT');
  for (const rule of scoreRules) {
    const fieldValue = get(property, rule.fieldName);
    const passed = evaluateOperator(fieldValue, rule.operator, rule.value);
    const awarded = passed ? rule.weight : 0;

    score += awarded;

    breakdown.push({
      ruleId: rule.id,
      ruleName: rule.name,
      result: passed ? 'PASS' : 'FAIL',
      scored: awarded,
    });
  }

  const status = score >= 50 ? 'QUALIFIED' : 'ANALYZING';

  return {
    status,
    qualificationScore: score,
    ruleBreakdown: breakdown,
  };
}

/**
 * Calculates the Maximum Allowable Offer (MAO) using the 70% rule.
 *
 * Formula: MAO = (ARV × 0.70) − repair costs
 *
 * @param arv - After Repair Value (estimated value after repairs)
 * @param repairCosts - Estimated repair costs
 * @returns { mao: number, formula: string }
 */
export function calculateMAO(arv: number, repairCosts: number): MAOResult {
  const mao = arv * 0.70 - repairCosts;
  const formula = `(${arv} × 0.70) − ${repairCosts}`;

  return { mao, formula };
}
