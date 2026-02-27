import { createHmac } from 'crypto';
import sgMail from '@sendgrid/mail';

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const SENDGRID_FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL ?? '';
const SENDGRID_FROM_NAME = process.env.SENDGRID_FROM_NAME ?? 'Offer Platform';

// Lazily initialize to avoid build-time errors when env vars are not set
let initialized = false;

function ensureInitialized() {
  if (!initialized) {
    if (!SENDGRID_API_KEY) {
      throw new Error('SENDGRID_API_KEY is not set');
    }
    sgMail.setApiKey(SENDGRID_API_KEY);
    initialized = true;
  }
}

export function createSendGridClient() {
  ensureInitialized();
  return sgMail;
}

export async function sendOfferEmail(
  toEmail: string,
  toName: string | undefined,
  htmlContent: string,
  plainText: string,
  subject: string = 'Professional Offer for Your Property'
) {
  ensureInitialized();

  try {
    const [response] = await sgMail.send({
      to: {
        email: toEmail,
        name: toName ?? 'Property Owner',
      },
      from: {
        email: SENDGRID_FROM_EMAIL,
        name: SENDGRID_FROM_NAME,
      },
      subject,
      html: htmlContent,
      text: plainText,
      trackingSettings: {
        clickTracking: {
          enable: true,
          enableText: false, // Don't track plain text links
        },
        openTracking: {
          enable: true,
        },
      },
      mailSettings: {
        sandboxMode: {
          enable: process.env.NODE_ENV === 'development', // Dev uses sandbox
        },
      },
    });

    // Extract message ID from SendGrid response
    const messageId = response.headers['x-message-id'] as string | undefined;
    return {
      success: true,
      messageId,
      statusCode: response.statusCode,
    };
  } catch (error) {
    console.error('SendGrid send error:', error);
    throw error;
  }
}

/**
 * Verify SendGrid webhook signature
 * SendGrid signs all webhooks with HMAC-SHA256
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  timestamp: string,
  secret: string
): boolean {
  try {
    const hmac = createHmac('sha256', secret);
    hmac.update(timestamp + payload);
    const expectedSig = hmac.digest('base64');
    return expectedSig === signature;
  } catch (error) {
    console.error('Webhook signature verification failed:', error);
    return false;
  }
}
