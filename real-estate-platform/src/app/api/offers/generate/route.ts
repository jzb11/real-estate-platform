import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';
import { renderOfferEmail } from '@/lib/email/offerTemplate';
import { calculateMAO } from '@/lib/qualification/engine';

export async function POST(req: NextRequest) {
  const { userId: clerkId } = await auth();

  if (!clerkId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Resolve internal user from Clerk ID
  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { dealId, recipientEmail, recipientName, repairCosts } = body as {
    dealId?: string;
    recipientEmail?: string;
    recipientName?: string;
    repairCosts?: number;
  };

  // Validate inputs
  if (!dealId || !recipientEmail) {
    return NextResponse.json(
      { error: 'dealId and recipientEmail are required' },
      { status: 400 }
    );
  }

  try {
    // Fetch deal and verify ownership
    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      include: {
        property: true,
      },
    });

    if (!deal || deal.userId !== user.id) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
    }

    if (!deal.property) {
      return NextResponse.json(
        { error: 'Deal missing property data' },
        { status: 400 }
      );
    }

    // Calculate MAO using 70% rule
    const maoResult = calculateMAO(
      deal.property.estimatedValue ?? 0,
      repairCosts ?? 0
    );

    // Prepare offer email data
    const offerData = {
      propertyAddress: deal.property.address,
      propertyCity: deal.property.city,
      propertyState: deal.property.state,
      propertyZip: deal.property.zip,
      estimatedValue: deal.property.estimatedValue ?? 0,
      repairCosts: repairCosts ?? 0,
      mao: maoResult.mao,
      offerPrice: maoResult.mao * 0.95, // 5% below MAO — user can customize later
      equityPercent: deal.property.equityPercent ?? 0,
      realtor: {
        name: user.name ?? 'Deal Team',
        phone: process.env.REALTOR_PHONE ?? '+1-xxx-xxx-xxxx',
        email: user.email,
      },
    };

    // Render email template
    const emailContent = renderOfferEmail(offerData);

    return NextResponse.json({
      success: true,
      draft: {
        dealId,
        recipientEmail,
        recipientName,
        subject: 'Professional Offer for Your Property',
        html: emailContent.html,
        text: emailContent.text,
        offerData: {
          propertyAddress: offerData.propertyAddress,
          estimatedValue: offerData.estimatedValue,
          repairCosts: offerData.repairCosts,
          mao: offerData.mao,
          maoFormula: maoResult.formula,
          offerPrice: offerData.offerPrice,
        },
      },
    });
  } catch (error) {
    console.error('Offer generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate offer' },
      { status: 500 }
    );
  }
}
