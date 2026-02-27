# Phase 1: Core Deal Sourcing & CRM - Context

**Gathered:** 2026-02-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Enable users to connect to deal data sources (PropStream), source and qualify deals automatically based on investor criteria, organize them in a visual CRM pipeline (Kanban + table), and maintain full TCPA compliance from day one with comprehensive audit logging.

New capabilities (offer generation, automated follow-ups, creative finance scoring) belong in Phase 2.

</domain>

<decisions>
## Implementation Decisions

### PropStream Integration

- **Import method:** CSV upload (manual) for Phase 1 MVP. User downloads from PropStream, uploads to platform.
- **Refresh strategy:** Daily automated refresh. System prompts user to import updated CSV daily or on-demand.
- **Data staleness handling:** Show "as of [date]" on every deal + warning banner for deals >7 days old. Users understand data may be 7-30 days behind market reality.
- **Data scope:** Capture ALL raw data PropStream provides. Store as-is in database for future analysis and creativity.
- **Contact enrichment:** Automatic full enrichment. Skip-trace to find missing phone/email upfront.
  - Budget-conscious approach (cost is a factor).
  - Skip-trace provider: Claude will research and recommend (Batch, RealtyMole, others).
  - Error handling: Auto-fallback — import deals with partial enrichment, queue failures for manual review.
- **Duplicate handling:** Smart merge. Detect duplicates by address + owner name, merge or ask user which to keep.

### Deal Qualification Rules

- **User involvement:** No custom rule builder UI. Qualification is automated based on pre-defined criteria.
- **Criteria:** Equity percentage, debt amount, time on market, property condition/repairs — all required in Phase 1.
- **Filtering strictness:** Strict — show only deals that pass ALL criteria. Non-matching deals are filtered out automatically.
- **Threshold visibility:** Visible and adjustable. Dashboard shows criteria (e.g., "Deals qualified by: equity > 30%, debt < $200k, listed 60-90 days"). Users can tweak thresholds.
- **Offer price calculation:** Calculate MAO (Maximum Allowable Offer) using simple 70% rule on import.
  - Formula: (ARV × 0.70) - estimated repairs
  - No geographic customization in Phase 1. Phase 2 adds state-specific tax/cost adjustments.

### CRM Pipeline Visualization

- **View options:** Both Kanban board (drag-drop cards) AND table/list view. Users toggle between preferred view.
- **Pipeline stages:** Customizable. Users can rename default stages (Sourced → Contacted → Pending → Closed) or add custom ones.
- **Visible info per deal:** Address, owner name, MAO, equity %, time on market, days in current stage.
- **Stage change tracking:** Full audit trail. Log timestamp when deal moves stages. Display "Sourced on Jan 15, Contacted Jan 18, ...".
- **Bulk operations:** Bulk move deals between stages with confirmation dialog. Prevents accidental moves of multiple deals.
- **Deal detail interaction:** Click deal card → slide-out side panel on right. Full details visible, pipeline stays in view. Easy to close and return.
- **Dashboard metrics:** Show key metrics above pipeline: # deals per stage, total potential (sum of all MAO), conversion rate.
- **Notes & history:** Users can add free-form notes on deals. System auto-logs actions (stage change, offer sent, enrichment completed). Combined timeline of user notes + system events.
- **Search & filter:** Both quick search (by address/owner) AND advanced filters (equity, debt, stage, time on market). Users can build complex queries.
- **Export/reporting:** Not in Phase 1. CSV export can be added in Phase 2 if needed.

### Compliance & Consent Capture

- **Consent timing:** On-demand. Consent not required at import. Captured before sending (Phase 2) or manually by user anytime.
- **Consent documentation:** Simple checkbox — "I have express written consent for this contact." Lightweight but requires user responsibility.
- **Warning on send without consent:** Soft warning. Yellow banner: "No consent documented. Proceed at your own risk." User can click through (emphasizes user responsibility for TCPA).
- **Contact logging (for audit):** Full detailed logging of all contact attempts:
  - Timestamp (precise)
  - Contact method (email, SMS, call, etc.)
  - Recipient (encrypted phone/email)
  - Consent status at time of send (documented/not documented)
  - Message content (full offer email, SMS text, etc.)
  - User who initiated contact
  - IP address of requester
  - Delivery status (sent, bounced, failed, opened, etc.)
  - All data immutable (append-only ContactLog table, no updates)

### Claude's Discretion

- Skip-trace provider selection (will research options and recommend)
- Specific threshold values for qualification rules (Equity % threshold, debt cap, time-on-market window)
- UI/UX details (colors, spacing, exact card layouts)
- Performance optimizations for deal list loading
- Database indexing strategy for multi-tenant queries

</decisions>

<specifics>
## Specific Ideas

- **Automatic qualification:** You want the platform to do the heavy lifting — users provide criteria, platform filters intelligently. No manual rule-building.
- **Budget-conscious enrichment:** Cost matters for skip-trace. Prefer free/cheap tiers if available, accept lower accuracy for cost savings.
- **Full audit trail mindset:** Every action logged for potential legal discovery. Compliance isn't just a feature, it's foundational.
- **Customizable pipeline:** Your deals move through custom stages. Default is Sourced → Contacted → Pending → Closed, but users can adapt to their workflow.

</specifics>

<deferred>
## Deferred Ideas

- **PropStream API integration** — CSV import only in Phase 1. Automated API polling in Phase 2.
- **Geographic customization of offer formula** — Phase 1 uses simple 70% rule. State/county-specific taxes and closing costs added in Phase 2.
- **Creative finance scoring** — Phase 2 feature. Unlock seller-financed, subject-to, and other creative deals.
- **Offer generation & sending** — Phase 2. Phase 1 focuses on sourcing and qualification.
- **Automated follow-up sequences** — Phase 2. Email/SMS/call automation with compliance.
- **CSV export & PDF reporting** — Phase 2. Phase 1 focuses on data in-app.
- **Face detection or advanced property condition scoring** — Future phases.

</deferred>

---

*Phase: 01-core-deal-sourcing-crm*
*Context gathered: 2026-02-26*
