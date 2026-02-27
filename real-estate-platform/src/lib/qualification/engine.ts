import get from 'lodash/get';
import { evaluateOperator } from './operators';
import { evaluateAllCreativeFinanceRules } from './creativeFinance';
import type { CreativeFinanceRule } from './creativeFinance';
import type { CreativeFinanceType } from '@prisma/client';
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
 * 3. Standard SCORE_COMPONENT rules (ruleSubtype = null) accumulate their weights
 * 4. Creative finance rules (ruleSubtype != null) evaluated separately — +20 bonus per match
 * 5. Final score >= 50 → QUALIFIED, < 50 → ANALYZING
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
  // FILTER rules are always standard rules (ruleSubtype = null)
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
        creativeFinanceTypes: null,
      };
    }
  }

  // Accumulate standard SCORE_COMPONENT rules (non-CF rules: ruleSubtype is null/undefined)
  const standardScoreRules = enabledRules.filter(
    (r) => r.ruleType === 'SCORE_COMPONENT' && !r.ruleSubtype,
  );
  for (const rule of standardScoreRules) {
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

  // Evaluate creative finance rules (ruleSubtype != null) — +20 bonus per matched rule
  // Build typed CreativeFinanceRule objects from rules that have a non-null ruleSubtype
  const cfRules: CreativeFinanceRule[] = enabledRules
    .filter((r) => r.ruleType === 'SCORE_COMPONENT' && r.ruleSubtype != null)
    .map((r) => ({
      id: r.id,
      name: r.name,
      ruleSubtype: r.ruleSubtype as CreativeFinanceType,
      fieldName: r.fieldName,
      operator: r.operator,
      value: r.value,
      enabled: r.enabled,
    }));

  const cfEvaluation = evaluateAllCreativeFinanceRules(
    property as Record<string, unknown>,
    cfRules,
  );

  // Add CF bonus to score — stacks across multiple matched CF rules
  score += cfEvaluation.totalBonus;

  // Add CF rule results to breakdown for UI display
  for (const cfResult of cfEvaluation.results) {
    breakdown.push({
      ruleId: cfResult.ruleId,
      ruleName: cfResult.ruleName,
      result: cfResult.matched ? 'PASS' : 'FAIL',
      scored: cfResult.scoreBonus,
    });
  }

  const status = score >= 50 ? 'QUALIFIED' : 'ANALYZING';

  return {
    status,
    qualificationScore: score,
    ruleBreakdown: breakdown,
    creativeFinanceTypes: cfEvaluation.matched ? (cfEvaluation.matchedTypes as string[]) : null,
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
