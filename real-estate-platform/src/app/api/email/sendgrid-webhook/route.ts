import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyWebhookSignature } from '@/lib/email/sendgrid';
import { SendgridEventType, OfferedDealStatus, type Prisma } from '@prisma/client';

const SENDGRID_WEBHOOK_KEY = process.env.SENDGRID_WEBHOOK_KEY;

if (!SENDGRID_WEBHOOK_KEY) {
  console.warn('SENDGRID_WEBHOOK_KEY not set — webhook verification will fail');
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-twilio-email-event-signature');
    const timestamp = req.headers.get('x-twilio-email-timestamp');

    if (!signature || !timestamp || !SENDGRID_WEBHOOK_KEY) {
      console.warn('Missing webhook signature or key');
      return NextResponse.json(
        { error: 'Invalid webhook' },
        { status: 400 }
      );
    }

    // Verify signature using HMAC-SHA256
    const isValid = verifyWebhookSignature(
      rawBody,
      signature,
      timestamp,
      SENDGRID_WEBHOOK_KEY
    );

    if (!isValid) {
      console.warn('Invalid webhook signature');
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    const events = JSON.parse(rawBody) as Array<Record<string, unknown>>;

    // Process each event in sequence
    for (const event of events) {
      const eventType = mapSendGridEventType(event['event'] as string);
      const messageId = event['message-id'] as string | undefined;
      const email = event['email'] as string;
      const rawTimestamp = event['timestamp'] as number;

      // Store webhook event log
      await prisma.sendgridWebhook.create({
        data: {
          eventType,
          email,
          timestamp: new Date(rawTimestamp * 1000),
          messageId,
          bounceType: event['bounce_type'] as string | undefined,
          complaintType: event['complaint'] as string | undefined,
          url: event['url'] as string | undefined,
          rawPayload: event as Prisma.InputJsonValue,
        },
      });

      // Update OfferedDeal status based on event type (if we can match by messageId)
      if (messageId) {
        const offeredDeal = await prisma.offeredDeal.findFirst({
          where: { sendgridMessageId: messageId },
        });

        if (offeredDeal) {
          const updateData: {
            status?: OfferedDealStatus;
            emailOpenedAt?: Date;
            linkClickedAt?: Date;
            bouncedAt?: Date;
            bouncetype?: string;
            complainedAt?: Date;
            complaintType?: string;
          } = {};

          switch (event['event']) {
            case 'open':
              updateData.emailOpenedAt = new Date(rawTimestamp * 1000);
              updateData.status = OfferedDealStatus.OPENED;
              break;
            case 'click':
              updateData.linkClickedAt = new Date(rawTimestamp * 1000);
              updateData.status = OfferedDealStatus.CLICKED;
              break;
            case 'bounce':
              updateData.bouncedAt = new Date(rawTimestamp * 1000);
              updateData.bouncetype = event['bounce_type'] as string | undefined;
              updateData.status = OfferedDealStatus.BOUNCED;
              break;
            case 'spamreport':
            case 'complaint':
              updateData.complainedAt = new Date(rawTimestamp * 1000);
              updateData.complaintType = event['complaint'] as string | undefined;
              updateData.status = OfferedDealStatus.COMPLAINED;
              break;
            case 'unsubscribe':
            case 'group_unsubscribe':
              updateData.status = OfferedDealStatus.UNSUBSCRIBED;
              break;
          }

          if (Object.keys(updateData).length > 0) {
            await prisma.offeredDeal.update({
              where: { id: offeredDeal.id },
              data: updateData,
            });
          }
        }
      }
    }

    return NextResponse.json({ success: true, processed: events.length });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

function mapSendGridEventType(sendgridEventType: string): SendgridEventType {
  const map: Record<string, SendgridEventType> = {
    delivered: SendgridEventType.DELIVERED,
    open: SendgridEventType.OPEN,
    click: SendgridEventType.CLICK,
    bounce: SendgridEventType.BOUNCE,
    spamreport: SendgridEventType.COMPLAINT,
    complaint: SendgridEventType.COMPLAINT,
    unsubscribe: SendgridEventType.UNSUBSCRIBE,
    group_unsubscribe: SendgridEventType.GROUP_UNSUBSCRIBE,
  };
  return map[sendgridEventType] ?? SendgridEventType.DELIVERED;
}
