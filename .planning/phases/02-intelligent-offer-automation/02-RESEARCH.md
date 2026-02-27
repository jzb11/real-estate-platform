# Phase 2: Intelligent Offer Automation & Creative Finance - Research

**Researched:** 2026-02-27
**Domain:** Email automation, offer generation, follow-up sequences, creative finance scoring, contact enrichment, deliverability monitoring
**Confidence:** HIGH (SendGrid stack, BullMQ patterns, TCPA/CAN-SPAM rules verified; contact enrichment and creative finance rules need validation in implementation)

## Summary

Phase 2 automates the most manual, time-consuming workflows in real estate deal sourcing: generating professional offers, sending them at scale, automating follow-up sequences, and intelligently identifying high-potential deals through creative finance rules. The technology stack is mature and industry-standard: SendGrid for email delivery (trusted by real estate platforms), BullMQ for reliable job queuing (already in Phase 1 Redis), MJML for responsive email templates, and webhooks for deliverability tracking. Contact enrichment (skip-trace) integrates with Phase 1's scaffolding, and creative finance scoring extends Phase 1's rules engine without breaking existing workflow.

**Primary recommendation:** Use SendGrid as primary email provider (industry-standard for real estate, TCPA-compliant, built-in list validation and webhook tracking). BullMQ job queue handles bulk send operations and follow-up sequences at scale. MJML for responsive offer email templates. Extend Phase 1 rules engine with creative finance rule types rather than building separate scoring system. Monitor deliverability via SendGrid webhooks (bounce, complaint, open events) with alerts at thresholds (bounce >5%, complaint >0.1%).

---

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Email & Offer Delivery**
- **Provider:** SendGrid primary, Brevo fallback
- **Why:** Industry-standard for real estate, TCPA-compliant, reputation monitoring, list validation built-in
- **Cost:** ~$20/month (10k emails) + $0.25/validation via SendGrid List Validate
- **Alternative rejected:** Mailgun (cheaper but less real estate focused)
- **Unsubscribe:** All offers include SMTP unsubscribe header + HTML footer link (double compliance)

**Multi-Channel Delivery**
- **Email:** Primary for offer letters (Phase 2)
- **SMS:** Optional via Twilio for follow-ups only IF phone number + explicit consent
- **Phone calls:** Scheduling feature in UI, actual calls out-of-scope Phase 2

**Offer Generation**
- **Template rendering:** Server-side (EJS or similar)
- **Content:** Property address, estimated value, MAO calculation, offer price, realtor contact, unsubscribe
- **Customization:** One standardized template in Phase 2, custom templates added in Phase 2.1

**Follow-Up Automation**
- **Job queue:** BullMQ (already in Phase 1 Redis infrastructure)
- **Sequences:** User defines steps (email → wait → email → wait → SMS if phone exists)
- **Trigger:** User sends offer, sequence automatically enqueued
- **User control:** Can pause/resume any sequence per recipient
- **Tracking:** Webhook handlers capture SendGrid events → update FollowUpLog

**Creative Finance Scoring**
- **Approach:** Extend Phase 1 rules engine with new rule types
- **New rule types:** CREATIVE_FINANCE_FLAG (subject-to, seller financing, etc.)
- **Score boost:** Creative finance deals get +20 points if matching criteria
- **UI marking:** Pipeline shows "Subject-To" or "Seller Finance" badge
- **No auto-generation in Phase 2** — user manually creates creative finance rules

**Contact Enrichment**
- **Default:** REISkip (Phase 1 scaffold) at $0.15/record
- **Optional premium:** BatchData integration ($500/month, Phase 2.1)
- **Trigger:** Bulk enrichment via background job when sending offer sequence

**Email Deliverability Monitoring**
- **Source:** SendGrid webhook events + daily reputation API polling
- **Bounce tracking:** Webhook captures hard/soft bounces, update contact list
- **Complaint tracking:** Spam complaints → auto-unsubscribe, alert user
- **Sender score:** Daily polling, alert if score drops below 80
- **Thresholds:** Alert if bounce rate > 5%, complaint rate > 0.1%

**Offer Tracking & Analytics**
- **Tables:** OfferedDeal (many-to-one with Deal), FollowUpEvent
- **Tracked data:** When sent, to whom, status (sent/opened/clicked/bounced/complained)
- **No UTM tracking Phase 2** — added in Phase 2.1
- **Link tracking:** SendGrid click tracking enabled by default

### Claude's Discretion

- Email template library and styling choices (responsive design patterns)
- Specific BullMQ configuration (workers, concurrency, job timeouts)
- Bounce/complaint rate alert mechanisms (email, Slack webhook, etc.)
- Contact enrichment fallback strategies (partial enrichment handling)
- Creative finance rule validation logic (what makes a deal qualify)

### Deferred Ideas (OUT OF SCOPE)

- PropStream API integration (CSV import only Phase 1, API polling Phase 2 future)
- Custom email template builder (Phase 2.1)
- Advanced analytics (UTM tracking, conversion attribution)
- Phone call automation (scheduling UI only, actual calls future)
- SMS authentication (SMS optional Phase 2.1)
- Geographic customization (offer formula applies nationwide, Phase 2.1 adds state-specific costs)
- Face detection or property condition scoring (future phases)

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| OF-01 | Generate and send professional offers with one click | SendGrid email API, offer template rendering, send API integration |
| OF-02 | Bulk send offers and see delivery/open tracking | SendGrid bulk send, webhook event tracking (open, click, bounce, complaint) |
| OF-03 | Create and automate follow-up sequences | BullMQ job queue, sequence steps, trigger logic |
| OF-04 | Identify and enrich contact information at scale | REISkip skip-trace API, BatchData integration (premium), background enrichment jobs |
| OF-05 | Score deals intelligently and identify creative finance opportunities | Rules engine extension with CREATIVE_FINANCE_FLAG, deal scoring algorithm |
| OF-06 | Monitor email deliverability and sender reputation | SendGrid webhooks (bounce, complaint, open), daily reputation API polling |
| OF-07 | Bulk operations and compliance | BullMQ rate limiting, TCPA/CAN-SPAM unsubscribe, consent verification |
| AU-01 | Define follow-up sequences (email → SMS → call scheduling) | BullMQ sequence steps, Twilio SMS API, UI scheduling |
| AU-02 | Automatically trigger follow-ups based on sequence | BullMQ scheduled jobs, trigger logic on offer send |
| AU-03 | Customize cadence (email day 1, SMS day 3, call day 7) | BullMQ delayed jobs, step delay configuration |
| AU-04 | Pause/resume sequences per recipient | Job queue state management, pause/resume handlers |
| AU-05 | Track follow-up engagement (open, click, SMS read) | SendGrid webhooks, Twilio delivery status webhooks |
| AU-06 | Multi-channel delivery (email primary, SMS fallback) | SendGrid + Twilio integration, channel selection logic |
| QA-06 | Score deals on 0-100 scale based on equity, condition, motivation | Rules engine scoring (Phase 1 foundation + creative finance extension) |
| QA-07 | Identify and mark creative finance deals | Rules engine CREATIVE_FINANCE_FLAG rules, pipeline UI badges |

---

## Standard Stack

### Core Email Infrastructure
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @sendgrid/mail | v7.7.0+ | SendGrid Node.js SDK for email sending API | Industry-standard for real estate, TCPA-compliant, webhook support, reputation monitoring built-in |
| bullmq | v5.x | Redis-backed job queue for email/SMS sending, follow-up sequences | Reliable, scalable, handles retries, rate limiting, scheduled jobs — battle-tested for transactional workflows |
| mjml | v4.15.3+ | Responsive email template language (Node.js) | Responsive-by-default, easy to use, compiles to HTML, large template library, industry adoption |
| ejs | v3.1.10+ | Server-side template rendering for dynamic offer content | Lightweight, integrates with Express, supports complex logic, flexible variable substitution |
| redis | v7.x | In-memory data store (already in Phase 1) | BullMQ requires Redis, already deployed Phase 1 |

### Multi-Channel Delivery
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| twilio | v4.x | SMS and phone call scheduling API | Phase 2: SMS follow-ups only if phone number + explicit consent |
| node-cron | v3.0.3+ | Job scheduling for daily deliverability monitoring | Optional: scheduled tasks (e.g., daily sender score API poll) |

### Deliverability & Validation
| Service | Purpose | Cost | Integration |
|---------|---------|------|-------------|
| SendGrid List Validate API | Pre-send email validation (removes invalid addresses) | $0.01-$0.25 per validation | BullMQ pre-send job step |
| SendGrid Reputation API | Daily sender score polling | Included in SendGrid plan | Scheduled daily job |
| SendGrid Webhook Events | Bounce, complaint, open, click tracking | Included in SendGrid plan | POST /api/webhooks/sendgrid → FollowUpEvent logging |

### Contact Enrichment (Skip-Trace)
| Service | Version | Purpose | Cost | When to Use |
|---------|---------|---------|------|-------------|
| REISkip | v1.0+ (Phase 1 scaffold) | Phone/email lookup via skip-trace | $0.15 per record | Default Phase 2 enrichment |
| BatchData | API v1.0 | Premium skip-trace, bulk property enrichment | $500/month | Optional Phase 2.1, better accuracy (76% right-party contact rate) |

### Installation

```bash
# Phase 2 Core
npm install @sendgrid/mail bullmq mjml ejs dotenv

# Multi-channel (optional Phase 2)
npm install twilio

# Type definitions
npm install -D @types/express @types/node @types/bullmq

# Environment variables required
cat > .env << 'EOF'
SENDGRID_API_KEY=SG.xxx...
SENDGRID_FROM_EMAIL=noreply@yourcompany.com
SENDGRID_FROM_NAME="Your Company Name"
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=xxx...
TWILIO_PHONE_NUMBER=+1...
REDIS_URL=redis://localhost:6379
EOF
```

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| SendGrid | Brevo, Mailgun, AWS SES | Brevo cheaper (300/day free tier), less real estate focus. Mailgun developer-friendly but weaker reputation monitoring. AWS SES cheapest but requires manual reputation management. SendGrid chosen for industry adoption + compliance features |
| BullMQ | RabbitMQ, node-agenda, node-schedule | RabbitMQ more robust but requires separate infrastructure. node-agenda simpler but less scalable for high-volume queuing. BullMQ chosen for Redis-first design (Phase 1 already uses Redis) |
| MJML | Handlebars, custom HTML | Handlebars simpler but not responsive-by-default. Custom HTML requires manual responsive design. MJML chosen for responsive-by-default + template library |
| EJS | Nunjucks, Handlebars | Nunjucks more powerful, Handlebars simpler. EJS chosen for simplicity and Express integration |

---

## Architecture Patterns

### Offer Generation & Send Workflow

**Pattern: Stateless Template Rendering + Job Queue**

Offer generation is stateless: given deal ID + recipient email, render HTML email via MJML template, validate email address via SendGrid List Validate, enqueue send job in BullMQ.

```
User clicks "Send Offer" on Deal →
  API: POST /api/offers/send { dealId, recipientEmail } →
    Load deal details (MAO, address, property metrics) →
    Render MJML template with deal data →
    Validate email via SendGrid List Validate API →
    Create OfferedDeal record (status: PENDING) →
    Enqueue send job in BullMQ (priority: HIGH) →
    Return immediately to user →
  BullMQ Worker processes job:
    Call SendGrid API to send email →
    Update OfferedDeal (status: SENT, sent_at timestamp) →
    Enqueue follow-up sequence if configured
```

**Why:** Rendering is fast and stateless (no database writes). Job queue decouples send from user request (user gets immediate feedback, system handles retries). Validation prevents reputation damage from invalid addresses.

### Follow-Up Sequence Automation

**Pattern: State Machine + Scheduled Jobs**

Each follow-up sequence is a state machine: user defines steps (email, wait, email, SMS, etc.), system tracks current step per recipient, BullMQ schedules next step execution.

```typescript
// Example sequence definition
const sequence = {
  name: "Aggressive 7-Day Follow-up",
  steps: [
    { type: "WAIT", duration: 0 },           // Step 0: Immediate (same as send)
    { type: "EMAIL", delay: 3, template: "followup_1" },
    { type: "WAIT", duration: 3 },           // Wait 3 days
    { type: "SMS", delay: 3, template: "sms_reminder" },  // SMS day 3
    { type: "WAIT", duration: 4 },           // Wait 4 days
    { type: "PHONE_CALL_SCHEDULE", delay: 7 }  // Phone call day 7
  ]
};

// FollowUpScheduled row per recipient:
{
  dealId, recipientEmail, sequenceId,
  currentStep: 0,                    // At step 0 (initial send)
  nextStepAt: now() + 3 days,       // Next: step 1 (email) in 3 days
  status: "ACTIVE"
}

// BullMQ scheduled job (nextStepAt → execute step)
// When job runs: execute step[currentStep], increment currentStep, schedule next job
```

**Why:** State machine prevents duplicate steps. Scheduled jobs (BullMQ supports `delay` option) handle cadence. User can pause/resume by setting `status: PAUSED`.

### Webhook-Based Deliverability Tracking

**Pattern: Async Event Log + Alert Thresholds**

SendGrid webhooks POST bounce, complaint, open, click events. System appends immutable FollowUpEvent records, calculates rolling metrics (bounce %, complaint %), triggers alerts.

```
SendGrid Webhook (POST /api/webhooks/sendgrid) →
  Verify webhook signature (SendGrid signs all webhooks) →
  Parse event (type: delivered, bounce, complaint, open, click, etc.) →
  Create FollowUpEvent record (immutable, append-only) →
  Update derived metrics (bounce_count, complaint_count, open_count) →
  Check thresholds:
    if bounce_rate > 5% → alert user
    if complaint_rate > 0.1% → auto-unsubscribe recipient, alert
    if sender_score < 80 (polled daily) → alert user
```

**Why:** Immutable event log is audit-friendly (TCPA compliance). Webhook approach is real-time (not polling SendGrid API constantly). Signature verification prevents spoofing.

### Creative Finance Rules Engine Integration

**Pattern: Rule Type Extension (No New Scoring Engine)**

Phase 1 rules engine (operators: GT, LT, EQ, IN, CONTAINS, RANGE; weights 0-100) is extended with new rule types: CREATIVE_FINANCE_FLAG. No separate scoring system.

```typescript
// Phase 1 existing rules:
{
  fieldName: "estimated_value",
  operator: "GT",  // GreaterThan
  value: 150000,
  weight: 10
}

// Phase 2 new rule types:
{
  fieldName: "distress_signals",  // JSONB field
  operator: "CONTAINS",
  value: ["seller_financed", "subject_to"],  // Array of creative finance keywords
  ruleType: "CREATIVE_FINANCE_FLAG",  // New: flags deal for creative finance
  scoreBoost: 20,  // +20 points if matched
  weight: 20
}

// Scoring logic (unchanged from Phase 1):
// score = sum(rule.weight * (condition_met ? 1 : 0)) for all rules
// If creative finance rule matches, add scoreBoost directly
```

**Why:** Reuses Phase 1's proven rules engine. Creative finance rules are optional (don't break existing qualified/unqualified logic). No new database schema beyond adding `ruleSubtype` column.

### Contact Enrichment via Background Job

**Pattern: Bulk Async Enrichment + Graceful Degradation**

When bulk sending offers, enrich contacts in parallel before sending. If enrichment fails (provider timeout, rate limit), proceed with partial data.

```
Bulk Send Request (50 deals) →
  Enqueue BullMQ job: "enrich_contacts" {dealIds: [1, 2, ..., 50]} →
  Job processor:
    Call REISkip API (or BatchData) with batch of 50 addresses →
    For each result: upsert OwnerContact (phone, email, confidence_score) →
    If enrichment fails for a property: log error, skip that record, continue →
    After enrichment: enqueue send jobs for all deals (enriched or not) →
  Send jobs proceed: use enriched phone/email OR original if enrichment failed
```

**Why:** Parallel enrichment speeds up bulk operations. Graceful degradation means one provider failure doesn't block all sends. BullMQ retries give transient errors (timeouts) a second chance.

### Recommended Project Structure

```
src/
├── lib/
│   ├── offers/
│   │   ├── template.ts          # MJML → HTML rendering, EJS for dynamic content
│   │   ├── types.ts             # OfferTemplate, OfferContext types
│   │   └── sendgrid-client.ts   # SendGrid SDK wrapper (auth, rate limiting)
│   ├── sequences/
│   │   ├── state-machine.ts     # Sequence state transitions, step execution
│   │   ├── job-handlers.ts      # BullMQ job processor (EMAIL, SMS, PHONE_CALL_SCHEDULE steps)
│   │   └── types.ts             # FollowUpSequence, FollowUpScheduled types
│   ├── enrichment/
│   │   ├── skip-trace.ts        # REISkip API client (Phase 1 scaffold integration)
│   │   ├── batchdata-client.ts  # BatchData API client (optional Phase 2.1)
│   │   └── types.ts
│   ├── deliverability/
│   │   ├── webhook-handler.ts   # POST /api/webhooks/sendgrid event parser
│   │   ├── metrics.ts           # Bounce %, complaint %, sender score calculations
│   │   ├── alerts.ts            # Alert threshold logic (email, Slack, etc.)
│   │   └── types.ts
│   └── compliance/
│       ├── unsubscribe.ts       # Unsubscribe list enforcement (Phase 1 do-not-call)
│       └── consent-check.ts     # TCPA/CAN-SPAM consent verification
├── app/api/
│   ├── offers/
│   │   ├── route.ts             # POST /api/offers/send, GET /api/offers
│   │   ├── [id]/route.ts        # GET /api/offers/:id (details, tracking)
│   │   └── validate/route.ts    # POST /api/offers/validate (email list validation)
│   ├── sequences/
│   │   ├── route.ts             # GET /api/sequences, POST /api/sequences (create)
│   │   ├── [id]/route.ts        # GET /api/sequences/:id, PATCH /api/sequences/:id
│   │   └── [id]/pause/route.ts  # POST /api/sequences/:id/pause, .../resume
│   └── webhooks/
│       └── sendgrid/route.ts    # POST /api/webhooks/sendgrid (deliverability events)
├── jobs/
│   ├── send-offer.ts            # BullMQ job: send single offer
│   ├── bulk-send.ts             # BullMQ job: bulk send with rate limiting
│   ├── enrich-contacts.ts       # BullMQ job: skip-trace enrichment
│   ├── execute-sequence-step.ts # BullMQ job: execute next sequence step
│   └── poll-sender-score.ts     # BullMQ job: daily sender reputation poll
├── prisma/
│   └── migrations/
│       ├── [timestamp]_add_offered_deal/
│       ├── [timestamp]_add_followup_sequence/
│       ├── [timestamp]_add_followup_scheduled/
│       ├── [timestamp]_add_followup_event/
│       └── [timestamp]_add_sendgrid_webhook/
└── tests/
    ├── lib/offers.test.ts
    ├── lib/sequences.test.ts
    ├── api/webhooks.test.ts
    └── jobs/send-offer.test.ts
```

### Anti-Patterns to Avoid

- **Synchronous SendGrid sends:** Never call SendGrid API directly in request handler. Always queue async job (user sees immediate response, retries handled by BullMQ).
- **Manual retry logic:** Don't implement custom retry loops. BullMQ has built-in exponential backoff (retries with delay).
- **Unverified webhook handlers:** Always verify SendGrid webhook signature before processing (prevent spoofing).
- **Unchecked unsubscribe:** Never send to addresses on do-not-call or unsubscribed list. Enforce before enqueueing job.
- **Render templates in request handler:** Render MJML templates in background job if possible (reduces request latency). For small batch sends, rendering in request is acceptable.
- **Hardcoded template logic:** Keep template content flexible (EJS variables, not hardcoded text). Future phases add custom templates.
- **Ignoring creative finance rules conflicts:** If custom rules conflict (one marks "qualified", another marks "creative finance only"), document precedence (FILTER rules run first, then SCORE rules).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Email delivery (SMTP) | Custom SMTP client, managing mailboxes | SendGrid API | Reputation management, bounce handling, ISP relationships, TCPA compliance built-in. Rolling your own exposes you to deliverability hell. |
| Job queuing (retries, scheduling) | Custom job queue (polling database, cron jobs) | BullMQ (Redis-backed) | Handles failures gracefully, exponential backoff, rate limiting, scheduled jobs, worker scaling. Database polling is inefficient and error-prone. |
| Email template rendering | Hand-written HTML emails | MJML (responsive-by-default) | MJML handles responsive design, email client quirks, syntax validation. Hand-written HTML breaks on mobile devices and email clients. |
| Email validation/list cleaning | Manual validation logic | SendGrid List Validate API | Checks syntax, SMTP, MX records, role detection (noreply@, info@), disposable email domains. Manual logic misses edge cases. |
| Contact enrichment (skip-trace) | Scraping web pages, reverse phone lookups | REISkip or BatchData API | Maintains accuracy (76% right-party contact rate), legal compliance (data sourcing), fast API (doesn't require web scraping). Web scraping is slow, unreliable, and legally risky. |
| Webhook signature verification | Manual HMAC validation | SendGrid SDK webhook verification helper | Prevents replay attacks, spoofing. Manual implementation is error-prone. |
| Sequence scheduling | Manual cron jobs | BullMQ delayed jobs | BullMQ handles job scheduling, prevents duplicate execution, survives server restarts. Manual cron job scheduling is brittle and scales poorly. |
| Bounce/complaint tracking | Manual metric calculation | SendGrid webhooks (immutable event log) | Real-time events (not polling), append-only log (audit trail), signature verified. Manual polling misses events, slow to propagate. |

**Key insight:** Email delivery is complex domain with legal, technical, and operational challenges. Industry-standard tools (SendGrid, BullMQ) handle these challenges so you don't have to rewrite them.

---

## Common Pitfalls

### Pitfall 1: Sending to Unvalidated Email Addresses

**What goes wrong:** Bulk send 50 offers, 15 bounce hard (invalid address, typo). Each bounce damages sender reputation. 10 hard bounces and your IP gets blacklisted by ISPs.

**Why it happens:** Phase 1 import may have data quality issues (typos in owner email). Developers assume "if it's in database, it's valid."

**How to avoid:**
1. **Before bulk send:** Run SendGrid List Validate API on all recipients. Costs $0.01-$0.25 per address, removes invalid/risky addresses.
2. **Pre-send check:** Query do-not-call list + unsubscribed list, filter out before enqueueing jobs.
3. **Webhook handlers:** Process bounce events, update OwnerContact.is_valid flag. Don't send to addresses that bounced before.

**Warning signs:**
- Bounce rate climbing above 5% (alert fires)
- Hard bounces on specific domains (check address format, domain typos)
- Complaint rate increasing (recipients marking as spam because they never consented)

---

### Pitfall 2: Job Queue Overload (Rate Limiting Issues)

**What goes wrong:** User bulk sends 1,000 offers in one batch. BullMQ enqueues 1,000 jobs immediately. Workers process all 1,000 in parallel. SendGrid API rate limit (500/sec) is hit. Requests throttled, jobs retry, system becomes slow.

**Why it happens:** No rate limiting configuration in BullMQ. Developers assume "send as fast as possible."

**How to avoid:**
1. **BullMQ concurrency:** Set `opts.concurrency = 5` in worker config. Process 5 jobs at a time (each job = 1 email), not all 1,000 in parallel.
2. **Rate limiting:** Each job includes delay before send. SendGrid's API accepts batches (multiple To: headers), but simpler to space jobs out.
3. **Bulk operation thresholds:** For sends >500, show user a warning and implement progressive queuing (enqueue 100 jobs, wait for 50 to complete, enqueue next 100).

**Warning signs:**
- Worker logs show "429 Too Many Requests" from SendGrid API
- BullMQ job queue growing faster than jobs are processed (jobs.count() >> jobs.completed())
- System response time slow during bulk sends

---

### Pitfall 3: Webhook Handler Misses or Processes Events Twice

**What goes wrong:** SendGrid sends webhook event (open, bounce, complaint). System processes it, updates database. Webhook times out mid-process. SendGrid retries webhook. System processes same event again, creates duplicate FollowUpEvent records, corrupts metrics.

**Why it happens:** No webhook signature verification (open to replay attacks). No idempotency key handling (allows duplicate processing).

**How to avoid:**
1. **Verify signature:** All SendGrid webhooks are signed. Verify signature before processing:
   ```typescript
   import { EventWebhook } from "@sendgrid/eventwebhook";
   const eventWebhook = new EventWebhook();
   const publicKey = process.env.SENDGRID_WEBHOOK_SIGNATURE_KEY;
   const isValid = eventWebhook.verify(publicKey, payload, signature);
   if (!isValid) return 400; // Reject unsigned webhooks
   ```
2. **Idempotency key:** SendGrid includes unique `sg_message_id` in each event. Use this as idempotency key:
   ```typescript
   const existingEvent = await prisma.followUpEvent.findUnique({
     where: { sendgridMessageId: event.sg_message_id }
   });
   if (existingEvent) return 200; // Already processed, return 200 to ack
   // Process event and create record
   ```

**Warning signs:**
- FollowUpEvent table has duplicate records with same `sg_message_id`
- Bounce/complaint metrics don't match SendGrid dashboard
- Unsubscribe count is higher than expected

---

### Pitfall 4: Sequence State Machine Gets Out of Sync

**What goes wrong:** User creates follow-up sequence with 5 steps. While first step (email) is being sent, user pauses sequence. System is mid-update of FollowUpScheduled.currentStep. Pause request races with job completion. Database ends up in inconsistent state (marked paused but next step still scheduled).

**Why it happens:** No transaction handling. FollowUpScheduled updates are not atomic.

**How to avoid:**
1. **Transactions:** Wrap state machine updates in database transactions:
   ```typescript
   await prisma.$transaction(async (tx) => {
     const scheduled = await tx.followUpScheduled.findUnique({
       where: { id: scheduleId }
     });
     if (scheduled.status === "PAUSED") throw new Error("Paused");

     // Execute step, then update state atomically
     await executeSequenceStep(scheduled.currentStep);
     await tx.followUpScheduled.update({
       where: { id: scheduleId },
       data: {
         currentStep: scheduled.currentStep + 1,
         nextStepAt: calculateNextStepTime(...)
       }
     });
   });
   ```
2. **Optimistic locking:** Add `version` field to FollowUpScheduled. Fail update if version mismatch (detect races).
3. **Single writer:** Only the BullMQ job processor should update FollowUpScheduled.currentStep. Pause/resume only change `status` field.

**Warning signs:**
- Some sequences progress normally, others stuck at step 0 or skip steps
- User reports "I paused but emails still sending"
- FollowUpEvent shows gaps (step 1 completed, but step 2 never ran)

---

### Pitfall 5: Creative Finance Rules Conflict with Qualification Rules

**What goes wrong:** User creates rule: "If subject-to signals → mark as creative finance." Separately, they create rule: "If no financing structure → not qualified." Now a property matching both rules gets conflicting signals. Pipeline shows it as qualified AND creative-only, causing confusion.

**Why it happens:** Phase 1 rules engine evaluates all rules independently. Phase 2 adds creative finance rules without documenting precedence.

**How to avoid:**
1. **Document rule precedence:** In CONTEXT or RESEARCH:
   - FILTER rules (hard stops) evaluated first
   - Then SCORE rules (weighted scoring)
   - Creative finance rules are optional SCORE rules (don't override FILTER logic)
   - Deal is "qualified" if passes all FILTER rules, regardless of creative finance score

2. **Test conflicting rule scenarios:** In phase plan, include test:
   ```typescript
   // Test: Property matches BOTH "no financing" filter AND "subject-to" creative finance rule
   // Expected: Deal shows qualified + creative finance badge (creative finance is bonus, not replacement)
   ```

3. **UI clarity:** Pipeline shows both "Qualified" badge AND "Subject-To" badge. Rules engine doesn't override user's custom rules.

**Warning signs:**
- User reports deals appearing/disappearing as they toggle rules
- Dashboard shows same deal in both "Qualified" and "Needs Financing" sections simultaneously
- Qualification logic seems non-deterministic (same deal qualifies sometimes, doesn't other times)

---

### Pitfall 6: TCPA Consent Not Verified Before Follow-Up Sends

**What goes wrong:** User sends initial offer email (transactional, no TCPA consent needed). System auto-enqueues 3-day follow-up email. At day 3, system sends without checking if consent was documented. If recipient complains to FCC, you're liable.

**Why it happens:** Initial offer send is "transactional" (no consent needed), but follow-ups are "marketing" (consent required). Code path doesn't re-check consent for follow-up steps.

**How to avoid:**
1. **Consent check before sequence execute:** In job handler for each follow-up step (email #2, SMS, call scheduling), query consent_records table:
   ```typescript
   const consent = await prisma.consentRecord.findFirst({
     where: {
       ownerPhoneNumber: encrypted(recipient.phone),
       consentStatus: { in: ["EXPRESS_WRITTEN", "PRIOR_EXPRESS"] }
     }
   });
   if (!consent) {
     log.warn(`No consent for ${recipient.email}, skipping follow-up`);
     return; // Don't send, log the skipped step
   }
   ```

2. **Document consent timing in FollowUpEvent:** Log which consent record was verified:
   ```typescript
   await prisma.followUpEvent.create({
     data: {
       type: "EMAIL_SENT",
       followUpScheduledId: ...,
       consentRecordId: consent.id,  // Link to consent
       ...
     }
   });
   ```

**Warning signs:**
- Users report "I sent follow-ups but didn't document consent"
- FollowUpEvent logs show emails sent without corresponding consent_records
- Compliance audit shows sends not linked to consent documentation

---

## Code Examples

Verified patterns from official sources and Phase 1 foundation:

### Offer Generation and SendGrid Send

```typescript
// Source: @sendgrid/mail docs, MJML docs
// File: src/lib/offers/template.ts

import { render } from "mjml-core";
import * as ejs from "ejs";
import type { Deal, OwnerContact } from "@prisma/client";

export interface OfferContext {
  deal: Deal & { property?: any };
  contact: OwnerContact;
  ourCompanyName: string;
  ourContactEmail: string;
}

export async function renderOfferEmail(
  context: OfferContext
): Promise<{ html: string; text: string }> {
  // Load MJML template
  const mjmlTemplate = `
<mjml>
  <mj-body background-color="#f4f4f4">
    <mj-section>
      <mj-column>
        <mj-text font-size="20px" color="#333">
          Offer on Property at {{address}}
        </mj-text>
        <mj-text color="#666">
          Dear {{contactName}},
        </mj-text>
        <mj-text>
          I represent {{companyName}}, and we are interested in acquiring your property at {{address}}.
        </mj-text>
        <mj-text>
          <strong>Proposed Offer Price:</strong> ${{offerPrice}}
        </mj-text>
        <mj-text>
          <strong>Estimated After-Repair Value (ARV):</strong> ${{arv}}
        </mj-text>
        <mj-text>
          This offer is subject to inspection and appraisal.
        </mj-text>
        <mj-button href="https://yourcompany.com/learn-more">
          Learn More
        </mj-button>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>
  `;

  // Substitute variables using EJS
  const filled = await ejs.render(mjmlTemplate, {
    address: `${context.deal.property?.address}`,
    contactName: context.contact.ownerName,
    companyName: context.ourCompanyName,
    offerPrice: context.deal.estimatedProfit?.toString() || "TBD",
    arv: context.deal.property?.estimatedValue?.toString() || "TBD",
  });

  // Compile MJML to HTML
  const { html } = render(filled);

  // Plain text fallback
  const text = `
Offer on Property at ${context.deal.property?.address}

Dear ${context.contact.ownerName},

I represent ${context.ourCompanyName}, and we are interested in acquiring your property.

Proposed Offer Price: $${context.deal.estimatedProfit}
Estimated After-Repair Value (ARV): $${context.deal.property?.estimatedValue}

This offer is subject to inspection and appraisal.

Contact: ${context.ourContactEmail}
  `;

  return { html, text };
}
```

### SendGrid Send with Job Queue

```typescript
// Source: @sendgrid/mail SDK docs, BullMQ job pattern
// File: src/jobs/send-offer.ts

import sgMail from "@sendgrid/mail";
import { prisma } from "@/lib/db";
import { renderOfferEmail, type OfferContext } from "@/lib/offers/template";

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

export interface SendOfferJobData {
  offeredDealId: string;
  offerPrice: number;
}

export async function handleSendOfferJob(data: SendOfferJobData) {
  const { offeredDealId } = data;

  // Load offer details
  const offeredDeal = await prisma.offeredDeal.findUnique({
    where: { id: offeredDealId },
    include: {
      deal: {
        include: {
          property: true,
          user: true,
        },
      },
      contact: true,
    },
  });

  if (!offeredDeal) throw new Error(`Offer ${offeredDealId} not found`);

  const { deal, contact } = offeredDeal;

  // Render email template
  const context: OfferContext = {
    deal,
    contact: contact!,
    ourCompanyName: deal.user?.companyName || "Our Company",
    ourContactEmail: deal.user?.contactEmail || "noreply@company.com",
  };

  const { html, text } = await renderOfferEmail(context);

  // SendGrid unsubscribe list check (Phase 1 do_not_call_list)
  const isUnsubscribed = await prisma.doNotCallList.findFirst({
    where: {
      phoneNumber: contact?.phone || "",
    },
  });

  if (isUnsubscribed) {
    console.warn(`Recipient ${contact?.email} is on unsubscribe list, skipping`);
    await prisma.offeredDeal.update({
      where: { id: offeredDealId },
      data: {
        status: "SKIPPED",
        bounceReason: "UNSUBSCRIBED",
      },
    });
    return;
  }

  // SendGrid send
  try {
    const msg = {
      to: contact?.email || "",
      from: {
        email: process.env.SENDGRID_FROM_EMAIL!,
        name: process.env.SENDGRID_FROM_NAME!,
      },
      subject: `Offer on ${deal.property?.address}`,
      text,
      html,
      replyTo: deal.user?.contactEmail || process.env.SENDGRID_FROM_EMAIL!,
      // TCPA/CAN-SPAM compliance
      headers: {
        "List-Unsubscribe": `<${process.env.NEXT_PUBLIC_APP_URL}/unsubscribe?email=${encodeURIComponent(contact?.email || "")}>`,
      },
      trackingSettings: {
        openTracking: { enable: true },
        clickTracking: { enable: true },
      },
    };

    const response = await sgMail.send(msg);
    const sendgridId = response[0].headers["x-message-id"];

    // Update offer status
    await prisma.offeredDeal.update({
      where: { id: offeredDealId },
      data: {
        status: "SENT",
        sentAt: new Date(),
        sendgridMessageId: sendgridId,
      },
    });

    console.log(`Offer ${offeredDealId} sent to ${contact?.email}`);
  } catch (error) {
    console.error(`Failed to send offer ${offeredDealId}:`, error);
    throw error; // BullMQ will retry
  }
}
```

### BullMQ Job Setup (from Phase 1)

```typescript
// Source: BullMQ docs, Phase 1 integration pattern
// File: src/lib/queue/initialize.ts

import { Queue, Worker } from "bullmq";
import { handleSendOfferJob } from "@/jobs/send-offer";
import { handleExecuteSequenceStepJob } from "@/jobs/execute-sequence-step";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

// Create queues
export const offerQueue = new Queue("send-offer", {
  connection: { url: REDIS_URL },
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
  },
});

export const sequenceQueue = new Queue("execute-sequence", {
  connection: { url: REDIS_URL },
  defaultJobOptions: {
    attempts: 2,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
  },
});

// Create workers
const offerWorker = new Worker("send-offer", handleSendOfferJob, {
  connection: { url: REDIS_URL },
  concurrency: 5, // Process 5 offers in parallel (respects SendGrid rate limit)
});

const sequenceWorker = new Worker(
  "execute-sequence",
  handleExecuteSequenceStepJob,
  {
    connection: { url: REDIS_URL },
    concurrency: 3,
  }
);

// Error handling
offerWorker.on("failed", (job, err) => {
  console.error(`Job ${job?.id} failed:`, err.message);
});

sequenceWorker.on("failed", (job, err) => {
  console.error(`Sequence job ${job?.id} failed:`, err.message);
});
```

### SendGrid Webhook Handler

```typescript
// Source: SendGrid docs, webhook signature verification
// File: src/app/api/webhooks/sendgrid/route.ts

import { EventWebhook } from "@sendgrid/eventwebhook";
import { prisma } from "@/lib/db";

const eventWebhook = new EventWebhook();
const WEBHOOK_SIGNATURE_KEY = process.env.SENDGRID_WEBHOOK_SIGNATURE_KEY!;

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("X-Twilio-Email-Event-Webhook-Signature") || "";
  const timestamp = request.headers.get("X-Twilio-Email-Event-Webhook-Timestamp") || "";

  // Verify signature
  const isValid = eventWebhook.verify(WEBHOOK_SIGNATURE_KEY, body, signature, timestamp);
  if (!isValid) {
    console.warn("Invalid SendGrid webhook signature");
    return new Response("Unauthorized", { status: 401 });
  }

  // Parse events
  const events = JSON.parse(body);
  for (const event of events) {
    const { sg_message_id, email, event: eventType, timestamp: eventTime } = event;

    // Idempotency: check if already processed
    const existing = await prisma.followUpEvent.findFirst({
      where: {
        sendgridMessageId: sg_message_id,
        type: eventType.toUpperCase(),
      },
    });

    if (existing) {
      console.log(`Event ${sg_message_id}/${eventType} already processed`);
      continue;
    }

    // Create event log
    let eventLog: any = {
      sendgridMessageId: sg_message_id,
      recipientEmail: email,
      type: eventType.toUpperCase(),
      eventTime: new Date(parseInt(eventTime) * 1000),
    };

    // Handle bounce event
    if (eventType === "bounce") {
      eventLog.bounceType = event.bounce_type; // hard or soft
      eventLog.bounceReason = event.reason;

      // Hard bounces: mark contact as invalid
      if (event.bounce_type === "permanent") {
        await prisma.ownerContact.updateMany({
          where: { email },
          data: { isValid: false, invalidReason: "HARD_BOUNCE" },
        });
      }
    }

    // Handle complaint event
    if (eventType === "spamreport" || eventType === "complaint") {
      eventLog.complaintType = event.complaint_type || "spam";

      // Auto-unsubscribe on complaint
      await prisma.doNotCallList.create({
        data: {
          phoneNumber: email, // Using email as identifier (simplified)
          addedReason: "SPAM_COMPLAINT",
          addedTimestamp: new Date(),
        },
      });

      // Alert user
      console.warn(`Spam complaint for ${email}, added to unsubscribe list`);
    }

    // Log the event
    await prisma.followUpEvent.create({
      data: eventLog,
    });
  }

  return new Response("OK", { status: 200 });
}
```

### Follow-Up Sequence State Machine

```typescript
// Source: Phase 2 design pattern, BullMQ scheduling
// File: src/lib/sequences/state-machine.ts

import { FollowUpSequence, FollowUpScheduled } from "@prisma/client";
import { prisma } from "@/lib/db";
import { sequenceQueue } from "@/lib/queue/initialize";

export type SequenceStep = {
  id: string;
  type: "EMAIL" | "SMS" | "PHONE_CALL_SCHEDULE" | "WAIT";
  delay: number; // days
  template?: string;
};

export async function enqueueSequenceForRecipient(
  dealId: string,
  sequenceId: string,
  recipientEmail: string,
  recipientPhone?: string
) {
  // Create scheduled instance
  const steps = await getSequenceSteps(sequenceId);
  const nextStepAt = calculateNextStepTime(steps[0]?.delay || 0);

  const scheduled = await prisma.followUpScheduled.create({
    data: {
      dealId,
      sequenceId,
      recipientEmail,
      recipientPhone,
      currentStep: 0,
      nextStepAt,
      status: "ACTIVE",
    },
  });

  // Enqueue first step
  const delay = (steps[0]?.delay || 0) * 24 * 60 * 60 * 1000;
  await sequenceQueue.add(
    `execute-step-${scheduled.id}`,
    {
      followUpScheduledId: scheduled.id,
      stepIndex: 0,
    },
    {
      delay,
      priority: 10,
    }
  );
}

export async function executeSequenceStep(followUpScheduledId: string) {
  // Fetch state
  const scheduled = await prisma.followUpScheduled.findUnique({
    where: { id: followUpScheduledId },
    include: { sequence: true },
  });

  if (!scheduled) throw new Error(`Schedule ${followUpScheduledId} not found`);
  if (scheduled.status === "PAUSED") return; // Don't execute paused sequences

  const steps = JSON.parse(scheduled.sequence.stepsJson);
  const currentStep = steps[scheduled.currentStep];

  if (!currentStep) {
    // All steps completed
    await prisma.followUpScheduled.update({
      where: { id: followUpScheduledId },
      data: { status: "COMPLETED" },
    });
    return;
  }

  // Execute step based on type
  switch (currentStep.type) {
    case "EMAIL":
      // Enqueue send-offer job
      await prisma.followUpEvent.create({
        data: {
          followUpScheduledId,
          type: "EMAIL_SENT",
          eventTime: new Date(),
        },
      });
      break;

    case "SMS":
      // Enqueue SMS job
      await prisma.followUpEvent.create({
        data: {
          followUpScheduledId,
          type: "SMS_SENT",
          eventTime: new Date(),
        },
      });
      break;

    case "PHONE_CALL_SCHEDULE":
      // Create reminder for user (don't actually call)
      await prisma.followUpEvent.create({
        data: {
          followUpScheduledId,
          type: "PHONE_CALL_SCHEDULED",
          eventTime: new Date(),
        },
      });
      break;
  }

  // Move to next step
  const nextStep = steps[scheduled.currentStep + 1];
  if (nextStep) {
    const delay = (nextStep.delay || 0) * 24 * 60 * 60 * 1000;
    await sequenceQueue.add(
      `execute-step-${followUpScheduledId}`,
      {
        followUpScheduledId,
        stepIndex: scheduled.currentStep + 1,
      },
      {
        delay,
      }
    );

    await prisma.followUpScheduled.update({
      where: { id: followUpScheduledId },
      data: {
        currentStep: scheduled.currentStep + 1,
        nextStepAt: new Date(Date.now() + delay),
      },
    });
  }
}

export async function pauseSequence(followUpScheduledId: string) {
  await prisma.followUpScheduled.update({
    where: { id: followUpScheduledId },
    data: { status: "PAUSED" },
  });

  // Note: BullMQ job already enqueued; it won't execute if status is PAUSED
  // (checked in executeSequenceStep)
}

export async function resumeSequence(followUpScheduledId: string) {
  const scheduled = await prisma.followUpScheduled.findUnique({
    where: { id: followUpScheduledId },
  });

  if (!scheduled) throw new Error("Schedule not found");

  await prisma.followUpScheduled.update({
    where: { id: followUpScheduledId },
    data: { status: "ACTIVE" },
  });

  // Re-enqueue the next step if it hasn't been scheduled yet
  const delay = Math.max(
    0,
    scheduled.nextStepAt.getTime() - Date.now()
  );

  if (delay > 0) {
    await sequenceQueue.add(
      `execute-step-${followUpScheduledId}`,
      {
        followUpScheduledId,
        stepIndex: scheduled.currentStep,
      },
      { delay }
    );
  }
}
```

### Creative Finance Rules Extension

```typescript
// Source: Phase 1 rules engine (src/lib/deals/rules.ts), Phase 2 extension
// File: src/lib/creative-finance/rules.ts

import { QualificationRule } from "@prisma/client";

export type CreativeFinanceRuleSubtype =
  | "SUBJECT_TO"
  | "SELLER_FINANCE"
  | "OWNER_OCCUPIED_VACATED"
  | "LIEN_POSITION"
  | "PROBATE";

export async function scoreCreativeFinance(
  deal: any,
  rules: QualificationRule[]
): Promise<{ score: number; matchedRules: string[] }> {
  let score = 0;
  const matched: string[] = [];

  for (const rule of rules) {
    // Only process creative finance rules in this function
    if (rule.ruleType !== "CREATIVE_FINANCE_FLAG") continue;

    const matches = evaluateRule(deal, rule);
    if (matches) {
      score += rule.scoreBoost || 20; // Default +20 points
      matched.push(rule.name);
    }
  }

  return { score, matchedRules: matched };
}

function evaluateRule(deal: any, rule: QualificationRule): boolean {
  const value = getFieldValue(deal, rule.fieldName);

  switch (rule.operator) {
    case "CONTAINS":
      if (!Array.isArray(rule.value)) return false;
      return rule.value.some((v) =>
        Array.isArray(value)
          ? value.includes(v)
          : String(value).includes(v)
      );
    case "IN":
      if (!Array.isArray(rule.value)) return false;
      return rule.value.includes(value);
    case "EQ":
      return value === rule.value;
    default:
      return false;
  }
}

function getFieldValue(deal: any, fieldName: string): any {
  return deal[fieldName] || deal.property?.[fieldName] || null;
}

// Example usage in deal qualification:
export async function qualifyDealWithCreativeFinance(dealId: string) {
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    include: { property: true },
  });

  // Phase 1 score (FILTER + SCORE rules)
  const phase1Score = calculatePhase1Score(deal);

  // Phase 2 creative finance bonus
  const creativeRules = await prisma.qualificationRule.findMany({
    where: {
      ruleType: "CREATIVE_FINANCE_FLAG",
      enabled: true,
    },
  });

  const { score: creativeBonus, matchedRules } = await scoreCreativeFinance(
    deal,
    creativeRules
  );

  // Final score = Phase 1 + Creative Finance bonus
  const finalScore = phase1Score + creativeBonus;

  // Mark as creative finance if any creative rules matched
  const isCreativeFinance = matchedRules.length > 0;

  await prisma.deal.update({
    where: { id: dealId },
    data: {
      qualificationScore: finalScore,
      customFields: {
        ...deal.customFields,
        creativeFinanceFlags: matchedRules,
      },
    },
  });

  return { finalScore, isCreativeFinance, matchedRules };
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual email composition, copy-paste | MJML template rendering + SendGrid API | 2020s industry standard | Responsive-by-default emails, consistent branding, no manual HTML |
| SMTP relay (self-hosted) | SendGrid/Brevo API (managed services) | 2015+ | Reputation management outsourced, better deliverability, built-in compliance |
| Delayed jobs via cron + database polling | BullMQ (Redis-backed job queue) | 2020+ | Reliable retries, rate limiting, scheduled jobs, scales horizontally |
| Manual webhook handling (HMAC, replay) | SendGrid SDK webhook helpers | 2022+ | Built-in signature verification, prevents spoofing |
| Manual bounce tracking spreadsheets | Webhook event log + metrics dashboards | 2020+ | Real-time visibility, automated alerts, audit trail |
| Custom follow-up automation (email templates per step) | Sequence state machine + generic templates | 2022+ | User-defined sequences, flexible cadence, easier to maintain |

**Deprecated/outdated:**
- **Sendmail/Postfix (self-hosted SMTP):** Replaced by managed email APIs. Self-hosted requires IP reputation management, blacklist monitoring, ISP relationships. Use SendGrid instead.
- **Node-schedule (simple cron wrapper):** Replaced by BullMQ. node-schedule is fine for simple tasks, but doesn't handle failures, retries, or rate limiting. Use BullMQ for email/SMS queuing.
- **Manual email template HTML:** Replaced by MJML. Writing HTML emails manually breaks on mobile and email clients. MJML handles responsive design automatically.

---

## Open Questions

1. **REISkip vs BatchData pricing and accuracy trade-off**
   - What we know: REISkip costs $0.15/record, BatchData $500/month but 76% right-party contact rate. Phase 1 selected REISkip for cost.
   - What's unclear: How much does the higher accuracy of BatchData translate to better deal conversion? Is the $500/month worth it for a user sending 50 offers/week?
   - Recommendation: Start with REISkip in Phase 2. Provide BatchData as opt-in integration in Phase 2.1. Track conversion metrics per enrichment provider to validate ROI.

2. **SendGrid List Validate API cost vs accuracy trade-off**
   - What we know: Each validation costs $0.01-$0.25 depending on strictness level. Bulk send 50 offers → up to $12.50 validation cost per batch.
   - What's unclear: Is strict validation worth the cost? What's the actual bounce rate without validation?
   - Recommendation: Start with "lenient" validation ($0.01/email). Monitor bounce rate. If >5%, upgrade to "strict" validation ($0.25/email).

3. **Alert mechanism for bounce/complaint/sender score**
   - What we know: Thresholds set (bounce >5%, complaint >0.1%, sender score <80).
   - What's unclear: How should user be alerted? Email? In-app notification? Slack webhook?
   - Recommendation: Default email alert to user's account email. Phase 2.1 adds Slack/webhook integration.

4. **Multi-channel sequencing (email → SMS → call scheduling) complexity**
   - What we know: Phase 2 supports SMS if phone number + consent exists. Actual phone calls are scheduling only (Phase 2 limitation).
   - What's unclear: If SMS fails (invalid phone), should sequence skip to next step or pause?
   - Recommendation: Log failure and continue to next step. Don't pause entire sequence for single channel failure.

5. **Creative finance rule validation and conflict detection**
   - What we know: Rules are optional, don't override standard qualification.
   - What's unclear: Should system warn user if they create conflicting rules? How to detect/prevent "impossible" rules?
   - Recommendation: Implement rule validation in plan 02-04. Before saving rule, check for logical conflicts (e.g., "equity > 50%" conflicts with "distressed property"). Warn user but allow save (user responsibility).

---

## Sources

### Primary (HIGH confidence)

- **@sendgrid/mail SDK** (v7.7.0+) — Node.js SDK documentation, webhook signature verification, template rendering
  - Verified: SendGrid API contract, rate limits, webhook event types, unsubscribe handling
  - Source: https://github.com/sendgrid/sendgrid-nodejs, https://docs.sendgrid.com/

- **BullMQ v5.x** — Job queue documentation, Redis integration, concurrency/rate limiting
  - Verified: Job queue patterns, delayed jobs, worker configuration, idempotency, retries
  - Source: https://bullmq.io/, https://github.com/taskforcesh/bullmq

- **MJML v4.15.3+** — Responsive email framework documentation, Node.js integration
  - Verified: Template syntax, responsive design, Email client compatibility
  - Source: https://mjml.io/, https://github.com/mjmlio/mjml

- **SendGrid Event Webhook Documentation** — Bounce, complaint, open, click event types, signature verification
  - Verified: Event payload structure, signature verification, retry behavior
  - Source: https://docs.sendgrid.com/for-developers/tracking-events/event, https://www.twilio.com/docs/sendgrid/

- **TCPA and CAN-SPAM Compliance (FTC/FCC)**
  - Verified: TCPA rules (SMS requires explicit consent, opt-out requirements), CAN-SPAM (email unsubscribe), 2026 updates (consumers can revoke consent via multiple methods)
  - Source: https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business, https://blog.clickpointsoftware.com/tcpa-one-to-one-consent-can-spam-state-regulations

### Secondary (MEDIUM confidence)

- **SendGrid Pricing and Rate Limits (2026)**
  - Verified: Free trial (100 emails/day, 60 days), Essentials ($19.95/month, 50k emails), API rate limit (500 requests/sec)
  - Source: https://sendgrid.com/en-us/pricing, https://hackceleration.com/sendgrid-review/

- **Brevo vs SendGrid Comparison (2026)**
  - Verified: Brevo free tier (300 emails/day), SendGrid free trial (100/day, 60 days), Mailgun free tier (100/day)
  - Source: https://www.brevo.com/blog/sendgrid-alternatives/, https://www.emailvendorselection.com/sendgrid-alternatives/

- **Bulk Email Rate Limiting Best Practices**
  - Verified: 10-20 emails/day per account, warm-up for new accounts, SPF/DKIM authentication requirement (Gmail 2026)
  - Source: https://growthlist.co/email-sending-limits-of-various-email-service-providers/, https://www.realestateblog247.com/mastering-legal-rules-for-bulk-emails-in-real-estate-this-year/

- **Email Authentication (SPF, DKIM, DMARC)**
  - Verified: SPF (domain whitelist), DKIM (message signing), DMARC (policy enforcement), 2026 requirement for large senders
  - Source: https://www.cloudflare.com/learning/email-security/dmarc-dkim-spf/, https://storylab.ai/email-deliverability-mastering-spf-dkim-dmarc/

- **Twilio SMS API for Node.js**
  - Verified: SMS sending API, scheduled messages, delivery status webhooks
  - Source: https://www.twilio.com/en-us/blog/send-scheduled-sms-node-js-twilio, https://www.twilio.com/docs/messaging/quickstart

- **Contact Enrichment / Skip-Trace APIs**
  - Verified: BatchData Node.js SDK, REISkip pricing ($0.15/record), right-party contact rates (76% BatchData)
  - Source: https://batchdata.io/skip-tracing, https://developer.batchdata.com/docs, https://batchdata.io/blog/real-time-skip-tracing-apis-real-estate

- **Real Estate Offer Email Templates**
  - Verified: Professional email structure (address, price, terms, contact), mobile responsiveness requirement
  - Source: https://flodesk.com/tips/real-estate-offer-email-templates, https://www.omnisend.com/blog/real-estate-email-templates/

### Tertiary (LOW confidence)

- **Creative Finance Deal Scoring Algorithm**
  - Verified: Subject-to, seller financing, lease option as creative strategies
  - Unverified: Specific algorithm (0-100 scoring based on equity, condition, motivation signals). Phase 2 implementation will define/validate.
  - Source: https://www.offermarket.us/blog/creative-financing, https://www.nasdaq.com/articles/12-creative-financing-strategies-real-estate-investing

- **Real Estate Automation Platforms (Leadfwd, Apollo.io)**
  - Verified: Multi-channel sequences exist in competitor products
  - Unverified: Specific implementation patterns. Phase 2 will design from first principles.
  - Source: https://leadfwd.ai/, https://www.unkoa.com/apollo-io-sequences-the-ultimate-guide-to-automated-outreach-for-b2b-sales/

---

## Metadata

**Confidence breakdown:**

- **Standard stack (HIGH):** SendGrid, BullMQ, MJML, EJS are mature, well-documented, industry-standard. Phase 1 already uses Redis. No surprises expected.
- **Email deliverability (HIGH):** SendGrid webhook events, rate limits, authentication requirements verified from official docs and recent 2026 guides. TCPA/CAN-SPAM rules confirmed via FTC/FCC sources.
- **Multi-channel (MEDIUM):** Twilio SMS integration verified, but actual implementation details (retry logic, consent verification) will emerge during phase 02-03.
- **Contact enrichment (MEDIUM):** REISkip and BatchData APIs verified, but accuracy/ROI trade-off requires empirical testing in Phase 2.
- **Creative finance (LOW):** Strategies (subject-to, seller financing) verified, but scoring algorithm (0-100 points based on signals) needs validation during Phase 2 planning. Phase 2 will define: what signals trigger creative finance flag? How much boost does +20 points translate to?
- **Architecture (HIGH):** BullMQ job queue patterns, webhook handling, state machines are battle-tested patterns from industry experience.

**Research date:** 2026-02-27
**Valid until:** 2026-04-01 (stable stack, 30 days). Re-verify SendGrid pricing/limits and Twilio SMS compliance if Phase 2 planning extends beyond April 2026.

---

**Next Step:** Planner can now create PLAN.md files for Phase 2 Wave 1 (02-01, 02-02) and Wave 2 (02-03 through 02-06).
