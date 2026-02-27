/**
 * REISkip API types and internal skip-trace types.
 *
 * REISkip is a skip-trace service that looks up property owner contact
 * information (phone numbers and email addresses) from a property address.
 *
 * API docs: https://reiskip.com/api (requires API key — set SKIP_TRACE_API_KEY)
 */

/**
 * Input for a single skip-trace lookup.
 * Matches REISkip single-property lookup request format.
 */
export interface SkipTraceInput {
  propertyId: string; // Internal DB property ID
  address: string;
  city: string;
  state: string;
  zip: string;
  ownerName?: string; // Optional — improves match accuracy
}

/**
 * A single phone result returned from REISkip.
 */
export interface SkipTracePhone {
  number: string; // Normalized E.164 format where possible
  type?: string; // 'MOBILE', 'LANDLINE', 'VOIP', etc.
  confidence?: number; // 0-100 match confidence score
  isPrimary?: boolean;
}

/**
 * A single email result returned from REISkip.
 */
export interface SkipTraceEmail {
  address: string;
  confidence?: number; // 0-100 match confidence
  isPrimary?: boolean;
}

/**
 * Normalized skip-trace result after parsing REISkip API response.
 * This is the shape stored internally and written back to Property.
 */
export interface SkipTraceResult {
  propertyId: string;
  found: boolean;
  phones: SkipTracePhone[];
  emails: SkipTraceEmail[];
  rawResponse: unknown; // Full REISkip response preserved for audit
}

/**
 * Raw REISkip API response shape.
 * REISkip returns matches array with contact details per matched owner.
 */
export interface REISkipApiResponse {
  status?: string; // 'success', 'not_found', 'error'
  matches?: REISkipMatch[];
  error?: string;
  message?: string;
  // Some endpoints return results directly at top level
  phones?: REISkipPhone[];
  emails?: REISkipEmail[];
}

export interface REISkipMatch {
  firstName?: string;
  lastName?: string;
  fullName?: string;
  phones?: REISkipPhone[];
  emails?: REISkipEmail[];
  confidence?: number;
}

export interface REISkipPhone {
  phoneNumber?: string;
  phone_number?: string; // snake_case variant
  number?: string; // shorthand variant
  type?: string;
  phoneType?: string;
  confidence?: number;
  isPrimary?: boolean;
  is_primary?: boolean;
}

export interface REISkipEmail {
  emailAddress?: string;
  email_address?: string; // snake_case variant
  email?: string; // shorthand variant
  confidence?: number;
  isPrimary?: boolean;
  is_primary?: boolean;
}

/**
 * BullMQ job payload for skip-trace queue.
 */
export interface SkipTraceJobPayload {
  skipTraceRequestId: string; // SkipTraceRequest.id
  propertyId: string;
  userId: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  ownerName?: string;
}

/**
 * Bulk skip-trace request summary.
 */
export interface BulkSkipTraceResult {
  queued: number;
  skipped: number; // Already skip-traced recently
  errors: string[];
  requestIds: string[];
}
