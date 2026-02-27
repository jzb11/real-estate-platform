/**
 * PropStreamClient — API abstraction layer.
 *
 * Phase 1: PropStream does not have a public API (partnership required).
 * Data is imported via CSV export from PropStream's UI.
 * Use POST /api/properties/import and GET /api/properties/search instead.
 *
 * Phase 2: When PropStream partnership is secured, this class gets a live
 * API implementation — no other code changes required.
 */
import type { PropStreamProperty, PropertySearchFilters } from './types';

export class PropStreamClient {
  private readonly apiKey: string | undefined;
  private readonly baseUrl: string;

  constructor() {
    this.apiKey = process.env.PROPSTREAM_API_KEY;
    this.baseUrl = process.env.PROPSTREAM_API_URL ?? 'https://api.propstream.com/v1';
  }

  /**
   * Search properties via PropStream API.
   *
   * Phase 1: Not yet available — PropStream requires partnership for API access.
   * All data comes from CSV imports ingested via /api/properties/import.
   * Use GET /api/properties/search for DB-backed property search.
   *
   * Phase 2 implementation: replace throw with live API call.
   */
  async searchProperties(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _filters: PropertySearchFilters
  ): Promise<PropStreamProperty[]> {
    if (!this.apiKey) {
      throw new Error(
        'PropStream API not available (Phase 1). ' +
          'Import properties via CSV at POST /api/properties/import and search via ' +
          'GET /api/properties/search. ' +
          'Set PROPSTREAM_API_KEY when partnership is established for live API access.'
      );
    }

    // Phase 2 — placeholder for live API implementation:
    // const response = await fetch(`${this.baseUrl}/properties/search`, {
    //   method: 'POST',
    //   headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
    //   body: JSON.stringify(filters),
    // });
    // return response.json() as Promise<PropStreamProperty[]>;

    throw new Error(
      `PropStream live API not yet implemented. API key is set but Phase 2 implementation is pending. URL: ${this.baseUrl}`
    );
  }

  /**
   * Returns true if a live PropStream API key is configured.
   * Useful for toggling UI between "import CSV" and "live API" modes.
   */
  isApiAvailable(): boolean {
    return !!this.apiKey;
  }
}

export const propStreamClient = new PropStreamClient();
