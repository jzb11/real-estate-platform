export interface OfferEmailData {
  propertyAddress: string;
  propertyCity: string;
  propertyState: string;
  propertyZip: string;
  estimatedValue: number;
  repairCosts: number;
  mao: number; // Maximum Allowable Offer
  offerPrice: number;
  equityPercent: number;
  realtor: {
    name: string;
    phone: string;
    email: string;
  };
}

export interface SendGridWebhookPayload {
  event: string;
  email?: string;
  timestamp?: number;
  'message-id'?: string;
  bounce_type?: string;
  complaint?: string;
  url?: string;
  [key: string]: unknown;
}
