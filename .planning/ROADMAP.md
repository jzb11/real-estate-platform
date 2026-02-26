# Roadmap: Real Estate Automation Platform

**Project:** Real Estate Deal Sourcing & Wholesale Automation
**Date Created:** 2026-02-25
**Status:** Draft

---

## Overview

This roadmap delivers a deal automation platform that moves investors from manual deal sourcing to one-click offer generation and automated follow-ups. The platform sources deals from PropStream, qualifies them using creative finance criteria, and manages complete deal lifecycle through automated offer sequences.

**v1 Coverage:** 40/40 requirements mapped ✓

---

## Phases

- [ ] **Phase 1: Core Deal Sourcing & CRM** - Foundation for sourcing, analyzing, and organizing deals with compliance built-in
- [ ] **Phase 2: Intelligent Offer Automation & Creative Finance** - Automate offer generation, follow-up sequences, and intelligent deal scoring

---

## Phase Details

### Phase 1: Core Deal Sourcing & CRM

**Goal:** Enable users to connect PropStream, source deals, analyze profitability, organize in a CRM pipeline, and access the platform securely with compliance foundations in place.

**Depends on:** Nothing (first phase)

**Requirements:** DS-01, DS-02, DS-03, DS-04, DS-05, DS-06, DS-07, QA-01, QA-02, QA-03, QA-04, QA-05, TC-01, TC-02, TC-03, TC-04, TC-05, TC-06, KB-01, KB-02, KB-03, KB-04, AUTH-01, AUTH-02, AUTH-03, AUTH-04

**Success Criteria** (what must be TRUE when this phase completes):

1. **User can authenticate and access dashboard** — Create account with email/password, log in, session persists across page refreshes, can log out from any page, can reset forgotten password
2. **User can connect to PropStream and source deals** — API connection with credentials, search properties by time on market, filter by equity/debt/interest rate, save filter criteria, receive list of matching properties with key metrics
3. **User can analyze deals for profitability** — View property detail dashboard with full financials, see calculated offer price based on 70% rule, view custom qualification rules applied, deals filtered to show only qualified matches
4. **User can organize deals in visual CRM pipeline** — Deals organized in pipeline view (sourced → contacted → pending → closed), track which deals are in each stage, see all deal details and history
5. **User can access educational content and understand the platform** — Knowledge base available with guides on deal analysis and creative finance structures, can search for topics, help contextually available on dashboard
6. **System is compliant and audit-ready** — Consent captured before any contact, compliance logs track all actions, system flags TCPA violations, deal analysis data tagged with freshness date, user can view audit trail

**Plans:** TBD

---

### Phase 2: Intelligent Offer Automation & Creative Finance

**Goal:** Automate the most time-consuming workflows (offer generation, follow-ups) while enabling creative finance deals to unlock higher-profitability opportunities.

**Depends on:** Phase 1 (deal sourcing, CRM, compliance framework in place)

**Requirements:** OF-01, OF-02, OF-03, OF-04, OF-05, OF-06, OF-07, AU-01, AU-02, AU-03, AU-04, AU-05, AU-06, QA-06, QA-07

**Success Criteria** (what must be TRUE when this phase completes):

1. **User can generate and send professional offers with one click** — Generate offer email with property address, details, and calculated price, email formatted professionally with unsubscribe link, send to realtor/homeowner with single click, system tracks sent offers and timestamps
2. **User can bulk send offers and see delivery/open tracking** — Send multiple offers in one batch operation, see if offers were opened/read by recipients, view responses and replies from recipients
3. **User can create and automate follow-up sequences** — Define follow-up sequence (email → SMS → phone call schedule), system automatically triggers follow-ups based on sequence, customize cadence (e.g., email day 1, SMS day 3, call day 7)
4. **User can identify and enrich contact information at scale** — Skip-trace contacts to find phone/email, system enriches contact data before sending, user can send 50+ offers per day without manual effort
5. **User can score deals intelligently and identify creative finance opportunities** — Deals scored on 0-100 scale based on equity, condition, motivation signals, sort qualified deals by score, create and apply custom creative finance rules (e.g., subject-to, seller financing qualifying deals), see creative finance deals clearly marked in pipeline
6. **System monitors email deliverability and sender reputation** — Bounce rate tracked and monitored (alert if >5%), complaint rate tracked and monitored (alert if >0.1%), sender reputation remains stable, list validation removes low-confidence addresses before bulk send

**Plans:** TBD

---

## Progress Table

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Core Deal Sourcing & CRM | 0/TBD | Not started | — |
| 2. Intelligent Offer Automation & Creative Finance | 0/TBD | Not started | — |

---

## Coverage Summary

| Category | Requirements | Phase |
|----------|--------------|-------|
| Deal Sourcing | DS-01 through DS-07 (7) | Phase 1 |
| Deal Qualification & Analysis | QA-01 through QA-05 (5), QA-06-QA-07 (2) | Phase 1 (5), Phase 2 (2) |
| Offer Generation & Sending | OF-01 through OF-07 (7) | Phase 2 |
| Automation & Follow-Up | AU-01 through AU-06 (6) | Phase 2 |
| Tracking & Compliance | TC-01 through TC-06 (6) | Phase 1 |
| Knowledge Base | KB-01 through KB-04 (4) | Phase 1 |
| Authentication | AUTH-01 through AUTH-04 (4) | Phase 1 |

**Total:** 40/40 v1 requirements mapped ✓

---

## Delivery Strategy

**Phase 1 Timeline:** 8-10 weeks
- Focus on data quality and compliance foundations upfront
- Minimal manual data entry (auto-populated from PropStream)
- Strong onboarding reduces adoption friction
- Deal analysis engine with geographic customization

**Phase 2 Timeline:** 6-8 weeks
- BullMQ job queue for reliable automation
- SendGrid + third-party providers for multi-channel delivery
- Creative finance rules engine unlocks differentiator
- Email deliverability infrastructure (list validation, monitoring)

**Architecture Evolution:**
- Phase 1: Monolith with PostgreSQL + Redis caching
- Phase 2: Introduce BullMQ + Redis job queuing, SendGrid integration, rules engine

---

## Key Success Metrics

**Phase 1:**
- User sources deals daily
- User analyzes 3+ deals for profitability before sending offers
- User organizes deals in CRM (moves through pipeline)
- Zero support requests about "how do I use this?"
- Compliance audits pass

**Phase 2:**
- User closes 2-4 deals/month with less manual effort
- Creative finance deals represent 15%+ of pipeline
- Email bounce rate < 5%, complaint rate < 0.1%
- 50+ offers sent per week with automated follow-ups
- Sender reputation remains stable

---

**Next Step:** Await approval for Phase 1 planning via `/gsd:plan-phase 1`
