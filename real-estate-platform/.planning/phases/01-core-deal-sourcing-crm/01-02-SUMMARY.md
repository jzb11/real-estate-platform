---
phase: 01-core-deal-sourcing-crm
plan: "02"
subsystem: api
tags: [papaparse, csv, aes-256-gcm, encryption, prisma, postgres, propstream, search, filters]

# Dependency graph
requires:
  - phase: 01-core-deal-sourcing-crm
    plan: "01"
    provides: "Prisma schema (User, Property, Deal models), Prisma client, Clerk auth, database connection"
provides:
  - "PropStreamClient abstraction layer (client.ts) for future API partnership swap"
  - "parsePropStreamCsv — CSV parser mapping PropStream export columns to Property model with AES-256-GCM phone encryption"
  - "buildPropertyFilter — converts 5 filter dimensions to Prisma WHERE clause"
  - "POST /api/properties/import — multipart CSV upload returning {imported, updated, skipped, errors}"
  - "GET /api/properties/search — paginated filtered query with isStale flag"
  - "GET/POST /api/search-filters — saved filter preset CRUD"
  - "GET/DELETE /api/search-filters/[id] — retrieve and delete filters with ownership enforcement"
  - "Prisma migration: equityPercent, debtOwed, interestRate, daysOnMarket columns + indexes on Property"
  - "Prisma migration: SavedSearchFilter model with userId relation"
affects:
  - "01-03 (deal creation/pipeline) — can now create deals from imported properties"
  - "01-04 (qualification engine) — equityPercent/debtOwed/interestRate now typed columns, filterable"
  - "01-05 (TCPA compliance) — import preserves encrypted ownershipPhone for contact workflow"
  - "01-06 (skip-trace) — properties without ownershipPhone can be queued for skip-trace"

# Tech tracking
tech-stack:
  added:
    - "papaparse + @types/papaparse — CSV parsing with case-insensitive header mapping"
  patterns:
    - "AES-256-GCM phone encryption: iv + authTag + ciphertext stored as base64 JSON — never plaintext"
    - "CSV header mapping: case-insensitive + partial match fallback for PropStream export variations"
    - "PropStream abstraction: client.ts provides Phase 1 stub, drops in Phase 2 live API without downstream changes"
    - "User scoping via Deal relation: properties are globally stored, user-scoped through Deal.userId"
    - "buildPropertyFilter: typed column filters (not JSONB path) for index-backed queries"
    - "isStale flag: computed at query time from dataFreshnessDate > 14 days threshold"
    - "Ownership verification pattern: findFirst({where:{id, userId}}) before delete — 404 prevents existence leakage"

key-files:
  created:
    - "src/lib/propstream/types.ts — PropStreamProperty, PropertySearchFilters, ImportResult, SavedSearchFilter interfaces"
    - "src/lib/propstream/csvParser.ts — parsePropStreamCsv + encryptPhone/decryptPhone with AES-256-GCM"
    - "src/lib/propstream/client.ts — PropStreamClient abstraction (Phase 1 stub, Phase 2 API slot)"
    - "src/lib/propstream/searchFilters.ts — buildPropertyFilter, mergeFilters"
    - "src/app/api/properties/import/route.ts — POST multipart CSV import"
    - "src/app/api/properties/search/route.ts — GET paginated filtered property search"
    - "src/app/api/search-filters/route.ts — GET list + POST create saved filters"
    - "src/app/api/search-filters/[id]/route.ts — GET single + DELETE saved filter"
    - "prisma/migrations/20260227034104_add_filter_columns/migration.sql — filter column + SavedSearchFilter migration"
  modified:
    - "prisma/schema.prisma — added equityPercent, debtOwed, interestRate, daysOnMarket to Property; added SavedSearchFilter model; added savedSearchFilters relation to User"
    - "package.json — added papaparse, @types/papaparse"

key-decisions:
  - "Typed columns over JSONB: equityPercent/debtOwed/interestRate/daysOnMarket added as typed columns (not JSONB fields) for efficient index-backed filtering"
  - "User scoping via Deal relation: Property table is global (externalId dedup across users); user isolation enforced through Deal.userId join"
  - "AES-256-GCM encryption at import time: phone numbers encrypted in parsePropStreamCsv before any return — never stored as plaintext"
  - "Phase 1/Phase 2 abstraction: PropStreamClient throws descriptive error in Phase 1, ready to swap to live API calls in Phase 2 without changing calling code"
  - "Address hash as externalId fallback: when PropStream CSV lacks Property ID column, generate from address+city+state+zip — ensures stable upsert key"
  - "Raw data preservation: full original CSV row stored in rawData JSONB — audit trail, never discard original"
  - "Stale threshold: 14 days matches RESEARCH.md data freshness requirement"
  - "Row limit: 10,000 per import — returns 413 if exceeded, prevents OOM on large exports"

patterns-established:
  - "Filter merging: savedFilter base + query param override — filterId loads preset, query params take precedence"
  - "ImportResult shape: {totalRows, imported, updated, skipped, errors[]} — standard import summary contract"
  - "Pagination: default 50/page, max 200/page, returns {properties, total, page, limit, hasMore}"

requirements-completed:
  - DS-01
  - DS-02
  - DS-03
  - DS-04
  - DS-05
  - DS-06
  - DS-07

# Metrics
duration: 6min
completed: 2026-02-27
---

# Phase 01 Plan 02: PropStream Data Layer Summary

**PropStream CSV import pipeline with AES-256-GCM phone encryption, 5-dimension Prisma property search, and saved filter presets**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-27T03:38:54Z
- **Completed:** 2026-02-27T03:45:07Z
- **Tasks:** 2
- **Files modified:** 9 created, 2 modified

## Accomplishments

- PropStream CSV import: parses export files with case-insensitive header mapping, encrypts phone numbers (AES-256-GCM) at import time, upserts up to 10,000 properties with raw data preservation
- Property search: 5 filter dimensions (equity %, debt owed, interest rate, days-on-market, geographic) using typed indexed columns; paginated with isStale flag for data older than 14 days
- Saved filters: full CRUD with Zod validation, filterId merge-on-search support, ownership-verified deletion
- Schema migration: added equityPercent, debtOwed, interestRate, daysOnMarket typed columns + indexes; SavedSearchFilter model with userId relation

## Task Commits

Each task was committed atomically:

1. **Task 1: PropStream data layer — CSV parser, API abstraction, search filters** - `a305b4c` (feat)
2. **Task 2: Property import/search API routes + saved filters CRUD** - `2dc7f4d` (feat)

## Files Created/Modified

- `src/lib/propstream/types.ts` — PropStreamProperty, PropertySearchFilters, ImportResult, SavedSearchFilter interfaces
- `src/lib/propstream/csvParser.ts` — parsePropStreamCsv with AES-256-GCM phone encryption, case-insensitive header mapping, raw data preservation
- `src/lib/propstream/client.ts` — PropStreamClient abstraction (Phase 1 stub, Phase 2 API slot ready)
- `src/lib/propstream/searchFilters.ts` — buildPropertyFilter (5 dimensions to Prisma WHERE), mergeFilters
- `src/app/api/properties/import/route.ts` — POST multipart CSV upload, 10K row limit, ImportResult response
- `src/app/api/properties/search/route.ts` — GET paginated filtered search with isStale, filterId merge support
- `src/app/api/search-filters/route.ts` — GET list + POST create with Zod validation
- `src/app/api/search-filters/[id]/route.ts` — GET single + DELETE with ownership enforcement (404 not 403)
- `prisma/schema.prisma` — Property filter columns + indexes; SavedSearchFilter model; User.savedSearchFilters relation
- `prisma/migrations/20260227034104_add_filter_columns/migration.sql` — migration for above schema changes
- `package.json` — added papaparse + @types/papaparse

## Decisions Made

- **Typed columns over JSONB:** equityPercent/debtOwed/interestRate/daysOnMarket added as typed columns (not JSONB path queries) — required for efficient filtering with indexes
- **User scoping via Deal relation:** Property table is globally deduped by externalId; user isolation enforced through `deals: { some: { userId } }` join — allows properties shared across users (same house, different investors) while preventing cross-tenant access
- **AES-256-GCM at import time:** Phone numbers encrypted inside parsePropStreamCsv before any return value — the function never returns plaintext phone numbers
- **Phase 1/Phase 2 abstraction:** PropStreamClient established pattern without blocking anything — when API partnership secured, only client.ts changes
- **Address hash as externalId fallback:** Stable upsert key when PropStream CSV lacks Property ID column

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added database indexes for filter columns**
- **Found during:** Task 1 (schema update)
- **Issue:** Plan specified adding typed columns but did not include indexes — without indexes, filtering on equityPercent/debtOwed/daysOnMarket would require full table scans
- **Fix:** Added `@@index([equityPercent])`, `@@index([debtOwed])`, `@@index([daysOnMarket])` to Property model in schema migration
- **Files modified:** prisma/schema.prisma
- **Committed in:** a305b4c (Task 1 commit)

**2. [Rule 1 - Bug] Fixed papaparse trimHeaders API mismatch**
- **Found during:** Task 1 TypeScript verification
- **Issue:** `trimHeaders` is not a valid papaparse config option — TypeScript error. Also, parsing without `worker: false` returns `void` instead of `ParseResult`
- **Fix:** Changed to `transformHeader: (h) => h.trim()` and added `worker: false, download: false` to ensure synchronous parse result
- **Files modified:** src/lib/propstream/csvParser.ts
- **Committed in:** a305b4c (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 missing critical, 1 bug)
**Impact on plan:** Both fixes essential for correctness. No scope creep.

## Issues Encountered

- Prisma migrate dev requires DATABASE_URL at shell level when prisma.config.ts reads from `process.env` — resolved by passing DATABASE_URL explicitly to migration command
- npm install papaparse required `--legacy-peer-deps` due to @clerk/clerk-react peer dependency on specific React minor versions — does not affect runtime behavior

## Next Phase Readiness

- Property data layer complete — deals can now be created from imported properties (Plan 01-03)
- equityPercent/debtOwed/interestRate typed columns ready for qualification engine rule evaluation (Plan 01-04)
- ownershipPhone encrypted and stored — contact workflow can use decryptPhone from csvParser.ts (Plan 01-05)
- Properties without ownershipPhone are queryable (Plan 01-06 skip-trace queue)

---
*Phase: 01-core-deal-sourcing-crm*
*Completed: 2026-02-27*
