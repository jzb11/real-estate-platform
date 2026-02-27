import { describe, it, expect } from 'vitest';
import { evaluateOperator } from '../operators';

describe('evaluateOperator', () => {
  describe('GT (greater than)', () => {
    it('returns true when field value is greater than rule value', () => {
      expect(evaluateOperator(150000, 'GT', 100000)).toBe(true);
    });

    it('returns false when field value is less than rule value', () => {
      expect(evaluateOperator(50000, 'GT', 100000)).toBe(false);
    });

    it('returns false when values are equal', () => {
      expect(evaluateOperator(100000, 'GT', 100000)).toBe(false);
    });
  });

  describe('LT (less than)', () => {
    it('returns true when field value is less than rule value', () => {
      expect(evaluateOperator(3, 'LT', 5)).toBe(true);
    });

    it('returns false when field value is greater than rule value', () => {
      expect(evaluateOperator(7, 'LT', 5)).toBe(false);
    });

    it('returns false when values are equal', () => {
      expect(evaluateOperator(5, 'LT', 5)).toBe(false);
    });
  });

  describe('EQ (equal)', () => {
    it('returns true when string values match', () => {
      expect(evaluateOperator('FORECLOSURE', 'EQ', 'FORECLOSURE')).toBe(true);
    });

    it('returns false when string values differ', () => {
      expect(evaluateOperator('FORECLOSURE', 'EQ', 'PREFORECLOSURE')).toBe(false);
    });

    it('returns true when boolean values match', () => {
      expect(evaluateOperator(false, 'EQ', false)).toBe(true);
    });

    it('returns false when boolean values differ', () => {
      expect(evaluateOperator(true, 'EQ', false)).toBe(false);
    });

    it('returns true when numeric values match', () => {
      expect(evaluateOperator(42, 'EQ', 42)).toBe(true);
    });
  });

  describe('IN (value in array)', () => {
    it('returns true when value is in the array', () => {
      expect(evaluateOperator('CA', 'IN', ['CA', 'TX', 'FL'])).toBe(true);
    });

    it('returns false when value is not in the array', () => {
      expect(evaluateOperator('NY', 'IN', ['CA', 'TX', 'FL'])).toBe(false);
    });

    it('returns false when rule value is not an array', () => {
      expect(evaluateOperator('CA', 'IN', 'CA')).toBe(false);
    });
  });

  describe('CONTAINS (object key with truthy value)', () => {
    it('returns true when object has the key with truthy value', () => {
      expect(evaluateOperator({ foreclosure: true, preforeclosure: false }, 'CONTAINS', 'foreclosure')).toBe(true);
    });

    it('returns false when object has the key but value is falsy', () => {
      expect(evaluateOperator({ foreclosure: false, preforeclosure: false }, 'CONTAINS', 'foreclosure')).toBe(false);
    });

    it('returns false when object does not have the key', () => {
      expect(evaluateOperator({ preforeclosure: true }, 'CONTAINS', 'foreclosure')).toBe(false);
    });

    it('returns true when array contains the value', () => {
      expect(evaluateOperator(['foreclosure', 'preforeclosure'], 'CONTAINS', 'foreclosure')).toBe(true);
    });

    it('returns false when array does not contain the value', () => {
      expect(evaluateOperator(['preforeclosure'], 'CONTAINS', 'foreclosure')).toBe(false);
    });

    it('returns false when fieldValue is not an array or object (e.g. string)', () => {
      expect(evaluateOperator('foreclosure', 'CONTAINS', 'foreclosure')).toBe(false);
    });

    it('returns false when fieldValue is null', () => {
      expect(evaluateOperator(null, 'CONTAINS', 'foreclosure')).toBe(false);
    });
  });

  describe('RANGE (value within min/max bounds)', () => {
    it('returns true when value is within range', () => {
      expect(evaluateOperator(75, 'RANGE', { min: 60, max: 90 })).toBe(true);
    });

    it('returns false when value is below range', () => {
      expect(evaluateOperator(45, 'RANGE', { min: 60, max: 90 })).toBe(false);
    });

    it('returns false when value is above range', () => {
      expect(evaluateOperator(95, 'RANGE', { min: 60, max: 90 })).toBe(false);
    });

    it('returns true when value equals min boundary (inclusive)', () => {
      expect(evaluateOperator(60, 'RANGE', { min: 60, max: 90 })).toBe(true);
    });

    it('returns true when value equals max boundary (inclusive)', () => {
      expect(evaluateOperator(90, 'RANGE', { min: 60, max: 90 })).toBe(true);
    });

    it('returns false when ruleValue is not a valid range object', () => {
      expect(evaluateOperator(75, 'RANGE', 'invalid')).toBe(false);
    });
  });

  describe('NOT_CONTAINS (key absent or falsy)', () => {
    it('returns true when object key has falsy value', () => {
      expect(evaluateOperator({ foreclosure: false }, 'NOT_CONTAINS', 'foreclosure')).toBe(true);
    });

    it('returns true when key is completely absent from object', () => {
      expect(evaluateOperator({ preforeclosure: true }, 'NOT_CONTAINS', 'foreclosure')).toBe(true);
    });

    it('returns false when object key exists with truthy value', () => {
      expect(evaluateOperator({ foreclosure: true }, 'NOT_CONTAINS', 'foreclosure')).toBe(false);
    });

    it('returns true when array does not contain the value', () => {
      expect(evaluateOperator(['preforeclosure'], 'NOT_CONTAINS', 'foreclosure')).toBe(true);
    });

    it('returns false when array contains the value', () => {
      expect(evaluateOperator(['foreclosure', 'preforeclosure'], 'NOT_CONTAINS', 'foreclosure')).toBe(false);
    });

    it('returns false when fieldValue is not an array or object (e.g. number)', () => {
      expect(evaluateOperator(42, 'NOT_CONTAINS', 'foreclosure')).toBe(false);
    });

    it('returns false when fieldValue is null', () => {
      expect(evaluateOperator(null, 'NOT_CONTAINS', 'foreclosure')).toBe(false);
    });
  });

  describe('Unknown operator', () => {
    it('returns false for unknown operator', () => {
      // @ts-expect-error Testing unknown operator
      expect(evaluateOperator(100, 'UNKNOWN', 100)).toBe(false);
    });
  });
});
