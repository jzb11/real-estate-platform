import Papa from 'papaparse';
import * as crypto from 'crypto';
import { PropStreamProperty } from './types';

// Encryption key must be 32 bytes (256 bits) for AES-256-GCM.
// Stored as hex in ENCRYPTION_KEY env var (64 hex chars = 32 bytes).
function getEncryptionKey(): Buffer {
  const keyHex = process.env.ENCRYPTION_KEY;
  if (!keyHex || keyHex.length !== 64) {
    throw new Error(
      'ENCRYPTION_KEY env var must be set to a 64-character hex string (32 bytes)'
    );
  }
  return Buffer.from(keyHex, 'hex');
}

/**
 * Encrypt a phone number using AES-256-GCM.
 * Returns a base64-encoded JSON string: { iv, authTag, data }
 */
export function encryptPhone(phone: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12); // 96-bit IV for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  let encrypted = cipher.update(phone, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const authTag = cipher.getAuthTag();

  const payload = {
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    data: encrypted,
  };

  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

/**
 * Decrypt a phone number that was encrypted with encryptPhone().
 */
export function decryptPhone(encryptedBase64: string): string {
  const key = getEncryptionKey();
  const payload = JSON.parse(Buffer.from(encryptedBase64, 'base64').toString('utf8')) as {
    iv: string;
    authTag: string;
    data: string;
  };

  const iv = Buffer.from(payload.iv, 'base64');
  const authTag = Buffer.from(payload.authTag, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(payload.data, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/** Parse a numeric field defensively — empty string returns undefined, not 0. */
function parseNum(value: string | undefined): number | undefined {
  if (value === undefined || value === null || value.trim() === '') return undefined;
  // Remove commas and dollar signs
  const cleaned = value.replace(/[$,]/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? undefined : num;
}

/** Parse a date field defensively. */
function parseDate(value: string | undefined): Date | undefined {
  if (!value || value.trim() === '') return undefined;
  const d = new Date(value.trim());
  return isNaN(d.getTime()) ? undefined : d;
}

/** Parse boolean-like field ("Yes", "true", "1", "Y" → true). */
function parseBool(value: string | undefined): boolean {
  if (!value) return false;
  const v = value.trim().toLowerCase();
  return v === 'yes' || v === 'true' || v === '1' || v === 'y';
}

/**
 * Look up a value from a CSV row using case-insensitive column name matching.
 * Also matches partial header names to handle PropStream export variations.
 */
function getField(
  row: Record<string, string>,
  headers: string[],
  ...candidateNames: string[]
): string | undefined {
  for (const candidate of candidateNames) {
    const lower = candidate.toLowerCase();
    const match = headers.find((h) => h.toLowerCase() === lower);
    if (match !== undefined && row[match] !== undefined) {
      return row[match];
    }
  }
  // Partial match as fallback
  for (const candidate of candidateNames) {
    const lower = candidate.toLowerCase();
    const match = headers.find((h) => h.toLowerCase().includes(lower));
    if (match !== undefined && row[match] !== undefined) {
      return row[match];
    }
  }
  return undefined;
}

/**
 * Generate a stable externalId from address components when PropStream
 * does not include a "Property ID" column.
 */
function generateExternalId(address: string, city: string, state: string, zip: string): string {
  const raw = `${address.trim().toLowerCase()}_${city.trim().toLowerCase()}_${state.trim().toLowerCase()}_${zip.trim()}`;
  return raw.replace(/\s+/g, '_');
}

/**
 * Parse a PropStream CSV export string into an array of PropStreamProperty objects.
 *
 * Column mapping is case-insensitive and tolerates slight header name variations
 * between different PropStream export versions.
 *
 * Phone numbers are AES-256-GCM encrypted before being returned.
 * The dataFreshnessDate is set to the time of import.
 */
export function parsePropStreamCsv(csvString: string): PropStreamProperty[] {
  const result = Papa.parse<Record<string, string>>(csvString, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header: string) => header.trim(),
    transform: (value: string) => value.trim(),
    worker: false,
    download: false,
  });

  if (result.errors.length > 0) {
    const fatalErrors = result.errors.filter(
      (e: Papa.ParseError) => e.type === 'Delimiter' || e.type === 'Quotes'
    );
    if (fatalErrors.length > 0) {
      throw new Error(`CSV parse errors: ${fatalErrors.map((e: Papa.ParseError) => e.message).join(', ')}`);
    }
  }

  const headers = result.meta.fields ?? [];
  const importTime = new Date();
  const properties: PropStreamProperty[] = [];

  for (const row of result.data) {
    // --- Address fields (required) ---
    const address =
      getField(row, headers, 'Property Address', 'Address', 'Street Address') ?? '';
    const city = getField(row, headers, 'City') ?? '';
    const state = getField(row, headers, 'State') ?? '';
    const zip = getField(row, headers, 'Zip', 'Zip Code', 'Postal Code') ?? '';

    // Skip rows that have no address
    if (!address && !city) continue;

    // --- External ID ---
    const rawExternalId = getField(row, headers, 'Property ID', 'PropStream ID', 'ID');
    const externalId =
      rawExternalId && rawExternalId.trim() !== ''
        ? rawExternalId.trim()
        : generateExternalId(address, city, state, zip);

    // --- Numeric fields ---
    const estimatedValue = parseNum(
      getField(row, headers, 'Estimated Value', 'ARV', 'Estimated Market Value', 'Market Value')
    );
    const lastSalePrice = parseNum(
      getField(row, headers, 'Last Sale Price', 'Last Sale Amount')
    );
    const taxAssessedValue = parseNum(
      getField(row, headers, 'Tax Assessed Value', 'Assessed Value', 'Assessed Total')
    );
    const equityRaw = parseNum(
      getField(row, headers, 'Equity Percent', 'Equity %', 'Equity', 'Equity Percentage')
    );
    const debtOwed = parseNum(
      getField(row, headers, 'Open Liens Amount', 'Total Liens', 'Lien Amount', 'Debt Owed')
    );
    const interestRate = parseNum(
      getField(
        row,
        headers,
        'Mortgage Interest Rate',
        'Interest Rate',
        'Loan Interest Rate',
        'Rate'
      )
    );
    const daysOnMarket = parseNum(
      getField(row, headers, 'Days On Market', 'Days Listed', 'DOM')
    );

    // --- Date fields ---
    const lastSaleDate = parseDate(
      getField(row, headers, 'Last Sale Date', 'Last Sold Date', 'Sale Date')
    );

    // --- Owner fields ---
    const ownershipName = getField(
      row,
      headers,
      'Owner Name',
      'Owner Full Name',
      'Property Owner'
    );
    const rawPhone = getField(
      row,
      headers,
      'Owner Phone',
      'Phone',
      'Owner Phone Number',
      'Phone Number'
    );

    // Encrypt phone before storing — never store plain text
    let ownershipPhone: string | undefined;
    if (rawPhone && rawPhone.trim() !== '') {
      try {
        ownershipPhone = encryptPhone(rawPhone.trim());
      } catch {
        // If encryption key not configured, skip phone (do not store plain text)
        ownershipPhone = undefined;
      }
    }

    // --- Property type ---
    const propertyType = getField(
      row,
      headers,
      'Property Type',
      'Type',
      'Property Use',
      'Land Use'
    );

    // --- Physical attributes ---
    const yearBuilt = parseNum(
      getField(row, headers, 'Year Built', 'YearBuilt', 'Year Constructed')
    );
    const squareFootage = parseNum(
      getField(row, headers, 'Square Footage', 'Sq Ft', 'Living Area', 'Building Area', 'SqFt', 'Square Feet', 'Living Sq Ft')
    );
    const bedrooms = parseNum(
      getField(row, headers, 'Bedrooms', 'Beds', 'Bed', 'Bedroom Count')
    );
    const bathrooms = parseNum(
      getField(row, headers, 'Bathrooms', 'Baths', 'Bath', 'Bathroom Count', 'Total Baths')
    );
    const unitCount = parseNum(
      getField(row, headers, 'Unit Count', 'Units', 'Number of Units', 'Total Units', '# Units')
    );
    const lotSize = parseNum(
      getField(row, headers, 'Lot Size', 'Lot Sq Ft', 'Lot Area', 'Lot Square Feet', 'Land Area')
    );
    const annualPropertyTax = parseNum(
      getField(row, headers, 'Annual Tax', 'Property Tax', 'Tax Amount', 'Annual Property Tax', 'Taxes')
    );

    // --- Distress signals ---
    const distressSignals: Record<string, boolean> = {
      inForeclosure: parseBool(
        getField(row, headers, 'In Foreclosure', 'Foreclosure', 'Is Foreclosure')
      ),
      preForeclosure: parseBool(
        getField(row, headers, 'Pre-Foreclosure', 'PreForeclosure', 'Pre Foreclosure')
      ),
      hasAuctionDate: parseBool(
        getField(row, headers, 'Auction Date', 'Has Auction', 'At Auction')
      ),
      isBankOwned: parseBool(
        getField(row, headers, 'Bank Owned', 'REO', 'Is REO', 'Bank-Owned')
      ),
      taxLien: parseBool(getField(row, headers, 'Tax Lien', 'Has Tax Lien')),
      codeViolation: parseBool(
        getField(row, headers, 'Code Violation', 'Has Code Violation')
      ),
      divorce: parseBool(getField(row, headers, 'Divorce', 'Is Divorce')),
      probate: parseBool(getField(row, headers, 'Probate', 'Is Probate')),
    };

    // Store the full raw row for audit purposes — never discard original data
    const rawData: Record<string, unknown> = { ...row };

    properties.push({
      externalId,
      address,
      city,
      state,
      zip,
      propertyType,
      estimatedValue,
      lastSalePrice,
      lastSaleDate,
      taxAssessedValue,
      ownershipName,
      ownershipPhone,
      equity: equityRaw,
      equityPercent: equityRaw,
      debtOwed,
      interestRate,
      daysOnMarket,
      yearBuilt: yearBuilt !== undefined ? Math.round(yearBuilt) : undefined,
      squareFootage,
      bedrooms: bedrooms !== undefined ? Math.round(bedrooms) : undefined,
      bathrooms,
      unitCount: unitCount !== undefined ? Math.round(unitCount) : undefined,
      lotSize,
      annualPropertyTax,
      distressSignals,
      dataFreshnessDate: importTime,
      rawData,
    });
  }

  return properties;
}
