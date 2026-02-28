import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { autoImportFromPropStream } from '@/lib/propstream/autoImport';
import type { ScrapeConfig } from '@/lib/propstream/scraper';

/**
 * POST /api/properties/scrape
 *
 * Triggers an automated PropStream scrape → parse → upsert pipeline.
 * This endpoint is intended for local use only — Playwright cannot run
 * on serverless platforms like Vercel.
 *
 * Request body (JSON):
 *   { location: string, filters?: {...}, headless?: boolean }
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

  let body: ScrapeConfig;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  if (!body.location || typeof body.location !== 'string') {
    return NextResponse.json(
      { error: '"location" is required (e.g. "Miami-Dade County, FL")' },
      { status: 400 }
    );
  }

  // Validate filter values if provided
  if (body.filters?.minEquityPercent !== undefined) {
    const eq = body.filters.minEquityPercent;
    if (typeof eq !== 'number' || eq < 0 || eq > 100) {
      return NextResponse.json(
        { error: 'minEquityPercent must be a number between 0 and 100' },
        { status: 400 }
      );
    }
  }

  try {
    const result = await autoImportFromPropStream(body);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Scrape failed: ${message}` },
      { status: 500 }
    );
  }
}
