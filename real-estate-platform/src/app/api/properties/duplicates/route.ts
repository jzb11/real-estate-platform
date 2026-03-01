import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * Normalize an address string for duplicate detection.
 * - Lowercase
 * - Trim whitespace
 * - Remove periods
 * - Standardize common abbreviations
 */
function normalizeAddress(address: string): string {
  let normalized = address.toLowerCase().trim().replace(/\./g, '');

  // Standardize common street type abbreviations
  const abbreviations: [RegExp, string][] = [
    [/\bst\b/g, 'street'],
    [/\bave\b/g, 'avenue'],
    [/\bdr\b/g, 'drive'],
    [/\bln\b/g, 'lane'],
    [/\brd\b/g, 'road'],
    [/\bblvd\b/g, 'boulevard'],
    [/\bct\b/g, 'court'],
  ];

  for (const [pattern, replacement] of abbreviations) {
    normalized = normalized.replace(pattern, replacement);
  }

  // Collapse multiple spaces to single space
  normalized = normalized.replace(/\s+/g, ' ');

  return normalized;
}

/**
 * GET /api/properties/duplicates
 *
 * Finds potential duplicate properties for the authenticated user by normalizing
 * addresses and grouping matches. Returns groups where two or more properties
 * share the same normalized address.
 *
 * Response: { duplicateGroups: Array<{ normalizedAddress, properties }>, totalDuplicates }
 */
export async function GET(): Promise<NextResponse> {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Fetch all properties the user has deals on
  const properties = await prisma.property.findMany({
    where: {
      deals: {
        some: { userId: user.id },
      },
    },
    select: {
      id: true,
      address: true,
      city: true,
      state: true,
      zip: true,
      propertyType: true,
      estimatedValue: true,
      dataFreshnessDate: true,
      createdAt: true,
    },
  });

  // Group by normalized address
  const groups = new Map<string, typeof properties>();

  for (const property of properties) {
    const normalized = normalizeAddress(property.address);
    const existing = groups.get(normalized);
    if (existing) {
      existing.push(property);
    } else {
      groups.set(normalized, [property]);
    }
  }

  // Filter to only groups with 2+ properties (actual duplicates)
  const duplicateGroups: { normalizedAddress: string; properties: typeof properties }[] = [];
  let totalDuplicates = 0;

  for (const [normalizedAddress, props] of groups) {
    if (props.length >= 2) {
      duplicateGroups.push({ normalizedAddress, properties: props });
      totalDuplicates += props.length;
    }
  }

  return NextResponse.json({
    duplicateGroups,
    totalDuplicates,
  });
}
