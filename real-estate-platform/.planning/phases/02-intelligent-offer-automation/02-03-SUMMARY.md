---
phase: 02-intelligent-offer-automation
plan: "03"
subsystem: offer-send-api
tags: [sendgrid, prisma, clerk, nextjs, zod, bullmq, offer-delivery, bulk-send, tracking]

# Dependency graph
requires:
  - phase: 02-01
    provides: "sendOfferEmail(), renderOfferEmail(), calculateMAO(), OfferedDeal schema"
  - phase: 02-02
    provides: "scheduleFollowUpSequence(), FollowUpScheduled schema, BullMQ queue"

provides:
  - "POST /api/offers/send — individual offer send with optional sequence trigger"
  - "POST /api/offers/bulk-send — batch offer send (up to 50) with per-deal result tracking"
  - "GET /api/offers — paginated delivery tracking query with status filtering"
  - "OfferedDeal record creation at send time with sendgridMessageId for webhook correlation"
  - "Follow-up sequence trigger at send time (FollowUpScheduled creation + BullMQ enqueue)"

affects: [02-07-frontend-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Bulk send: pre-load all deals in single query (dealIds IN clause) to avoid N+1"
    - "Partial success: bulk-send continues on per-deal failures, returns per-deal result array"
    - "Sequence resolution: per-deal sequenceId override takes priority over global sequenceId"
    - "OfferedDeal.sendgridMessageId links delivery record to SendGrid webhook events"
    - "Zod coerce for query param parsing (page/limit as strings coerced to numbers)"
    - "Prisma $transaction for atomic count + list in GET /api/offers"

key-files:
  created:
    - src/app/api/offers/send/route.ts
    - src/app/api/offers/bulk-send/route.ts
    - src/app/api/offers/route.ts
  modified: []

decisions:
  - "Bulk send processes deals sequentially (not parallel) to isolate per-deal failures and avoid SendGrid rate limits"
  - "Per-deal sequenceId override takes priority over global sequenceId in bulk-send"
  - "Offer price = MAO * 0.95 (5% below MAO) — consistent with generate endpoint established in prior plan"
  - "GET /api/offers includes deal title + property address to avoid separate lookup in UI"
  - "BULK_SEND_LIMIT = 50 to prevent abuse while supporting realistic batch sizes"

metrics:
  duration: "4 minutes"
  completed_date: "2026-02-27"
  tasks_completed: 3
  tasks_total: 3
  files_created: 3
  files_modified: 0
---

# Phase 02 Plan 03: Offer Send + Bulk Send API Summary

**One-liner:** Individual and bulk offer send endpoints with SendGrid delivery + optional BullMQ follow-up sequence trigger, plus paginated delivery tracking query.

---

## What Was Built

### Individual Offer Send (`src/app/api/offers/send/route.ts`)

`POST /api/offers/send` — Sends a single offer email and creates an `OfferedDeal` record:

1. Validates input via zod schema (dealId, recipientEmail, repairCosts?, subject?, sequenceId?)
2. Resolves clerkId to internal user; fetches deal + property with ownership check
3. Validates sequence ownership if `sequenceId` provided
4. Calculates MAO using `calculateMAO()` (70% rule), renders offer email via `renderOfferEmail()`
5. Sends via `sendOfferEmail()` (SendGrid with tracking enabled)
6. Creates `OfferedDeal` record with `sendgridMessageId` for webhook correlation
7. Optionally creates `FollowUpScheduled` and enqueues step 0 via `scheduleFollowUpSequence()`

Response includes: offeredDeal record, offerSummary (MAO, formula, offerPrice), optional scheduledSequence id.

### Bulk Send (`src/app/api/offers/bulk-send/route.ts`)

`POST /api/offers/bulk-send` — Sends up to 50 offer emails in a single request:

- Pre-loads all referenced deals in a single `dealIds IN` query (avoids N+1)
- Pre-validates all per-deal sequenceIds in a single query
- Processes each offer sequentially — per-deal failures don't block others
- Global `sequenceId` or per-deal override (per-deal takes priority)
- Returns `{ summary: { total, succeeded, failed }, results: [...] }` with per-deal success/error

### Delivery Tracking Query (`src/app/api/offers/route.ts`)

`GET /api/offers` — Paginated list of sent offer records:

- Optional filter by `dealId` and/or `status` (SENT | OPENED | CLICKED | BOUNCED | COMPLAINED | UNSUBSCRIBED)
- Pagination: `page` + `limit` (default 20, max 100)
- Includes deal title + property address in each result
- Uses Prisma `$transaction` for atomic count + list

---

## Deviations from Plan

None — plan executed exactly as written.

---

## Self-Check: PASSED

| Item | Status |
|------|--------|
| src/app/api/offers/send/route.ts | FOUND |
| src/app/api/offers/bulk-send/route.ts | FOUND |
| src/app/api/offers/route.ts | FOUND |
| commit 1d26f9f (Task 1: POST /api/offers/send) | FOUND |
| commit 6cdc9e6 (Task 2: POST /api/offers/bulk-send) | FOUND |
| commit 663401a (Task 3: GET /api/offers) | FOUND |
| TypeScript errors in my new files: 0 | PASSED |
| Pre-existing TS errors (CreativeFinanceType, skipTraceRequest, ruleSubtype) | PRE-EXISTING — out of scope |
