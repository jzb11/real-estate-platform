# Deferred Items

## Pre-existing Issues (Out of Scope for 01-04)

### 1. src/lib/compliance/tcpaValidator.ts - Type error
- **Discovered during:** 01-04 Task 2 TypeScript check
- **Error:** `Record<string, unknown>` not assignable to Prisma InputJsonValue type
- **Origin:** Plan 01-05 (TCPA compliance plan, partially executed before 01-04)
- **Status:** Pre-existing, not caused by 01-04 changes

### 2. src/app/api/compliance/consent/route.ts - Build error
- **Discovered during:** 01-04 Task 2 build check
- **Error:** `phoneHash` property does not exist on ConsentRecord Prisma type
- **Origin:** Untracked file from another plan's partial execution
- **Status:** Pre-existing, not caused by 01-04 changes

### 3. src/lib/propstream/csvParser.ts - Type errors
- **Discovered during:** 01-04 Task 2 TypeScript check
- **Error:** PapaParse `trimHeaders` option not in type, and parse result type mismatch
- **Origin:** Plan 01-02 (CSV import plan), not related to deals
- **Status:** FIXED during 01-02 execution — changed to `transformHeader` and `worker: false`

### 4. src/app/api/compliance/contacts/route.ts - Zod v4 enum API
- **Discovered during:** 01-02 Task 1 TypeScript check
- **Error:** `TS2554: Expected 2-3 arguments, but got 1` on z.enum(['EMAIL', 'CALL', 'SMS', 'LETTER'])
- **Cause:** Zod v4 changed enum signature — requires `as const` tuple
- **Status:** Pre-existing from 01-01, out of scope for 01-02

### 5. prisma/seed-kb.ts - Parse errors
- **Discovered during:** 01-02 Task 2 TypeScript check
- **Error:** Multiple TS parse errors (malformed template literals with unescaped backticks)
- **Status:** Pre-existing seed file issue, out of scope for 01-02
