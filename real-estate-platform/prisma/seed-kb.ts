import { PrismaClient, KbCategory } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';

function createClient() {
  const connectionString = process.env.DATABASE_URL as string;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is required');
  }
  const adapter = new PrismaNeon({ connectionString });
  return new PrismaClient({ adapter });
}

const articles: {
  slug: string;
  title: string;
  category: KbCategory;
  content: string;
  isPublished: boolean;
}[] = [
  {
    slug: 'deal-analysis-70-percent-rule',
    title: 'The 70% Rule: Your Foundation for Deal Analysis',
    category: KbCategory.FORMULAS,
    isPublished: true,
    content: `# The 70% Rule: Your Foundation for Deal Analysis

The 70% rule is the most widely used heuristic in real estate wholesaling and fix-and-flip investing. It gives you a quick, reliable Maximum Allowable Offer (MAO) so you never overpay for a deal.

## The Formula

\`\`\`
MAO = (ARV × 0.70) − Repair Costs
\`\`\`

- **ARV** = After-Repair Value (what the property will sell for after renovations)
- **0.70** = The 70% multiplier (your buying threshold)
- **Repair Costs** = Estimated cost to bring the property to sale-ready condition

## Why 70%?

The 30% buffer accounts for three key cost categories:

| Cost Category | Typical Range |
|---|---|
| Investor profit margin | 10–15% |
| Holding costs (taxes, insurance, utilities) | 5–8% |
| Closing costs (buy + sell) | 4–6% |

By staying at or below 70% of ARV, you preserve enough margin to pay your overhead and earn a profit.

## Example Calculation

**Scenario:** A property in a neighborhood where comparable renovated homes sell for $200,000. The house needs $30,000 in repairs.

\`\`\`
MAO = ($200,000 × 0.70) − $30,000
MAO = $140,000 − $30,000
MAO = $110,000
\`\`\`

You should not offer more than **$110,000** for this property. If the seller needs $125,000, the deal doesn't work at your target margin — walk away or renegotiate repair scope.

## When to Deviate from 70%

The 70% rule is a starting point, not a hard law. Adjust based on market conditions:

### Strong (Hot) Market
- Homes sell faster, less holding cost risk
- You may go up to **75%** for highly desirable properties
- Lower days-on-market means lower carrying costs

### Slow Market
- Higher inventory, longer selling time
- Tighten to **65%** to account for extended holding periods
- Distressed markets: consider 60% for high-repair properties

### Property-Specific Factors
- Unique property type (luxury, commercial-adjacent): tighter margins
- Seller already priced at steep discount: you have room to move
- Rental hold strategy: different formula applies (use cap rate instead)

## Common Mistakes

### 1. Using Asking Price as ARV
The most expensive mistake a new investor makes. ARV is what the property will sell for **after repairs**, not what the seller is asking today. Always run comps — look at recent sales of similar properties (same bed/bath, within 1 mile, sold in last 6 months).

### 2. Underestimating Repair Costs
Get a contractor walkthrough before finalizing your offer. Add a 10–15% contingency buffer to all repair estimates for unexpected issues (plumbing behind walls, roof decking, foundation micro-cracks).

### 3. Ignoring Holding Costs
Every month you hold a property, you pay taxes, insurance, utilities, and loan interest. A $150,000 purchase with 8% hard money financing costs ~$1,000/month in interest alone. Factor in realistic timelines.

## Quick Reference

- **ARV $100K, $15K repairs** → MAO = $55,000
- **ARV $150K, $20K repairs** → MAO = $85,000
- **ARV $200K, $30K repairs** → MAO = $110,000
- **ARV $300K, $45K repairs** → MAO = $165,000

The 70% rule runs in the background of every deal qualification score in this platform. Use it as your final sanity check before submitting an offer.
`,
  },
  {
    slug: 'what-is-subject-to-financing',
    title: 'Subject-To Financing: Buying Properties with Existing Mortgages',
    category: KbCategory.CREATIVE_FINANCE,
    isPublished: true,
    content: `# Subject-To Financing: Buying Properties with Existing Mortgages

Subject-to financing (often written as "sub2" or "subject-to") is one of the most powerful creative finance strategies in real estate. It lets you acquire a property without qualifying for a new loan — the existing mortgage stays in place.

## What Does "Subject To" Mean?

When you buy a property "subject to the existing financing," you:
1. Take **title** (legal ownership) of the property
2. The **seller's mortgage remains in their name**
3. You make the mortgage payments going forward

The deed transfers to you. The loan does not. You own the property and control it — but the lender still sees the original borrower as responsible for the debt.

## Why Would a Seller Agree?

Sellers in distress have limited options. Subject-to solves problems that traditional sales cannot:

### Foreclosure Prevention
A seller facing foreclosure needs their mortgage caught up **fast**. Subject-to lets you take over payments immediately — saving their credit and stopping the foreclosure clock. The seller walks away clean.

### Underwater Mortgage
If the seller owes more than the property is worth (negative equity), they can't sell through traditional means without bringing cash to close. Subject-to lets them exit without a shortfall.

### Speed and Certainty
Traditional closings take 30–60 days. Subject-to can close in days. For motivated sellers, speed has real value.

### No Realtor Commissions
The seller avoids 5–6% agent fees. In a distressed sale, that saved commission may mean the difference between breaking even and going underwater.

## Risk Factors

### Due-on-Sale Clause
Nearly every mortgage contains a due-on-sale clause — a provision that allows the lender to **demand full repayment** if ownership transfers without their consent.

**The reality:** Lenders rarely invoke this clause as long as payments are made on time. A performing loan is not something lenders want to call due. However, the risk exists and must be disclosed to sellers.

**Mitigation:** Keep payments current. Never miss a payment on a sub2 property. Consider a Land Trust structure in some states to add a layer of privacy.

### Title Transfer Risk
The property is now in your name. If you fail to make payments, the foreclosure affects the original seller's credit. This is a serious ethical obligation — you must perform.

### Insurance Gap
The seller's homeowner's insurance policy may lapse or become void after transfer. Obtain a new investor policy immediately at closing.

## Qualification Criteria for Subject-To Deals

This platform's distress signals identify the best subject-to candidates. Look for:

| Signal | Why It Matters |
|---|---|
| Pre-foreclosure or Notice of Default | Seller has urgent timeline, motivated to exit |
| Low equity (< 20%) | Can't sell traditionally without bringing cash |
| Mortgage payments current | Avoids inherited arrears |
| High seller motivation score | More willing to accept creative terms |
| Long time on market | Tried traditional route, now open to alternatives |

## How This Platform Identifies Subject-To Candidates

The qualification rules engine scores properties on distress signals:
- **Foreclosure status**: +25 points
- **Tax delinquency**: +15 points
- **Low equity signals**: +10 points
- **Long days on market**: +10 points

Properties scoring 40+ with low equity are flagged as strong subject-to candidates in your deal detail view.

## Next Steps

1. Run the 70% rule to verify there's enough equity (or no equity) to structure the deal
2. Qualify the seller's motivation with a discovery call
3. Request a mortgage statement to verify payoff amount and payment history
4. Consult a real estate attorney for your state's specific requirements
5. Use a Land Trust or LLC for asset protection

For structuring seller financing as an alternative, see: [Seller Financing: How to Structure Owner-Financed Deals](/kb/seller-financing-guide)
`,
  },
  {
    slug: 'seller-financing-guide',
    title: 'Seller Financing: How to Structure Owner-Financed Deals',
    category: KbCategory.CREATIVE_FINANCE,
    isPublished: true,
    content: `# Seller Financing: How to Structure Owner-Financed Deals

Seller financing (also called owner financing) turns the seller into the bank. Instead of you qualifying for a conventional mortgage, the seller accepts monthly payments directly from you over an agreed term.

## How It Works

1. You and the seller agree on a purchase price, interest rate, and repayment term
2. At closing, the seller holds a **promissory note** (your promise to pay)
3. The note is secured by a **mortgage or deed of trust** on the property
4. You make monthly payments to the seller — not a bank
5. After the term ends (or at payoff), you own the property free and clear

No bank. No qualifying. No W-2 requirements. No 30-day approval process.

## When Do Sellers Agree to Carry Financing?

The ideal seller financing candidate has these characteristics:

### Free-and-Clear Property (No Mortgage)
If the seller owns the property outright, they can offer financing without any lender restrictions. A paid-off $200K property held by a retiree is a perfect seller-financing candidate — they'd prefer monthly income over a lump sum they don't need.

### High Equity + Cash Flow Need
Sellers with 70%+ equity may prefer monthly payments over a lump sum that they'd struggle to deploy elsewhere. The note creates a predictable income stream at above-bank interest rates.

### Can't Find Buyers at Full Price
When a property has unique characteristics (rural location, unusual configuration, deferred maintenance), traditional buyers struggle to get conventional financing. Seller financing expands the buyer pool to investors who don't need bank approval.

### Estate Sales
Heirs inheriting property often prefer the installment sale approach for tax benefits — spreading the capital gain recognition over multiple years via the IRS installment sale method.

## Key Terms to Negotiate

### Interest Rate
Typically 5–8% on seller-financed deals. Higher than a bank saves (good for seller), lower than hard money (good for you). Both sides win vs. their alternatives.

### Amortization Period
- **30-year amortization** = lower monthly payments, larger balloon
- **15-year amortization** = higher monthly payments, paid off faster
- **Interest-only** = lowest payments, 100% balloon at end

Choose amortization based on your hold strategy.

### Balloon Payment
Most seller-financed deals include a **balloon payment** — the full remaining balance due after 3–10 years. This gives the seller their lump sum eventually while giving you time to stabilize the property and refinance conventionally.

**Typical structure:** 30-year amortization, 5-year balloon. Low payments for 5 years, then refinance with a bank once you have rent history.

### Down Payment
10–20% down is typical. Lower down payment = more leverage for you. Higher down payment = more security for the seller.

## Sample Term Sheet

\`\`\`
Property:        123 Main Street
Purchase Price:  $150,000
Down Payment:    $15,000 (10%)
Financed Amount: $135,000
Interest Rate:   6.5%
Amortization:    30 years
Monthly Payment: $853.51
Balloon Due:     5 years from closing
Prepayment:      No penalty
\`\`\`

After 5 years, you've paid down the balance to ~$127,000. If the property appreciated to $180,000, you refinance, cash out equity, and the seller gets their balloon.

## Qualifying Seller-Finance Candidates

In this platform, strong seller-finance candidates appear when:

| Signal | Meaning |
|---|---|
| Low or no mortgage balance | Seller can offer financing without lender restrictions |
| Long time on market | Motivated seller, open to creative structures |
| High list price relative to comps | Seller unwilling to reduce price but may flex on terms |
| Estate/probate records | Heirs often prefer installment sale tax treatment |

Run a comparable analysis (ARV − repairs − your profit) to confirm the terms work. If the financed amount creates negative cash flow, the structure doesn't work.

## Due Diligence Before Signing

1. **Title search**: Confirm the seller actually owns the property free of liens
2. **Property inspection**: You're buying it — inspect it thoroughly
3. **Appraisal or BPO**: Verify you're not overpaying
4. **Attorney review**: Real estate attorney in your state must draft the promissory note and security instrument
5. **Title insurance**: Protect yourself from undiscovered liens

For alternative creative structures when the seller has an existing mortgage, see: [Subject-To Financing](/kb/what-is-subject-to-financing)
`,
  },
  {
    slug: 'tcpa-compliance-wholesalers',
    title: 'TCPA Compliance for Real Estate Wholesalers',
    category: KbCategory.COMPLIANCE,
    isPublished: true,
    content: `# TCPA Compliance for Real Estate Wholesalers

The Telephone Consumer Protection Act (TCPA) is federal law enforced by the FCC. It applies to **any business** using phone, SMS, or auto-dialer technology to contact consumers — including real estate wholesalers. Non-compliance is one of the fastest ways to incur five- or six-figure legal liability.

## What Is the TCPA?

The TCPA (47 U.S.C. § 227) was enacted in 1991 and significantly expanded in subsequent FCC rulings. It regulates:

- **Telephone calls** made with auto-dialers or prerecorded messages
- **SMS/text messages** sent without prior express consent
- **Fax transmissions** to registered numbers
- Calls to numbers on the **National Do Not Call (DNC) Registry**

**Critical:** Courts have consistently ruled that real estate wholesalers making unsolicited calls or texts to property owners fall under TCPA jurisdiction. The "small investor" exception does not exist.

## Fine Structure

TCPA violations carry **per-contact** penalties:

| Violation Type | Fine Per Violation |
|---|---|
| Standard TCPA violation | $500 |
| Willful or knowing violation | Up to $1,500 |

**Real math:** If you send 500 unsolicited text messages and 100 recipients file complaints, that's $50,000 to $150,000 in potential liability — for a single campaign. Class action suits aggregate violations across all recipients.

## What Triggers a Violation?

### Calling/Texting Without Prior Express Written Consent (PEWC)
To legally contact someone by autodialer or text, you must have their **written** consent on record. Verbal consent alone is insufficient for telemarketing purposes.

PEWC must:
- Be a written agreement (electronic OK, including checkbox or signed form)
- Clearly identify the seller/requester
- State that the consumer is agreeing to be contacted
- Not be a condition of purchase

### Calling Numbers on the DNC Registry
Before any outreach campaign, scrub your list against:
1. The National DNC Registry (register at donotcall.gov)
2. Your internal company DNC list (opt-outs you've received)

Companies must update DNC list subscriptions at minimum every 31 days.

### Continuing Contact After Opt-Out
Once a consumer requests to stop contact, **you must honor it immediately**. "Stop," "Unsubscribe," "Remove me," and "Do not contact" are all opt-out requests, regardless of exact phrasing. You have **10 business days** to process opt-outs under FCC rules.

### Contacting Without Calling Hours Compliance
Calls/texts are only permitted 8 AM – 9 PM in the **recipient's local time zone**. Contacting outside these hours is a separate violation.

## How This Platform Protects You

The platform's TCPA compliance module is built into every contact workflow:

### Consent Logging
Every contact interaction is logged with:
- Contact method (call, SMS, email, letter)
- Consent status at time of contact
- Timestamp of consent obtained
- Consent medium (verbal, written, electronic)

This creates an **audit trail** that demonstrates good-faith compliance if you're ever challenged.

### DNC List Check
Before any outbound contact appears in your workflow, the property owner's phone number is checked against your internal DNC list. Properties with `DO_NOT_CALL` status cannot be contacted through the platform.

### Opt-Out Processing
When an owner requests removal, mark their contact log with `optOutRequestedAt`. The platform enforces no-contact status for that number going forward.

### 4-Year Record Retention
TCPA compliance records must be retained for a minimum of 4 years. All contact logs and consent records in this platform are immutable — they cannot be deleted.

## Best Practice Compliance Checklist

- [ ] **Obtain written consent** before calling or texting any property owner
- [ ] **Scrub against DNC Registry** before every outreach campaign (update monthly)
- [ ] **Honor opt-outs within 10 business days** — mark immediately, process within deadline
- [ ] **Only contact between 8 AM – 9 PM local time**
- [ ] **Retain consent records for 4 years minimum**
- [ ] **Never use auto-dialers** without PEWC on file
- [ ] **Train anyone who contacts sellers** on these requirements

## Resources

- [FCC TCPA Overview](https://www.fcc.gov/consumers/guides/stop-unwanted-robocalls-and-texts)
- [National DNC Registry](https://www.donotcall.gov)
- FCC's 2023 TCPA One-to-One Consent Rule (effective Jan 27, 2025)

**This article is informational only and does not constitute legal advice. Consult a licensed attorney for guidance specific to your situation.**
`,
  },
  {
    slug: 'reading-distress-signals',
    title: 'How to Read Property Distress Signals',
    category: KbCategory.ANALYSIS,
    isPublished: true,
    content: `# How to Read Property Distress Signals

Distress signals are indicators that a property owner is in a difficult situation — financially, personally, or circumstantially — and may be more motivated to sell than the average homeowner. Understanding these signals helps you identify which leads deserve your time and energy.

## Foreclosure

### What It Means
Foreclosure is the legal process by which a lender repossesses a property after the borrower defaults on their loan. There are two key phases:

**Pre-Foreclosure (Notice of Default filed)**
The lender has filed public notice that the borrower is behind on payments. The homeowner typically has 90–180 days before the property goes to auction. **This is your best window.**

**Active Foreclosure (Lis Pendens or Auction Scheduled)**
The foreclosure is progressing through the court system. Less time to negotiate, but still possible.

### Why It's Valuable
A homeowner in pre-foreclosure faces:
- Damaged credit if foreclosure completes
- Potential deficiency judgment (in recourse states)
- Stress and urgency

They need a **solution**, not just a buyer. You offer relief. This creates the motivation needed for below-market pricing or creative structure acceptance.

### Finding Pre-Foreclosure Opportunities
- County courthouse public records (Notice of Default filings)
- PropStream's pre-foreclosure filter
- PACER for federal cases
- Title company relationships

## Tax Delinquency

### What It Means
Tax delinquency means the property owner has failed to pay property taxes. This can happen without a mortgage default — many free-and-clear property owners fall behind on taxes due to financial hardship.

### Why It's Valuable
Tax-delinquent properties signal financial distress **without necessarily triggering foreclosure**. This means:
- Less competition from other investors (no public Notice of Default)
- Owner may be highly motivated but hasn't taken action yet
- Tax liens accrue interest (up to 18–36% in some states), creating urgency

### How to Find Tax-Delinquent Properties
- County tax assessor records (often searchable online)
- PropStream's tax delinquency filter
- State-specific tax lien auction lists

## Long Time on Market

### What It Means
Properties that have been listed for 90+ days without selling are showing a **motivation signal**. The average home sells in 30–45 days in most markets. Extended listings indicate:
- Overpriced listing (seller anchored to an unrealistic number)
- Property condition issues deterring conventional buyers
- Unusual property characteristics limiting the buyer pool

### Why It's Valuable
A seller who has been trying to sell for 4+ months is **psychologically ready** to consider alternatives. They've endured showings, price reductions, and disappointment. Approaching them with a creative finance solution (seller financing, subject-to) or an as-is cash offer often finds a receptive audience.

### Days on Market Thresholds
| Days on Market | Signal Strength |
|---|---|
| 0–30 days | Normal — no signal |
| 30–60 days | Mild — worth monitoring |
| 60–90 days | Moderate — potential for negotiation |
| 90+ days | Strong — seller likely motivated |
| 180+ days | Very strong — actively motivated, possible price reduction |

## Combining Signals: Weight-Based Scoring

Individual distress signals are useful, but **combinations are where deals are found**. A property with:
- Pre-foreclosure + Tax delinquency = High urgency, probably open to any reasonable exit
- Long time on market + Low equity = Subject-to or seller-finance candidate
- Tax delinquency + High equity = Cash-out opportunity for the seller

### How Qualification Rules Use These Signals

This platform's scoring system assigns weights to each signal:

| Signal | Point Weight |
|---|---|
| Active foreclosure | +25 |
| Pre-foreclosure (NOD filed) | +20 |
| Tax delinquency | +15 |
| 90+ days on market | +10 |
| Low equity (< 20%) | +10 |
| Absentee owner | +8 |
| Property condition distress | +7 |

Properties scoring 50+ are automatically classified as **QUALIFIED** and moved to the front of your pipeline.

## Reading Signals in Your Dashboard

In your property list view, each lead shows:
- **Distress score badge** (color-coded: green < 20, yellow 20–49, red 50+)
- **Signal breakdown** in the detail view (which signals triggered and their weights)
- **Recommended strategy** based on signal combination (cash offer / subject-to / seller-finance)

Use the qualification rules engine to customize weights based on your local market and investing strategy.
`,
  },
  {
    slug: 'platform-quick-start',
    title: 'Quick Start: From CSV Import to Your First Qualified Deal',
    category: KbCategory.ANALYSIS,
    isPublished: true,
    content: `# Quick Start: From CSV Import to Your First Qualified Deal

Welcome to your real estate deal sourcing platform. This guide walks you through the complete workflow — from exporting data out of PropStream to submitting your first offer — in 7 steps.

## Step 1: Export from PropStream

PropStream is a leading real estate data aggregator that gives you access to distressed property lists across the country. Before importing to this platform, configure your PropStream export correctly.

**Recommended PropStream Filters:**
- **Property Type:** Single Family, Condo/TH, Multi-Family (2–4 units)
- **Equity Percent:** 0–70% OR select "Pre-Foreclosure" or "Tax Delinquent" to catch no-equity distressed
- **Ownership Type:** Absentee Owner (highest motivation signal)
- **Distress Filters:** Check "Pre-Foreclosure," "Tax Delinquency," "MLS Failed (Expired)"
- **Days on Market:** 90+ (for long-listing distress signal)
- **Geography:** Target zip codes you're actively working

**Exporting:**
1. Run your filtered search in PropStream
2. Click "Download" → Select CSV format
3. Choose fields: address, owner name, estimated value, equity %, distress flags, phone, last sale price
4. Download the file (typically named `PropStream_Export_YYYYMMDD.csv`)

## Step 2: Import CSV to This Platform

1. Navigate to **Properties → Import CSV** in the sidebar
2. Click "Select File" and choose your PropStream export
3. The platform auto-maps PropStream column headers to our data fields
4. Review the field mapping preview — correct any mismatches
5. Click "Import" — processing takes 2–5 seconds per 100 records

**What happens during import:**
- Duplicate detection by address (existing records are updated, not duplicated)
- Distress signal parsing from PropStream flags
- Initial qualification scoring runs automatically
- Properties appear in your **Properties** list immediately

## Step 3: Review Your Filtered Property List

After import, navigate to **Properties** to see your leads.

**Sort and filter by:**
- **Qualification Score** (highest first to see best opportunities)
- **Distress Level** (High / Medium / Low)
- **Category** (Pre-Foreclosure / Tax Delinquent / Long on Market)

Each property card shows:
- Address and basic details
- Estimated value and equity %
- Distress signals active (badges)
- Qualification score (0–100)

**Quick filters:** Click "Score 50+" to see only QUALIFIED leads, or "Pre-Foreclosure" to see urgent opportunities.

## Step 4: Understand the Qualification Score

Every property receives a qualification score from 0–100 based on:

| Component | Max Points |
|---|---|
| Distress signals (see breakdown) | 60 |
| Equity position | 20 |
| Market velocity (days on market) | 10 |
| Property type match | 10 |

**Score interpretation:**
- **0–29:** Low motivation — only pursue if price is exceptional
- **30–49:** Moderate motivation — worth initial outreach
- **50–79:** High motivation — prioritize immediately
- **80–100:** Maximum distress — move fast, motivated seller

The score updates automatically as new data comes in (PropStream refresh, your manual updates).

## Step 5: Create a Deal from a Property

When a property scores well and you want to pursue it:

1. Click "Create Deal" on the property card
2. Add a deal title (default: the property address)
3. Set initial notes (what you know about the seller's situation)
4. Click "Create" — the deal appears in your **Pipeline**

A property can have multiple deals (e.g., you sourced it twice over different time periods). The platform tracks them separately.

## Step 6: Move Through the Pipeline Stages

Your pipeline tracks every deal from initial contact to close:

| Stage | What It Means | Your Next Action |
|---|---|---|
| **SOURCED** | Imported, not yet analyzed | Review property data, calculate MAO |
| **ANALYZING** | You're evaluating it | Run comps, get repair estimate |
| **QUALIFIED** | Rules passed, score ≥ 50 | Make contact with seller |
| **UNDER_CONTRACT** | Offer accepted | Due diligence, title search |
| **CLOSED** | Deal completed | Log final numbers, analyze performance |
| **REJECTED** | Eliminated | Note reason for future learning |

Move deals forward by clicking the stage button on the deal detail page. Every stage change is timestamped in the deal history.

## Step 7: Calculate Your MAO Before Making an Offer

Never submit an offer without running the numbers. The 70% rule is your foundation:

\`\`\`
MAO = (ARV × 0.70) − Repair Costs
\`\`\`

**In practice:**
1. Pull 3–5 sold comparables (PropStream comps, Zillow, MLS if you have access)
2. Calculate ARV = average of comparable sold prices
3. Get a contractor walkthrough or use cost-per-square-foot estimates
4. Plug into the formula

The deal detail page shows the estimated value from PropStream — use this as a starting point, not as ARV. Always verify with recent sold comps in the immediate area.

**Before calling the seller:**
- Know your MAO
- Know your estimated repair costs
- Know your ideal structure (cash / subject-to / seller finance)
- Have your exit strategy ready (wholesale assignment / fix-and-flip / hold)

You're now ready to source deals systematically. Import weekly, score daily, call leads while motivation is highest.

For formula details, see: [The 70% Rule](/kb/deal-analysis-70-percent-rule)
For understanding pipeline stages in depth, see: [Deal Pipeline Stages](/kb/deal-pipeline-stages)
`,
  },
  {
    slug: 'deal-pipeline-stages',
    title: 'Understanding the Deal Pipeline: From Sourced to Closed',
    category: KbCategory.ANALYSIS,
    isPublished: true,
    content: `# Understanding the Deal Pipeline: From Sourced to Closed

The deal pipeline is your command center for tracking every active opportunity from the moment you source a lead to the day you close. Understanding what each stage means — and when to advance — keeps your deals moving and your analysis sharp.

## Pipeline Overview

\`\`\`
SOURCED → ANALYZING → QUALIFIED → UNDER_CONTRACT → CLOSED
                                                  ↘ REJECTED (any stage)
\`\`\`

Every deal enters at SOURCED and exits at either CLOSED or REJECTED. The pipeline is linear by design — it forces you to evaluate each deal before advancing, creating a discipline that separates profitable investors from churners.

## Stage Breakdown

### SOURCED
**What it means:** The deal has been created from a property in your database. No analysis has been done yet — this is the raw lead stage.

**How you get here:**
- Created from the property detail page
- Auto-created when a property score exceeds your threshold (if enabled)

**What to do:**
1. Review the property data from PropStream
2. Check the qualification score and distress signals
3. Decide if it's worth analyzing (if score < 20 with no compelling signals, reject here)
4. Gather initial information: ownership chain, mortgage balance if available, tax status

**When to advance:** You've reviewed the data and believe the opportunity is worth analyzing. Move to ANALYZING when you're actively working the deal.

**When to reject:** Score too low, property type doesn't match your strategy, or geography outside your target market.

---

### ANALYZING
**What it means:** You're actively evaluating this deal. Comps are being pulled, repair costs are being estimated, and you're assessing the seller's situation.

**What to do:**
1. Pull sold comparables (target: 3–5 sales within 1 mile, last 6 months, similar specs)
2. Calculate ARV from comps
3. Estimate repair costs (drive-by at minimum, contractor walkthrough ideally)
4. Run MAO calculation: (ARV × 0.70) − Repairs
5. Determine your ideal acquisition structure (cash / sub2 / seller-finance)
6. Research ownership: confirm owner occupant vs. absentee, contact info accuracy
7. Check for any additional liens (IRS, mechanics, HOA)

**When to advance:** MAO works, structure is clear, and you're ready to contact the seller. Move to QUALIFIED.

**When to reject:** Numbers don't work at any reasonable price, title is cloudy, or you've discovered disqualifying issues (environmental, structural, legal).

---

### QUALIFIED
**What it means:** The qualification rules have passed (score ≥ 50), numbers work, and the deal is ready to pursue. This is your active outreach stage.

**What to do:**
1. Make initial contact with the property owner
2. Build rapport — understand their situation before pitching
3. Confirm seller motivation level (1–10 scale internally)
4. Present your offer (verbally first, then written)
5. Handle objections with empathy
6. Negotiate terms — price and/or structure

**Compliance reminder:** Obtain TCPA consent before calling or texting. Log every contact attempt. Check DNC status before outreach.

**When to advance:** Seller accepts your offer verbally. Move to UNDER_CONTRACT when you have a signed purchase agreement.

**When to reject:** Seller not motivated, price gap too wide, or motivated but wants terms you can't make work.

---

### UNDER_CONTRACT
**What it means:** You have a signed purchase agreement. The deal is in due diligence and on its way to close.

**What to do:**
1. Open escrow / title with your preferred title company
2. Order title search — look for all liens, judgments, easements
3. Complete your physical inspection (bring contractor)
4. Verify repair estimates against your assumptions
5. Confirm financing (hard money lender approval, POF from cash buyer if wholesaling)
6. If wholesaling: market to your buyers list, lock in end buyer
7. Review and sign all closing documents
8. Coordinate closing date with all parties

**Due diligence period:** Typically 7–21 days depending on your contract language. Use this time aggressively — you have the right to walk away for cause during this period.

**When to advance:** You've completed due diligence, financing is confirmed, and you're ready to close. Move to CLOSED when the deed transfers.

**When to reject:** Title issues not resolvable, inspection reveals deal-breaking conditions, end buyer falls through (if wholesaling) with no backup.

---

### CLOSED
**What it means:** The deal is complete. Deed has transferred (or assignment fee collected if wholesale). Funds have disbursed.

**What to do:**
1. Log your final numbers: actual acquisition price, actual repair costs, sale price/assignment fee
2. Calculate actual profit vs. projected
3. Note lessons learned
4. Add seller to your nurture list for future referrals
5. Celebrate appropriately

**After closing analysis:** Compare your projected MAO to your actual acquisition price. Compare estimated repairs to actual repairs. This feedback loop makes you more accurate over time.

---

### REJECTED
**What it means:** The deal was eliminated at some stage. Rejection is not failure — it's discipline.

**Best practice:**
- Always add a rejection reason note
- Common reasons: "Numbers don't work," "Seller unmotivated," "Title issues," "Lost to competitor"
- Rejected deals can be re-opened if circumstances change (foreclosure date approaches, seller calls back)

---

## Pipeline Best Practices

### Move Fast on QUALIFIED Leads
Distressed sellers talk to multiple investors. If you've qualified a lead, initiate contact within 24–48 hours. The investor who calls first and builds rapport fastest often wins.

### Keep Pipeline Clean
A bloated ANALYZING stage means you're not making decisions. Set a weekly discipline: every deal in ANALYZING must either advance or be rejected within 2 weeks. Indecision is a strategy — it's just a bad one.

### Track Stage History
Every stage change is logged with a timestamp. After 50+ closed deals, you can analyze: how long deals spend at each stage, your conversion rate from SOURCED to CLOSED, which distress signal combinations close fastest.

### Use Notes Liberally
The deal notes field is your working memory. Document every seller conversation, price negotiation point, and due diligence finding. When you revisit a deal 3 months later, the notes tell the story.
`,
  },
];

async function main() {
  const prisma = createClient();

  try {
    console.log('Seeding knowledge base articles...');

    let created = 0;
    let updated = 0;

    for (const article of articles) {
      const result = await prisma.kbArticle.upsert({
        where: { slug: article.slug },
        create: {
          title: article.title,
          slug: article.slug,
          category: article.category,
          content: article.content,
          isPublished: article.isPublished,
        },
        update: {
          title: article.title,
          category: article.category,
          content: article.content,
          isPublished: article.isPublished,
        },
      });

      if (result.createdAt.getTime() === result.updatedAt.getTime()) {
        created++;
        console.log(`  Created: ${result.slug}`);
      } else {
        updated++;
        console.log(`  Updated: ${result.slug}`);
      }
    }

    console.log(`\nDone! ${created} created, ${updated} updated.`);
    console.log(`Total articles in seed: ${articles.length}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
