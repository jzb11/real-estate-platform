import type { Operator, RangeValue } from './types';

/**
 * Evaluates a single operator against a field value and rule value.
 *
 * Pure function — no side effects, no DB access.
 * Used by the engine to evaluate individual rule conditions.
 */
export function evaluateOperator(
  fieldValue: unknown,
  operator: Operator,
  ruleValue: unknown,
): boolean {
  switch (operator) {
    case 'GT': {
      return typeof fieldValue === 'number' &&
        typeof ruleValue === 'number' &&
        fieldValue > ruleValue;
    }

    case 'LT': {
      return typeof fieldValue === 'number' &&
        typeof ruleValue === 'number' &&
        fieldValue < ruleValue;
    }

    case 'EQ': {
      return fieldValue === ruleValue;
    }

    case 'IN': {
      if (!Array.isArray(ruleValue)) return false;
      return ruleValue.includes(fieldValue);
    }

    case 'CONTAINS': {
      // Array case: check if array includes the string value
      if (Array.isArray(fieldValue)) {
        return typeof ruleValue === 'string' && fieldValue.includes(ruleValue);
      }
      // Object case: check if key exists with truthy value
      if (typeof fieldValue === 'object' && fieldValue !== null && typeof ruleValue === 'string') {
        const obj = fieldValue as Record<string, unknown>;
        return Object.prototype.hasOwnProperty.call(obj, ruleValue) && Boolean(obj[ruleValue]);
      }
      return false;
    }

    case 'RANGE': {
      if (typeof fieldValue !== 'number') return false;
      if (
        typeof ruleValue !== 'object' ||
        ruleValue === null ||
        !('min' in ruleValue) ||
        !('max' in ruleValue)
      ) {
        return false;
      }
      const range = ruleValue as RangeValue;
      return fieldValue >= range.min && fieldValue <= range.max;
    }

    case 'NOT_CONTAINS': {
      // Array case: check if array does NOT include the value
      if (Array.isArray(fieldValue)) {
        return typeof ruleValue === 'string' && !fieldValue.includes(ruleValue);
      }
      // Object case: key absent or falsy
      if (typeof fieldValue === 'object' && fieldValue !== null && typeof ruleValue === 'string') {
        const obj = fieldValue as Record<string, unknown>;
        return !Object.prototype.hasOwnProperty.call(obj, ruleValue) || !Boolean(obj[ruleValue]);
      }
      return false;
    }

    default: {
      return false;
    }
  }
}
