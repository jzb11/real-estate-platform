import { describe, it, expect } from 'vitest';
import { evaluateDeal, calculateMAO } from '../engine';
import type { QualificationRule, PropertyForEvaluation } from '../types';

// Helper to build a rule with defaults
function makeRule(overrides: Partial<QualificationRule>): QualificationRule {
  return {
    id: 'rule-1',
    name: 'Test Rule',
    description: null,
    ruleType: 'FILTER',
    fieldName: 'estimatedValue',
    operator: 'GT',
    value: 50000,
    weight: 0,
    enabled: true,
    ...overrides,
  };
}

describe('evaluateDeal', () => {
  describe('Case 1: FILTER rule fails → immediate REJECTED', () => {
    it('returns REJECTED with score 0 when FILTER rule fails', () => {
      const property: PropertyForEvaluation = { estimatedValue: 30000 };
      const rules: QualificationRule[] = [
        makeRule({
          id: 'rule-1',
          ruleType: 'FILTER',
          fieldName: 'estimatedValue',
          operator: 'GT',
          value: 50000,
          weight: 0,
        }),
      ];

      const result = evaluateDeal(property, rules);

      expect(result.status).toBe('REJECTED');
      expect(result.qualificationScore).toBe(0);
      expect(result.ruleBreakdown).toHaveLength(1);
      expect(result.ruleBreakdown[0].ruleId).toBe('rule-1');
      expect(result.ruleBreakdown[0].result).toBe('FAIL');
      expect(result.ruleBreakdown[0].scored).toBe(0);
    });

    it('short-circuits on first FILTER failure, does not evaluate remaining rules', () => {
      const property: PropertyForEvaluation = { estimatedValue: 30000 };
      const rules: QualificationRule[] = [
        makeRule({ id: 'rule-1', ruleType: 'FILTER', fieldName: 'estimatedValue', operator: 'GT', value: 50000, weight: 0 }),
        makeRule({ id: 'rule-2', ruleType: 'SCORE_COMPONENT', fieldName: 'estimatedValue', operator: 'GT', value: 10000, weight: 30 }),
      ];

      const result = evaluateDeal(property, rules);

      expect(result.status).toBe('REJECTED');
      expect(result.ruleBreakdown).toHaveLength(1);
      expect(result.ruleBreakdown[0].ruleId).toBe('rule-1');
    });
  });

  describe('Case 2: All FILTER rules pass, scoring accumulates (below threshold)', () => {
    it('returns ANALYZING when score is below 50', () => {
      const property: PropertyForEvaluation = {
        estimatedValue: 150000,
        distressSignals: { foreclosure: true },
        ownerOccupied: false,
      };
      const rules: QualificationRule[] = [
        makeRule({ id: 'rule-1', ruleType: 'FILTER', fieldName: 'estimatedValue', operator: 'GT', value: 50000, weight: 0 }),
        makeRule({ id: 'rule-2', ruleType: 'SCORE_COMPONENT', fieldName: 'distressSignals', operator: 'CONTAINS', value: 'foreclosure', weight: 25 }),
        makeRule({ id: 'rule-3', ruleType: 'SCORE_COMPONENT', fieldName: 'ownerOccupied', operator: 'EQ', value: false, weight: 15 }),
      ];

      const result = evaluateDeal(property, rules);

      expect(result.status).toBe('ANALYZING');
      expect(result.qualificationScore).toBe(40);
      expect(result.ruleBreakdown).toHaveLength(3);
    });
  });

  describe('Case 3: Score >= 50 → QUALIFIED', () => {
    it('returns QUALIFIED when combined score is >= 50', () => {
      const property: PropertyForEvaluation = {
        estimatedValue: 200000,
        distressSignals: { foreclosure: true },
        daysOnMarket: 75,
        ownerOccupied: false,
      };
      const rules: QualificationRule[] = [
        makeRule({ id: 'rule-1', ruleType: 'FILTER', fieldName: 'estimatedValue', operator: 'GT', value: 50000, weight: 0 }),
        makeRule({ id: 'rule-2', ruleType: 'SCORE_COMPONENT', fieldName: 'distressSignals', operator: 'CONTAINS', value: 'foreclosure', weight: 25 }),
        makeRule({ id: 'rule-3', ruleType: 'SCORE_COMPONENT', fieldName: 'daysOnMarket', operator: 'GT', value: 60, weight: 20 }),
        makeRule({ id: 'rule-4', ruleType: 'SCORE_COMPONENT', fieldName: 'ownerOccupied', operator: 'EQ', value: false, weight: 15 }),
      ];

      const result = evaluateDeal(property, rules);

      expect(result.status).toBe('QUALIFIED');
      expect(result.qualificationScore).toBe(60);
    });

    it('returns QUALIFIED with exactly 50 score', () => {
      const property: PropertyForEvaluation = { estimatedValue: 100000, daysOnMarket: 70 };
      const rules: QualificationRule[] = [
        makeRule({ id: 'rule-1', ruleType: 'SCORE_COMPONENT', fieldName: 'estimatedValue', operator: 'GT', value: 50000, weight: 30 }),
        makeRule({ id: 'rule-2', ruleType: 'SCORE_COMPONENT', fieldName: 'daysOnMarket', operator: 'GT', value: 60, weight: 20 }),
      ];

      const result = evaluateDeal(property, rules);

      expect(result.status).toBe('QUALIFIED');
      expect(result.qualificationScore).toBe(50);
    });
  });

  describe('Case 4: Disabled rules are skipped', () => {
    it('does not evaluate disabled rules, does not include them in breakdown', () => {
      const property: PropertyForEvaluation = { estimatedValue: 30000 };
      const rules: QualificationRule[] = [
        makeRule({ id: 'rule-1', ruleType: 'FILTER', fieldName: 'estimatedValue', operator: 'GT', value: 50000, weight: 0, enabled: false }),
      ];

      const result = evaluateDeal(property, rules);

      // Disabled FILTER rule should not cause REJECTED
      expect(result.status).not.toBe('REJECTED');
      expect(result.ruleBreakdown).toHaveLength(0);
    });

    it('skips disabled SCORE_COMPONENT rules in accumulation', () => {
      const property: PropertyForEvaluation = { estimatedValue: 200000, daysOnMarket: 75 };
      const rules: QualificationRule[] = [
        makeRule({ id: 'rule-1', ruleType: 'SCORE_COMPONENT', fieldName: 'estimatedValue', operator: 'GT', value: 50000, weight: 30, enabled: false }),
        makeRule({ id: 'rule-2', ruleType: 'SCORE_COMPONENT', fieldName: 'daysOnMarket', operator: 'GT', value: 60, weight: 20, enabled: true }),
      ];

      const result = evaluateDeal(property, rules);

      expect(result.qualificationScore).toBe(20); // only enabled rule scored
      expect(result.ruleBreakdown).toHaveLength(1);
    });
  });

  describe('Case 5: Nested field access via dot notation', () => {
    it('evaluates rules using dot notation for nested properties', () => {
      const property: PropertyForEvaluation = {
        rawData: { mortgageRate: 4.5 },
      };
      const rules: QualificationRule[] = [
        makeRule({ id: 'rule-1', ruleType: 'FILTER', fieldName: 'rawData.mortgageRate', operator: 'LT', value: 5 }),
      ];

      const result = evaluateDeal(property, rules);

      // FILTER passes because 4.5 < 5
      expect(result.status).not.toBe('REJECTED');
    });

    it('rejects when nested field fails FILTER rule', () => {
      const property: PropertyForEvaluation = {
        rawData: { mortgageRate: 6.5 },
      };
      const rules: QualificationRule[] = [
        makeRule({ id: 'rule-1', ruleType: 'FILTER', fieldName: 'rawData.mortgageRate', operator: 'LT', value: 5 }),
      ];

      const result = evaluateDeal(property, rules);

      expect(result.status).toBe('REJECTED');
    });
  });

  describe('Rule breakdown details', () => {
    it('includes PASS result and correct score for passing SCORE_COMPONENT', () => {
      const property: PropertyForEvaluation = { estimatedValue: 200000 };
      const rules: QualificationRule[] = [
        makeRule({ id: 'rule-1', ruleType: 'SCORE_COMPONENT', fieldName: 'estimatedValue', operator: 'GT', value: 50000, weight: 25 }),
      ];

      const result = evaluateDeal(property, rules);

      expect(result.ruleBreakdown[0].ruleId).toBe('rule-1');
      expect(result.ruleBreakdown[0].result).toBe('PASS');
      expect(result.ruleBreakdown[0].scored).toBe(25);
    });

    it('includes FAIL result and 0 score for failing SCORE_COMPONENT', () => {
      const property: PropertyForEvaluation = { estimatedValue: 10000 };
      const rules: QualificationRule[] = [
        makeRule({ id: 'rule-1', ruleType: 'SCORE_COMPONENT', fieldName: 'estimatedValue', operator: 'GT', value: 50000, weight: 25 }),
      ];

      const result = evaluateDeal(property, rules);

      expect(result.ruleBreakdown[0].result).toBe('FAIL');
      expect(result.ruleBreakdown[0].scored).toBe(0);
    });

    it('returns ANALYZING with 0 score when no rules provided', () => {
      const property: PropertyForEvaluation = { estimatedValue: 200000 };
      const result = evaluateDeal(property, []);

      expect(result.status).toBe('ANALYZING');
      expect(result.qualificationScore).toBe(0);
      expect(result.ruleBreakdown).toHaveLength(0);
    });
  });
});

describe('calculateMAO', () => {
  it('returns correct MAO using 70% rule formula', () => {
    const result = calculateMAO(200000, 50000);

    expect(result.mao).toBe(90000); // (200000 * 0.70) - 50000 = 140000 - 50000 = 90000
    expect(result.formula).toBe('(200000 × 0.70) − 50000');
  });

  it('handles zero repair costs', () => {
    const result = calculateMAO(100000, 0);

    expect(result.mao).toBe(70000);
    expect(result.formula).toBe('(100000 × 0.70) − 0');
  });

  it('handles high repair costs that result in negative MAO', () => {
    const result = calculateMAO(100000, 80000);

    expect(result.mao).toBe(-10000); // 70000 - 80000
    expect(result.formula).toBe('(100000 × 0.70) − 80000');
  });

  it('formats formula string correctly', () => {
    const result = calculateMAO(150000, 30000);

    expect(result.formula).toBe('(150000 × 0.70) − 30000');
  });
});
