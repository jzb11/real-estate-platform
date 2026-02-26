# Requirements: Real Estate Automation Platform

**Defined:** 2026-02-25
**Core Value:** Automate deal sourcing and qualification so investors can go from "deals brought to you" to closed contracts without manual searching or outreach work.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Deal Sourcing

- [ ] **DS-01**: User can connect PropStream API with API key
- [ ] **DS-02**: User can search properties by time on market (days listed)
- [ ] **DS-03**: User can filter properties by equity percentage
- [ ] **DS-04**: User can filter properties by debt owed
- [ ] **DS-05**: User can filter properties by interest rate
- [ ] **DS-06**: User can save filter criteria and reuse them
- [ ] **DS-07**: User receives list of matching properties with key metrics displayed

### Deal Qualification & Analysis

- [ ] **QA-01**: User can create custom qualification rules (e.g., "if equity > 30% AND debt < $200k then WINNER")
- [ ] **QA-02**: System automatically qualifies deals based on user rules
- [ ] **QA-03**: System displays only qualified deals (filters out non-matching properties)
- [ ] **QA-04**: User can view property detail dashboard with full financials
- [ ] **QA-05**: User can see calculated offer price based on property data
- [ ] **QA-06**: System scores deals on 0-100 scale (highest score = best opportunity)
- [ ] **QA-07**: User can sort qualified deals by score

### Offer Generation & Sending

- [ ] **OF-01**: User can generate offer email that includes property address, details, and offer price
- [ ] **OF-02**: Offer email is formatted professionally and ready to send
- [ ] **OF-03**: User can send offer email to realtor or homeowner with one click
- [ ] **OF-04**: System tracks which offers were sent and when
- [ ] **OF-05**: User can see if offer was opened/read by recipient
- [ ] **OF-06**: User can see responses and replies to sent offers
- [ ] **OF-07**: User can send bulk offers (multiple properties in one batch)

### Automation & Follow-Up

- [ ] **AU-01**: User can create follow-up sequence (email → SMS → phone call schedule)
- [ ] **AU-02**: System automatically follows up based on sequence when offer sent
- [ ] **AU-03**: User can skip-trace contacts to find phone numbers and email addresses
- [ ] **AU-04**: System enriches contact data with verified phone/email before sending
- [ ] **AU-05**: User can send 50+ offers per day without manual effort
- [ ] **AU-06**: User can customize follow-up cadence (e.g., email day 1, SMS day 3, call day 7)

### Tracking & Compliance

- [ ] **TC-01**: User sees CRM dashboard with visual pipeline (Sourced → Contacted → Pending → Closed)
- [ ] **TC-02**: User can track which deals are in each stage of pipeline
- [ ] **TC-03**: System logs all contact attempts for compliance audit
- [ ] **TC-04**: System captures and logs consent before sending automated offers
- [ ] **TC-05**: User can view audit trail of all actions on each deal
- [ ] **TC-06**: System flags TCPA violations (contact attempt without consent logged)

### Knowledge Base & Education

- [ ] **KB-01**: User can access educational content about deal analysis
- [ ] **KB-02**: User can view guides on creative finance structures (subject-to, seller financing)
- [ ] **KB-03**: User can search knowledge base for specific topics
- [ ] **KB-04**: Knowledge base integrates with deal dashboard (context-aware help)

### Authentication & User Management

- [ ] **AU-01**: User can create account with email/password
- [ ] **AU-02**: User session persists across browser refresh
- [ ] **AU-03**: User can reset password via email link
- [ ] **AU-04**: User can log out from any page

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Advanced Qualification

- **AQ-01**: AI-powered offer generation based on winning/losing offer patterns
- **AQ-02**: Seller intent signals (tax arrears, code violations, time-on-market patterns)
- **AQ-03**: Geographic customization of offer formula (state-specific transfer taxes, closing costs)
- **AQ-04**: Multi-market support (state-by-state contract variants, compliance rules)

### Advanced Automation

- **AA-01**: Direct mail integration (list → design → USPS → response tracking)
- **AA-02**: Hard money lender network integration and pre-qualification
- **AA-03**: AI voice assistant for incoming calls
- **AA-04**: Mobile app with offline access

### Analytics & Reporting

- **AR-01**: Portfolio analytics dashboard (pipeline metrics, deal velocity, ROI by neighborhood)
- **AR-02**: Team performance reporting
- **AR-03**: Buyer network visualization (map view of cash buyers by region)

### Integrations

- **INT-01**: MLS integration for market data
- **INT-02**: CMA (Comparative Market Analysis) API integration
- **INT-03**: Tax assessor data integration
- **INT-04**: Loan platform integrations

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Mobile app (v1) | Web-first approach for MVP; mobile comes in v2 |
| Team/multi-user features (v1) | Solo investor initially; team features add complexity for phase 1 |
| White-label marketplace | Focus on internal product first, marketplace can be future enterprise feature |
| Real-time voice calling system | Use SMS/email for outreach; voice can come later |
| Property management features | Focus on deal sourcing and outreach only; do not build PM module |
| Investor network/buyer community | Partner with existing networks instead of building custom community |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| DS-01 | Phase 1 | Pending |
| DS-02 | Phase 1 | Pending |
| DS-03 | Phase 1 | Pending |
| DS-04 | Phase 1 | Pending |
| DS-05 | Phase 1 | Pending |
| DS-06 | Phase 1 | Pending |
| DS-07 | Phase 1 | Pending |
| QA-01 | Phase 1 | Pending |
| QA-02 | Phase 1 | Pending |
| QA-03 | Phase 1 | Pending |
| QA-04 | Phase 1 | Pending |
| QA-05 | Phase 1 | Pending |
| QA-06 | Phase 2 | Pending |
| QA-07 | Phase 2 | Pending |
| OF-01 | Phase 2 | Pending |
| OF-02 | Phase 2 | Pending |
| OF-03 | Phase 2 | Pending |
| OF-04 | Phase 2 | Pending |
| OF-05 | Phase 2 | Pending |
| OF-06 | Phase 2 | Pending |
| OF-07 | Phase 2 | Pending |
| AU-01 | Phase 2 | Pending |
| AU-02 | Phase 2 | Pending |
| AU-03 | Phase 2 | Pending |
| AU-04 | Phase 2 | Pending |
| AU-05 | Phase 2 | Pending |
| AU-06 | Phase 2 | Pending |
| TC-01 | Phase 1 | Pending |
| TC-02 | Phase 1 | Pending |
| TC-03 | Phase 1 | Pending |
| TC-04 | Phase 1 | Pending |
| TC-05 | Phase 1 | Pending |
| TC-06 | Phase 1 | Pending |
| KB-01 | Phase 1 | Pending |
| KB-02 | Phase 1 | Pending |
| KB-03 | Phase 1 | Pending |
| KB-04 | Phase 1 | Pending |
| AUTH-01 | Phase 1 | Pending |
| AUTH-02 | Phase 1 | Pending |
| AUTH-03 | Phase 1 | Pending |
| AUTH-04 | Phase 1 | Pending |

**Coverage:**
- v1 requirements: 40 total
- Mapped to phases: 40
- Unmapped: 0 ✓

---
*Requirements defined: 2026-02-25*
*Last updated: 2026-02-25 after initial definition*
