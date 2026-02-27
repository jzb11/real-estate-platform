# Deferred Items

## Pre-existing Issues (Out of Scope for 02-06)

### 1. CreativeFinanceType Prisma client not regenerated (parallel plan conflict)
- **Discovered during:** 02-06 Task 2 final TypeScript check
- **Error:** `src/lib/qualification/creativeFinance.ts(1,10): TS2305: Module '"@prisma/client"' has no exported member 'CreativeFinanceType'`
- **Also:** `engine.ts`: `creativeFinanceTypes` property missing from EvaluationResult
- **Origin:** `CreativeFinanceType` enum was added to prisma/schema.prisma by a parallel plan (02-03/02-04 wave 2) but Prisma client was not regenerated after that schema change
- **Scope:** Pre-existing in `src/lib/qualification/` — not caused by 02-06 changes
- **Resolution:** Run `npx prisma generate` after the parallel plan completes its schema migration
