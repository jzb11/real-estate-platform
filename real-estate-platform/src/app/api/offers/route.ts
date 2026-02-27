import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';
import { z } from 'zod';

const listOffersSchema = z.object({
  dealId: z.string().optional(),
  status: z
    .enum(['DRAFT', 'SENT', 'OPENED', 'CLICKED', 'BOUNCED', 'COMPLAINED', 'UNSUBSCRIBED'])
    .optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

/**
 * GET /api/offers
 *
 * List sent offer records with delivery status for the authenticated user.
 * Supports optional filtering by dealId and/or status.
 *
 * Query params:
 *   dealId    - filter by specific deal
 *   status    - filter by delivery status (SENT | OPENED | CLICKED | BOUNCED | COMPLAINED | UNSUBSCRIBED)
 *   page      - page number (default: 1)
 *   limit     - results per page (default: 20, max: 100)
 *
 * Response:
 * {
 *   offers: [{
 *     id, dealId, sentToEmail, recipientName, status,
 *     sentAt, emailOpenedAt?, linkClickedAt?, bouncedAt?,
 *     complainedAt?, sendgridMessageId?
 *   }],
 *   pagination: { page, limit, total, totalPages }
 * }
 */
export async function GET(req: NextRequest) {
  const { userId: clerkId } = await auth();

  if (!clerkId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Parse query parameters
  const { searchParams } = new URL(req.url);
  const rawParams = {
    dealId: searchParams.get('dealId') ?? undefined,
    status: searchParams.get('status') ?? undefined,
    page: searchParams.get('page') ?? undefined,
    limit: searchParams.get('limit') ?? undefined,
  };

  let params: z.infer<typeof listOffersSchema>;
  try {
    params = listOffersSchema.parse(rawParams);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: error.issues },
        { status: 400 }
      );
    }
    throw error;
  }

  const { dealId, status, page, limit } = params;
  const offset = (page - 1) * limit;

  try {
    // Build where clause — always scoped to authenticated user
    const where = {
      userId: user.id,
      ...(dealId ? { dealId } : {}),
      ...(status ? { status } : {}),
    };

    const [offers, total] = await prisma.$transaction([
      prisma.offeredDeal.findMany({
        where,
        select: {
          id: true,
          dealId: true,
          sentToEmail: true,
          recipientName: true,
          status: true,
          sentAt: true,
          emailOpenedAt: true,
          linkClickedAt: true,
          bouncedAt: true,
          complainedAt: true,
          bouncetype: true,
          complaintType: true,
          sendgridMessageId: true,
          createdAt: true,
          deal: {
            select: {
              title: true,
              property: {
                select: {
                  address: true,
                  city: true,
                  state: true,
                },
              },
            },
          },
        },
        orderBy: { sentAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.offeredDeal.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      offers,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (error) {
    console.error('Fetch offers error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch offers' },
      { status: 500 }
    );
  }
}
