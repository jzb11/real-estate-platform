import { prisma } from '@/lib/db';
import { parsePropStreamCsv } from './csvParser';
import { scrapePropStream, type ScrapeConfig } from './scraper';
import type { ImportResult } from './types';

/**
 * Full automated pipeline: scrape PropStream → parse CSV → upsert to DB.
 *
 * Returns the same ImportResult shape as the manual CSV import endpoint,
 * but marks all properties with dataSource: "SCRAPER" to distinguish
 * from manual uploads.
 */
export async function autoImportFromPropStream(
  config: ScrapeConfig
): Promise<ImportResult> {
  // Step 1: Scrape — launch browser, login, search, download CSV
  const csvContent = await scrapePropStream(config);

  // Step 2: Parse — reuse existing CSV parser
  const properties = parsePropStreamCsv(csvContent);

  // Step 3: Upsert — same logic as /api/properties/import
  const result: ImportResult = {
    totalRows: properties.length,
    imported: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  for (const prop of properties) {
    try {
      const existing = await prisma.property.findUnique({
        where: { externalId: prop.externalId },
        select: { id: true },
      });

      const propertyData = {
        address: prop.address,
        city: prop.city,
        state: prop.state,
        zip: prop.zip,
        propertyType: prop.propertyType ?? null,
        estimatedValue: prop.estimatedValue ?? null,
        lastSalePrice: prop.lastSalePrice ?? null,
        lastSaleDate: prop.lastSaleDate ?? null,
        taxAssessedValue: prop.taxAssessedValue ?? null,
        ownershipName: prop.ownershipName ?? null,
        ownershipPhone: prop.ownershipPhone ?? null,
        equityPercent: prop.equityPercent ?? null,
        debtOwed: prop.debtOwed ?? null,
        interestRate: prop.interestRate ?? null,
        daysOnMarket: prop.daysOnMarket !== undefined ? Math.round(prop.daysOnMarket) : null,
        yearBuilt: prop.yearBuilt ?? null,
        squareFootage: prop.squareFootage ?? null,
        bedrooms: prop.bedrooms ?? null,
        bathrooms: prop.bathrooms ?? null,
        unitCount: prop.unitCount ?? null,
        lotSize: prop.lotSize ?? null,
        annualPropertyTax: prop.annualPropertyTax ?? null,
        distressSignals: (prop.distressSignals as object) ?? {},
        dataSource: 'SCRAPER' as const,
        dataFreshnessDate: prop.dataFreshnessDate,
        rawData: (prop.rawData as object) ?? {},
      };

      await prisma.property.upsert({
        where: { externalId: prop.externalId },
        create: { externalId: prop.externalId, ...propertyData },
        update: propertyData,
      });

      if (existing) {
        result.updated++;
      } else {
        result.imported++;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      result.errors.push(`Row (externalId: ${prop.externalId}): ${message}`);
      result.skipped++;
    }
  }

  return result;
}
