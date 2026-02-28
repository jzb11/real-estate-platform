import { describe, it, expect } from 'vitest';
import {
  evaluateCreativeFinanceRule,
  evaluateAllCreativeFinanceRules,
  CREATIVE_FINANCE_DESCRIPTIONS,
  type CreativeFinanceRule,
} from '../creativeFinance';

const makeRule = (overrides: Partial<CreativeFinanceRule> = {}): CreativeFinanceRule => ({
  id: 'rule-1',
  name: 'Test Rule',
  ruleSubtype: 'SUBJECT_TO',
  fieldName: 'equityPercent',
  operator: 'GT',
  value: 30,
  enabled: true,
  ...overrides,
});

const makeProperty = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  equityPercent: 50,
  estimatedValue: 300000,
  debtOwed: 150000,
  interestRate: 4.5,
  distressSignals: { inForeclosure: false, preForeclosure: false },
  ...overrides,
});

describe('CREATIVE_FINANCE_DESCRIPTIONS', () => {
  it('has descriptions for all 8 creative finance types', () => {
    const types = [
      'SUBJECT_TO', 'SELLER_FINANCE', 'OWNER_OCCUPIED_VACATED',
      'LEASE_OPTION', 'BRRRR', 'WHOLESALE', 'LAND_CONTRACT', 'RENT_TO_OWN',
    ];
    for (const type of types) {
      expect(CREATIVE_FINANCE_DESCRIPTIONS[type as keyof typeof CREATIVE_FINANCE_DESCRIPTIONS]).toBeDefined();
    }
  });
});

describe('evaluateCreativeFinanceRule', () => {
  it('returns matched=true and +20 bonus when rule matches', () => {
    const rule = makeRule({ operator: 'GT', value: 30 });
    const property = makeProperty({ equityPercent: 50 });

    const result = evaluateCreativeFinanceRule(property, rule);

    expect(result.matched).toBe(true);
    expect(result.scoreBonus).toBe(20);
    expect(result.ruleId).toBe('rule-1');
    expect(result.type).toBe('SUBJECT_TO');
  });

  it('returns matched=false and 0 bonus when rule does not match', () => {
    const rule = makeRule({ operator: 'GT', value: 80 });
    const property = makeProperty({ equityPercent: 50 });

    const result = evaluateCreativeFinanceRule(property, rule);

    expect(result.matched).toBe(false);
    expect(result.scoreBonus).toBe(0);
  });

  it('treats evaluation errors as non-match', () => {
    const rule = makeRule({ fieldName: 'nonExistentField', operator: 'GT', value: 10 });
    const property = makeProperty();

    const result = evaluateCreativeFinanceRule(property, rule);

    expect(result.matched).toBe(false);
    expect(result.scoreBonus).toBe(0);
  });

  it('includes explanation with rule name', () => {
    const rule = makeRule({ name: 'High Equity Subject-To' });
    const property = makeProperty({ equityPercent: 50 });

    const result = evaluateCreativeFinanceRule(property, rule);

    expect(result.explanation).toContain('High Equity Subject-To');
  });
});

describe('evaluateAllCreativeFinanceRules', () => {
  it('returns matched=false when no rules match', () => {
    const rules = [
      makeRule({ id: 'r1', operator: 'GT', value: 90 }),
      makeRule({ id: 'r2', operator: 'LT', value: 10 }),
    ];
    const property = makeProperty({ equityPercent: 50 });

    const result = evaluateAllCreativeFinanceRules(property, rules);

    expect(result.matched).toBe(false);
    expect(result.matchedTypes).toHaveLength(0);
    expect(result.totalBonus).toBe(0);
  });

  it('accumulates bonus from multiple matching rules', () => {
    const rules = [
      makeRule({ id: 'r1', ruleSubtype: 'SUBJECT_TO', operator: 'GT', value: 30 }),
      makeRule({ id: 'r2', ruleSubtype: 'SELLER_FINANCE', fieldName: 'interestRate', operator: 'GT', value: 3 }),
    ];
    const property = makeProperty({ equityPercent: 50, interestRate: 5 });

    const result = evaluateAllCreativeFinanceRules(property, rules);

    expect(result.matched).toBe(true);
    expect(result.matchedTypes).toContain('SUBJECT_TO');
    expect(result.matchedTypes).toContain('SELLER_FINANCE');
    expect(result.totalBonus).toBe(40); // 20 + 20
    expect(result.results).toHaveLength(2);
  });

  it('skips disabled rules', () => {
    const rules = [
      makeRule({ id: 'r1', enabled: false, operator: 'GT', value: 30 }),
    ];
    const property = makeProperty({ equityPercent: 50 });

    const result = evaluateAllCreativeFinanceRules(property, rules);

    expect(result.matched).toBe(false);
    expect(result.results).toHaveLength(0);
  });

  it('deduplicates matched types', () => {
    const rules = [
      makeRule({ id: 'r1', ruleSubtype: 'SUBJECT_TO', fieldName: 'equityPercent', operator: 'GT', value: 30 }),
      makeRule({ id: 'r2', ruleSubtype: 'SUBJECT_TO', fieldName: 'interestRate', operator: 'GT', value: 3 }),
    ];
    const property = makeProperty({ equityPercent: 50, interestRate: 5 });

    const result = evaluateAllCreativeFinanceRules(property, rules);

    expect(result.matchedTypes).toHaveLength(1);
    expect(result.matchedTypes[0]).toBe('SUBJECT_TO');
    expect(result.totalBonus).toBe(40); // Still 20 per rule
  });

  it('handles empty rules array', () => {
    const result = evaluateAllCreativeFinanceRules(makeProperty(), []);

    expect(result.matched).toBe(false);
    expect(result.matchedTypes).toHaveLength(0);
    expect(result.totalBonus).toBe(0);
    expect(result.results).toHaveLength(0);
  });
});
