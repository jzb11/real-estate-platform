import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { parsePropStreamCsv } from '@/lib/propstream/csvParser';
import type { ImportResult } from '@/lib/propstream/types';

const MAX_ROWS = 10_000;

/**
 * POST /api/properties/import
 *
 * Accepts a multipart/form-data upload with a CSV file exported from PropStream.
 * Parses the CSV, upserts properties into the database, and returns an import summary.
 *
 * Request body: FormData with field "file" containing the CSV file.
 * Properties are associated with the authenticated user via the Deal relation —
 * the raw property table is not user-scoped, but deals are. Properties are
 * stored globally and accessed through the user-scoped deals.
 *
 * Note: This endpoint does NOT create deals automatically. It only stores properties.
 *
 * Returns: { totalRows, imported, updated, skipped, errors }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Parse multipart form data
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: 'Failed to parse form data. Send multipart/form-data with a "file" field.' },
      { status: 400 }
    );
  }

  const file = formData.get('file');
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json(
      { error: 'Missing "file" field in form data.' },
      { status: 400 }
    );
  }

  // Read CSV text
  let csvText: string;
  try {
    csvText = await file.text();
  } catch {
    return NextResponse.json(
      { error: 'Failed to read uploaded file.' },
      { status: 400 }
    );
  }

  if (!csvText.trim()) {
    return NextResponse.json(
      { error: 'Uploaded CSV file is empty.' },
      { status: 400 }
    );
  }

  // Parse CSV
  let properties: ReturnType<typeof parsePropStreamCsv>;
  try {
    properties = parsePropStreamCsv(csvText);
  } catch (err) {
    return NextResponse.json(
      { error: `CSV parse error: ${err instanceof Error ? err.message : String(err)}` },
      { status: 400 }
    );
  }

  // Enforce row limit
  if (properties.length > MAX_ROWS) {
    return NextResponse.json(
      {
        error: `CSV contains ${properties.length} rows which exceeds the ${MAX_ROWS} row limit per import. Split into smaller files.`,
      },
      { status: 413 }
    );
  }

  const result: ImportResult = {
    totalRows: properties.length,
    imported: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  // Upsert each property
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
        dataSource: 'CSV' as const,
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

  return NextResponse.json(result, { status: 200 });
}
