import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parsePropStreamCsv, encryptPhone, decryptPhone } from '../csvParser';

// Mock encryption key (64 hex chars = 32 bytes)
const TEST_ENCRYPTION_KEY = 'a'.repeat(64);

beforeEach(() => {
  vi.stubEnv('ENCRYPTION_KEY', TEST_ENCRYPTION_KEY);
});

describe('parsePropStreamCsv', () => {
  it('parses a basic CSV with required fields', () => {
    const csv = [
      'Property Address,City,State,Zip',
      '123 Main St,Miami,FL,33101',
      '456 Oak Ave,Tampa,FL,33602',
    ].join('\n');

    const result = parsePropStreamCsv(csv);

    expect(result).toHaveLength(2);
    expect(result[0].address).toBe('123 Main St');
    expect(result[0].city).toBe('Miami');
    expect(result[0].state).toBe('FL');
    expect(result[0].zip).toBe('33101');
    expect(result[1].address).toBe('456 Oak Ave');
  });

  it('generates a stable externalId from address when no ID column', () => {
    const csv = [
      'Property Address,City,State,Zip',
      '123 Main St,Miami,FL,33101',
    ].join('\n');

    const result = parsePropStreamCsv(csv);

    expect(result[0].externalId).toBe('123_main_st_miami_fl_33101');

    // Parse again — should be identical (stable)
    const result2 = parsePropStreamCsv(csv);
    expect(result2[0].externalId).toBe(result[0].externalId);
  });

  it('uses PropStream ID when available', () => {
    const csv = [
      'Property ID,Property Address,City,State,Zip',
      'PS-12345,123 Main St,Miami,FL,33101',
    ].join('\n');

    const result = parsePropStreamCsv(csv);
    expect(result[0].externalId).toBe('PS-12345');
  });

  it('parses numeric fields with dollar signs and commas', () => {
    const csv = [
      'Property Address,City,State,Zip,Estimated Value,Last Sale Price,Tax Assessed Value',
      '123 Main St,Miami,FL,33101,"$350,000","$280,000","$310,000"',
    ].join('\n');

    const result = parsePropStreamCsv(csv);

    expect(result[0].estimatedValue).toBe(350000);
    expect(result[0].lastSalePrice).toBe(280000);
    expect(result[0].taxAssessedValue).toBe(310000);
  });

  it('parses equity, debt, and interest rate', () => {
    const csv = [
      'Property Address,City,State,Zip,Equity Percent,Open Liens Amount,Mortgage Interest Rate',
      '123 Main St,Miami,FL,33101,45,"$120,000",4.5',
    ].join('\n');

    const result = parsePropStreamCsv(csv);

    expect(result[0].equity).toBe(45);
    expect(result[0].equityPercent).toBe(45);
    expect(result[0].debtOwed).toBe(120000);
    expect(result[0].interestRate).toBe(4.5);
  });

  it('parses distress signals', () => {
    const csv = [
      'Property Address,City,State,Zip,In Foreclosure,Pre-Foreclosure,Tax Lien,Bank Owned',
      '123 Main St,Miami,FL,33101,Yes,No,Yes,No',
    ].join('\n');

    const result = parsePropStreamCsv(csv);

    expect(result[0].distressSignals).toBeDefined();
    expect(result[0].distressSignals!.inForeclosure).toBe(true);
    expect(result[0].distressSignals!.preForeclosure).toBe(false);
    expect(result[0].distressSignals!.taxLien).toBe(true);
    expect(result[0].distressSignals!.isBankOwned).toBe(false);
  });

  it('encrypts phone numbers', () => {
    const csv = [
      'Property Address,City,State,Zip,Owner Phone',
      '123 Main St,Miami,FL,33101,555-123-4567',
    ].join('\n');

    const result = parsePropStreamCsv(csv);

    // Phone should be encrypted (not plain text)
    expect(result[0].ownershipPhone).toBeDefined();
    expect(result[0].ownershipPhone).not.toBe('555-123-4567');

    // Should be decryptable back to original
    const decrypted = decryptPhone(result[0].ownershipPhone!);
    expect(decrypted).toBe('555-123-4567');
  });

  it('skips rows with no address and no city', () => {
    const csv = [
      'Property Address,City,State,Zip',
      '123 Main St,Miami,FL,33101',
      ',,,33602',
      '789 Pine Rd,Orlando,FL,32801',
    ].join('\n');

    const result = parsePropStreamCsv(csv);
    expect(result).toHaveLength(2);
  });

  it('handles empty CSV (headers only)', () => {
    const csv = 'Property Address,City,State,Zip\n';
    const result = parsePropStreamCsv(csv);
    expect(result).toHaveLength(0);
  });

  it('sets dataFreshnessDate to import time', () => {
    const before = new Date();
    const csv = [
      'Property Address,City,State,Zip',
      '123 Main St,Miami,FL,33101',
    ].join('\n');

    const result = parsePropStreamCsv(csv);
    const after = new Date();

    expect(result[0].dataFreshnessDate.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(result[0].dataFreshnessDate.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it('preserves raw data for audit', () => {
    const csv = [
      'Property Address,City,State,Zip,Custom Field',
      '123 Main St,Miami,FL,33101,some-value',
    ].join('\n');

    const result = parsePropStreamCsv(csv);

    expect(result[0].rawData).toBeDefined();
    expect(result[0].rawData!['Custom Field']).toBe('some-value');
  });

  it('handles case-insensitive column names', () => {
    const csv = [
      'PROPERTY ADDRESS,CITY,STATE,ZIP,ESTIMATED VALUE',
      '123 Main St,Miami,FL,33101,350000',
    ].join('\n');

    const result = parsePropStreamCsv(csv);

    expect(result[0].address).toBe('123 Main St');
    expect(result[0].estimatedValue).toBe(350000);
  });

  it('handles alternate column name variations', () => {
    const csv = [
      'Street Address,City,State,Postal Code,ARV,Owner Full Name',
      '123 Main St,Miami,FL,33101,400000,John Smith',
    ].join('\n');

    const result = parsePropStreamCsv(csv);

    expect(result[0].address).toBe('123 Main St');
    expect(result[0].zip).toBe('33101');
    expect(result[0].estimatedValue).toBe(400000);
    expect(result[0].ownershipName).toBe('John Smith');
  });

  it('parses last sale date', () => {
    const csv = [
      'Property Address,City,State,Zip,Last Sale Date',
      '123 Main St,Miami,FL,33101,2024-06-15',
    ].join('\n');

    const result = parsePropStreamCsv(csv);

    expect(result[0].lastSaleDate).toBeInstanceOf(Date);
    expect(result[0].lastSaleDate!.getFullYear()).toBe(2024);
  });

  it('handles empty numeric fields as undefined (not 0)', () => {
    const csv = [
      'Property Address,City,State,Zip,Estimated Value,Equity Percent',
      '123 Main St,Miami,FL,33101,,',
    ].join('\n');

    const result = parsePropStreamCsv(csv);

    expect(result[0].estimatedValue).toBeUndefined();
    expect(result[0].equity).toBeUndefined();
  });

  it('throws on fatally malformed CSV', () => {
    const csv = '"unclosed quote,broken';

    expect(() => parsePropStreamCsv(csv)).toThrow();
  });

  it('parses property type', () => {
    const csv = [
      'Property Address,City,State,Zip,Property Type',
      '123 Main St,Miami,FL,33101,Single Family',
    ].join('\n');

    const result = parsePropStreamCsv(csv);
    expect(result[0].propertyType).toBe('Single Family');
  });

  it('parses days on market', () => {
    const csv = [
      'Property Address,City,State,Zip,Days On Market',
      '123 Main St,Miami,FL,33101,45',
    ].join('\n');

    const result = parsePropStreamCsv(csv);
    expect(result[0].daysOnMarket).toBe(45);
  });
});

describe('encryptPhone / decryptPhone', () => {
  it('round-trips a phone number', () => {
    const phone = '(305) 555-1234';
    const encrypted = encryptPhone(phone);
    const decrypted = decryptPhone(encrypted);
    expect(decrypted).toBe(phone);
  });

  it('produces different ciphertext each time (random IV)', () => {
    const phone = '555-0000';
    const a = encryptPhone(phone);
    const b = encryptPhone(phone);
    expect(a).not.toBe(b);

    // But both decrypt to the same value
    expect(decryptPhone(a)).toBe(phone);
    expect(decryptPhone(b)).toBe(phone);
  });

  it('throws with missing encryption key', () => {
    vi.stubEnv('ENCRYPTION_KEY', '');
    expect(() => encryptPhone('555-0000')).toThrow('ENCRYPTION_KEY');
  });
});
