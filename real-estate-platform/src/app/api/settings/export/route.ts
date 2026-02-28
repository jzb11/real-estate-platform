import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * GET /api/settings/export
 * Exports all user data as a JSON download.
 */
export async function GET() {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const [deals, properties, offers, sequences, rules, contactLogs] = await Promise.all([
    prisma.deal.findMany({
      where: { userId: user.id },
      include: {
        property: { select: { address: true, city: true, state: true, zip: true } },
        history: { orderBy: { createdAt: 'desc' }, take: 50 },
      },
    }),
    prisma.property.findMany({
      where: { deals: { some: { userId: user.id } } },
      select: {
        address: true,
        city: true,
        state: true,
        zip: true,
        propertyType: true,
        estimatedValue: true,
        equityPercent: true,
        ownershipName: true,
        dataSource: true,
        dataFreshnessDate: true,
      },
    }),
    prisma.offeredDeal.findMany({
      where: { userId: user.id },
      select: {
        sentToEmail: true,
        recipientName: true,
        status: true,
        sentAt: true,
        emailOpenedAt: true,
        linkClickedAt: true,
        bouncedAt: true,
      },
    }),
    prisma.followUpSequence.findMany({
      where: { userId: user.id },
      select: { name: true, description: true, steps: true, enabled: true },
    }),
    prisma.qualificationRule.findMany({
      where: { userId: user.id },
      select: { name: true, ruleType: true, fieldName: true, operator: true, value: true, weight: true, enabled: true },
    }),
    prisma.contactLog.count({ where: { userId: user.id } }),
  ]);

  const exportData = {
    exportedAt: new Date().toISOString(),
    user: { email: user.email, name: user.name, createdAt: user.createdAt },
    summary: {
      deals: deals.length,
      properties: properties.length,
      offers: offers.length,
      sequences: sequences.length,
      rules: rules.length,
      contactLogs,
    },
    deals,
    properties,
    offers,
    sequences,
    rules,
  };

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="deal-platform-export-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}
