---
phase: 02-intelligent-offer-automation
plan: "02"
subsystem: follow-up-automation
tags: [bullmq, redis, job-queue, sequences, automation, exponential-backoff, sendgrid, prisma, clerk, nextjs, zod]

# Dependency graph
requires:
  - phase: 02-01
    provides: "FollowUpSequence, FollowUpScheduled, FollowUpEvent schema tables + sendOfferEmail()"

provides:
  - "BullMQ follow-up-sequences queue with 5-attempt exponential backoff (1s, 2s, 4s, 8s, 16s)"
  - "followUpQueue: Queue — enqueue sequence step jobs with delay support"
  - "followUpWorker: Worker — processes one job at a time (concurrency: 1)"
  - "registerJobHandlers() — activates BullMQ worker"
  - "enqueueFollowUpSequence(payload) — enqueues single step with delay calculation"
  - "scheduleFollowUpSequence(...) — chains entire sequence starting from step 0"
  - "executeSequenceStep(payload) — EMAIL/SMS/WAIT step execution with pause/skip logic"
  - "Immutable FollowUpEvent creation per executed step (sentAt timestamp, status, content)"
  - "GET /api/sequences — list user templates with scheduled instance counts"
  - "POST /api/sequences — create sequence template with zod-validated steps"
  - "PUT /api/sequences/[id] — partial update (name, description, steps, enabled)"
  - "DELETE /api/sequences/[id] — delete with cascade to Scheduled + Events"
  - "PATCH /api/sequences/[id] — pause/resume per FollowUpScheduled instance"

affects: [02-03-offer-send-api, 02-07-frontend-ui]

# Tech tracking
tech-stack:
  added:
    - bullmq@5.x (Redis-backed job queue with delayed jobs, retries, events)
  patterns:
    - "BullMQ Worker with concurrency: 1 to prevent race conditions on same sequence"
    - "Exponential backoff: 1s base, doubles per attempt (1s, 2s, 4s, 8s, 16s) up to 5 attempts"
    - "WAIT step delay = delayDays * 86400000ms applied at job enqueue time"
    - "Lazy import of sequenceExecutor in bullmq.ts to break circular dependency"
    - "Immutable event log: FollowUpEvent.sentAt set at creation time, no updatedAt"
    - "Pause/resume: executor checks FollowUpScheduled.status at job run time (not at enqueue)"
    - "Sequence chaining: executor enqueues next step after current step succeeds"
    - "zod v4: error.issues instead of error.errors for validation error details"
    - "Prisma JSON field: cast via unknown to InputJsonValue for content field"

key-files:
  created:
    - src/lib/queue/bullmq.ts
    - src/lib/queue/jobs.ts
    - src/lib/automation/sequenceExecutor.ts
    - src/app/api/sequences/route.ts
    - src/app/api/sequences/[id]/route.ts
  modified:
    - package.json (added bullmq)
    - package-lock.json

decisions:
  - "Lazy import of sequenceExecutor in bullmq.ts via dynamic import() to avoid circular dependency"
  - "Exponential backoff starts at 1s (not 2s) to match plan spec of 1s, 2s, 4s, 8s, 16s"
  - "SMS steps log as skipped (not failed) — deferred to Phase 2.1 Twilio integration"
  - "PATCH endpoint uses discriminated union schema (action: 'pause' | 'resume') for type safety"
  - "Zod v4 uses error.issues not error.errors — auto-fixed as Rule 1 bug"

metrics:
  duration: "7 minutes"
  completed_date: "2026-02-27"
  tasks_completed: 3
  tasks_total: 3
  files_created: 5
  files_modified: 2
---

# Phase 02 Plan 02: Follow-up Automation Backend Summary

**One-liner:** BullMQ Redis job queue with sequence executor, exponential backoff retries, and immutable FollowUpEvent audit logging for automated multi-step follow-up sequences.

---

## What Was Built

### BullMQ Queue Infrastructure (`src/lib/queue/`)

`bullmq.ts` initializes the `follow-up-sequences` queue with a Worker (concurrency: 1) that calls `executeSequenceStep`. Queue configuration:

- **Retries:** 5 attempts per job
- **Backoff:** exponential, 1s base (1s → 2s → 4s → 8s → 16s)
- **Job retention:** completed 1hr, failed 24hrs
- **Graceful shutdown:** SIGTERM handler closes worker + queue events

`jobs.ts` provides the `FollowUpJobPayload` type and two enqueueing functions:
- `enqueueFollowUpSequence(payload)` — enqueues one step with delay (WAIT steps: `delayDays * 86400000ms`)
- `scheduleFollowUpSequence(...)` — fetches sequence template, enqueues step 0

### Sequence Executor (`src/lib/automation/sequenceExecutor.ts`)

Core job processing logic:

1. Checks `FollowUpScheduled.status` — skips if PAUSED or COMPLETED (no-op return)
2. Executes step by type:
   - **EMAIL:** calls `sendOfferEmail()` via SendGrid with custom or default follow-up content
   - **SMS:** skipped (deferred to Phase 2.1 Twilio integration), logged as skipped
   - **WAIT:** logs completion only (delay already applied at enqueue time)
3. Creates immutable `FollowUpEvent` record with `sentAt` timestamp, status, and execution result
4. On success: enqueues next step (if exists) or marks sequence COMPLETED
5. On failure: throws error to trigger BullMQ retry

### Sequence Template CRUD API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/sequences` | GET | List user's templates with scheduled counts |
| `/api/sequences` | POST | Create template with validated steps array |
| `/api/sequences/[id]` | GET | Template detail + active scheduled instances |
| `/api/sequences/[id]` | PUT | Partial update (name, description, steps, enabled) |
| `/api/sequences/[id]` | DELETE | Delete with cascade to Scheduled + Events |
| `/api/sequences/[id]` | PATCH | Pause/resume specific scheduled instance |

All endpoints resolve `clerkId → internal userId` and verify ownership before any data access or modification.

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed zod v4 error property name**
- **Found during:** Task 3
- **Issue:** Plan code used `error.errors` which doesn't exist in zod v4 — the property is `error.issues`
- **Fix:** Changed all 3 occurrences of `error.errors` to `error.issues` in route files
- **Files modified:** `src/app/api/sequences/route.ts`, `src/app/api/sequences/[id]/route.ts`
- **Commit:** e3afae0

**2. [Rule 3 - Blocking] Circular import between bullmq.ts and sequenceExecutor.ts**
- **Found during:** Task 1 (TS check)
- **Issue:** `bullmq.ts` imports from `sequenceExecutor.ts` which imports from `jobs.ts` which imports from `bullmq.ts` — circular dependency
- **Fix:** Used lazy dynamic `import()` inside the Worker handler in `bullmq.ts` to break the cycle
- **Files modified:** `src/lib/queue/bullmq.ts`
- **Commit:** 7a7e46f

**3. [Rule 2 - Missing critical] Added ownership verification to PATCH endpoint**
- **Found during:** Task 3
- **Issue:** Plan's PATCH code only verified sequence ownership but not that the `scheduledId` belongs to the same user and sequence
- **Fix:** Added check that `scheduled.sequenceId === id && scheduled.userId === user.id` before updating
- **Files modified:** `src/app/api/sequences/[id]/route.ts`
- **Commit:** e3afae0

### Plan Spec Correction

The plan specified exponential backoff with `delay: 2000` (2s base). The success criteria listed "1s, 2s, 4s, 8s, 16s". Used `delay: 1000` (1s base) to match the success criteria specification.

---

## Self-Check: PASSED

| Item | Status |
|------|--------|
| src/lib/queue/bullmq.ts | FOUND |
| src/lib/queue/jobs.ts | FOUND |
| src/lib/automation/sequenceExecutor.ts | FOUND |
| src/app/api/sequences/route.ts | FOUND |
| src/app/api/sequences/[id]/route.ts | FOUND |
| commit 7a7e46f (Task 1) | FOUND |
| commit cbff5f4 (Task 2) | FOUND |
| commit e3afae0 (Task 3) | FOUND |
| TypeScript: npx tsc --noEmit | PASSED |
| Next.js build: npm run build | PASSED |
