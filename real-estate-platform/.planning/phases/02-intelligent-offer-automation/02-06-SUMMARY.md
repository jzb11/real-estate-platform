---
phase: 02-intelligent-offer-automation
plan: "06"
subsystem: email-deliverability-monitoring
tags: [sendgrid, monitoring, alerts, deliverability, bounce-rate, complaint-rate, sender-score, prisma, clerk, nextjs]

# Dependency graph
requires:
  - phase: 02-01
    provides: "SendgridWebhook table + sendgrid.ts (verifyWebhookSignature, sendOfferEmail)"

provides:
  - "DeliverabilityAlert schema model with userId/alertType/metrics/acknowledged fields"
  - "calculateDeliverabilityMetrics() — aggregates 30-day SendgridWebhook events"
  - "fetchSenderScore() — polls SendGrid /v3/user/account for reputation score"
  - "checkDeliverabilityMetrics(userId) — evaluates thresholds, generates alerts"
  - "generateAlert(userId, type, message, metrics) — creates DeliverabilityAlert (1/type/day dedup)"
  - "dailyMonitoringCheck(userId) — entry point for scheduled task"
  - "GET /api/monitoring/status — returns metrics, activeAlerts, HEALTHY/WARNING status"
  - "GET /api/monitoring/alerts — alert history with limit/unreadOnly filtering"
  - "PATCH /api/monitoring/alerts — acknowledges alerts by alertId"

affects: [02-07-frontend-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Metrics aggregation: prisma.sendgridWebhook.count() grouped by eventType over 30-day window"
    - "Sender score: polling SendGrid /v3/user/account REST API with Bearer token"
    - "Alert dedup: findFirst with userId + alertType + createdAt >= today check before create"
    - "healthStatus: senderScore=0 (API unavailable) treated as non-alerting — only real scores <80 trigger WARNING"
    - "Parallel DB queries: Promise.all([delivered, bounced, complained, opened]) for efficiency"

key-files:
  created:
    - src/lib/monitoring/sendgridMonitor.ts
    - src/app/api/monitoring/status/route.ts
    - src/app/api/monitoring/alerts/route.ts
    - prisma/migrations/20260227152910_add_deliverability_alerts/migration.sql
  modified:
    - prisma/schema.prisma (added DeliverabilityAlert model + User.deliverabilityAlerts relation)

decisions:
  - "senderScore=0 (API unavailable) does not trigger SENDER_SCORE_LOW alert — avoids false positives when SENDGRID_API_KEY is unset in dev"
  - "PATCH /api/monitoring/alerts placed on /alerts route (not /alerts/[id]) to match plan spec — uses alertId in body"
  - "calculateDeliverabilityMetrics() uses parallel Promise.all for 4 DB count queries to minimize latency"
  - "Alert dedup is per calendar day (midnight boundary) not per 24-hour rolling window"

metrics:
  duration: "4 minutes"
  completed_date: "2026-02-27"
  tasks_completed: 2
  tasks_total: 2
  files_created: 4
  files_modified: 1
---

# Phase 02 Plan 06: Email Deliverability Monitoring + Alerts Summary

**One-liner:** Bounce/complaint rate aggregation from SendGrid webhook events + sender score polling, with threshold-based DeliverabilityAlert records and REST endpoints for metrics dashboard and alert management.

---

## What Was Built

### Monitoring Core (`src/lib/monitoring/sendgridMonitor.ts`)

`calculateDeliverabilityMetrics()` runs four parallel `sendgridWebhook.count()` queries against the last 30 days of events:
- `DELIVERED` count
- `BOUNCE` count
- `COMPLAINT` count
- `OPEN` count

Computes derived rates:
- `bounceRate = bounced / (delivered + bounced) * 100`
- `complaintRate = complained / (delivered + bounced) * 100`
- `openRate = opened / (delivered + bounced) * 100`

`fetchSenderScore()` calls `GET https://api.sendgrid.com/v3/user/account` with Bearer auth to retrieve reputation score (0-100). Returns 0 if key not set or API fails — this is treated as "unknown" rather than "bad".

`checkDeliverabilityMetrics(userId)` evaluates three thresholds:
| Metric | Threshold | Alert Type |
|--------|-----------|------------|
| Bounce rate | > 5% | BOUNCE_RATE_HIGH |
| Complaint rate | > 0.1% | COMPLAINT_RATE_HIGH |
| Sender score | < 80 (and > 0) | SENDER_SCORE_LOW |

`generateAlert()` creates a `DeliverabilityAlert` record with full metrics snapshot, deduplicating by (userId, alertType, today) — at most one alert per type per user per day.

### Database Schema

New `DeliverabilityAlert` model:
- `userId` — FK to User (cascade delete)
- `alertType` — BOUNCE_RATE_HIGH | COMPLAINT_RATE_HIGH | SENDER_SCORE_LOW
- `message` — human-readable alert description with metric values
- `metrics` — JSON snapshot of `DeliverabilityMetrics` at alert time
- `acknowledged` — boolean for mark-as-read
- Indexes on `(userId, alertType, createdAt)` and `(userId, acknowledged)`

### API Endpoints

**GET `/api/monitoring/status`**
Returns:
```json
{
  "metrics": { "totalSent": 420, "bounced": 8, "bounceRate": 1.9, "complained": 0, "complaintRate": 0, "senderScore": 92, "opened": 210, "openRate": 50.0 },
  "activeAlerts": [],
  "healthStatus": "HEALTHY"
}
```

`healthStatus` is `WARNING` when:
- `bounceRate > 5`, OR
- `complaintRate > 0.1`, OR
- `senderScore > 0 && senderScore < 80`

**GET `/api/monitoring/alerts`**
Query params: `limit` (default 30, max 100), `unreadOnly=true`
Returns alert history sorted by `createdAt desc`.

**PATCH `/api/monitoring/alerts`**
Body: `{ alertId: string, acknowledged: boolean }`
Marks alert as read/unread. Validates alert ownership before update.

---

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

### Notes on External Schema Changes

During execution, a parallel plan (02-03/02-04 Wave 2) added a `CreativeFinanceType` enum and `ruleSubtype` field to `prisma/schema.prisma`. This caused pre-existing TypeScript errors in `src/lib/qualification/creativeFinance.ts` and `engine.ts` (Prisma client not regenerated). These errors are:
- Out of scope for 02-06
- Not caused by 02-06 changes
- Documented in `deferred-items.md` for the phase

All 02-06 source files compile cleanly (0 errors in monitoring/sendgridMonitor.ts, monitoring/status/route.ts, monitoring/alerts/route.ts).

---

## Self-Check: PASSED

| Item | Status |
|------|--------|
| src/lib/monitoring/sendgridMonitor.ts | FOUND |
| src/app/api/monitoring/status/route.ts | FOUND |
| src/app/api/monitoring/alerts/route.ts | FOUND |
| prisma/migrations/20260227152910_add_deliverability_alerts/migration.sql | FOUND |
| commit f41c076 (Task 1) | FOUND |
| commit d89e947 (Task 2) | FOUND |
| TypeScript (02-06 files): npx tsc --noEmit | PASSED (0 errors in new files) |
| Next.js build: npm run build | PASSED |
