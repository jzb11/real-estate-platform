---
phase: 01-core-deal-sourcing-crm
plan: "04"
subsystem: api, deals, state-machine
tags: [nextjs, prisma, typescript, zod, clerk, state-machine, audit-log, crm]

# Dependency graph
requires:
  - phase: 01-01
    provides: Prisma 7 + Neon schema (Deal, DealHistory, User models), Clerk auth middleware, prisma singleton at src/lib/db.ts
provides:
  - Deal state machine (VALID_TRANSITIONS, canTransition, transitionDeal) at src/lib/deals/stateMachine.ts
  - DealStatus TypeScript types (DealState, DealTransitionInput, TransitionResult, CreateDealInput, DealWithHistory) at src/lib/deals/types.ts
  - GET /api/deals — pipeline grouped by DealStatus stage, paginated flat list with ?status filter
  - POST /api/deals — creates deal from property in SOURCED state with initial DealHistory entry
  - GET /api/deals/[id] — full deal detail with complete ordered DealHistory + ruleEvals
  - PATCH /api/deals/[id] — updates mutable fields (title, notes, pipelinePosition, customFields); writes DealHistory per changed field
  - POST /api/deals/[id]/transition — enforces state machine; invalid transitions return 422 with valid next states list
affects:
  - 01-06 (pipeline UI — consumes GET /api/deals and POST /api/deals/[id]/transition)
  - 01-03 (qualification — writes qualificationScore to Deal; 01-04 endpoints return ruleEvals)
  - 01-07 (dashboard — uses deal pipeline data)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "State machine: VALID_TRANSITIONS typed constant is single source of truth for all deal pipeline transitions"
    - "Atomic audit: every state transition and field change writes DealHistory in same Prisma transaction"
    - "User scoping: all deal queries include userId: user.id — cross-user access returns 404 not 403"
    - "Zod 4: z.record() requires two arguments (keyType, valueType) — breaking change from Zod 3"
    - "422 vs 400: 422 for semantically invalid transitions, 400 for malformed requests"
    - "Clerk auth pattern: auth() → clerkId → prisma.user.findUnique(clerkId) → internal user.id"

key-files:
  created:
    - real-estate-platform/src/lib/deals/types.ts
    - real-estate-platform/src/lib/deals/stateMachine.ts
    - real-estate-platform/src/app/api/deals/route.ts
    - real-estate-platform/src/app/api/deals/[id]/route.ts
    - real-estate-platform/src/app/api/deals/[id]/transition/route.ts
  modified: []

key-decisions:
  - "422 used for invalid state machine transitions (not 400) — request is well-formed, business rule rejects it"
  - "404 used for cross-user deal access (not 403) — avoids leaking deal existence to unauthorized users"
  - "PATCH forbidden from changing status — status changes must use /transition endpoint (enforced with 422)"
  - "Duplicate active deal prevention: 409 if propertyId already has active deal for same user"
  - "Zod 4 z.record() requires explicit key type: z.record(z.string(), z.unknown()) instead of z.record(z.unknown())"

patterns-established:
  - "State machine: define VALID_TRANSITIONS typed array, canTransition() for pure check, transitionDeal() for atomic execution"
  - "DealHistory: write history row in same $transaction as deal update — atomicity guaranteed"
  - "Auth pattern: auth() from @clerk/nextjs/server, then internal user lookup via clerkId"
  - "Pipeline endpoint: group by DealStatus, include all 6 stages even if empty"

requirements-completed:
  - TC-01
  - TC-02

# Metrics
duration: 3min
completed: 2026-02-27
---

# Phase 01 Plan 04: Deal CRM Backend + State Machine Summary

**Deal pipeline API with 8-transition state machine, atomic DealHistory audit trail, and user-scoped CRUD (SOURCED → ANALYZING → QUALIFIED → UNDER_CONTRACT/REJECTED → CLOSED)**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-27T03:39:15Z
- **Completed:** 2026-02-27T03:42:59Z
- **Tasks:** 2/2 completed
- **Files modified:** 5 files created

## Accomplishments
- Deal state machine with 8 valid transitions enforced as single source of truth via VALID_TRANSITIONS
- Atomic Prisma transaction writes both deal status update and DealHistory audit row in one operation
- Full pipeline API: GET /api/deals returns deals grouped by all 6 DealStatus stages
- Invalid transitions return 422 with descriptive message listing valid next states
- Cross-user access returns 404 (not 403) to prevent deal existence leakage
- UNDER_CONTRACT transition requires estimatedProfit, CLOSED requires closedDate (enforced at state machine layer)
- Every PATCH field change writes a DealHistory row (oldValue → newValue) in the same transaction

## Task Commits

Each task was committed atomically:

1. **Task 1: Deal state machine and TypeScript types** - `e2bf0b5` (feat)
2. **Task 2: Deal CRUD API endpoints** - `3e63a86` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `src/lib/deals/types.ts` - DealState type alias, DealTransitionInput, TransitionResult, CreateDealInput, DealWithHistory interfaces
- `src/lib/deals/stateMachine.ts` - VALID_TRANSITIONS (8 transitions), canTransition() pure function, transitionDeal() atomic Prisma transaction
- `src/app/api/deals/route.ts` - GET (pipeline grouped by stage) + POST (create deal from property, SOURCED state)
- `src/app/api/deals/[id]/route.ts` - GET (full deal + history) + PATCH (mutable fields only, DealHistory per change)
- `src/app/api/deals/[id]/transition/route.ts` - POST (state machine enforcement, 422 on invalid, 404 on cross-user)

## Decisions Made

- Used 422 Unprocessable Entity for invalid state machine transitions (not 400 Bad Request) — the request format is valid, the business rule is what rejects it
- Used 404 for cross-user deal access instead of 403 — prevents attackers from probing which deal IDs exist
- Rejected status changes via PATCH with 422 and descriptive error pointing to /transition endpoint
- Added 409 Conflict for duplicate active deal on same property for same user (prevents accidental duplicates)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Zod 4 z.record() signature**
- **Found during:** Task 2 (PATCH /api/deals/[id] validation schema)
- **Issue:** `z.record(z.unknown())` fails TypeScript check in Zod 4 — API requires 2 arguments: key type and value type
- **Fix:** Changed to `z.record(z.string(), z.unknown())`
- **Files modified:** `src/app/api/deals/[id]/route.ts`
- **Verification:** `npx tsc --noEmit` passes with no errors on deals files
- **Committed in:** 3e63a86 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — Zod 4 API change)
**Impact on plan:** Single line fix for Zod 4 breaking change. No scope creep.

## Issues Encountered

Pre-existing TypeScript and build errors in other plan files (01-02, 01-05) were discovered during TypeScript and build checks. These are out of scope per deviation rules (not caused by 01-04 changes). Documented in `deferred-items.md`:
- `src/lib/compliance/tcpaValidator.ts` — Prisma InputJsonValue type mismatch (from 01-05)
- `src/app/api/compliance/consent/route.ts` — `phoneHash` field missing from ConsentRecord schema (from 01-05 partial execution)
- `src/lib/propstream/csvParser.ts` — PapaParse `trimHeaders` option type error (from 01-02)

## User Setup Required

None - no new external service configuration required. This plan uses the existing Clerk auth and Neon PostgreSQL setup from Plan 01-01.

## Next Phase Readiness

- All deal pipeline data layer complete — Plan 01-06 (pipeline UI) can consume GET /api/deals and POST /api/deals/[id]/transition
- Plan 01-03 (qualification engine) can write `qualificationScore` to Deal records; GET /api/deals/[id] returns ruleEvals
- DealHistory is fully operational — every status change and mutable field change is immutably recorded with userId + timestamp
- State machine is the single authority — no path to change status except through /transition endpoint

## Self-Check: PASSED

---
*Phase: 01-core-deal-sourcing-crm*
*Completed: 2026-02-27*
