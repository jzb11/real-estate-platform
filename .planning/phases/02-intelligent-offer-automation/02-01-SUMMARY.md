---
phase: 02-intelligent-offer-automation
plan: "01"
subsystem: email
tags: [sendgrid, prisma, email, offer, webhook, tcpa, can-spam, typescript, nextjs]

# Dependency graph
requires:
  - phase: 01-core-deal-sourcing-crm
    provides: Deal, Property, User models, qualification engine with calculateMAO()

provides:
  - SendGrid client library with lazy initialization and sandbox mode (src/lib/email/sendgrid.ts)
  - Offer email template rendering HTML + plain text with 70% rule metrics (src/lib/email/offerTemplate.ts)
  - OfferEmailData and SendGridWebhookPayload TypeScript types (src/lib/email/types.ts)
  - POST /api/offers/generate — draft offer generation endpoint
  - POST /api/email/sendgrid-webhook — SendGrid event ingestion with signature verification
  - OfferedDeal, SendgridWebhook, FollowUpSequence, FollowUpScheduled, FollowUpEvent database tables
affects:
  - 02-02 (follow-up automation uses FollowUpSequence/FollowUpScheduled/FollowUpEvent tables)
  - 02-03 (bulk send API calls sendOfferEmail() and creates OfferedDeal records)
  - 02-06 (deliverability monitoring queries SendgridWebhook events)
  - 02-07 (frontend reads /api/offers/generate to show email preview)

# Tech tracking
tech-stack:
  added:
    - "@sendgrid/mail v8.1.6 — email delivery with open/click tracking and sandbox mode"
  patterns:
    - "Lazy SendGrid initialization — setApiKey() called at runtime (not import time) to avoid build errors without env vars"
    - "Clerk auth pattern — auth() returns clerkId, then prisma.user.findUnique({ where: { clerkId } }) resolves internal userId"
    - "Enum-safe status updates — use Prisma enum values (OfferedDealStatus.OPENED) not raw strings"
    - "Prisma InputJsonValue cast — rawPayload: event as Prisma.InputJsonValue for Json fields"

key-files:
  created:
    - "src/lib/email/types.ts — OfferEmailData interface and SendGridWebhookPayload type"
    - "src/lib/email/sendgrid.ts — createSendGridClient(), sendOfferEmail(), verifyWebhookSignature()"
    - "src/lib/email/offerTemplate.ts — renderOfferEmail() returns { html, text, unsubscribeUrl }"
    - "src/app/api/offers/generate/route.ts — POST endpoint: auth + MAO calc + email draft generation"
    - "src/app/api/email/sendgrid-webhook/route.ts — POST endpoint: HMAC verify + event log + OfferedDeal status update"
    - "prisma/migrations/20260227054652_add_offer_followup_schema/migration.sql — 5 new tables + 2 enums"
  modified:
    - "prisma/schema.prisma — added OfferedDeal, SendgridWebhook, FollowUpSequence, FollowUpScheduled, FollowUpEvent; updated User + Deal relations"
    - ".env.example — added SENDGRID_API_KEY, SENDGRID_FROM_EMAIL, SENDGRID_FROM_NAME, SENDGRID_WEBHOOK_KEY, NEXT_PUBLIC_BASE_URL, REALTOR_PHONE"

key-decisions:
  - "Lazy SendGrid initialization: sgMail.setApiKey() called inside ensureInitialized() rather than at module top-level, so build succeeds without SENDGRID_API_KEY set"
  - "Use calculateMAO() return object: the engine returns { mao, formula } not a plain number — maoResult.mao and maoResult.formula both exposed in offer draft response"
  - "Clerk clerkId resolution pattern: all API routes use auth() -> clerkId -> findUnique({ where: { clerkId } }) to get internal user (not using Clerk userId directly as DB key)"
  - "Prisma client regeneration: schema had new models but client was stale — ran prisma generate to include OfferedDeal, SendgridWebhook, etc."
  - "Sandbox mode on development: sendOfferEmail() sets sandboxMode.enable = NODE_ENV === development so dev sends don't consume email quota"

patterns-established:
  - "Email lib directory: all email concerns live in src/lib/email/ (types.ts, sendgrid.ts, offerTemplate.ts)"
  - "Webhook signature verification first: always verify HMAC before processing payload, return 401 on failure"
  - "Event-driven OfferedDeal updates: webhook handler updates offer status + timestamps based on SendGrid event type"

requirements-completed:
  - OF-01
  - OF-02
  - OF-03

# Metrics
duration: 6min
completed: 2026-02-27
---

# Phase 2 Plan 01: Offer Generation Template + SendGrid Setup Summary

**SendGrid email infrastructure with offer template (70% rule), webhook HMAC verification, and 5-table database schema for offer lifecycle and follow-up automation tracking**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-27T14:36:21Z
- **Completed:** 2026-02-27T14:42:03Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments

- Full SendGrid integration with lazy initialization, sandbox mode, open/click tracking, and HMAC-SHA256 webhook verification
- Professional offer email template rendering HTML + plain text with MAO calculation, property metrics, and CAN-SPAM compliant unsubscribe footer
- 5 new database tables: OfferedDeal, SendgridWebhook, FollowUpSequence, FollowUpScheduled, FollowUpEvent (2 enums: SendgridEventType, OfferedDealStatus)
- POST /api/offers/generate: authenticated draft offer endpoint with 70% rule MAO calculation
- POST /api/email/sendgrid-webhook: verifies SendGrid signatures, logs events, updates OfferedDeal status on open/click/bounce/complaint/unsubscribe

## Task Commits

Each task was committed atomically:

1. **Task 1: Database schema extension** - `ad8dcb6` (feat)
2. **Task 2: SendGrid client library and offer email template** - `fd9df88` (feat)
3. **Task 3: Webhook handler and offer generation endpoint** - `f6f3362` (feat)

## Files Created/Modified

- `prisma/schema.prisma` — Added 5 models, 2 enums, updated User + Deal relations
- `prisma/migrations/20260227054652_add_offer_followup_schema/migration.sql` — Applied migration
- `src/lib/email/types.ts` — OfferEmailData and SendGridWebhookPayload interfaces
- `src/lib/email/sendgrid.ts` — createSendGridClient(), sendOfferEmail(), verifyWebhookSignature()
- `src/lib/email/offerTemplate.ts` — renderOfferEmail() returns { html, text, unsubscribeUrl }
- `src/app/api/offers/generate/route.ts` — POST: auth, deal lookup, MAO calc, email draft
- `src/app/api/email/sendgrid-webhook/route.ts` — POST: HMAC verify, event log, OfferedDeal update
- `.env.example` — SendGrid + base URL env vars documented

## Decisions Made

- Lazy SendGrid initialization: `setApiKey()` inside `ensureInitialized()` guard so `npm run build` succeeds without `SENDGRID_API_KEY` set in CI
- `calculateMAO()` returns `{ mao, formula }` object — both values exposed in offer draft response for transparency
- Sandbox mode auto-enabled in development to prevent accidental email sends during dev
- Prisma client required explicit `prisma generate` after schema was modified — now included in setup steps

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Clerk userId vs clerkId mismatch in offer generation endpoint**
- **Found during:** Task 3 (offer generation endpoint)
- **Issue:** Plan's code used `auth()` result as `userId` directly as a DB foreign key. Actual DB stores users with an internal UUID; Clerk ID is stored in `User.clerkId` column. Using Clerk ID as DB key would cause 404s on all deal lookups.
- **Fix:** Used `const { userId: clerkId } = await auth()` then `prisma.user.findUnique({ where: { clerkId } })` to resolve internal user — consistent with all Phase 1 API routes.
- **Files modified:** `src/app/api/offers/generate/route.ts`
- **Verification:** TypeScript passes; pattern matches deals API route.
- **Committed in:** f6f3362 (Task 3 commit)

**2. [Rule 3 - Blocking] Prisma client stale — new models not recognized**
- **Found during:** Task 3 (webhook handler)
- **Issue:** TypeScript error: `Module '@prisma/client' has no exported member 'SendgridEventType'` and `offeredDeal` not on PrismaClient. Schema had been modified but `prisma generate` had not been run.
- **Fix:** Ran `npx prisma generate` to regenerate client with new models and enums.
- **Files modified:** `node_modules/@prisma/client` (generated)
- **Verification:** TypeScript check passes, build succeeds.
- **Committed in:** f6f3362 (Task 3 commit)

**3. [Rule 1 - Bug] Fixed calculateMAO() return type in offer endpoint**
- **Found during:** Task 3 (offer generation endpoint)
- **Issue:** Plan's code called `calculateMAO(arv, costs)` as if it returned a plain number (`mao`). Actual return type is `MAOResult: { mao: number, formula: string }`.
- **Fix:** Used `maoResult.mao` for the numeric value and also exposed `maoResult.formula` in the response for debugging/display.
- **Files modified:** `src/app/api/offers/generate/route.ts`
- **Verification:** TypeScript passes.
- **Committed in:** f6f3362 (Task 3 commit)

**4. [Rule 1 - Bug] Fixed Prisma Json field type assignment in webhook handler**
- **Found during:** Task 3 (webhook handler)
- **Issue:** `rawPayload: event` where `event: Record<string, unknown>` was not assignable to Prisma's `InputJsonValue` type.
- **Fix:** Cast to `event as Prisma.InputJsonValue` and imported `Prisma` type from `@prisma/client`.
- **Files modified:** `src/app/api/email/sendgrid-webhook/route.ts`
- **Verification:** TypeScript passes.
- **Committed in:** f6f3362 (Task 3 commit)

---

**Total deviations:** 4 auto-fixed (3 bugs, 1 blocking)
**Impact on plan:** All fixes necessary for correctness. The Clerk auth pattern fix is critical — without it all deal lookups would fail in production. No scope creep.

## Issues Encountered

- `npm install @sendgrid/mail` required `--legacy-peer-deps` due to peer dependency conflicts in the React 19 project. This is an existing project-level issue, not introduced by this plan.

## User Setup Required

Before offer sending will work, configure in SendGrid dashboard:

1. **SENDGRID_API_KEY** — Create at SendGrid Dashboard > Settings > API Keys (Mail Send access)
2. **SENDGRID_FROM_EMAIL** — Verify sender domain at SendGrid Dashboard > Settings > Sender Authentication
3. **SENDGRID_FROM_NAME** — Your company/platform name
4. **SENDGRID_WEBHOOK_KEY** — Get from SendGrid Dashboard > Mail Settings > Event Webhook > Signed Event Webhook
5. **Configure webhook URL** — Point SendGrid webhook to `https://your-domain/api/email/sendgrid-webhook`
6. **Enable event types** — Opens, clicks, bounces, spam_reports in SendGrid Event Webhook settings
7. **NEXT_PUBLIC_BASE_URL** — Your production domain (for unsubscribe links)

## Next Phase Readiness

- Email infrastructure is complete — 02-02 can build follow-up automation using FollowUpSequence/FollowUpScheduled/FollowUpEvent tables
- 02-03 (bulk send) can call `sendOfferEmail()` directly and create `OfferedDeal` records
- 02-06 (deliverability monitoring) can query `SendgridWebhook` table for bounce/complaint rates
- SendGrid sandbox mode will prevent dev sends from consuming email quota during 02-03 testing

---
*Phase: 02-intelligent-offer-automation*
*Completed: 2026-02-27*
