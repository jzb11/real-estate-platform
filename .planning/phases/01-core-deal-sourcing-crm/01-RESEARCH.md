# Phase 1 Implementation Research: Core Deal Sourcing & CRM

**Phase Goal:** Enable users to connect data sources, source deals, analyze profitability, organize in a CRM pipeline, and access the platform securely with compliance foundations.

**Research Date:** 2026-02-26
**Overall Confidence:** MEDIUM (PropStream API requires partner investigation; TCPA rules clarified but FCC changes ongoing; stack and patterns validated)

---

## 1. PropStream API Integration

**Question:** What's the exact API contract? Rate limits? Authentication? Data structure? Best practices?

### Findings

**API Availability: MEDIUM Confidence**
- PropStream does NOT have a public, self-service API available on their website or documentation.
- PropStream offers **data APIs to strategic partners** (verified partnership with Tuesday App for MLS discovery).
- Official path: Contact PropStream partnership team at (877) 204-9040 for API integration details.
- Data coverage: 160+ million properties, 9,000 attributes per property, multi-sourced (public records, MLS, private aggregators).

**What This Means for Phase 1:**
- **DECISION REQUIRED:** PropStream integration is achievable but requires partnership agreement negotiation BEFORE development begins.
- **Timeline impact:** Add 2-4 weeks for partnership discovery call, terms, and technical onboarding before coding.
- **Fallback option:** ATTOM Data API (158M properties, $95+/month) is publicly available with documented REST endpoints and webhooks.

**Rate Limits & Data Freshness: LOW Confidence on PropStream specifics**
- PropStream data is 7-30 days old (acknowledged in domain research).
- Must explicitly flag data freshness to users ("Last updated: 7 days ago").
- ATTOM Data pricing: ~$95/month for developers; scales with usage.

**Authentication (if partner API obtained):**
- Likely OAuth 2.0 or API key (standard for real estate data APIs).
- Must implement token refresh and expiration handling in Node.js backend.

### Action Items for Phase 1
1. **Week 0:** Contact PropStream partnership; get technical documentation and sandbox credentials.
2. **Week 1-2:** Implement API abstraction layer in Express backend to decouple data source (allows PropStream swap to ATTOM if needed).
3. **Implement fallback:** If PropStream partnership stalls, ATTOM Data API is a documented, publicly available alternative.

**Sources:**
- [PropStream Partner Page](https://www.propstream.com/partner-with-us)
- [PropStream Tuesday App Partnership](https://www.rismedia.com/2026/02/04/propstream-partners-tuesday-app-streamline-mls-discovery-lead-generation/)
- [Real Estate APIs Comparison 2026](https://www.housecanary.com/blog/real-estate-api)

---

## 2. Database Schema for Phase 1

**Question:** What tables are needed for properties, deals, users, compliance logs, knowledge base?

### Core Tables Required

**Users & Authentication**
```
users
  - id (UUID)
  - email (UNIQUE, indexed)
  - name
  - password_hash (if custom auth; null if Clerk)
  - clerk_user_id (if Clerk-managed)
  - subscription_tier (FREE, PRO, ENTERPRISE)
  - created_at, updated_at
  - deleted_at (soft delete for GDPR)

user_roles
  - id (UUID)
  - user_id (FK)
  - role (ADMIN, AGENT, WHOLESALER)
  - permissions (JSONB for fine-grained access)
  - created_at
```

**Properties (from PropStream/ATTOM)**
```
properties
  - id (UUID)
  - external_id (PropStream or ATTOM reference, UNIQUE)
  - address (street, city, state, zip indexed for search)
  - latitude, longitude (GiST index for geo queries)
  - property_type (SINGLE_FAMILY, MULTI_UNIT, COMMERCIAL, LAND)
  - estimated_value (ARV equivalent)
  - last_sale_price
  - last_sale_date
  - tax_assessed_value
  - ownership_name, ownership_phone
  - distress_signals (JSONB: foreclosure, auction, notice, etc.)
  - data_source (PROPSTREAM, ATTOM, MLS)
  - data_freshness_date (timestamp of API pull, MUST show to users)
  - raw_data (JSONB backup of full API response for audit trail)
  - created_at, updated_at

property_indexes
  - (address, user_id) for quick "my favorite lists"
  - (external_id) for deduplication
  - (data_freshness_date DESC) for showing stale data warnings
```

**Deals (CRM)**
```
deals
  - id (UUID)
  - property_id (FK)
  - user_id (FK)
  - title (user-facing name)
  - status (enum: SOURCED, ANALYZING, QUALIFIED, REJECTED, UNDER_CONTRACT, CLOSED)
  - stage_history (JSONB: [{stage, entered_at, exited_at, reason}])
  - custom_fields (JSONB: user-defined filters like rehab_cost, target_arv)
  - qualification_score (integer: 0-100, auto-calculated)
  - estimated_profit
  - notes (user text)
  - pipeline_position (integer for Kanban sorting)
  - created_at, updated_at
  - closed_date (when deal reached CLOSED or REJECTED)

deal_history
  - id (UUID)
  - deal_id (FK)
  - field_changed (status, qualification_score, notes, etc.)
  - old_value, new_value
  - changed_by_user_id (FK)
  - changed_at (must be immutable for audit)
```

**Compliance & Contact Logging (TCPA)**
```
contact_logs
  - id (UUID)
  - property_id (FK)
  - owner_phone_number (encrypted; never logged plain text in logs)
  - contact_timestamp (UTC, precise to millisecond)
  - contact_method (CALL, SMS, EMAIL, LETTER)
  - initiated_by_user_id (FK)
  - consent_status (NO_CONSENT_OBTAINED, EXPRESS_WRITTEN_CONSENT, PRIOR_EXPRESS_CONSENT, DO_NOT_CALL)
  - consent_timestamp (when consent was recorded)
  - consent_medium (FORM_SUBMISSION, EMAIL_REPLY, SMS_REPLY, PHONE_CALL_RECORDED)
  - consent_details (JSONB: what was disclosed to consumer, which disclosures checked)
  - opt_out_requested_at (timestamp if consumer revoked consent)
  - opt_out_processed_at (timestamp when system honored request)
  - call_recording_url (if recorded)
  - notes (agent notes on conversation)
  - created_at (immutable)

consent_records
  - id (UUID)
  - owner_phone_number (encrypted)
  - original_consent_timestamp
  - original_consent_method
  - disclosures_acknowledged (JSONB list of what user agreed to)
  - revocation_timestamp (null until revoked)
  - revocation_method (how consumer opted out)
  - revocation_processed_date (when system honored within 10 business days per FCC Jan 2025)
  - compliance_status (COMPLIANT, VIOLATION_RISK, VIOLATION)
  - created_at, updated_at
  - must_retain_until (calculated as created_at + 4 years for audit)

do_not_call_list
  - id (UUID)
  - phone_number (encrypted, indexed)
  - added_timestamp
  - added_reason (USER_OPT_OUT, FTC_DNC_LIST_SYNC, INTERNAL_POLICY)
  - expiry_date (null = permanent)
  - created_at
  - indexes: (phone_number) for real-time checking
```

**Knowledge Base**
```
kb_articles
  - id (UUID)
  - title (indexed)
  - slug (unique, for URLs)
  - category (ANALYSIS, COMPLIANCE, FORMULAS, MARKET_TRENDS)
  - content (markdown)
  - is_published (boolean)
  - view_count (for analytics)
  - created_by_user_id (FK, admin)
  - created_at, updated_at

kb_access_logs
  - id (UUID)
  - article_id (FK)
  - user_id (FK)
  - viewed_at
```

**Qualification Rules (Database-Driven Approach)**
```
qualification_rules
  - id (UUID)
  - user_id (FK, null = default system rules)
  - name (e.g., "Flip Formula", "Rental Calculator")
  - rule_type (FILTER, SCORE_COMPONENT, HARD_STOP)
  - field_name (e.g., "estimated_value", "distress_signal")
  - operator (GT, LT, EQ, IN, CONTAINS, RANGE)
  - value (JSON: flexible to hold single value, array, or range)
  - weight (for scoring: 0-100)
  - enabled (boolean)
  - description (user-facing explanation)
  - created_at, updated_at

rule_evaluation_logs
  - id (UUID)
  - deal_id (FK)
  - rule_id (FK)
  - evaluation_result (PASS, FAIL, SCORE_POINTS: integer)
  - evaluated_at
```

### Schema Design Principles Applied

**High Confidence - Verified Best Practices:**
- Separate audit/compliance tables from operational tables (contact_logs separate from properties).
- JSONB for flexibility (distress_signals, custom_fields, stage_history) while maintaining queryability.
- Immutable timestamps (created_at, changed_at in deal_history) for audit compliance.
- Encryption indicators (owner_phone_number marked as encrypted field).
- Soft deletes (deleted_at in users) for GDPR compliance.
- Indexes on (user_id, status) for common pipeline queries; GiST on geo fields for location-based searches.
- Foreign key constraints to maintain referential integrity.

**Data Retention Strategy:**
- Compliance logs: Keep for 4+ years per TCPA and FCC audit requirements.
- Deal history: Keep permanently (cheap to store; invaluable for audit).
- User data: Soft delete + retention period (180 days) before hard delete for GDPR "right to be forgotten."

**Sources:**
- [CRM Database Schema Best Practices](https://www.dragonflydb.io/databases/schema/crm)
- [PostgreSQL Audit Logging Design](https://oneuptime.com/blog/post/2026-01-21-postgresql-audit-logging/view)
- [PostgreSQL Documentation on Schemas](https://www.postgresql.org/docs/current/ddl-schemas.html)

---

## 3. TCPA Compliance & Logging Requirements

**Question:** What exactly must be logged? When/how to capture consent? What triggers violations?

### Violation Risks & Penalties

**Cost of Non-Compliance: HIGH RISK**
- Fine range: **$500–$1,500 per contact violation** (FCC enforcement).
- Damages are multiplied: A single campaign violating TCPA for 100 contacts = $50K–$150K in fines.
- Legal costs: Defense + settlements often exceed $100K.
- **Real estate is high-risk:** Wholesalers/agents make frequent calls; single mistake = compounding liability.

### What MUST Be Logged (Jan 2026 Standards)

**Before Any Contact (Outbound Call/SMS):**
1. ✓ Obtain **prior express written consent** (PEWC) or express written consent (EWC).
2. ✓ Document **what disclosures** were shown to consumer:
   - "You will receive marketing calls from [Company] at this number"
   - "You are agreeing to receive robocalls/robotexts"
   - "You can revoke consent at any time"
3. ✓ Capture **consumer's signature** (E-SIGN compliant; digital OK).

**Logging Requirements (Must Retain 4+ Years):**
```
Record Fields (in contact_logs & consent_records tables):

[MANDATORY]
- Phone number (encrypted)
- Contact timestamp (UTC, millisecond precision)
- Consent type (PRIOR_EXPRESS_WRITTEN, EXPRESS_WRITTEN, or NO_CONSENT)
- Consent capture method (WEB_FORM, EMAIL, SMS_REPLY, IN_PERSON, CALL_RECORDING)
- Consent timestamp (when consent was obtained)
- What disclosures were shown (JSON list of disclosure checkboxes)
- Person who captured consent (user ID for audit trail)
- Call/SMS initiation timestamp & person initiating
- Call recording URL (if applicable)

[CONDITIONAL - If Consumer Opts Out]
- Opt-out timestamp
- Opt-out method (consumer text/call/email opt-out request)
- System processed timestamp (MUST be within 10 business days per FCC Jan 2025 ruling)
- Proof of compliance (system log showing opt-out honored)

[FOR AUDIT]
- Original API response from PropStream/ATTOM (who owns property)
- Any edits to above records (with audit log timestamp)
```

### Recent FCC Rule Changes (Jan 2025 - Jan 2026)

**Critical Deadline Met: April 11, 2025**
- Consumer opt-out requests must be honored within **10 business days** (reduced from 30 days).
- System must auto-flag phone numbers after opt-out → prevent outbound contacts.
- **Implementation:** do_not_call_list table + check before any contact attempt.

**One-to-One Consent Rule Status:**
- FCC proposed one-to-one consent rule in Jan 2025 (would require specific written consent for each individual property contact).
- Court challenge vacated this rule in Feb 2025.
- FCC reinstated prior "express written consent" standard in Aug 2025.
- **Phase 1 Approach:** Build flexible logging that supports both rules (future-proof if law changes again).

### Implementation Checklist for Phase 1

**Week 1-2:**
- [ ] Build contact_logs table with encrypted phone fields.
- [ ] Build consent_records table with immutable timestamps.
- [ ] Implement consent form capture (user checks "I obtained written consent from [owner]").
- [ ] Create do_not_call_list with real-time lookup before contact attempt.

**Week 3-4:**
- [ ] Add opt-out handler (timestamp consumer revocation → update do_not_call_list & contact_logs).
- [ ] Implement 10-business-day processing timeline (auto-flag contacts if not honored within 10 days).
- [ ] Add audit trail endpoints (read-only compliance logs for admin review).

**Gotchas to Avoid:**
- ❌ **Never log phone numbers in plain text.** Encrypt using PostgreSQL pgcrypto or app-layer encryption.
- ❌ **Never auto-contact a property owner.** Require explicit user initiation + consent checkbox.
- ❌ **Don't assume consent carries over.** Each property/contact may need separate consent.
- ❌ **Don't ignore opt-outs.** If consumer says "stop," honor within 10 business days or face penalties.

### High-Confidence Sources
- [FCC Consent Rule Changes 2025-2026](https://www.tratta.io/blog/tcpa-consent-rule-changes)
- [TCPA Compliance for Contact Centers 2026](https://www.tcn.com/blog/tcpa-compliance-for-contact-centers/)
- [Real Estate TCPA Guide](https://www.luxurypresence.com/blogs/tcpa-compliance-lead-generation/)

---

## 4. Deal Qualification Rules Engine

**Question:** How to implement rule evaluation? Rules-in-code or rules-in-database?

### Recommendation: Hybrid Approach (Database-Driven with Code Execution)

**Why Hybrid > Pure Code:**
- Pure code (hardcoded rules): Requires redeploy for every rule change. Slow.
- Pure database (rule DSL): Requires building a full rule language parser. Overkill for Phase 1.
- **Hybrid:** Store rules in DB (fast iteration), execute in code (type-safe, testable).

**Architecture:**
```
┌─────────────────────────────────────────────────────────────┐
│ PropStream/ATTOM Property Data                              │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
        ┌──────────────────────────────────┐
        │ Fetch Rules from DB              │
        │ qualification_rules table        │
        └──────────────────────┬───────────┘
                               │
                               ▼
        ┌──────────────────────────────────┐
        │ Execute Rules Engine in Code     │
        │ (TypeScript service layer)       │
        │ - Hard stops (FILTER)            │
        │ - Scoring (SCORE_COMPONENT)      │
        └──────────────────────┬───────────┘
                               │
                               ▼
        ┌──────────────────────────────────┐
        │ Result: qualification_score      │
        │ (0-100) + deal.status            │
        │ (QUALIFIED, REJECTED, etc.)      │
        └──────────────────────────────────┘
```

### Rule Types (Configurable in Phase 1)

**1. FILTER Rules (Hard Stops)**
```
Rule: "Reject if estimated_value < $50,000"
- Operator: LT
- Field: estimated_value
- Value: 50000
- Result: REJECTED status
```

**2. SCORING Rules (Weight-Based)**
```
Rule: "Award 20 points if distress_signal contains 'foreclosure'"
- Field: distress_signals
- Operator: CONTAINS
- Value: "foreclosure"
- Weight: 20
- Result: +20 to qualification_score
```

**3. SOFT WARNINGS (Future Phase 2)**
```
Rule: "Warn if data is >14 days old"
- Condition: data_freshness_date < (NOW - 14 days)
- Result: Flag in UI, don't auto-reject
```

### Implementation (TypeScript Service)

**Pseudocode for Phase 1:**
```typescript
// services/dealQualificationService.ts

type RuleType = 'FILTER' | 'SCORE_COMPONENT';
type Operator = 'GT' | 'LT' | 'EQ' | 'IN' | 'CONTAINS' | 'RANGE';

interface QualificationRule {
  id: string;
  fieldName: string;      // e.g., 'estimated_value', 'distress_signals'
  operator: Operator;
  value: any;             // Flexible: number, array, string
  weight: number;         // For SCORE_COMPONENT rules
  ruleType: RuleType;
}

async function evaluateDeal(
  property: Property,
  userRules: QualificationRule[]
): Promise<{
  qualificationScore: number;
  status: 'QUALIFIED' | 'REJECTED' | 'ANALYZING';
  ruleEvaluations: Record<string, boolean>;
}> {
  let score = 0;
  const evaluations: Record<string, boolean> = {};

  for (const rule of userRules.filter(r => r.enabled)) {
    const fieldValue = _.get(property, rule.fieldName);
    const pass = evaluateExpression(fieldValue, rule.operator, rule.value);
    evaluations[rule.id] = pass;

    if (rule.ruleType === 'FILTER' && !pass) {
      return { qualificationScore: 0, status: 'REJECTED', ruleEvaluations: evaluations };
    }

    if (rule.ruleType === 'SCORE_COMPONENT' && pass) {
      score += rule.weight;
    }
  }

  const status = score >= 50 ? 'QUALIFIED' : 'ANALYZING'; // Threshold: 50/100
  return { qualificationScore: score, status, ruleEvaluations: evaluations };
}
```

### Wholesale Deal Formula (70% Rule + MAO)

**Built-in Scoring Component:**
```
Maximum Allowable Offer (MAO) = (After Repair Value × 0.70) − Repair Costs
- ARV = what property sells for after full renovation
- Example: ARV $200K, repairs $50K
  MAO = ($200K × 0.70) − $50K = $90K

Scoring: Award points if property_list_price < MAO
- Encourages investors to target profitable deals
```

**Configure in qualification_rules:**
```
Rule 1: FILTER - If estimated_value > ARV, REJECT
Rule 2: FILTER - If (estimated_value * 1.3) > (MAO + repair estimate), REJECT
Rule 3: SCORE - If estimated_value < MAO, +25 points
Rule 4: SCORE - If distress_signal = 'foreclosure', +15 points
Rule 5: SCORE - If owner_occupied = false, +10 points (easier negotiation)

Result: Auto-qualify deals scoring 50+ points
```

### User Customization (Phase 1 MVP)

**Minimal UI for rules:**
- [ ] Simple form: "Reject if [field] [operator] [value]"
- [ ] Pre-built rule templates (70% Rule, 80% Rule, Rental ROI Calculator)
- [ ] Scoring dashboard showing which rules are triggering on each deal
- [ ] No rule conflict detection yet (Phase 2 enhancement)

### Sources
- [Rules Engine Design Patterns 2026](https://www.nected.ai/blog/rules-engine-design-pattern)
- [Real Estate Wholesale Deal Analysis](https://www.biggerpockets.com/blog/real-estate-investing-rules-of-thumb)
- [Deal Qualification Scoring Models](https://salesgrowth.com/deal-scoring-framework/)

---

## 5. CRM Pipeline Architecture

**Question:** How to structure deal state machine? What transitions are valid?

### State Machine Design

**Valid Deal States (with allowed transitions):**
```
SOURCED (initial)
  ├→ ANALYZING (user clicked "Analyze")
  │   ├→ QUALIFIED (rules passed OR manual override)
  │   │   ├→ REJECTED (user or rules reject)
  │   │   └→ UNDER_CONTRACT (deal accepted)
  │   │       ├→ CLOSED (deal completed)
  │   │       └→ REJECTED (deal fell through)
  │   └→ REJECTED (rules auto-reject)
  └→ REJECTED (user skipped)

Terminal States: CLOSED, REJECTED
Re-openable: ANALYZING, UNDER_CONTRACT (for rework)
```

**State Transition Rules:**
- Cannot skip ANALYZING → go to QUALIFIED without evaluation.
- Can manually override auto-rejection (audit log required).
- Once CLOSED, cannot return to ANALYZING (create new deal instead).

### Implementation: TypeScript State Machine

**Using finite-state-machine patterns:**
```typescript
// types/dealStates.ts
type DealState = 'SOURCED' | 'ANALYZING' | 'QUALIFIED' | 'REJECTED' | 'UNDER_CONTRACT' | 'CLOSED';

interface DealTransition {
  from: DealState;
  to: DealState;
  requiredData?: string[];  // e.g., ['estimatedProfit'] for UNDER_CONTRACT
  allowedBy?: string[];     // Roles allowed to make transition (AGENT, ADMIN)
}

const validTransitions: DealTransition[] = [
  { from: 'SOURCED', to: 'ANALYZING', allowedBy: ['AGENT', 'ADMIN'] },
  { from: 'ANALYZING', to: 'QUALIFIED', requiredData: ['qualificationScore'] },
  { from: 'ANALYZING', to: 'REJECTED', allowedBy: ['AGENT', 'ADMIN'] },
  { from: 'QUALIFIED', to: 'UNDER_CONTRACT', requiredData: ['estimatedProfit'] },
  { from: 'UNDER_CONTRACT', to: 'CLOSED', requiredData: ['closedDate'] },
  { from: 'UNDER_CONTRACT', to: 'REJECTED' },
];

// services/dealStateService.ts
async function transitionDeal(
  deal: Deal,
  targetState: DealState,
  userId: string,
  transitionData?: Record<string, any>
): Promise<Deal | ValidationError> {
  const user = await getUser(userId);
  const transition = validTransitions.find(
    t => t.from === deal.status && t.to === targetState
  );

  if (!transition) {
    throw new Error(`Invalid transition: ${deal.status} → ${targetState}`);
  }

  if (transition.allowedBy && !transition.allowedBy.includes(user.role)) {
    throw new Error(`Role ${user.role} cannot perform this transition`);
  }

  if (transition.requiredData) {
    const missing = transition.requiredData.filter(f => !transitionData?.[f]);
    if (missing.length > 0) {
      throw new Error(`Missing required data: ${missing.join(', ')}`);
    }
  }

  // Log state change
  await logDealHistory(deal.id, userId, {
    field: 'status',
    oldValue: deal.status,
    newValue: targetState,
    ...transitionData,
  });

  return await updateDeal(deal.id, { status: targetState, ...transitionData });
}
```

### CRM Pipeline Visualization (UI)

**Kanban-style columns:**
```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  ANALYZING   │  │ QUALIFIED    │  │UNDER_CONTRACT│  │   CLOSED     │
│   (15 deals) │  │  (8 deals)   │  │  (3 deals)   │  │  (22 deals)  │
├──────────────┤  ├──────────────┤  ├──────────────┤  ├──────────────┤
│ Deal A       │  │ Deal X       │  │ Deal M       │  │ Deal Alpha   │
│ (ARV $150K)  │  │ (Score 78)   │  │ (Est. profit │  │ (Closed      │
│              │  │              │  │  $30K)       │  │  $28K)       │
│ Deal B       │  │ Deal Y       │  │              │  │ Deal Beta    │
│ (Score 45)   │  │ (Score 82)   │  │              │  │ (Closed      │
│              │  │              │  │              │  │  $15K)       │
├──────────────┤  └──────────────┘  └──────────────┘  ├──────────────┤
│ (Drag to     │                                        │ [Filters]    │
│  move stage) │                                        │ Show only    │
└──────────────┘                                        │ closed 2026  │
                                                        └──────────────┘
```

**Pipeline health metrics:**
- Average time in ANALYZING: _X days_ (warning if > 30 days).
- Qualification rate: _(QUALIFIED / ANALYZING)%_ (target: 40-60%).
- Velocity: _Deals moved to CLOSED per week_.

### Stage-Triggered Automation (Phase 1 MVP)

**Minimal automation for MVP:**
- [ ] When deal → QUALIFIED: Create a task for user ("Follow up with agent").
- [ ] When deal → UNDER_CONTRACT: Log compliance record (consent captured).
- [ ] When deal → CLOSED: Update owner's deal count (for analytics).

**Defer to Phase 2:**
- Auto-SMS notifications
- Slack integration
- Calendar blocking
- Third-party CRM sync

### Sources
- [State Machine Pattern in TypeScript](https://medium.com/@floyd.may/building-a-typescript-state-machine-cc9e55995fa8)
- [CRM Pipeline Design Best Practices](https://respacio.com/real-estate-software/contact-management/guide-to-real-estate-pipeline-stages/)

---

## 6. Authentication Architecture

**Question:** Should we use Clerk (managed) or build custom? Known gotchas?

### Recommendation: Clerk for Phase 1 (Revisit at 10K+ MAU)

**Why Clerk:**
- **Fastest to market:** Pre-built React components, integration < 1 day.
- **Pricing:** Free for first 10K MAU; scales linearly at $0.02/user beyond.
- **Real estate SaaS alignment:** Built-in multi-tenancy, organization roles, fine-grained permissions.
- **Compliance:** SSO-ready (SAML support for enterprise Phase 3).
- **No maintenance:** Clerk handles password resets, MFA, security patches.

**Why NOT build custom:**
- Custom auth = security liability (password hashing, token refresh, CSRF protection).
- Hidden cost: 3-4 weeks of development + ongoing maintenance.
- Real estate has compliance audits; Clerk's audit trail is production-ready.

### Clerk Implementation (Phase 1)

**Setup:**
```typescript
// app.ts (Express)
import { clerkMiddleware, requireAuth } from '@clerk/express';

app.use(clerkMiddleware());

// All routes after this require authentication
app.use(requireAuth());

// Attach user context to request
app.use((req, res, next) => {
  req.user = {
    id: req.auth.userId,
    email: req.auth.sessionClaims.email,
    role: req.auth.sessionClaims.role || 'AGENT', // Custom claim
  };
  next();
});
```

**Database integration:**
```typescript
// Link Clerk user to DB user on first login
async function syncClerkUser(clerkUserId: string) {
  const user = await prisma.user.upsert({
    where: { clerk_user_id: clerkUserId },
    update: {},
    create: {
      clerk_user_id: clerkUserId,
      email: clerkEmail,
      subscription_tier: 'FREE',
      role: 'AGENT',
    },
  });
  return user;
}
```

**Next.js frontend:**
```typescript
// app/layout.tsx
import { ClerkProvider } from '@clerk/nextjs';

export default function RootLayout({ children }) {
  return (
    <ClerkProvider>
      {children}
    </ClerkProvider>
  );
}

// app/dashboard/page.tsx
import { useUser } from '@clerk/nextjs';

export default function Dashboard() {
  const { user, isLoaded } = useUser();
  if (!isLoaded) return <Spinner />;
  if (!user) return <redirect to="/sign-in" />;

  return <div>Welcome, {user.firstName}</div>;
}
```

### Gotchas to Avoid

**❌ Gotcha 1: Customization Limits**
- Clerk provides sleek pre-built components but limited flow customization.
- Can't inject custom logic into password reset flow (Phase 2 concern: MFA requirements).
- **Mitigation:** Use Clerk's default flows for MVP; if custom flows needed later, plan Auth0 migration.

**❌ Gotcha 2: Org/Roles Setup (Important for Real Estate Teams)**
- Clerk supports organizations, but setup is non-obvious.
- Must configure org invites + role assignments in Clerk dashboard.
- **Mitigation:** Document org setup; test invite flow with real user before Phase 1 launch.

**❌ Gotcha 3: Token Expiration & Refresh**
- Clerk tokens expire after ~10 minutes; must refresh via Clerk's token endpoint.
- Express middleware handles this automatically, but custom API calls need manual refresh.
- **Mitigation:** Wrap API calls in middleware that auto-refreshes on 401.

**❌ Gotcha 4: Phone Number for TCPA Logging**
- Clerk doesn't store phone numbers by default (focused on email/SSO).
- Must create separate phone_number field in user table for TCPA contact attempts.
- **Mitigation:** Add optional phone_number to user profile; keep separate from Clerk.

### When to Revisit This Decision (Phase 2+)

**Switch to Auth0/FusionAuth if:**
- User count > 10K MAU (Clerk becomes expensive vs. flat-rate Auth0 plan).
- Enterprise clients demand SAML 2.0 SSO + custom user provisioning.
- Compliance requires on-premise or specific data residency (CCPA/state laws).

### High Confidence Sources
- [Clerk vs Auth0 2026 Comparison](https://leonstaff.com/blogs/clerk-vs-auth0-identity-crisis/)
- [Clerk Documentation](https://clerk.com/)
- [Clerk Next.js Integration](https://www.contentful.com/blog/clerk-authentication/)

---

## 7. Tech Stack Validation

**Question:** Confirm PostgreSQL schema design, Prisma ORM, Next.js + Express separation?

### Validation Summary

| Component | Recommendation | Confidence | Notes |
|-----------|---|---|---|
| **Database** | PostgreSQL 15+ | HIGH | Supports JSONB (for flexible custom_fields, distress_signals), UUID, encryption, audit triggers. Scale to 1M+ properties/deals. |
| **ORM** | Prisma 5.x | HIGH | Type-safe, excellent PostgreSQL support, migrations automated, relationship queries clean. Better than raw SQL for this codebase. |
| **Backend** | Express.js 4.x + TypeScript | HIGH | Lightweight, mature, perfect for real estate API (contacts, compliance, rules engine). |
| **Frontend** | Next.js 15+ (App Router) | MEDIUM | Server components reduce bundle; API routes can stay as thin wrappers calling Express. Clerk integration smooth. |
| **Auth** | Clerk | MEDIUM | Fast to market; revisit at 10K+ MAU. |

### Why This Stack for Phase 1

**PostgreSQL + Prisma:**
- ✓ JSONB fields = flexible custom rules + property attributes without schema bloat.
- ✓ Native UUID support = better than auto-increment for distributed systems.
- ✓ Triggers + audit tables = TCPA compliance logging built-in.
- ✓ Row-level security = future-proofing for multi-tenant Phase 3.

**Express.js (Separate Backend):**
- ✓ Handles background jobs (push TCPA logging, nightly PropStream sync).
- ✓ API rate-limiting on compliance endpoints (prevent accidental mass-contact attempts).
- ✓ Scales independently from Next.js (UI can scale separately).
- ✓ Allows future mobile app (iOS/Android SDK calls Express directly).

**Next.js Frontend:**
- ✓ Server-side rendering improves SEO (marketing pages: "How to Analyze Deals").
- ✓ API middleware can be thin layer (calls Express backend).
- ✓ Next.js 15+ App Router = modern, async components.
- ✓ Built-in image optimization (property photos from PropStream).

### Architecture Diagram (Phase 1)

```
┌─────────────────────────────────────────────────────────┐
│                    Client (Browser)                      │
│         Next.js App (next/pages, next/components)        │
└────────────────┬────────────────────────────────────────┘
                 │ HTTP/WebSocket
                 ▼
        ┌────────────────────┐
        │  Next.js API Layer │ (thin routing)
        │  /api/deals/*      │
        │  /api/compliance/* │
        └────────┬───────────┘
                 │ Internal calls
                 ▼
    ┌────────────────────────────────────┐
    │      Express.js Backend Server     │
    │     (Separate Node.js process)     │
    ├────────────────────────────────────┤
    │ Routes:                            │
    │  POST /deals/analyze (rules engine)│
    │  POST /contacts (TCPA logging)     │
    │  GET /contacts/compliance          │
    │  POST /integrations/propstream     │
    │  GET /kb/articles                  │
    ├────────────────────────────────────┤
    │ Middleware:                        │
    │  - Clerk auth verification        │
    │  - Rate limiting                  │
    │  - Compliance logging             │
    └────────┬───────────────────────────┘
             │
    ┌────────▼───────────────────────────┐
    │    PostgreSQL 15 + Prisma ORM      │
    │                                    │
    │  - Properties (PropStream feed)    │
    │  - Deals (CRM)                    │
    │  - Contact logs (TCPA)            │
    │  - Qualification rules            │
    │  - Knowledge base                 │
    └────────────────────────────────────┘
             │
    ┌────────▼───────────────────────────┐
    │   External Services                │
    │   - PropStream/ATTOM API           │
    │   - Clerk Auth                     │
    │   - Optional: Stripe (billing)     │
    └────────────────────────────────────┘
```

### Prisma Schema Validation (Best Practices)

**High Confidence Confirmations:**
- ✓ Use PascalCase for model names (singular): User, Deal, Property.
- ✓ camelCase for fields: qualificationScore, dataFreshness.
- ✓ Define both sides of relations (1:many, many:many).
- ✓ Index on foreign keys + frequently queried fields (user_id, status, phone).
- ✓ Use Enums for fixed values (DealStatus, ContactMethod) → type-safe in code.
- ✓ Use JSONB for flexible attributes (custom_fields, distress_signals) → avoid over-normalizing.

**Example Prisma schema excerpt:**
```typescript
// schema.prisma
model Deal {
  id                String        @id @default(uuid())
  propertyId        String
  property          Property      @relation(fields: [propertyId], references: [id])
  userId            String
  user              User          @relation(fields: [userId], references: [id])
  status            DealStatus    @default(SOURCED)
  qualificationScore Int          @default(0)
  customFields      Json?         // Flexible user-defined fields
  estimatedProfit   Decimal?
  createdAt         DateTime      @default(now())
  updatedAt         DateTime      @updatedAt

  @@index([userId, status]) // Common query pattern
  @@index([propertyId])
  @@unique([id, userId]) // Ensure user owns deal
}

enum DealStatus {
  SOURCED
  ANALYZING
  QUALIFIED
  REJECTED
  UNDER_CONTRACT
  CLOSED
}

model ContactLog {
  id                  String        @id @default(uuid())
  propertyId          String
  property            Property      @relation(fields: [propertyId], references: [id])
  ownerPhoneEncrypted String        // Never plain text
  contactTimestamp    DateTime      @db.Timestamp(3) // Millisecond precision
  consentStatus       ConsentStatus
  consentTimestamp    DateTime?
  contactMethod       ContactMethod
  initiatedByUserId   String
  createdAt           DateTime      @default(now())

  @@index([ownerPhoneEncrypted]) // For DNC list checks
  @@index([contactTimestamp]) // For audit range queries
}

enum ConsentStatus {
  NO_CONSENT_OBTAINED
  EXPRESS_WRITTEN_CONSENT
  PRIOR_EXPRESS_CONSENT
  DO_NOT_CALL
}
```

### N+1 Query Prevention (Prisma)

**Problem:** Fetching 100 deals, then 1 query per deal to get property data = 101 queries.

**Solution:** Use Prisma's include/select:
```typescript
// BAD (N+1)
const deals = await prisma.deal.findMany({ where: { userId } });
const dealsWithProperties = await Promise.all(
  deals.map(d => prisma.property.findUnique({ where: { id: d.propertyId } }))
);

// GOOD (single query with JOIN)
const deals = await prisma.deal.findMany({
  where: { userId },
  include: { property: true }, // Automatically JOIN
});
```

### Sources
- [Prisma Best Practices 2026](https://www.prisma.io/docs/orm/more/best-practices)
- [Next.js Architecture Best Practices](https://www.raftlabs.com/blog/building-with-next-js-best-practices-and-benefits-for-performance-first-teams/)
- [Express.js Architecture Guide](https://treblle.com/blog/egergr)
- [Prisma Data Modeling](https://www.prisma.io/docs/orm/overview/introduction/data-modeling)

---

## 8. Critical Path & Implementation Sequence

**Question:** What must be done first? Deal sourcing → qualification → storage, then UI?

### Phase 1 Critical Path (Dependency Map)

```
WEEK 1-2: Foundation (Parallel work)
├─ Auth Setup (Clerk)
│  └─ Clerk dashboard config
│  └─ Next.js + Express Clerk middleware
│
├─ Database Design + Migrations (Prisma)
│  └─ Schema: users, properties, deals, contact_logs, consent_records
│  └─ Run migrations against dev/test databases
│  └─ Seed: Default qualification rules, test properties
│
└─ PropStream Integration (Series)
   └─ Contact PropStream partnership team (Week 0-1)
   └─ Receive API docs + sandbox credentials
   └─ Implement abstraction layer for data fetching

WEEK 3: Backend API Core (Express)
├─ Property sourcing endpoint: POST /api/properties/sync
│  └─ Calls PropStream API, inserts into DB
│  └─ Handles deduplication (external_id)
│
├─ Rules engine: POST /api/deals/analyze
│  └─ Pulls qualification_rules from DB
│  └─ Evaluates against property data
│  └─ Returns qualificationScore + status
│
└─ Deal CRUD: POST/GET /api/deals
   └─ Create deal from property
   └─ Transition deal status (SOURCED → ANALYZING → QUALIFIED)

WEEK 4: Compliance Foundations (Express + DB)
├─ Contact logging: POST /api/contacts/log
│  └─ Logs contact attempt (call/SMS/email)
│  └─ Checks do_not_call_list
│  └─ Records consent status
│
├─ Consent capture: POST /api/contacts/consent
│  └─ Records when user obtained written consent
│  └─ Stores disclosure details (JSONB)
│  └─ Immutable timestamps for audit
│
└─ Opt-out handling: POST /api/contacts/opt-out
   └─ Honors consumer revocation
   └─ Updates do_not_call_list
   └─ Flags for compliance review if not processed within 10 biz days

WEEK 5-6: Frontend (Next.js)
├─ Dashboard: GET /dashboard
│  └─ User sign-in (Clerk)
│  └─ Welcome screen + quick stats
│
├─ Deal sourcing: POST /dashboard/import
│  └─ Form to trigger property sync from PropStream
│  └─ Shows: "Importing... 1,250 properties found"
│
├─ Pipeline view: GET /dashboard/pipeline
│  └─ Kanban board: SOURCED → ANALYZING → QUALIFIED → UNDER_CONTRACT → CLOSED
│  └─ Drag-drop to change status
│
├─ Deal detail: GET /dashboard/deals/[id]
│  └─ Property info (address, value, distress signals)
│  └─ Qualification breakdown (which rules passed/failed)
│  └─ Estimated profit
│  └─ Contact log (who contacted, when, consent status)
│
└─ Compliance log: GET /dashboard/compliance
   └─ Read-only audit trail of all contacts
   └─ Filter by date, compliance status

WEEK 7: Testing + Deployment Prep
├─ Unit tests: Rules engine, state transitions, compliance logging
├─ Integration tests: PropStream → DB → Rules → Deal creation
├─ E2E tests: User signs in → imports deals → analyzes one → moves to qualified
└─ Load testing: Can system handle 10K property import + rule evaluation?

WEEK 8: Launch MVP
└─ Deploy Express backend to production (railway.app or similar)
└─ Deploy Next.js frontend (Vercel)
└─ Smoke tests in production
└─ Launch to internal testers
```

### Must-Have vs. Nice-to-Have (Phase 1 MVP)

**MUST HAVE (Week 1-7):**
- ✓ Clerk authentication (no custom auth).
- ✓ PostgreSQL + Prisma schema (all core tables).
- ✓ PropStream data integration (or fallback to ATTOM).
- ✓ Deal qualification rules engine (database-driven).
- ✓ CRM pipeline with state machine (SOURCED → CLOSED).
- ✓ TCPA logging foundation (contact_logs, consent_records tables + endpoints).
- ✓ Deal analysis UI (property details + profit calculation).
- ✓ Compliance audit log (read-only for admins).
- ✓ Knowledge base integration (static articles for now).

**NICE-TO-HAVE (Phase 2+):**
- ❌ Advanced rule builder UI (drag-drop rule creation).
- ❌ Auto-SMS notifications when deal qualifies.
- ❌ Slack integration for pipeline alerts.
- ❌ Third-party CRM sync (HubSpot, Salesforce).
- ❌ Advanced foreclosure prediction (ML model).
- ❌ Mobile app (iOS/Android).
- ❌ Multi-user collaboration (only single-user per account in Phase 1).

### Risk Mitigation: Why This Order?

**Why Clerk before custom auth?**
- Reduces week 1-2 scope; prevents 2-week auth rabbit hole.
- Keeps team focused on domain logic (properties, rules, compliance).

**Why schema before code?**
- Gets TCPA compliance table design right first; retrofitting later = pain.
- Ensures API routes can query efficiently (no N+1 issues).

**Why rules engine before UI?**
- Core business logic (deal qualification) must be solid.
- UI layer just displays results; can iterate quickly once backend works.

**Why compliance logging in week 4?**
- Can't skip or defer; legal risk too high.
- But can do MVP version (basic logging) in Phase 1, advanced audit features in Phase 2.

**Why PropStream partnership upfront?**
- If API approval stalls, have ATTOM fallback ready to implement.
- 2-week buffer built in; reduces last-minute surprises.

### Metrics to Track (Phase 1 Success)

```
Week 1:
- [ ] Clerk integrated + user sign-up working
- [ ] Database schema migrated to dev/test
- [ ] PropStream partnership contact made

Week 3:
- [ ] 100 test properties imported into DB
- [ ] Rules engine passing unit tests
- [ ] Deal CRUD endpoints returning correct JSON

Week 4:
- [ ] contact_logs table has >10 test records
- [ ] consent_records table validates opt-out within 10 days

Week 6:
- [ ] 3+ users can sign in + see dashboard
- [ ] User can manually import deals + see qualification score
- [ ] Kanban board drag-drop working

Week 8:
- [ ] E2E test: Sign in → Import → Analyze → Qualify → Close in production
- [ ] Admin can view compliance log (no PII exposed)
- [ ] 0 crashes in first week of beta
```

---

## Summary: Risks & Open Questions

### Highest-Risk Items (Must Resolve Before Week 2)

1. **PropStream API Access**
   - Risk: Partnership could take 4-6 weeks; delay deal sourcing feature.
   - Mitigation: Contact partner team immediately (Week 0); have ATTOM fallback ready.
   - **Owner: Product (contact PropStream)**

2. **TCPA Regulatory Changes**
   - Risk: FCC rules are still evolving (Jan 2025 - Jan 2026).
   - Mitigation: Build flexible logging (supports both old + new rules); refresh in Phase 2 if law changes.
   - **Owner: Compliance (legal review)**

3. **Consent Capture UX**
   - Risk: Users might skip consent checkbox; create liability.
   - Mitigation: Make checkbox mandatory + confirm before contact attempt; log failure for audit.
   - **Owner: UX (Phase 1 design)**

### Questions Needing Validation Before/During Phase 1

- [ ] **PropStream API contract:** What fields are returned? Rate limits? Pagination? Response time?
  - **Action:** Get sandbox API key week 0; document fields by week 1.

- [ ] **ATTOM Data API fallback:** Should we negotiate ATTOM partnership as backup?
  - **Action:** Request ATTOM dev account (free tier available); test integration by week 2.

- [ ] **Clerk organization setup:** How to structure teams/organizations for real estate brokerages?
  - **Action:** Test with 2+ test users in same org; document invite flow by week 1.

- [ ] **Phone number encryption:** Which PostgreSQL encryption method (pgcrypto vs. app-layer)?
  - **Action:** Security review in week 1; implement by week 2.

- [ ] **Qualification rule customization scope:** Can users create custom rules in Phase 1, or just use defaults?
  - **Action:** MVP approach: Defaults only; Phase 2 adds rule builder UI.

- [ ] **Data freshness handling:** How often to re-sync PropStream data? Nightly? Weekly?
  - **Action:** Design nightly batch job (Express background task) + show "last updated" timestamp.

---

## Confidence Assessment

| Area | Level | Reason |
|------|-------|--------|
| **PropStream Integration** | MEDIUM | API exists but requires partner agreement; not publicly documented. Fallback (ATTOM) confirmed available. |
| **Database Schema** | HIGH | PostgreSQL JSONB + Prisma patterns well-established; TCPA logging table design verified against compliance sources. |
| **TCPA Compliance** | MEDIUM-HIGH | Core requirements clear (consent logging, opt-out within 10 biz days, 4-year retention); FCC rules still evolving but architecture handles changes. |
| **Rules Engine** | HIGH | Hybrid (DB + code) approach standard; deal qualification formulas (70% rule) validated in wholesaling. |
| **CRM Pipeline** | HIGH | State machine patterns proven in TypeScript; transitions design straightforward. |
| **Authentication** | HIGH | Clerk validated as fastest path; switching cost low if needed at scale. |
| **Tech Stack** | HIGH | PostgreSQL + Prisma + Express + Next.js is standard modern SaaS stack. |
| **Critical Path** | MEDIUM | Sequence logical, but PropStream partnership timing could slip; 2-week buffer helps. |

---

## Sources

### PropStream & Real Estate Data APIs
- [PropStream Partnership Program](https://www.propstream.com/partner-with-us)
- [PropStream + Tuesday App Partnership](https://www.rismedia.com/2026/02/04/propstream-partners-tuesday-app-streamline-mls-discovery-lead-generation/)
- [Real Estate APIs Comparison 2026](https://www.housecanary.com/blog/real-estate-api)
- [Top Real Estate APIs 2025](https://www.attomdata.com/news/attom-insights/best-apis-real-estate/)

### TCPA Compliance & Logging
- [TCPA Consent Rule Changes 2025-2026](https://www.tratta.io/blog/tcpa-consent-rule-changes)
- [TCPA Compliance for Contact Centers 2026](https://www.tcn.com/blog/tcpa-compliance-for-contact-centers/)
- [Real Estate TCPA Compliance Guide](https://www.luxurypresence.com/blogs/tcpa-compliance-lead-generation/)
- [FCC TCPA Consent Rules](https://docs.fcc.gov/public/attachments/DA-25-312A1.pdf)
- [TCPA One-to-One Consent Rule 2025](https://perkinscoie.com/insights/update/tcpa-one-one-consent-rules-go-effect-january-2025)

### Database & ORM
- [CRM Database Schema Design](https://www.dragonflydb.io/databases/schema/crm)
- [PostgreSQL Audit Logging 2026](https://oneuptime.com/blog/post/2026-01-21-postgresql-audit-logging/view)
- [Prisma Best Practices](https://www.prisma.io/docs/orm/more/best-practices)
- [Prisma Data Modeling](https://www.prisma.io/docs/orm/overview/introduction/data-modeling)

### Rules Engine & Deal Analysis
- [Rules Engine Design Patterns 2026](https://www.nected.ai/blog/rules-engine-design-pattern)
- [Real Estate Wholesale Deal Analysis](https://www.biggerpockets.com/blog/real-estate-investing-rules-of-thumb)
- [Deal Qualification Scoring Models](https://salesgrowth.com/deal-scoring-framework/)

### CRM & State Machine Patterns
- [State Machine Pattern in TypeScript](https://medium.com/@floyd.may/building-a-typescript-state-machine-cc9e55995fa8)
- [CRM Pipeline Design](https://respacio.com/real-estate-software/contact-management/guide-to-real-estate-pipeline-stages/)

### Authentication
- [Clerk vs Auth0 2026](https://leonstaff.com/blogs/clerk-vs-auth0-identity-crisis/)
- [Clerk Documentation](https://clerk.com/)
- [Clerk Next.js Integration](https://www.contentful.com/blog/clerk-authentication/)

### Architecture & Best Practices
- [Next.js Architecture Best Practices 2026](https://www.raftlabs.com/blog/building-with-next-js-best-practices-and-benefits-for-performance-first-teams/)
- [Express.js Architecture Guide](https://treblle.com/blog/egergr)
- [Next.js + Express.js Separation Best Practices](https://github.com/vercel/next.js/discussions/72473)

---

## Next Steps

This research file is **complete** for Phase 1 planning. The following should be done BEFORE development:

1. **PropStream Partnership** (Week 0): Contact partnership team; negotiate API access + rate limits.
2. **Compliance Legal Review** (Week 1): Validate TCPA consent form wording + opt-out flow.
3. **Clerk Setup** (Week 1): Create Clerk dashboard; test org/role features.
4. **Database Review** (Week 1): Have DBA/architect review schema for performance + audit requirements.
5. **Design Review** (Week 1): UX reviews deal qualification UI + consent capture flow.

**Phase 1 is go/no-go on PropStream access.** If partnership is declined, pivot immediately to ATTOM Data API (already validated as working alternative).
