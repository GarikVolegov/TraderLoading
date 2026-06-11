# TraderLoadings A/B Testing & Validation Framework

## Overview

Questo documento definisce come validare le assunzioni di pricing attraverso esperimenti controllati (A/B test) prima del full rollout. L'obiettivo è massimizzare conversion rate e revenue senza sacrificare acquisition.

---

## Phase 0: Baseline Metrics (Pre-Pricing)

**Durata**: 1–2 settimane (raccolta dati contemporanea a setup tecnico Stripe).

### Cosa misurare
- **Signup rate** (utenti nuovi al giorno)
- **Trial activation rate** (% che compie ≥1 azione in trial)
- **Feature adoption** (quali feature top 3 usano?)
- **Session duration** (media minuti per visit)
- **Churn intent signals** (chi disattiva notifiche, cancella portafoglio, etc.)

### Come implementare
- Aggiungi event tracking (Segment, Mixpanel, o backend log JSON):
  ```json
  {
    "event": "trial_activated",
    "user_id": "...",
    "timestamp": "2026-06-10T10:00:00Z",
    "features_used": ["dashboard", "alerts", "ai_chat"]
  }
  ```
- Dashboard simple in Metabase/Grafana: **Daily Active Users**, **Trial Signup Count**, **Activation Rate %**.

### Success criteria (baseline)
- ≥100 signups/week
- ≥20% trial activation
- ≥10 min avg session duration

---

## Phase 1: Soft Launch — Freemium + Trial (Week 1–2)

**Scope**: Deploy paywall, Freemium tier, 7-day Pro trial → track conversion funnel.

### Test Hypothesis
**H1**: "Trial convertibility is ≥3% (30 conversions per 1,000 signups)"

### Experiment Design

| Arm | Treatment | Percent | Metrics |
|---|---|---|---|
| **Control** | Freemium only (no trial, no paid) | 50% | Activation rate, feature usage |
| **Trial** | 7-day Pro trial auto-start | 50% | Trial activation, trial→paid conversion, plan choice |

### Rollout
1. Deploy Stripe integration (Stage, not live yet).
2. Enable trial for 50% of new signups (feature flag: `trial_cohort`).
3. Track:
   - Trial starts (automated)
   - Day 0, 3, 6 event triggers (email nurture)
   - Trial end → paywall conversion intent
   - Actual subscription events (Stripe webhooks)

### Success criteria (Phase 1)
- Trial conversion ≥3% → PROCEED to Phase 2
- Trial activation ≥30% (users try trial features) → PROCEED
- Trial plan selection: expect 60% Pro, 30% Starter, 10% Other → PROCEED

### Failure criteria
- Trial conversion < 1% → PIVOT (extend trial to 14 days, add onboarding email)
- Activation < 20% → PIVOT (improve trial UX, feature discovery)

---

## Phase 2: Price Optimization (Week 3–4)

**Scope**: A/B test two Pro price points (€24 vs €29) to find optimal conversion + revenue.

### Test Hypothesis
**H2a**: "€24 Pro increases conversion by ≥15% vs €29" (trade-off: lower unit price, higher volume).  
**H2b**: "€29 maximizes revenue despite lower conversion" (anchoring/value perception).

### Experiment Design

| Arm | Pro Monthly Price | Percentage | Assumptions |
|---|---|---|---|
| **Control (A)** | €29/mo | 50% | Baseline; TradingView Plus-like positioning. |
| **Test (B)** | €24/mo | 50% | 15% more conversions; 17% less revenue per subscription. |

**Sample size**: ~400 conversions per arm (≈12,000–15,000 signups needed, ~7–10 days at 100/day signup rate).

### Metrics Captured (per user)

| Metric | Formula | Target |
|---|---|---|
| **Trial-to-paid conversion** | % who subscribe after trial | A: 3%, B: 3.5% (15% lift) |
| **Revenue per trial** | (MRR × 12) / trial starts | A: €10.4/trial, B: €8.6/trial |
| **Plan mix** | % choosing Starter vs Pro | A/B: maintain 60% Pro target |
| **Churn rate (D30)** | % churned by day 30 | A/B: <5% (no diff expected) |

### Analysis & Guardrails

**Interim analysis (Day 5 of Phase 2)**:
- Check for **low-quality conversions**: high churn D7 in one arm → investigate (product issue?).
- Check **plan mix skew**: if B drives >70% to Starter, price may be too low.

**Final analysis (end Phase 2, ~10 days)**:
- Use **t-test** (conversion rate) and **Mann-Whitney** (revenue per trial).
- Threshold: **p < 0.05** for win; otherwise inconclusive (extend to Phase 2b or call it even).

**Decision tree**:
```
A (€29) wins on revenue? 
  ├─ YES (p < 0.05) → KEEP €29, move to Phase 3
  └─ NO
      ├─ B (€24) wins on conversions? 
      │   ├─ YES (p < 0.05, revenue diff <10%) → ADOPT €24, move to Phase 3
      │   └─ NO → CALL IT EVEN, keep €29 (psychological anchor)
```

### Rollout Mechanics
- Feature flag: `pro_price_test` with value `control` | `test`.
- Stripe: create both price IDs (prod_pricing_v1 €29, prod_pricing_v2 €24).
- Frontend: inject price dynamically based on flag + user cohort assignment.
- Webhook validation: confirm Stripe MRR matches tracked amount.

---

## Phase 3: Team Tier Validation (Week 5–8)

**Scope**: Soft launch Team tier (€79/mo) + invite early customers for feedback.

### Test Hypothesis
**H3**: "Team tier adoption ≥5% of pro-tier users; median team size ≥2 members."

### Experiment Design

| Arm | Status | Percent | Metrics |
|---|---|---|---|
| **Control** | Team tier hidden (Pro is max) | 70% | Remain on Pro; no upgrade path shown |
| **Test** | Team tier visible + upgrade prompt | 30% | See upgrade CTA in dashboard day 14 |

### Rollout
1. Identify Pro subscribers active >7 days (good retention).
2. Show in-app banner: "Invite team → €79/mo" (test cohort only).
3. Stripe: create Team product & price. Implement upgrade flow (Pro → Team, proration on 30-day cycle).
4. Track:
   - Banner impression + click rate
   - Signup attempt rate
   - Successful upgrade rate
   - Team member invitations (max 5 per plan)

### Success criteria
- ≥10% upgrade click-through (from Pro users shown banner)
- ≥2% actual upgrade conversion (Pro → Team)
- ≥1.5 avg team size (multiple members per workspace)
- Team plan ARPU ≥3.2× Pro ARPU (€79 vs €29 ≈ 2.7×; aim for 3.2× with usage)

### Failure criteria
- <5% banner CTR → revise messaging or position (less prominent).
- <0.5% upgrade conversion → Team features not valuable yet; revisit after retention improves.

---

## Phase 4: Enterprise Direct Sales (Week 9+)

**Scope**: Manual outreach to high-value accounts (5+ team seats, custom integrations).

### Test Hypothesis
**H4**: "≥1 enterprise contract closed per month at 3–5× Team pricing (€250–400/mo)."

### Experiment Design

| Channel | Target | Cadence | Conversion Target |
|---|---|---|---|
| **Inbound** | Trial users with 3+ portfolios | Weekly (top 10 accounts) | ≥5% request Enterprise features |
| **Outbound** | Team users at +50% seat utilization | Bi-weekly (top 5 accounts) | ≥2 conversations → ≥1 deal |

### CRM Workflow
1. Flag accounts in Stripe: `account_segment = "enterprise_lead"`.
2. Export weekly to sales spreadsheet (name, usage, team size, signup date).
3. Sales rep reaches out: "We noticed you're using 4 team seats — custom pricing available."
4. Close: custom contract (email invoice), setup SSO/SAML, dedic support.

### Success criteria
- ≥1 enterprise deal / month (>€250/mo ACV)
- NPS ≥40 (post-contract survey)

---

## Guardrails & Ethical Considerations

### Price Discrimination Safeguards
1. **Cohort assignment**: random, not based on demographics/region (unless explicit feature flagging).
2. **Transparency**: show all users which trial length / price they see (no dark patterns).
3. **Exit option**: always offer churn/downgrade without penalty.

### Sample Size & Power
- Target **80% statistical power** (β=0.2).
- Expected effect size: 15% lift (Cohen's h = 0.315 for 3% vs 3.5% conversion).
- Minimum per-arm: N ≥ 200 conversions.

### Data Privacy
- All event tracking **GDPR-compliant**: hashed user IDs, no IP logging, opt-out mechanism.
- Stripe data retained per contract (typically 7 years for compliance).

---

## Monitoring & Observability

### Real-Time Dashboard
(Build in Metabase, Grafana, or custom dashboard)

```
Phase 1 (Freemium + Trial)
├─ Signups (daily) → 100
├─ Trial starts (daily) → 50
├─ Trial activation (%) → 35%
├─ Trial-to-paid (%) → 3.2%
├─ Paid ARPU (€/mo) → €24.50
└─ 7-day churn (%) → 4.2%

Phase 2 (Pro Price A/B)
├─ Arm A (€29) → 200 conversions, 3.0%, €26/ARPU
├─ Arm B (€24) → 210 conversions, 3.5%, €22/ARPU
├─ Revenue diff → A wins by 5% (not significant, p=0.15)
└─ Recommendation → KEEP €29

Phase 3 (Team Tier)
├─ Team upgrade CTR (%) → 12%
├─ Team conversion (%) → 1.8%
├─ Team avg size → 2.1 members
└─ Team ARPU multiple → 3.0× Pro (on target)
```

### Incident Alerting
- **Conversion drop >30% in 1h** → Slack alert → investigate Stripe/checkout.
- **Churn spike >15% weekly** → review product/UX changes, reach out to churned users.
- **High trial abandonment (>90% D2)** → check email delivery, feature onboarding.

---

## Timeline & Ownership

| Phase | Duration | Owner | Status | Go/No-Go |
|---|---|---|---|---|
| Baseline | 1–2 wks | Eng + Analytics | ⏳ Deploy tracking | — |
| Phase 1 | 1–2 wks | Eng + Growth | ⏳ Freemium + trial launch | Need H1: >3% conv |
| Phase 2 | 1–2 wks | Growth + Data | ⏳ Pro price A/B | Need H2a or H2b |
| Phase 3 | 2–4 wks | Eng + Growth | ⏳ Team tier launch | Need H3: >2% upgrade |
| Phase 4 | Ongoing | Sales | ⏳ Enterprise outreach | Need H4: >€250 ACV |

---

## Appendix: Event Schema (Backend Tracking)

```typescript
// events.ts — centralized event logging

type PricingEvent = 
  | { type: "trial_started"; user_id: string; plan: "pro"; duration_days: 7 }
  | { type: "trial_activated"; user_id: string; features: string[] }
  | { type: "trial_day_email_sent"; user_id: string; day: 3 | 6 }
  | { type: "trial_expired"; user_id: string; converted: boolean }
  | { type: "subscription_created"; user_id: string; plan: "starter" | "pro" | "team"; price: number; billing_cycle: "monthly" | "annual" }
  | { type: "subscription_upgraded"; user_id: string; from: string; to: string }
  | { type: "subscription_churned"; user_id: string; plan: string; reason?: string }
  | { type: "team_member_invited"; workspace_id: string; inviter_id: string; email: string }
  | { type: "team_member_activated"; workspace_id: string; user_id: string }
  | { type: "feature_used"; user_id: string; feature: string; metadata?: Record<string, any> };

// Usage
logEvent({
  type: "subscription_created",
  user_id: "user_123",
  plan: "pro",
  price: 29,
  billing_cycle: "monthly"
});
```

---

## Success Metrics (End of All Phases)

| KPI | Target | Rationale |
|---|---|---|
| **MRR** | €5k–10k | 150–350 paid users at €20–30 avg |
| **CAC** | <€50 | LTV €240 (12 months avg) / 5 LTV:CAC ratio |
| **Trial-to-paid** | ≥3% | Benchmark fintech SaaS |
| **30-day churn** | <5% | Retain 95% cohorts, healthy funnel |
| **ARPU** | €24–30/mo | Mixed Starter/Pro distribution |
| **NPS** | ≥35 | Passable SaaS benchmark (excellent: >50) |

---

**Document Version**: 1.0 | **Last Updated**: 2026-06-10
**Owner**: Growth + Data Team | **Status**: Ready for Phase 0 execution
