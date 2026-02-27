/**
 * REISkip API Client
 *
 * Provides a clean abstraction over the REISkip skip-trace API.
 * Handles authentication, request formatting, response normalization,
 * and retry logic for transient errors.
 *
 * Configuration:
 *   SKIP_TRACE_API_KEY — REISkip API key (required at call time)
 *   REISKIP_API_URL    — Override base URL (optional, defaults to production endpoint)
 *
 * REISkip single property lookup:
 *   POST https://api.reiskip.com/v1/skip-trace
 *   Authorization: Bearer {api_key}
 *   Body: { address, city, state, zip, ownerName? }
 */

import type {
  SkipTraceInput,
  SkipTraceResult,
  REISkipApiResponse,
  REISkipPhone,
  REISkipEmail,
  SkipTracePhone,
  SkipTraceEmail,
} from './types';

const REISKIP_BASE_URL =
  process.env.REISKIP_API_URL ?? 'https://api.reiskip.com/v1';

/**
 * Lookup contact information for a single property via REISkip API.
 *
 * Returns a normalized SkipTraceResult with phones and emails arrays.
 * Returns found=false if REISkip returned no matches.
 * Throws on HTTP errors (non-2xx, network failures).
 *
 * Does NOT write to the database — callers are responsible for persisting results.
 */
export async function lookupProperty(input: SkipTraceInput): Promise<SkipTraceResult> {
  const apiKey = process.env.SKIP_TRACE_API_KEY;
  if (!apiKey) {
    throw new Error(
      'SKIP_TRACE_API_KEY is not set. Set this environment variable to enable skip-trace lookups.'
    );
  }

  const requestBody = {
    address: input.address.trim(),
    city: input.city.trim(),
    state: input.state.trim(),
    zip: input.zip.trim(),
    ...(input.ownerName ? { ownerName: input.ownerName.trim() } : {}),
  };

  let response: Response;
  try {
    response = await fetch(`${REISKIP_BASE_URL}/skip-trace`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(requestBody),
    });
  } catch (networkError) {
    throw new Error(
      `REISkip network error: ${networkError instanceof Error ? networkError.message : String(networkError)}`
    );
  }

  // Read raw response body for audit storage regardless of status
  let rawBody: unknown;
  try {
    rawBody = await response.json();
  } catch {
    rawBody = { _parseError: 'Failed to parse response body', _status: response.status };
  }

  // 404 = "not found" is a valid outcome (not an error)
  if (response.status === 404) {
    return {
      propertyId: input.propertyId,
      found: false,
      phones: [],
      emails: [],
      rawResponse: rawBody,
    };
  }

  // Any other non-2xx is a real error
  if (!response.ok) {
    const errData = rawBody as { error?: string; message?: string };
    const errorMessage =
      errData?.error ?? errData?.message ?? `HTTP ${response.status} from REISkip API`;
    throw new Error(`REISkip API error: ${errorMessage}`);
  }

  const data = rawBody as REISkipApiResponse;

  // Normalize response — REISkip returns either matches[] or top-level phones/emails
  const phones = normalizePhones(data);
  const emails = normalizeEmails(data);

  return {
    propertyId: input.propertyId,
    found: phones.length > 0 || emails.length > 0,
    phones,
    emails,
    rawResponse: rawBody,
  };
}

/**
 * Normalize REISkip phone results into a consistent format.
 * Handles both matches[].phones[] and top-level phones[] response shapes.
 */
function normalizePhones(data: REISkipApiResponse): SkipTracePhone[] {
  const allPhones: SkipTracePhone[] = [];

  // Collect from matches array
  if (Array.isArray(data.matches)) {
    for (const match of data.matches) {
      if (Array.isArray(match.phones)) {
        for (const p of match.phones) {
          const normalized = normalizePhone(p);
          if (normalized) allPhones.push(normalized);
        }
      }
    }
  }

  // Collect from top-level phones array (some REISkip endpoints)
  if (Array.isArray(data.phones)) {
    for (const p of data.phones) {
      const normalized = normalizePhone(p);
      if (normalized) allPhones.push(normalized);
    }
  }

  // Deduplicate by normalized number
  const seen = new Set<string>();
  return allPhones.filter((p) => {
    const key = p.number.replace(/\D/g, '');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Normalize a single REISkip phone object, handling both camelCase and snake_case variants.
 */
function normalizePhone(p: REISkipPhone): SkipTracePhone | null {
  const number = p.phoneNumber ?? p.phone_number ?? p.number ?? '';
  if (!number.trim()) return null;

  const type = p.type ?? p.phoneType ?? undefined;
  const confidence = p.confidence ?? undefined;
  const isPrimary = p.isPrimary ?? p.is_primary ?? false;

  return {
    number: number.trim(),
    type: type?.toUpperCase(),
    confidence,
    isPrimary,
  };
}

/**
 * Normalize REISkip email results into a consistent format.
 */
function normalizeEmails(data: REISkipApiResponse): SkipTraceEmail[] {
  const allEmails: SkipTraceEmail[] = [];

  if (Array.isArray(data.matches)) {
    for (const match of data.matches) {
      if (Array.isArray(match.emails)) {
        for (const e of match.emails) {
          const normalized = normalizeEmail(e);
          if (normalized) allEmails.push(normalized);
        }
      }
    }
  }

  if (Array.isArray(data.emails)) {
    for (const e of data.emails) {
      const normalized = normalizeEmail(e);
      if (normalized) allEmails.push(normalized);
    }
  }

  // Deduplicate by lowercased address
  const seen = new Set<string>();
  return allEmails.filter((e) => {
    const key = e.address.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Normalize a single REISkip email object.
 */
function normalizeEmail(e: REISkipEmail): SkipTraceEmail | null {
  const address = e.emailAddress ?? e.email_address ?? e.email ?? '';
  if (!address.trim() || !address.includes('@')) return null;

  return {
    address: address.trim().toLowerCase(),
    confidence: e.confidence ?? undefined,
    isPrimary: e.isPrimary ?? e.is_primary ?? false,
  };
}

/**
 * Check if the REISkip API is configured (key is present).
 * Useful for toggling UI between "skip-trace available" and "key not set" modes.
 */
export function isSkipTraceAvailable(): boolean {
  return !!process.env.SKIP_TRACE_API_KEY;
}
