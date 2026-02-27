import { Prisma } from '@prisma/client';
import { PropertySearchFilters } from './types';

/**
 * Convert PropertySearchFilters into a Prisma WHERE clause for the Property model.
 *
 * All filter fields map to typed columns (not JSONB) for efficient index-backed queries.
 * Caller is responsible for adding `userId` scope to the final WHERE clause.
 */
export function buildPropertyFilter(
  filters: PropertySearchFilters
): Prisma.PropertyWhereInput {
  const where: Prisma.PropertyWhereInput = {};

  // Days on market range
  if (filters.minDaysOnMarket !== undefined || filters.maxDaysOnMarket !== undefined) {
    where.daysOnMarket = {};
    if (filters.minDaysOnMarket !== undefined) {
      where.daysOnMarket.gte = filters.minDaysOnMarket;
    }
    if (filters.maxDaysOnMarket !== undefined) {
      where.daysOnMarket.lte = filters.maxDaysOnMarket;
    }
  }

  // Equity percent range
  if (filters.minEquityPercent !== undefined || filters.maxEquityPercent !== undefined) {
    where.equityPercent = {};
    if (filters.minEquityPercent !== undefined) {
      where.equityPercent.gte = filters.minEquityPercent;
    }
    if (filters.maxEquityPercent !== undefined) {
      where.equityPercent.lte = filters.maxEquityPercent;
    }
  }

  // Max debt owed (total liens)
  if (filters.maxDebtOwed !== undefined) {
    where.debtOwed = { lte: filters.maxDebtOwed };
  }

  // Max interest rate
  if (filters.maxInterestRate !== undefined) {
    where.interestRate = { lte: filters.maxInterestRate };
  }

  // Geographic filters (exact match, case-insensitive via mode: insensitive)
  if (filters.city !== undefined) {
    where.city = { equals: filters.city, mode: 'insensitive' };
  }

  if (filters.state !== undefined) {
    where.state = { equals: filters.state, mode: 'insensitive' };
  }

  if (filters.propertyType !== undefined) {
    where.propertyType = { equals: filters.propertyType, mode: 'insensitive' };
  }

  return where;
}

/**
 * Merge two PropertySearchFilters objects.
 * Override values in base with any defined values from override.
 * Useful for applying saved filter presets and then layering on ad-hoc params.
 */
export function mergeFilters(
  base: PropertySearchFilters,
  override: PropertySearchFilters
): PropertySearchFilters {
  return {
    ...base,
    ...Object.fromEntries(
      Object.entries(override).filter(([, v]) => v !== undefined)
    ),
  };
}
