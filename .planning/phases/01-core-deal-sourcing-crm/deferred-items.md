# Deferred Items

## Pre-existing TypeScript Errors (out of scope for 01-03)

Found during `npx tsc --noEmit` in 01-03 execution. These are pre-existing issues
in compliance API routes from a prior plan (01-02 or earlier).

- `src/app/api/compliance/consent/route.ts(58,9)`: `phoneHash` property does not exist in ConsentRecord schema
- `src/app/api/compliance/contacts/route.ts(19,21)`: Expected 2-3 arguments, got 1
- `src/app/api/compliance/opt-out/route.ts(67,9)`: `phoneHash` does not exist in ConsentRecordWhereInput

**Action:** Fix in a follow-up pass or when compliance routes are revisited.
