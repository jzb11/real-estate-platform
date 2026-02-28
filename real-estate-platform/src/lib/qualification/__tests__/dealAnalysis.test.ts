import {
  validateComps,
  detectRehabTraps,
  checkMultifamilyLiquidity,
  recommendTransactionStrategy,
  flagCreativeFinanceRisks,
  checkPropertyTax,
  analyzeDeal,
  type PropertyForAnalysis,
} from '../dealAnalysis';

describe('validateComps', () => {
  it('flags missing ARV', () => {
    const result = validateComps({ estimatedValue: null });
    expect(result.valid).toBe(false);
    expect(result.issues[0]).toContain('No ARV');
  });

  it('flags missing year built', () => {
    const result = validateComps({ estimatedValue: 200000, yearBuilt: null });
    expect(result.valid).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([expect.stringContaining('Year built missing')])
    );
  });

  it('flags missing sq footage', () => {
    const result = validateComps({ estimatedValue: 200000, yearBuilt: 2000, squareFootage: null });
    expect(result.valid).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([expect.stringContaining('Square footage missing')])
    );
  });

  it('flags ARV wildly exceeding tax assessed value', () => {
    const result = validateComps({
      estimatedValue: 500000,
      taxAssessedValue: 100000,
      yearBuilt: 2000,
      squareFootage: 1500,
      propertyType: 'Single Family',
    });
    expect(result.valid).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([expect.stringContaining('5.0x the tax assessed')])
    );
  });

  it('passes when all data present and reasonable', () => {
    const result = validateComps({
      estimatedValue: 300000,
      taxAssessedValue: 250000,
      yearBuilt: 2005,
      squareFootage: 1800,
      propertyType: 'Single Family',
    });
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });
});

describe('detectRehabTraps', () => {
  it('flags pre-1970 wiring risk', () => {
    const result = detectRehabTraps({ yearBuilt: 1960, estimatedValue: 200000 }, 30000);
    const wiringAlert = result.rehabTraps.find((a) => a.title === 'Potential Wiring Issue');
    expect(wiringAlert).toBeDefined();
    expect(wiringAlert!.severity).toBe('warning');
  });

  it('flags pre-1950 foundation risk', () => {
    const result = detectRehabTraps({ yearBuilt: 1940, estimatedValue: 200000 }, 30000);
    const foundationAlert = result.rehabTraps.find((a) => a.title === 'Foundation Risk');
    expect(foundationAlert).toBeDefined();
    expect(foundationAlert!.severity).toBe('danger');
  });

  it('detects lipstick on a pig', () => {
    const result = detectRehabTraps(
      { yearBuilt: 1970, estimatedValue: 300000, lastSalePrice: 150000 },
      10000, // low repair estimate
    );
    const lipstick = result.rehabTraps.find((a) => a.title === 'Lipstick on a Pig Warning');
    expect(lipstick).toBeDefined();
  });

  it('flags too expensive to flip', () => {
    const result = detectRehabTraps({ estimatedValue: 100000 }, 90000);
    expect(result.tooExpensiveToFlip).toBe(true);
    const trap = result.rehabTraps.find((a) => a.title === 'Too Expensive to Flip');
    expect(trap).toBeDefined();
    expect(trap!.severity).toBe('danger');
  });

  it('does not flag when repair costs are reasonable', () => {
    const result = detectRehabTraps({ yearBuilt: 2010, estimatedValue: 300000 }, 30000);
    expect(result.rehabTraps).toHaveLength(0);
    expect(result.tooExpensiveToFlip).toBe(false);
  });
});

describe('checkMultifamilyLiquidity', () => {
  it('flags 5+ units at $900k+', () => {
    const result = checkMultifamilyLiquidity({ unitCount: 6, estimatedValue: 1000000 });
    expect(result).not.toBeNull();
    expect(result!.severity).toBe('warning');
    expect(result!.detail).toContain('6-unit');
  });

  it('does not flag 4 units', () => {
    const result = checkMultifamilyLiquidity({ unitCount: 4, estimatedValue: 1000000 });
    expect(result).toBeNull();
  });

  it('does not flag 5 units under $900k', () => {
    const result = checkMultifamilyLiquidity({ unitCount: 5, estimatedValue: 500000 });
    expect(result).toBeNull();
  });
});

describe('recommendTransactionStrategy', () => {
  it('recommends double close when fee exceeds $15k', () => {
    const result = recommendTransactionStrategy({}, 100000, 120000);
    expect(result.recommended).toBe('double_close');
    expect(result.assignmentFee).toBe(20000);
  });

  it('recommends assignment when fee is under $15k', () => {
    const result = recommendTransactionStrategy({}, 100000, 110000);
    expect(result.recommended).toBe('assignment');
    expect(result.assignmentFee).toBe(10000);
  });

  it('recommends hold when no spread', () => {
    const result = recommendTransactionStrategy({}, 100000, 90000);
    expect(result.recommended).toBe('hold');
  });
});

describe('flagCreativeFinanceRisks', () => {
  it('flags wrap mortgage when debt exists', () => {
    const result = flagCreativeFinanceRisks({ debtOwed: 150000, interestRate: 4.5 });
    const wrap = result.find((a) => a.title === 'Wrap Mortgage Consideration');
    expect(wrap).toBeDefined();
    expect(wrap!.detail).toContain('$150,000');
  });

  it('flags contract for deed when high equity', () => {
    const result = flagCreativeFinanceRisks({ equityPercent: 70 });
    const cfd = result.find((a) => a.title === 'Contract for Deed Caution');
    expect(cfd).toBeDefined();
    expect(cfd!.detail).toContain('deed in lieu');
  });

  it('returns nothing for low equity no debt property', () => {
    const result = flagCreativeFinanceRisks({ equityPercent: 30, debtOwed: 0 });
    expect(result).toHaveLength(0);
  });
});

describe('checkPropertyTax', () => {
  it('flags missing tax data', () => {
    const result = checkPropertyTax({ annualPropertyTax: null, estimatedValue: 300000 });
    expect(result).not.toBeNull();
    expect(result!.severity).toBe('warning');
  });

  it('flags suspiciously low tax', () => {
    const result = checkPropertyTax({ annualPropertyTax: 500, estimatedValue: 300000 });
    expect(result).not.toBeNull();
    expect(result!.title).toContain('Low Tax');
  });

  it('returns null when tax is reasonable', () => {
    const result = checkPropertyTax({ annualPropertyTax: 5000, estimatedValue: 300000 });
    expect(result).toBeNull();
  });
});

describe('analyzeDeal', () => {
  it('returns comprehensive analysis for a problem property', () => {
    const property: PropertyForAnalysis = {
      estimatedValue: 200000,
      yearBuilt: 1945,
      squareFootage: null,
      unitCount: 1,
      annualPropertyTax: null,
      debtOwed: 100000,
      interestRate: 5.0,
      equityPercent: 60,
    };

    const result = analyzeDeal(property, 195000); // repair costs nearly equal ARV
    expect(result.alerts.length).toBeGreaterThan(0);
    expect(result.rehabAssessment.tooExpensiveToFlip).toBe(true);

    // Should have foundation risk, wiring risk, tax warning, comp issues
    const categories = result.alerts.map((a) => a.category);
    expect(categories).toContain('rehab_trap');
    expect(categories).toContain('comp_validation');
    expect(categories).toContain('tax');
  });

  it('returns clean result for a good property', () => {
    const property: PropertyForAnalysis = {
      estimatedValue: 300000,
      taxAssessedValue: 270000,
      yearBuilt: 2010,
      squareFootage: 1800,
      propertyType: 'Single Family',
      unitCount: 1,
      annualPropertyTax: 4500,
    };

    const result = analyzeDeal(property, 20000);
    // Should have minimal or no alerts
    expect(result.rehabAssessment.tooExpensiveToFlip).toBe(false);
    expect(result.compValidation.valid).toBe(true);
    expect(result.multifamilyWarning).toBeNull();
  });
});
