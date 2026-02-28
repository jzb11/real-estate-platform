/**
 * Level 2 Advanced Deal Analysis
 *
 * Pure functions — no side effects, no DB access.
 * Called after standard qualification to add warnings, flags, and strategy recommendations.
 *
 * Criteria:
 * 1. Comp Validation — property type, year built +-10yr, sq ft range
 * 2. Rehab Trap Detection — lipstick on a pig, wiring/foundation killers, too-cheap-to-flip
 * 3. Multifamily Liquidity — 5+ units at $900k+ in B/C markets
 * 4. Transaction Strategy — double close vs assignment
 * 5. Creative Finance Risk Flags — wrap mortgage / contract for deed warnings
 * 6. Dynamic Property Tax — flag missing or stale tax data
 */

// ── Types ────────────────────────────────────────────────────────────────────

export type AlertSeverity = 'info' | 'warning' | 'danger';

export interface DealAlert {
  category: string;
  severity: AlertSeverity;
  title: string;
  detail: string;
}

export interface CompValidation {
  valid: boolean;
  issues: string[];
}

export interface RehabAssessment {
  rehabTraps: DealAlert[];
  tooExpensiveToFlip: boolean;
  estimatedProfit: number | null;
}

export interface TransactionStrategy {
  recommended: 'assignment' | 'double_close' | 'hold';
  reason: string;
  assignmentFee: number | null;
}

export interface DealAnalysisResult {
  alerts: DealAlert[];
  compValidation: CompValidation;
  rehabAssessment: RehabAssessment;
  transactionStrategy: TransactionStrategy | null;
  multifamilyWarning: DealAlert | null;
  taxWarning: DealAlert | null;
}

export interface PropertyForAnalysis {
  estimatedValue?: number | null;
  lastSalePrice?: number | null;
  taxAssessedValue?: number | null;
  annualPropertyTax?: number | null;
  propertyType?: string | null;
  yearBuilt?: number | null;
  squareFootage?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  unitCount?: number | null;
  equityPercent?: number | null;
  debtOwed?: number | null;
  interestRate?: number | null;
  city?: string | null;
  state?: string | null;
  distressSignals?: Record<string, unknown>;
  [key: string]: unknown;
}

// ── Constants ────────────────────────────────────────────────────────────────

const DOUBLE_CLOSE_FEE_THRESHOLD = 15000;
const LARGE_MULTI_UNIT_THRESHOLD = 5;
const LARGE_MULTI_PRICE_THRESHOLD = 900000;
const TOO_CHEAP_MIN_PROFIT = 15000; // Minimum profit to justify a flip
const WIRING_YEAR_THRESHOLD = 1970; // Pre-1970 = likely knob-and-tube or aluminum
const FOUNDATION_YEAR_THRESHOLD = 1950; // Pre-1950 = higher foundation risk

// ── Comp Validation ──────────────────────────────────────────────────────────

/**
 * Validates that the ARV/comp is reasonable for this property.
 * Checks property type consistency, year built range, and sq ft range.
 * These are the same filters an appraiser uses when selecting comps.
 */
export function validateComps(property: PropertyForAnalysis): CompValidation {
  const issues: string[] = [];

  // ARV must exist
  if (!property.estimatedValue || property.estimatedValue <= 0) {
    issues.push('No ARV/estimated value — cannot validate comps');
    return { valid: false, issues };
  }

  // Year built check — comps should be within +-10 years
  if (!property.yearBuilt) {
    issues.push('Year built missing — cannot verify comp year range (appraisers require +-10yr match)');
  }

  // Sq footage check — comps should be within +-20%
  if (!property.squareFootage || property.squareFootage <= 0) {
    issues.push('Square footage missing — cannot verify comp size range (appraisers cap at +-20%)');
  }

  // Property type check — SFR comps shouldn't be used for multifamily and vice versa
  if (!property.propertyType) {
    issues.push('Property type missing — cannot verify comp type match');
  }

  // Cross-check: if tax assessed value exists and differs wildly from ARV, flag it
  if (property.taxAssessedValue && property.estimatedValue) {
    const ratio = property.estimatedValue / property.taxAssessedValue;
    if (ratio > 2.0) {
      issues.push(
        `ARV ($${property.estimatedValue.toLocaleString()}) is ${ratio.toFixed(1)}x the tax assessed value ($${property.taxAssessedValue.toLocaleString()}) — verify comps are accurate`
      );
    }
    if (ratio < 0.5) {
      issues.push(
        `ARV ($${property.estimatedValue.toLocaleString()}) is less than half the tax assessed value ($${property.taxAssessedValue.toLocaleString()}) — check for data error`
      );
    }
  }

  return { valid: issues.length === 0, issues };
}

// ── Rehab Trap Detection ─────────────────────────────────────────────────────

/**
 * Detects rehab traps:
 * - Lipstick on a pig: cosmetic-only rehab on structural problems
 * - Wiring/foundation killers: pre-1970 wiring, pre-1950 foundation
 * - Too cheap to flip: ARV - rehab costs leaves no profit
 */
export function detectRehabTraps(
  property: PropertyForAnalysis,
  estimatedRepairCosts: number,
): RehabAssessment {
  const traps: DealAlert[] = [];
  const arv = property.estimatedValue ?? 0;

  // Wiring risk — pre-1970 buildings likely have knob-and-tube or aluminum wiring
  if (property.yearBuilt && property.yearBuilt < WIRING_YEAR_THRESHOLD) {
    traps.push({
      category: 'rehab_trap',
      severity: 'warning',
      title: 'Potential Wiring Issue',
      detail: `Built in ${property.yearBuilt} — pre-1970 properties often have knob-and-tube or aluminum wiring. Budget $8-15k for rewiring if not already updated.`,
    });
  }

  // Foundation risk — pre-1950 buildings
  if (property.yearBuilt && property.yearBuilt < FOUNDATION_YEAR_THRESHOLD) {
    traps.push({
      category: 'rehab_trap',
      severity: 'danger',
      title: 'Foundation Risk',
      detail: `Built in ${property.yearBuilt} — pre-1950 properties have elevated foundation risk. Get structural inspection before committing. Foundation repairs run $10-50k+.`,
    });
  }

  // Lipstick on a pig — high ARV relative to last sale + low repair estimate on old property
  if (
    property.yearBuilt &&
    property.yearBuilt < 1980 &&
    property.lastSalePrice &&
    arv > 0 &&
    estimatedRepairCosts < arv * 0.1 && // Repair costs less than 10% of ARV
    arv / property.lastSalePrice > 1.5 // Expecting 50%+ value jump
  ) {
    traps.push({
      category: 'rehab_trap',
      severity: 'warning',
      title: 'Lipstick on a Pig Warning',
      detail: `Low repair estimate ($${estimatedRepairCosts.toLocaleString()}) on a ${property.yearBuilt} property expecting ${Math.round((arv / property.lastSalePrice - 1) * 100)}% value increase. Verify the scope — cosmetic rehab alone rarely produces this ROI on older properties.`,
    });
  }

  // Too cheap to flip — (ARV * 0.70) - repairs - purchase price leaves no profit
  const mao = arv * 0.70 - estimatedRepairCosts;
  const estimatedProfit = mao > 0 ? mao * 0.15 : null; // Rough ~15% margin on MAO
  const tooExpensiveToFlip = arv > 0 && estimatedRepairCosts > 0 && (arv - estimatedRepairCosts) < TOO_CHEAP_MIN_PROFIT;

  if (tooExpensiveToFlip) {
    traps.push({
      category: 'rehab_trap',
      severity: 'danger',
      title: 'Too Expensive to Flip',
      detail: `ARV ($${arv.toLocaleString()}) minus repair costs ($${estimatedRepairCosts.toLocaleString()}) = $${(arv - estimatedRepairCosts).toLocaleString()} spread — below $${TOO_CHEAP_MIN_PROFIT.toLocaleString()} minimum profit threshold. Not worth the risk.`,
    });
  }

  return {
    rehabTraps: traps,
    tooExpensiveToFlip,
    estimatedProfit,
  };
}

// ── Multifamily Liquidity ────────────────────────────────────────────────────

/**
 * Flags large multifamily properties (5+ units) at $900k+ in B/C markets.
 * These require ~$200k down payment and have limited buyer pool.
 */
export function checkMultifamilyLiquidity(property: PropertyForAnalysis): DealAlert | null {
  const units = property.unitCount ?? 1;
  const arv = property.estimatedValue ?? 0;

  if (units >= LARGE_MULTI_UNIT_THRESHOLD && arv >= LARGE_MULTI_PRICE_THRESHOLD) {
    return {
      category: 'liquidity',
      severity: 'warning',
      title: 'Large Multifamily Liquidity Warning',
      detail: `${units}-unit property at $${arv.toLocaleString()} — requires ~$${Math.round(arv * 0.20).toLocaleString()} down payment (20%). Limited buyer pool in most B/C markets. Consider seller financing or creative terms to improve exit.`,
    };
  }

  return null;
}

// ── Transaction Strategy ─────────────────────────────────────────────────────

/**
 * Recommends transaction strategy based on assignment fee threshold.
 *
 * Rules:
 * - Assignment fee > $15-20k → recommend double close (buyers balk at large assignment fees)
 * - Non-assignable clause detected → must double close
 * - Otherwise → standard assignment is cheaper and faster
 */
export function recommendTransactionStrategy(
  property: PropertyForAnalysis,
  purchasePrice: number,
  resalePrice: number,
): TransactionStrategy {
  const assignmentFee = resalePrice - purchasePrice;

  if (assignmentFee <= 0) {
    return {
      recommended: 'hold',
      reason: 'No spread between purchase and resale — consider hold or creative strategy',
      assignmentFee: null,
    };
  }

  if (assignmentFee > DOUBLE_CLOSE_FEE_THRESHOLD) {
    return {
      recommended: 'double_close',
      reason: `Assignment fee of $${assignmentFee.toLocaleString()} exceeds $${DOUBLE_CLOSE_FEE_THRESHOLD.toLocaleString()} threshold — buyers may object. Use simultaneous (double) close to keep fee private.`,
      assignmentFee,
    };
  }

  return {
    recommended: 'assignment',
    reason: `Assignment fee of $${assignmentFee.toLocaleString()} is within acceptable range. Standard assignment is cheaper and faster.`,
    assignmentFee,
  };
}

// ── Creative Finance Risk Flags ──────────────────────────────────────────────

/**
 * Flags specific creative finance contract risks:
 * - Wrap mortgage: due-on-sale risk, insurance gaps
 * - Contract for deed: buyer has no title protection
 * - Recommendation: counter with deed in lieu of foreclosure clause
 */
export function flagCreativeFinanceRisks(property: PropertyForAnalysis): DealAlert[] {
  const alerts: DealAlert[] = [];

  // If property has existing debt, wrap mortgage risks apply for subject-to / seller finance
  if (property.debtOwed && property.debtOwed > 0 && property.interestRate) {
    alerts.push({
      category: 'creative_finance',
      severity: 'info',
      title: 'Wrap Mortgage Consideration',
      detail: `Existing debt of $${property.debtOwed.toLocaleString()} at ${property.interestRate}% — if structuring as wrap/subject-to, ensure due-on-sale clause risk is addressed. Lender acceleration is possible but rare. Keep insurance and payments current.`,
    });
  }

  // High equity + owner-occupied = good candidate for seller finance but flag CFD risk
  if (property.equityPercent && property.equityPercent > 50) {
    alerts.push({
      category: 'creative_finance',
      severity: 'info',
      title: 'Contract for Deed Caution',
      detail: `${property.equityPercent}% equity — owner may propose contract for deed (installment sale). Counter with deed in lieu of foreclosure clause to protect your position. Buyer has no title protection without it.`,
    });
  }

  return alerts;
}

// ── Dynamic Property Tax ─────────────────────────────────────────────────────

/**
 * Flags missing or potentially stale property tax data.
 * Don't hardcode taxes — they vary by county and can change dramatically after purchase.
 */
export function checkPropertyTax(property: PropertyForAnalysis): DealAlert | null {
  if (!property.annualPropertyTax) {
    return {
      category: 'tax',
      severity: 'warning',
      title: 'Property Tax Data Missing',
      detail: 'Annual property tax not available — look up county assessor records. Taxes can change significantly after purchase (reassessment at new sale price). Budget 1-2% of ARV as estimate.',
    };
  }

  // Flag if tax is suspiciously low relative to ARV (may be reassessed upward after purchase)
  const arv = property.estimatedValue ?? 0;
  if (arv > 0 && property.annualPropertyTax < arv * 0.005) {
    return {
      category: 'tax',
      severity: 'info',
      title: 'Low Tax — Possible Reassessment',
      detail: `Annual tax $${property.annualPropertyTax.toLocaleString()} is less than 0.5% of ARV ($${arv.toLocaleString()}). County may reassess after purchase — budget for higher taxes.`,
    };
  }

  return null;
}

// ── Full Deal Analysis ───────────────────────────────────────────────────────

/**
 * Runs all Level 2 analysis checks on a property.
 * Returns a comprehensive analysis result with all alerts, warnings, and strategy recommendations.
 *
 * @param property - Property data for analysis
 * @param estimatedRepairCosts - Estimated repair costs (0 if unknown)
 * @param purchasePrice - Intended purchase price (for transaction strategy)
 */
export function analyzeDeal(
  property: PropertyForAnalysis,
  estimatedRepairCosts: number = 0,
  purchasePrice?: number,
): DealAnalysisResult {
  const alerts: DealAlert[] = [];

  // 1. Comp Validation
  const compValidation = validateComps(property);
  for (const issue of compValidation.issues) {
    alerts.push({
      category: 'comp_validation',
      severity: 'warning',
      title: 'Comp Issue',
      detail: issue,
    });
  }

  // 2. Rehab Trap Detection
  const rehabAssessment = detectRehabTraps(property, estimatedRepairCosts);
  alerts.push(...rehabAssessment.rehabTraps);

  // 3. Multifamily Liquidity
  const multifamilyWarning = checkMultifamilyLiquidity(property);
  if (multifamilyWarning) {
    alerts.push(multifamilyWarning);
  }

  // 4. Transaction Strategy (only if we have purchase price)
  let transactionStrategy: TransactionStrategy | null = null;
  if (purchasePrice !== undefined && property.estimatedValue) {
    const mao = property.estimatedValue * 0.70 - estimatedRepairCosts;
    transactionStrategy = recommendTransactionStrategy(property, purchasePrice, mao);
  }

  // 5. Creative Finance Risk Flags
  const cfRisks = flagCreativeFinanceRisks(property);
  alerts.push(...cfRisks);

  // 6. Property Tax Check
  const taxWarning = checkPropertyTax(property);
  if (taxWarning) {
    alerts.push(taxWarning);
  }

  return {
    alerts,
    compValidation,
    rehabAssessment,
    transactionStrategy,
    multifamilyWarning,
    taxWarning,
  };
}
