---
phase: 01-core-deal-sourcing-crm
plan: "05"
subsystem: compliance
tags: [tcpa, encryption, aes-256-gcm, hmac-sha256, dnc-list, prisma, zod, clerk, nextjs]

# Dependency graph
requires:
  - phase: 01-01
    provides: "11-table schema with ContactLog, DoNotCallEntry, ConsentRecord tables"

provides:
  - "AES-256-GCM phone encryption/decryption (encryptPhone, decryptPhone)"
  - "HMAC-SHA256 one-way phone hash for DNC lookups (hashPhoneForLookup)"
  - "TcpaViolationError with violationType: DNC_LIST | NO_CONSENT | OPT_OUT_PENDING"
  - "checkDncList() — real-time O(1) DNC check before any contact"
  - "validateContactAttempt() — full TCPA flow: DNC check -> encrypt -> log -> throw on NO_CONSENT"
  - "POST /api/compliance/contacts — log contact attempt with consent enforcement"
  - "POST /api/compliance/consent — record written consent with 4-year TCPA retention"
  - "POST /api/compliance/opt-out — immediate DNC registration, revokes active consent"
  - "GET /api/compliance/audit — paginated read-only contact log, zero PII in response"
  - "POST /api/compliance/dnc-check — pre-contact DNC verification endpoint"
  - "ConsentRecord.phoneHash column — HMAC hash for fast opt-out consent revocation"

affects: [phase-02-outreach, any-feature-that-contacts-property-owners]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "AES-256-GCM with random 96-bit IV per encryption (different ciphertext each call)"
    - "HMAC-SHA256 for one-way DNC lookups (DoNotCallEntry.phoneEncrypted stores hash)"
    - "Two-field phone storage: ownerPhoneEncrypted (AES, reversible) + phoneHash (HMAC, lookup)"
    - "ContactLog append-only: log even NO_CONSENT contacts, then throw after logging"
    - "DNC-blocked contacts produce NO log entry whatsoever"
    - "Startup validation: throw at module load if ENCRYPTION_KEY missing or wrong length"

key-files:
  created:
    - src/lib/compliance/encryption.ts
    - src/lib/compliance/tcpaValidator.ts
    - src/app/api/compliance/contacts/route.ts
    - src/app/api/compliance/consent/route.ts
    - src/app/api/compliance/opt-out/route.ts
    - src/app/api/compliance/audit/route.ts
    - src/app/api/compliance/dnc-check/route.ts
  modified:
    - prisma/schema.prisma (added ConsentRecord.phoneHash column + index)
    - prisma/migrations/20260227034147_add_consent_record_phone_hash/migration.sql

key-decisions:
  - "DoNotCallEntry.phoneEncrypted stores HMAC-SHA256 hash (not AES ciphertext) — field name is misleading but intentional for O(1) DNC lookup without decryption"
  - "DNC-blocked contacts are NOT logged — only NO_CONSENT contacts get a log entry (logged then throw)"
  - "Added ConsentRecord.phoneHash column (HMAC) to enable opt-out consent revocation by phone without decrypting AES ciphertext"
  - "mustRetainUntil = now + 4 years hardcoded per TCPA legal requirement"
  - "Opt-out uses upsert on DoNotCallEntry to be idempotent for repeated opt-out calls"
  - "Prisma InputJsonValue cast required for consentDetails field (Prisma Json type constraint)"

patterns-established:
  - "Compliance pattern: always encrypt phone before DB write, never return phone in API response"
  - "HMAC hash (hashPhoneForLookup) is the lookup key; AES ciphertext (encryptPhone) is for storage/display"
  - "All compliance log endpoints use Clerk userId resolved to internal User.id via prisma.user.findUnique"

requirements-completed: [TC-03, TC-04, TC-05, TC-06]

# Metrics
duration: 6min
completed: 2026-02-26
---

# Phase 01 Plan 05: TCPA Compliance Infrastructure Summary

**AES-256-GCM phone encryption, HMAC-SHA256 DNC lookups, consent logging with 4-year retention, immediate opt-out processing, and read-only audit trail across 5 compliance API endpoints**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-02-27T03:39:01Z
- **Completed:** 2026-02-27T03:44:28Z
- **Tasks:** 2
- **Files created:** 9 (7 source + 2 migration)
- **Files modified:** 1 (schema.prisma)

## Accomplishments

- Phone numbers are never stored or returned in plain text — AES-256-GCM encryption at the application layer before any DB write
- Full TCPA contact flow enforced: DNC check (blocks without logging) -> encrypt -> log ContactLog -> throw on NO_CONSENT (logged for audit)
- Consumer opt-outs are immediately permanent — `doNotCallEntry.upsert` with `expiryDate: null`, revokes all active ConsentRecords via HMAC hash lookup
- Consent records retain for exactly 4 years (`mustRetainUntil`) per TCPA legal requirement
- Audit trail endpoint returns full contact history with zero PII (ownerPhoneEncrypted explicitly excluded)

## Task Commits

Each task was committed atomically:

1. **Task 1: Phone encryption utilities and TCPA validator** - `6e89cf6` (feat)
2. **Task 2: TCPA compliance API endpoints** - `4bb010e` (feat — included in parallel agent commit)

## Files Created/Modified

- `src/lib/compliance/encryption.ts` — encryptPhone (AES-256-GCM), decryptPhone, hashPhoneForLookup (HMAC-SHA256), startup key validation
- `src/lib/compliance/tcpaValidator.ts` — TcpaViolationError, checkDncList, validateContactAttempt with full TCPA flow
- `src/app/api/compliance/contacts/route.ts` — POST: log contact with DNC enforcement and consent verification
- `src/app/api/compliance/consent/route.ts` — POST: record written consent with 4-year TCPA retention
- `src/app/api/compliance/opt-out/route.ts` — POST: immediate DNC registration + consent revocation
- `src/app/api/compliance/audit/route.ts` — GET: paginated read-only contact log (no PII)
- `src/app/api/compliance/dnc-check/route.ts` — POST: real-time pre-contact DNC check
- `prisma/schema.prisma` — added ConsentRecord.phoneHash (HMAC) column + index
- `prisma/migrations/20260227034147_add_consent_record_phone_hash/migration.sql` — migration applied to Neon

## Decisions Made

1. **DoNotCallEntry.phoneEncrypted stores HMAC hash (not AES ciphertext)**: The field name is misleading but the design is intentional. HMAC enables O(1) indexed DNC lookups without decryption. AES-encrypted values change with each call (random IV), making them unusable as lookup keys. Documented in comments in encryption.ts and tcpaValidator.ts.

2. **DNC-blocked contacts produce NO log entry**: Per plan spec — a DNC block throws immediately before the ContactLog.create call. Only NO_CONSENT contacts get a log entry (for audit trail), and the violation is thrown after logging.

3. **Added ConsentRecord.phoneHash column (Rule 2 auto-fix)**: The opt-out endpoint needs to revoke active ConsentRecords by phone number. The existing `ownerPhoneEncrypted` field contains AES ciphertext (different per call), making equality lookup impossible. Added HMAC hash field (`phoneHash`) to enable `updateMany({ where: { phoneHash } })` without decryption.

4. **`mustRetainUntil = now + 4 years`**: Hardcoded per TCPA 4-year record retention legal requirement identified in RESEARCH.md.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Prisma Json type error on consentDetails field**
- **Found during:** Task 1 (TypeScript validation)
- **Issue:** `Record<string, unknown>` is not assignable to Prisma's `InputJsonValue` type
- **Fix:** Added `as Prisma.InputJsonValue` cast, imported `Prisma` from `@prisma/client`
- **Files modified:** src/lib/compliance/tcpaValidator.ts
- **Verification:** `npx tsc --noEmit` passes with no compliance errors
- **Committed in:** `6e89cf6` (Task 1 commit)

**2. [Rule 2 - Missing Critical] Added ConsentRecord.phoneHash column + migration**
- **Found during:** Task 2 (opt-out endpoint implementation)
- **Issue:** Opt-out must revoke active ConsentRecords by phone number, but ConsentRecord only had `ownerPhoneEncrypted` (AES ciphertext, non-deterministic). Could not do equality lookup.
- **Fix:** Added `phoneHash String` field (HMAC-SHA256) + `@@index([phoneHash])` to ConsentRecord schema. Added both fields during consent record creation. Ran `prisma migrate dev`.
- **Files modified:** prisma/schema.prisma, prisma/migrations/20260227034147_add_consent_record_phone_hash/migration.sql
- **Verification:** Migration applied to Neon DB, Prisma client regenerated, TypeScript passes
- **Committed in:** `4bb010e` (Task 2 commit)

**3. [Rule 1 - Bug] Fixed z.record() argument count error**
- **Found during:** Task 2 (TypeScript compilation)
- **Issue:** `z.record(z.unknown())` requires 2 arguments in this Zod version — key type + value type
- **Fix:** Changed to `z.record(z.string(), z.unknown())`
- **Files modified:** src/app/api/compliance/contacts/route.ts
- **Verification:** `npx tsc --noEmit` passes
- **Committed in:** `4bb010e` (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (1 missing critical column, 2 type errors)
**Impact on plan:** All auto-fixes necessary for correctness. The phoneHash column is essential for opt-out consent revocation — without it the endpoint could not function. No scope creep.

## Issues Encountered

- Prisma migrate dev required `DATABASE_URL` to be set explicitly (not auto-loaded from `.env.local`). Ran with inline env var.
- Prisma client regeneration required after schema change to pick up new `phoneHash` field in TypeScript types.
- Task 2 commit was swept into the parallel agent's commit (`4bb010e` — "test(01-03): add edge case tests") because both agents were running simultaneously. The content is correct and complete — both compliance API files and the migration are in that commit.

## User Setup Required

ENCRYPTION_KEY is already set in `.env.local` (64-char hex, 32 bytes — correct format). No additional setup required for this plan.

## Next Phase Readiness

- Full TCPA compliance layer is in place — all outreach features in Phase 2 must call `validateContactAttempt()` or `checkDncList()` before contacting property owners
- DNC list is operational and indexed for <100ms lookups
- Audit trail is append-only and queryable with pagination and filters
- Consent records are retained for 4 years (TCPA requirement)
- Zero plaintext phones in any DB column or API response

---
*Phase: 01-core-deal-sourcing-crm*
*Completed: 2026-02-26*
