# Real Estate Automation Platform

## What This Is

An automation platform that sources real estate deals from PropStream, qualifies them using creative finance criteria, and automatically generates and sends offers to homeowners and realtors. The system surfaces only qualified deals (winners), enables one-click offer generation with all deal data and numbers, and manages follow-up sequences to close deals faster and at scale.

## Core Value

Automate deal sourcing and qualification so investors can go from "deals brought to you" to closed contracts without manual searching or outreach work.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Connect to PropStream API with API key authentication
- [ ] Filter properties by time on market (60-90 days optimal)
- [ ] Filter properties by financial metrics (equity, debt owed, interest rate)
- [ ] Qualify deals based on creative finance/Sub2 criteria
- [ ] Display only qualified deals (filter out losers automatically)
- [ ] Generate offer document with property data and calculated offer price
- [ ] Send offer email to realtor or homeowner with one click
- [ ] Track offer status and follow-up sequences
- [ ] Automated follow-up sequence (email cadence, phone call reminders)
- [ ] User dashboard with pending deals, sent offers, and responses
- [ ] Educational knowledge base informed by deal analysis videos

### Out of Scope

- Mobile app (web-first only)
- Multi-user/team features (solo investor initially)
- Advanced CRM features (focus on deal flow automation)

## Context

Building this to automate and accelerate a wholesale real estate business using creative finance and Subject-to deals. The current workflow is manual (search deals, qualify, write offers, follow up) — this system eliminates the manual steps and enables sending multiple offers daily at scale. Initial goal is 2 offers/day for validation, then scale to more deals under contract.

Will incorporate educational content (transcribed market analysis videos) to continuously improve deal qualification logic.

## Constraints

- **Timeline**: No hard deadline, but build fast while maintaining quality
- **Audience**: Solo investor initially (productize if successful)
- **UI/UX**: Must be polished and user-facing (good visual presentation)
- **Automation**: Critical path is PropStream integration → offer generation → email automation

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Solo investor first, then product | Validate with real deals before scaling to multiple users | — Pending |
| Focus on creative finance qualification | Core to wholesale deals that work at scale | — Pending |
| Educational knowledge base layer | Improve deal qualification over time with market insights | — Pending |

---
*Last updated: 2026-02-25 after initialization*
