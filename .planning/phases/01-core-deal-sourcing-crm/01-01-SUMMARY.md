---
phase: 01-core-deal-sourcing-crm
plan: "01"
subsystem: auth, database
tags: [nextjs, clerk, prisma, postgresql, neon, typescript, tailwind, svix, tcpa]

# Dependency graph
requires: []
provides:
  - Next.js 15 project scaffolded with TypeScript, Tailwind CSS, App Router, src-dir layout
  - Clerk authentication protecting all routes (sign-in, sign-up, session, sign-out, password reset)
  - Clerk middleware at src/middleware.ts — all routes protected except /sign-in, /sign-up, /api/webhooks/*
  - Clerk webhook handler at /api/webhooks/clerk syncing user.created events to DB
  - Prisma 7 singleton via src/lib/db.ts using PrismaNeon adapter for connection pooling
  - Full 11-table PostgreSQL schema migrated to Neon — all Phase 1 data contracts defined
  - Migration history committed to source control (prisma/migrations/)
affects:
  - 01-02 (CSV import — needs Property and Deal models)
  - 01-03 (CRM pipeline — needs Deal, DealHistory, User models)
  - 01-04 (qualification rules — needs QualificationRule, RuleEvaluationLog models)
  - 01-05 (TCPA compliance — needs ContactLog, ConsentRecord, DoNotCallEntry models)
  - 01-06 (knowledge base — needs KbArticle, KbAccessLog models)
  - 01-07 (dashboard — needs auth and all models)

# Tech tracking
tech-stack:
  added:
    - next@15.5.12
    - "@clerk/nextjs@6.38.3"
    - svix@1.86.0
    - zod@4.3.6
    - prisma@7.4.1
    - "@prisma/client@7.4.1"
    - "@prisma/adapter-neon@7.4.1"
    - "@neondatabase/serverless"
    - typescript@5
    - tailwindcss@4
    - react@19.1.0
  patterns:
    - clerkMiddleware with createRouteMatcher for route protection
    - Prisma 7 requires prisma.config.ts for datasource URL (breaking change from v6)
    - Prisma 7 requires database adapter passed to PrismaClient constructor
    - PrismaNeon adapter used for Neon PostgreSQL connection pooling
    - globalThis-based Prisma singleton to prevent hot-reload connection exhaustion
    - Clerk pre-built components (SignIn, SignUp) — no custom auth UI

key-files:
  created:
    - real-estate-platform/src/middleware.ts
    - real-estate-platform/src/app/layout.tsx
    - real-estate-platform/src/app/page.tsx
    - real-estate-platform/src/app/(auth)/sign-in/[[...sign-in]]/page.tsx
    - real-estate-platform/src/app/(auth)/sign-up/[[...sign-up]]/page.tsx
    - real-estate-platform/src/app/(dashboard)/layout.tsx
    - real-estate-platform/src/app/(dashboard)/dashboard/page.tsx
    - real-estate-platform/src/app/api/webhooks/clerk/route.ts
    - real-estate-platform/src/lib/db.ts
    - real-estate-platform/prisma/schema.prisma
    - real-estate-platform/prisma/migrations/20260227033047_init/migration.sql
    - real-estate-platform/prisma.config.ts
    - real-estate-platform/.env.example
    - real-estate-platform/package.json
  modified:
    - real-estate-platform/.gitignore (allow .env.example via negation pattern)

key-decisions:
  - "Prisma 7 breaking change: datasource URL moved from schema.prisma to prisma.config.ts"
  - "Prisma 7 breaking change: PrismaClient requires adapter — using @prisma/adapter-neon for Neon PostgreSQL"
  - "React peer dependency conflict (19.1.0 vs clerk@6 expecting 19.0.3) resolved with --legacy-peer-deps"
  - "Clerk pre-built components used (SignIn, SignUp) — no custom auth UI per research recommendation"
  - "TCPA-first schema: ContactLog and DealHistory have no updatedAt (append-only immutable audit log)"
  - "Prisma singleton uses globalThis pattern to prevent connection exhaustion during Next.js hot reload"

patterns-established:
  - "Auth: clerkMiddleware wraps all routes; createRouteMatcher defines public exceptions"
  - "Database: PrismaClient instantiated with PrismaNeon adapter; singleton via globalThis"
  - "Schema: TCPA audit tables (ContactLog, DealHistory) have no updatedAt by design"
  - "Schema: userId denormalized on all tenant-scoped tables for multi-tenant isolation"
  - "Schema: JSONB for flexible fields (distressSignals, stageHistory, customFields, rawData)"
  - "Config: prisma.config.ts required for Prisma 7 datasource URL and migration config"

requirements-completed:
  - AUTH-01
  - AUTH-02
  - AUTH-03
  - AUTH-04

# Metrics
duration: 9min
completed: 2026-02-27
---

# Phase 01 Plan 01: Bootstrap Phase Summary

**Next.js 15 + Clerk auth (clerkMiddleware, pre-built components, webhook sync) + 11-table PostgreSQL schema migrated via Prisma 7 with Neon adapter**

## Performance

- **Duration:** 9 min
- **Started:** 2026-02-27T03:26:17Z
- **Completed:** 2026-02-27T03:35:22Z
- **Tasks:** 2/2 completed
- **Files modified:** 15 files created, 1 modified

## Accomplishments
- Next.js 15 project bootstrapped with TypeScript, Tailwind CSS, ESLint, App Router, src-dir layout
- Clerk authentication end-to-end: sign-in page, sign-up page, protected routes, webhook user sync
- All 11 Phase 1 database tables migrated to Neon PostgreSQL via Prisma 7
- TCPA-first compliance design confirmed: ContactLog and DealHistory are append-only (no updatedAt)
- 6 PostgreSQL enums: DealStatus, ContactMethod, ConsentStatus, RuleType, Operator, KbCategory
- Prisma singleton configured with PrismaNeon adapter for serverless connection pooling
- Next.js production build passes with zero TypeScript errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Bootstrap Next.js 15 with Clerk auth** - `feb5cc7` (feat)
2. **Task 2: Design and migrate complete Phase 1 database schema** - `2bf8d16` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `src/middleware.ts` - Clerk route protection (clerkMiddleware + createRouteMatcher)
- `src/app/layout.tsx` - Root layout with ClerkProvider wrapper
- `src/app/page.tsx` - Root redirect to /dashboard
- `src/app/(auth)/sign-in/[[...sign-in]]/page.tsx` - Clerk SignIn component
- `src/app/(auth)/sign-up/[[...sign-up]]/page.tsx` - Clerk SignUp component
- `src/app/(dashboard)/layout.tsx` - Dashboard route group layout
- `src/app/(dashboard)/dashboard/page.tsx` - Placeholder dashboard with user email
- `src/app/api/webhooks/clerk/route.ts` - Svix-verified webhook syncing user.created to DB
- `src/lib/db.ts` - Prisma singleton with PrismaNeon adapter and globalThis hot-reload fix
- `prisma/schema.prisma` - 11-table Phase 1 schema with 6 enums
- `prisma/migrations/20260227033047_init/migration.sql` - Applied migration
- `prisma.config.ts` - Prisma 7 config with datasource URL and schema path
- `.env.example` - All required environment variable templates
- `package.json` - Next.js 15 + Clerk + Prisma + Neon adapter dependencies
- `.gitignore` - Updated to allow .env.example via negation rule

## Decisions Made

- Used `--legacy-peer-deps` to resolve React 19.1.0 vs @clerk/nextjs peer dependency mismatch
- Used Clerk pre-built components (SignIn, SignUp) instead of custom UI — avoids 2-week auth rabbit hole per research
- Used `@prisma/adapter-neon` for Prisma 7 Client engine compatibility with Neon serverless PostgreSQL
- ContactLog and DealHistory intentionally have no `updatedAt` — immutable audit tables for TCPA compliance

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] React 19.1.0 peer dependency conflict with @clerk/nextjs**
- **Found during:** Task 1 (dependency installation)
- **Issue:** `@clerk/nextjs@6.38.3` requires `react@^18.0.0 || ~19.0.3` but Next.js 15.5.12 installs `react@19.1.0`
- **Fix:** Used `npm install --legacy-peer-deps` to bypass strict peer resolution
- **Files modified:** package.json, package-lock.json
- **Verification:** Build passes, all components render correctly
- **Committed in:** feb5cc7 (Task 1 commit)

**2. [Rule 3 - Blocking] Prisma 7 removed datasource URL from schema.prisma**
- **Found during:** Task 2 (Prisma generate)
- **Issue:** Prisma 7 error P1012 — `datasource.url` property no longer supported in schema.prisma; must use prisma.config.ts
- **Fix:** Removed `url = env("DATABASE_URL")` from schema datasource block; created `prisma.config.ts` with `defineConfig({ datasource: { url: process.env.DATABASE_URL } })`
- **Files modified:** prisma/schema.prisma, prisma.config.ts (created)
- **Verification:** `npx prisma generate` and `npx prisma migrate dev` succeed
- **Committed in:** 2bf8d16 (Task 2 commit)

**3. [Rule 3 - Blocking] Prisma 7 "client" engine requires database adapter**
- **Found during:** Task 2 (next build)
- **Issue:** `PrismaClientConstructorValidationError: Using engine type "client" requires either "adapter" or "accelerateUrl"` — Prisma 7 changed default engine from "library" to "client"
- **Fix:** Installed `@prisma/adapter-neon` and `@neondatabase/serverless`; updated `src/lib/db.ts` to instantiate `PrismaNeon` adapter and pass to `PrismaClient({ adapter })`
- **Files modified:** src/lib/db.ts, package.json, package-lock.json
- **Verification:** `npm run build` passes with zero errors
- **Committed in:** 2bf8d16 (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (all Rule 3 — blocking issues from Prisma 7 breaking changes)
**Impact on plan:** All auto-fixes necessary for Prisma 7 compatibility. No scope creep. The Prisma 7 migration pattern (prisma.config.ts + adapter) is now established for all subsequent plans.

## Issues Encountered

Prisma 7 has significant breaking changes from v6: datasource URL moved to prisma.config.ts, and the new "client" engine type requires a database adapter. All three breaking changes were auto-fixed per deviation rules. Future plans building on Prisma should reference these patterns from this SUMMARY.

## User Setup Required

External services have been configured via `.env.local`. If setting up a new environment:
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` — Clerk Dashboard > API Keys
- `CLERK_SECRET_KEY` — Clerk Dashboard > API Keys
- `CLERK_WEBHOOK_SECRET` — Clerk Dashboard > Webhooks > Add Endpoint (URL: /api/webhooks/clerk, event: user.created)
- `DATABASE_URL` — Neon PostgreSQL connection string (pooler mode for serverless)
- `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in`
- `NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up`
- `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard`
- `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard`

## Next Phase Readiness

- All 11 database tables exist in Neon PostgreSQL with correct schema
- Clerk auth is protecting all routes — ready for feature development
- Prisma client generated and all model types available for import via `@prisma/client`
- `prisma` singleton available via `import { prisma } from '@/lib/db'`
- All Phase 1 plans (01-02 through 01-07) can now build against the defined data contracts

## Self-Check: PASSED

All files verified present, commits verified in git history, 11 tables confirmed in migration SQL, ContactLog verified with no `updatedAt` column (TCPA append-only compliance).

---
*Phase: 01-core-deal-sourcing-crm*
*Completed: 2026-02-27*
