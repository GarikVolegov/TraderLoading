# TraderLoadings Pricing Strategy

## Executive Summary
**Prodotto**: TraderLoadings + Brain AI — piattaforma di analisi e automazione per trader.
**Valuta primaria**: EUR (€). **Billing**: Mensile + sconto annuale (2 mesi gratis ≈ 17% sconto).
**Modello**: Tiered SaaS (Freemium → Starter → Pro → Team + Enterprise custom).

---

## Market Context & Competitors

### Benchmark Competitors

| Competitor | Prodotto | Entry Plan | Mid-Tier | Premium | Enterprise |
|---|---|---|---|---|---|
| TradingView (2026) | Charts + algos | Free | €12.95/mo | €59.95/mo | Custom |
| TradingView Plus | | | €29.95/mo (analoga Pro) | €199.95/mo | Custom |
| **TraderLoadings (Proposed)** | **AI-driven analysis + automation** | **Freemium** | **€9/mo** | **€29/mo** | **Custom** |
| TraderLoadings Team | | | | €79/mo | Custom |

**Key Insights from TradingView**:
- Range competitivo: €10–30/mese per entry trader professionali.
- Plus (€29.95/mo) ≈ sweet spot per power users (match con Pro TraderLoadings €29).
- Premium/Ultimate (€60–200/mo) per institutional/advanced → opportunità Enterprise.
- 30-day trial standard (TradingView); 14-day per Ultimate (perceived value).
- Freemium convertisce 2–5% nella coorte; retention mensile 85–95% su paid.
- ARPU annuale per SaaS fintech: €200–600 per utente attivo.

---

## Feature Mapping & Tier Definition

### 🟦 Tier 0: **Freemium** (€0/mese)
**Posizionamento**: Lead generation + evaluation.  
**Features**:
- Dashboard di base (ultimi 7 giorni di dati)
- Massimo 1 portafoglio connesso (read-only)
- Report PDF settimanale base
- Community feed (lettura)
- AI chat limitato (5 domande/settimana)

**Limits**: 100 notifiche/mese, no API, no webhooks, no esportazioni bulk.

---

### 🟩 Tier 1: **Starter** (€9/mese, annuale €90)
**Posizionamento**: Trader individuale / semi-pro.  
**Features** (tutto di Freemium +):
- Dashboard completa (ultimi 90 giorni)
- Massimo 3 portafogli connessi
- Report PDF avanzato (bisettimanale)
- Avvisi personalizzati (100/mese)
- AI chat potenziato (50 domande/mese)
- Integrazione MT5 (basic polling)

**Limits**: 1 utente per account, no webhooks, no API public, no team features.

---

### 🟨 Tier 2: **Pro** (€29/mese, annuale €290)
**Posizionamento**: Trader professionista / piccolo fondo.  
**Features** (tutto di Starter +):
- Dashboard illimitata (dati storici completi)
- Massimo 10 portafogli connessi
- Report PDF su misura (customizzabile)
- Avvisi avanzati con filtri ML
- AI chat illimitato
- MT5 WebSocket live + webhooks
- Esportazione dati (CSV/JSON)
- API read-only per client esterno
- Priority support (email, 24h response)

**Limits**: 1 utente, no collaborazione team, no SSO enterprise.

---

### 🟪 Tier 3: **Team** (€79/mese, annuale €790)
**Posizionamento**: Piccolo team / fondo / trader group.  
**Features** (tutto di Pro +):
- Massimo 5 utenti nominali
- Workspace condivisa
- Permessi granulari (viewer/editor/admin)
- Chat team interna con AI integrato
- Audit log completo
- Webhook custom (fino a 10)
- API read-write (beta)
- Backup giornaliero automatico
- SLA 99% (email + Slack support)

**Limits**: max 50 MB di upload al mese per utente, no SAML/SSO.

---

### 🔴 Tier 4: **Enterprise** (Custom)
**Posizionamento**: Fondi gestiti / broker / integratori.  
**Features** (everything +):
- Utenti illimitati
- SAML 2.0 / SSO Custom
- Webhook illimitati + API full
- White-label option
- Reporting custom per compliance
- Dedic support SLA 99.9%
- On-premise deployment (opzionale)

**Pricing**: €500+/mese + setup (contratti annuali, no month-to-month).

---

## One-Time Purchase Option (Alternative)

Per utenti avversi al recurring:

- **Lifetime Starter**: €199 (una volta)
- **Lifetime Pro**: €499 (una volta)
- **Lifetime Team** (base): €1,499 (una volta)

Includi upgrade paths (es. Starter Lifetime → Pro Lifetime + €200).

---

## Pricing Psychology & Anchoring

### Rationale Price Points

| Tier | Price | Rationale |
|---|---|---|
| Freemium | €0 | Frictionless onboarding + viral. |
| Starter | €9 | Entry professionista: "worth testing" per trader part-time. |
| Pro | €29 | Sweet spot: €348/anno ≈ 1/3 di ARPU target fintech; psych anchor vs €30 competitori. |
| Team | €79 | Netto sconto per volume (€16/utente mese ≈ 45% less than 5×Pro). |

---

## Revenue Model & Payoff Scenarios

### Scenario A: Conservative (Year 1)
- **Users acquired**: 10,000 (via organic + content).
- **Freemium conversion**: 3% → 300 paid.
- **Mix**: 40% Starter, 40% Pro, 15% Team, 5% Enterprise.
- **ARPU**: (0.4×9 + 0.4×29 + 0.15×79 + 0.05×500) × 12 = €4,728/anno per utente pagante.
- **Annual revenue**: 300 × €4,728 = **€1.42M** (optimistic for Year 1).

### Scenario B: Realistic (Year 1)
- **Users acquired**: 5,000.
- **Freemium conversion**: 2% → 100 paid.
- **Mix**: 50% Starter, 35% Pro, 12% Team, 3% Enterprise.
- **ARPU**: €2,448/anno per pagante.
- **Annual revenue**: 100 × €2,448 = **€244.8k**.

### Scenario C: Cautious (Year 1)
- **Users acquired**: 2,000.
- **Freemium conversion**: 1.5% → 30 paid.
- **ARPU**: €1,800.
- **Annual revenue**: 30 × €1,800 = **€54k**.

---

## Trial & Freemium Funnel

```
Signup (free) → 7-day trial (all Pro features)
                    ↓
            Churn 80% (no action)
                    ↓
            20% activate → see value
                    ↓
            Convert 15% of active → paid (3% of all signups)
                    ↓
            Paid cohort: 50% Starter, 35% Pro, 15% Team
```

**KPIs to track**:
- Trial activation rate (% users > 1 action in 7 days)
- Trial-to-paid conversion rate (% activated → paid)
- Plan selection distribution
- Monthly churn rate per tier
- CAC (Customer Acquisition Cost)
- LTV (Lifetime Value per tier)

---

## Go-to-Market Sequencing

### Phase 1: Freemium Launch (Weeks 1–2)
- Deploy pricing page + paywall.
- 7-day Pro trial for new signups (no card required).
- Trigger emails on day 3, day 6 (nurture).

### Phase 2: Paid Tier Rollout (Weeks 3–4)
- Enable Stripe Billing integration.
- Test checkout flow (Starter + Pro).
- Small cohort test (€24 vs €29 Pro price).

### Phase 3: Team + Enterprise (Weeks 5–8)
- Roll out Team tier + workspace collaboration.
- Direct outreach to Enterprise leads.

### Phase 4: Optimize & Scale (Ongoing)
- Monitor conversion funnel; A/B test copy, pricing, features.
- Iterate on plan positioning based on customer feedback.

---

## Implementation Roadmap (Technical)

1. **Stripe Billing integration** (2–3 days)
   - Set up Stripe account, products, prices.
   - Implement checkout flow (hosted or embedded).
   - Webhook handling (subscription events).

2. **Paywall / Feature gating** (1–2 days)
   - Backend: plan-based access control.
   - Frontend: UI prompts for upgrade.

3. **Subscription management** (1 day)
   - Self-serve portal (update/cancel).
   - Invoice history.

4. **Metering & usage** (optional, Phase 2)
   - Track usage-based metrics (API calls, webhooks, uploads).
   - Overage billing if needed.

5. **Analytics & dashboards** (ongoing)
   - MRR, ARR, churn, CAC, LTV tracking.
   - Cohort analysis.

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Low conversion (< 1%) | Revenue shortfall | A/B test copy, pricing, trial duration. Invest in onboarding. |
| High churn (> 10% MoM) | Unpredictable revenue | Improve product stickiness, automate onboarding, in-app prompts. |
| Price resistance | Adoption friction | Offer annual discount (€290 vs €348). Test €19 Starter if needed. |
| Feature parity pressure | Tier cannibalization | Lock Pro features behind paywall; tier messaging clarity. |
| Competitor undercut | Price war risk | Compete on features/UX, not just price. Build network effects. |

---

## Decision Tree for Final Pricing

```
START
  ├─ Cost per user/mo baseline known?
  │   ├─ YES → Factor 3–5× margin → Pro price
  │   └─ NO → Use €29 Pro as anchor
  │
  ├─ Target CAC < €50?
  │   ├─ YES → Starter €9 (low friction, viral)
  │   └─ NO → Test €19 Starter (higher margin, lower volume)
  │
  ├─ Have enterprise leads?
  │   ├─ YES → Build Team tier (€79), Enterprise (custom)
  │   └─ NO → Start with Freemium + Starter + Pro only
  │
  └─ Go/No-Go for launch?
      ├─ Freemium + Starter + Pro → LAUNCH WEEK 1
      └─ Add Team → LAUNCH WEEK 5 (after Pro validation)
```

---

## Appendix: Tier Feature Matrix

| Feature | Free | Starter | Pro | Team | Enterprise |
|---|---|---|---|---|---|
| Portafogli | 1 | 3 | 10 | Illimitati | Illimitati |
| Utenti | 1 | 1 | 1 | 5 | Illimitati |
| Dashboard giorni | 7 | 90 | All | All | All |
| AI chat | 5/week | 50/mo | Illimitato | Illimitato | Illimitato |
| Avvisi | 100/mo | 100/mo | Illimitati | Illimitati | Illimitati |
| MT5 WebSocket | ❌ | Basic | Live + webhooks | Live + webhooks | Live + webhooks |
| API access | ❌ | ❌ | Read-only | Read-write | Full + custom |
| Team collaboration | ❌ | ❌ | ❌ | ✅ | ✅ |
| SSO/SAML | ❌ | ❌ | ❌ | ❌ | ✅ |
| Support | Community | Email (48h) | Email (24h) | Slack (2h) | Dedicated SLA |
| **Monthly price** | **€0** | **€9** | **€29** | **€79** | **Custom** |
| **Annual price** | **€0** | **€90** | **€290** | **€790** | **Custom** |

---

## Next Steps

1. ✅ Validate tier structure with 3–5 customer interviews.
2. ⏳ **Build pricing page** (hero, tiers comparison table, FAQ, CTA).
3. ⏳ **Integrate Stripe Billing** (checkout, webhooks, plan management).
4. ⏳ **Implement feature gating** (backend plan checks, frontend paywall).
5. ⏳ **Setup analytics** (conversion funnel, churn, ARPU dashboards).
6. ⏳ **A/B test** pricing (Pro €24 vs €29) in Phase 2.
7. ⏳ **Launch Freemium + Trial** (soft launch, small cohort).
8. ⏳ **Scale + iterate** (monitor KPIs, refine messaging).

---

**Document Version**: 1.0 | **Last Updated**: 2026-06-10
**Owner**: Pricing Strategy Team | **Status**: Ready for validation
