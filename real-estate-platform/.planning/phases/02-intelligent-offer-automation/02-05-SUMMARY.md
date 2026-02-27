---
phase: 02-intelligent-offer-automation
plan: "05"
subsystem: contact-enrichment, skip-trace
tags: [reiskip, skip-trace, bullmq, redis, prisma, encryption, aes-256-gcm, phone-lookup, email-lookup, nextjs, zod, clerk]

# Dependency graph
requires:
  - phase: 01-02
    provides: "AES-256-GCM phone encryption (encryptPhone) — reused for skip-trace phone storage"
  - phase: 01-05
    provides: "compliance/encryption.ts with encryptPhone/decryptPhone/hashPhoneForLookup"
  - phase: 02-02
    provides: "BullMQ Redis queue infrastructure pattern — skip-trace queue follows same pattern"

provides:
  - "REISkip API client (lookupProperty) — single property skip-trace via HTTP POST"
  - "isSkipTraceAvailable() — checks SKIP_TRACE_API_KEY presence for graceful degradation"
  - "SkipTraceJobPayload type + enqueueSkipTrace() — BullMQ job enqueuing"
  - "processSkipTraceJob() — job processor: IN_PROGRESS -> REISkip -> COMPLETED/FAILED"
  - "POST /api/properties/skip-trace — single property lookup, queued async, 202 Accepted"
  - "POST /api/properties/skip-trace/bulk — bulk queue (up to 500), defaults to phone-missing properties"
  - "GET /api/properties/skip-trace/status — poll by propertyId or requestId"
  - "SkipTraceRequest schema table — tracks every lookup with status, phoneFound, emailFound, rawResponse"
  - "Property.ownershipEmail — new column for skip-trace returned emails"
  - "Property.skipTraced — boolean flag to prevent re-tracing already-enriched properties"
  - "SkipTraceStatus enum — PENDING | IN_PROGRESS | COMPLETED | FAILED | NOT_FOUND"

affects: [02-07-frontend-ui, any-outreach-feature-needing-phone-email]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "REISkip API client: POST /v1/skip-trace with Bearer token auth, JSON body {address, city, state, zip, ownerName?}"
    - "Response normalization: handles both matches[].phones[] and top-level phones[] shapes"
    - "Phone deduplication: Set<string> on normalized digits prevents duplicate numbers"
    - "Email deduplication: Set<string> on lowercased addresses prevents duplicate emails"
    - "Primary selection: isPrimary flag > highest confidence > first result"
    - "AES-256-GCM phone encryption: skip-trace phones encrypted same way as CSV-imported phones"
    - "Email storage: plain text in Property.ownershipEmail (business contact, not financial PII)"
    - "skipTraced flag: set to true on COMPLETED or NOT_FOUND — prevents indefinite retries"
    - "BullMQ queue: concurrency 1 (no parallel REISkip calls), 3 retries, 2s/4s/8s exponential backoff"
    - "Duplicate request prevention: 409 if PENDING or IN_PROGRESS request exists for same property"
    - "rawResponse excluded from status API: may contain PII; stored for internal audit only"
    - "Bulk default: properties without ownershipPhone, up to 500 per request"
    - "Ownership enforcement: single endpoint checks Deal.userId; bulk checks Deal relation"

key-files:
  created:
    - src/lib/skiptrace/types.ts
    - src/lib/skiptrace/reiskip.ts
    - src/lib/skiptrace/queue.ts
    - src/lib/skiptrace/processor.ts
    - src/app/api/properties/skip-trace/route.ts
    - src/app/api/properties/skip-trace/bulk/route.ts
    - src/app/api/properties/skip-trace/status/route.ts
    - prisma/migrations/20260227160000_add_skip_trace_request/migration.sql
  modified:
    - prisma/schema.prisma (added SkipTraceStatus enum, SkipTraceRequest model, Property.ownershipEmail, Property.skipTraced, User.skipTraceRequests relation, Property.skipTraceRequests relation)

decisions:
  - "REISkip API client as pure abstraction: no DB calls in reiskip.ts — processor.ts handles all persistence"
  - "Phone encrypted with AES-256-GCM before DB write: matches CSV import pattern from 01-02"
  - "Email stored as plain text: business contact email, not financial consumer data"
  - "skipTraced=true on NOT_FOUND: prevents indefinite retries for non-traceable properties"
  - "BullMQ concurrency: 1 to avoid overwhelming REISkip rate limits from single worker"
  - "rawResponse stored in DB but excluded from status API: audit trail without API surface PII exposure"
  - "Bulk defaults to phone-missing properties: primary use case is enriching properties from CSV import"

metrics:
  duration: "12 minutes"
  completed_date: "2026-02-27"
  tasks_completed: 3
  tasks_total: 3
  files_created: 8
  files_modified: 1
---

# Phase 02 Plan 05: Contact Enrichment + Skip-Trace Integration Summary

**One-liner:** REISkip API integration with BullMQ async queue, AES-256-GCM phone encryption, and bulk enrichment for properties missing owner contact information.

---

## What Was Built

### REISkip API Client (`src/lib/skiptrace/reiskip.ts`)

`lookupProperty(input)` makes a single HTTP POST to REISkip's skip-trace endpoint:
- Handles `404 Not Found` as a valid "not found" outcome (not an error)
- Normalizes responses from both `matches[].phones[]` and top-level `phones[]` shapes
- Deduplicates phone numbers by normalized digits and emails by lowercased address
- Stores full `rawResponse` for audit trail regardless of outcome
- Returns `{ found, phones[], emails[], rawResponse }` — never writes to DB

`isSkipTraceAvailable()` — checks `SKIP_TRACE_API_KEY` presence. API endpoints return `503` when key is missing.

### Skip-Trace Types (`src/lib/skiptrace/types.ts`)

- `SkipTraceInput` — address + optional ownerName for REISkip request
- `SkipTracePhone` / `SkipTraceEmail` — normalized result shapes
- `SkipTraceResult` — normalized output from `lookupProperty()`
- `REISkipApiResponse` / `REISkipMatch` / `REISkipPhone` / `REISkipEmail` — raw API shapes (handles both camelCase and snake_case variants)
- `SkipTraceJobPayload` — BullMQ job data structure
- `BulkSkipTraceResult` — bulk endpoint response shape

### BullMQ Queue (`src/lib/skiptrace/queue.ts`)

`skip-trace` queue with:
- `concurrency: 1` — no parallel REISkip calls from the same worker
- 3 retries with exponential backoff: 2s → 4s → 8s
- `lockDuration: 60000` — 60s lock because REISkip calls can take up to 30s
- Lazy import of `processSkipTraceJob` in worker to avoid circular dependency
- `enqueueSkipTrace(payload)` — enqueues job with `jobId: skip-trace-{requestId}`
- SIGTERM handler for graceful shutdown

### Job Processor (`src/lib/skiptrace/processor.ts`)

`processSkipTraceJob(payload)` execution flow:
1. Mark `SkipTraceRequest.status = IN_PROGRESS`
2. Call `lookupProperty()` via REISkip API
3. Select primary phone: `isPrimary` flag > highest confidence score > first
4. Encrypt primary phone with `encryptPhone()` (AES-256-GCM — same as CSV import pattern)
5. Select primary email: same priority logic
6. Write `ownershipPhone`, `ownershipEmail`, `skipTraced=true` back to `Property`
7. Mark `SkipTraceRequest` as `COMPLETED` or `NOT_FOUND`
8. On exception: mark `FAILED` with `errorMessage`, rethrow (triggers BullMQ retry)

### Schema Changes

**New enum:**
```
SkipTraceStatus: PENDING | IN_PROGRESS | COMPLETED | FAILED | NOT_FOUND
```

**New columns on `Property`:**
- `ownershipEmail String?` — email from skip-trace (plain text)
- `skipTraced Boolean @default(false)` — enrichment flag
- `@@index([skipTraced])` — indexed for bulk query efficiency

**New model `SkipTraceRequest`:**
- Full audit trail: `status`, `requestedAt`, `completedAt`, `phoneFound`, `emailFound`, `rawResponse`, `errorMessage`
- FK relations to both `Property` and `User` with CASCADE delete
- Indexed on `propertyId`, `(userId, status)`, and `requestedAt`

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/properties/skip-trace` | POST | Single property lookup: creates SkipTraceRequest, enqueues BullMQ job, returns 202 |
| `/api/properties/skip-trace/bulk` | POST | Bulk queue: up to 500 properties, defaults to phone-missing, returns queued/skipped counts |
| `/api/properties/skip-trace/status` | GET | Poll by `?propertyId=` or `?requestId=` — returns status, phoneFound, emailFound |

All endpoints:
- Require Clerk auth
- Return `503` when `SKIP_TRACE_API_KEY` is not set
- Return `409` if PENDING/IN_PROGRESS request already exists for the property
- Exclude `rawResponse` from responses (PII audit-trail only)
- Enforce user ownership via `Deal.userId` relation

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added User FK relation to SkipTraceRequest**
- **Found during:** Task 1 (schema design)
- **Issue:** Initial schema had `userId` column but no Prisma relation to `User` model — prevents Prisma from enforcing referential integrity and generating correct types
- **Fix:** Added `user User @relation(...)` to `SkipTraceRequest` + `skipTraceRequests SkipTraceRequest[]` to `User`; updated migration SQL with `SkipTraceRequest_userId_fkey`
- **Files modified:** prisma/schema.prisma, prisma/migrations/.../migration.sql

**2. [Rule 2 - Missing Critical] Excluded rawResponse from status API**
- **Found during:** Task 3 (status endpoint design)
- **Issue:** Raw REISkip response may contain full owner name, address history, and other PII. Exposing it via API surface would create an unintended data leak.
- **Fix:** Status endpoint explicitly selects only `id, propertyId, status, requestedAt, completedAt, phoneFound, emailFound, errorMessage` — `rawResponse` excluded with comment

**3. [Rule 1 - Bug] Removed redundant `updatedAt` explicit set in processor.ts**
- **Found during:** Task 2 (processor code review)
- **Issue:** `propertyUpdate.updatedAt = new Date()` — `@updatedAt` is managed by Prisma automatically. Setting it explicitly is redundant and creates a TypeScript type issue.
- **Fix:** Removed the explicit `updatedAt` field from the update payload.

---

## Manual Steps Required

**The Bash tool was unavailable in this session, so the following steps must be run manually:**

### 1. Apply database migration

```bash
DATABASE_URL=$(grep '^DATABASE_URL=' .env.local | cut -d= -f2-) \
  npx prisma migrate deploy
```

Or for development (interactive):

```bash
npx prisma migrate dev --name add_skip_trace_request
```

### 2. Regenerate Prisma client

```bash
npx prisma generate
```

### 3. Verify TypeScript compilation

```bash
npx tsc --noEmit
```

### 4. Verify Next.js build

```bash
npm run build
```

### 5. Commit the changes

```bash
git add prisma/schema.prisma
git add "prisma/migrations/20260227160000_add_skip_trace_request/migration.sql"
git add src/lib/skiptrace/types.ts
git add src/lib/skiptrace/reiskip.ts
git add src/lib/skiptrace/queue.ts
git add src/lib/skiptrace/processor.ts
git commit -m "feat(02-05): add skip-trace schema (SkipTraceRequest, ownershipEmail, skipTraced)

- Add SkipTraceStatus enum (PENDING, IN_PROGRESS, COMPLETED, FAILED, NOT_FOUND)
- Add Property.ownershipEmail and Property.skipTraced columns with index
- Add SkipTraceRequest model with FK to Property and User
- Migration: 20260227160000_add_skip_trace_request
"

git add src/lib/skiptrace/types.ts src/lib/skiptrace/reiskip.ts src/lib/skiptrace/queue.ts src/lib/skiptrace/processor.ts
git commit -m "feat(02-05): add REISkip client, BullMQ queue, and job processor

- reiskip.ts: lookupProperty() with response normalization, dedup, isSkipTraceAvailable()
- queue.ts: skip-trace BullMQ queue with concurrency 1, 3 retries, exponential backoff
- processor.ts: processSkipTraceJob() with IN_PROGRESS->COMPLETED/FAILED lifecycle
- types.ts: SkipTraceInput, SkipTraceResult, SkipTraceJobPayload, BulkSkipTraceResult
"

git add src/app/api/properties/skip-trace/route.ts
git add src/app/api/properties/skip-trace/bulk/route.ts
git add src/app/api/properties/skip-trace/status/route.ts
git commit -m "feat(02-05): add skip-trace API endpoints (single, bulk, status)

- POST /api/properties/skip-trace: single property lookup, 202 Accepted
- POST /api/properties/skip-trace/bulk: bulk queue up to 500, defaults to phone-missing
- GET /api/properties/skip-trace/status: poll by propertyId or requestId
- All endpoints enforce Clerk auth, 503 if API key missing, 409 on duplicate active request
"

git add .planning/phases/02-intelligent-offer-automation/02-05-SUMMARY.md
git commit -m "docs(02-05): complete skip-trace integration plan summary"
```

---

## Self-Check

| Item | Status |
|------|--------|
| src/lib/skiptrace/types.ts | FOUND |
| src/lib/skiptrace/reiskip.ts | FOUND |
| src/lib/skiptrace/queue.ts | FOUND |
| src/lib/skiptrace/processor.ts | FOUND |
| src/app/api/properties/skip-trace/route.ts | FOUND |
| src/app/api/properties/skip-trace/bulk/route.ts | FOUND |
| src/app/api/properties/skip-trace/status/route.ts | FOUND |
| prisma/migrations/20260227160000_add_skip_trace_request/migration.sql | FOUND |
| prisma/schema.prisma modified (SkipTraceRequest model) | FOUND |
| TypeScript: npx tsc --noEmit | PENDING (Bash unavailable) |
| Next.js build: npm run build | PENDING (Bash unavailable) |
| Database migration applied | PENDING (Bash unavailable) |

**Self-Check: PARTIAL — Code complete, manual steps required to apply migration and verify build.**
