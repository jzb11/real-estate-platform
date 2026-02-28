export interface PropStreamProperty {
  externalId: string; // PropStream property ID (from CSV column "Property ID" or address hash)
  address: string;
  city: string;
  state: string;
  zip: string;
  propertyType?: string;
  estimatedValue?: number; // ARV/estimated value
  lastSalePrice?: number;
  lastSaleDate?: Date;
  taxAssessedValue?: number;
  ownershipName?: string;
  ownershipPhone?: string; // Will be encrypted before storage
  equity?: number; // Equity % (0-100)
  debtOwed?: number; // Total liens
  interestRate?: number; // Current mortgage rate
  daysOnMarket?: number;
  yearBuilt?: number;
  squareFootage?: number; // Living area in sq ft
  bedrooms?: number;
  bathrooms?: number; // Allows half-baths (2.5)
  unitCount?: number; // Number of units (1 = SFR, 5+ = large multi)
  lotSize?: number; // Lot size in sq ft
  annualPropertyTax?: number;
  distressSignals?: Record<string, boolean>; // foreclosure, auction, preforeclosure, etc.
  dataFreshnessDate: Date;
  rawData?: Record<string, unknown>;
  equityPercent?: number;
}

export interface PropertySearchFilters {
  minDaysOnMarket?: number;
  maxDaysOnMarket?: number;
  minEquityPercent?: number;
  maxEquityPercent?: number;
  maxDebtOwed?: number;
  maxInterestRate?: number;
  city?: string;
  state?: string;
  propertyType?: string;
}

export interface SavedSearchFilter {
  id: string;
  name: string;
  filters: PropertySearchFilters;
}

export interface ImportResult {
  totalRows: number;
  imported: number;
  updated: number;
  skipped: number;
  errors: string[];
}
