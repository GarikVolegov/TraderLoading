# TraderLoadings — project conventions

Monorepo (pnpm): frontend in `artifacts/trader-dashboard` (React + Vite + Wouter + Tailwind, dark only), API Express in `artifacts/api-server` (deployed as single Vercel function `api/index.js`), shared libs in `lib/`. Run all tests with `pnpm run test` from the repo root; typecheck with `pnpm run typecheck`.

## i18n — MANDATORY for every user-facing string

The app supports 5 languages: **it, en, es, fr, de**. Italian is the source language and fallback. There is ONE dictionary: `artifacts/trader-dashboard/src/lib/i18n.ts` (`DICT`, flat keys like `"area.subkey"`).

Rules for ANY new or edited component:

1. **Never hardcode user-visible copy** (labels, titles, tooltips, aria-labels, empty states, errors, toasts). Always go through a translation key.
2. In React components use the hook:
   ```tsx
   import { useLanguage } from "@/contexts/LanguageContext";
   const { t } = useLanguage();
   <Button>{t("billing.upgrade_cta")}</Button>
   t("billing.pro_page.renewal", { date: formatted })   // placeholders: {var}
   ```
   Outside the render/hook context use `uiText(key, vars)` (non-reactive) or the `I18nText` component, both from `@/contexts/LanguageContext`.
3. **Every new key MUST be added to ALL 5 language blocks** of `DICT` (it, en, es, fr, de) with a real translation — not a copy of the Italian text (except proper nouns like "Backtesting", "Pro", "Free").
4. Parity is enforced by `src/lib/i18n.parity.static.test.ts`: same key set in all 5 languages, non-empty values, identical `{placeholder}` sets, no mojibake. It runs in `pnpm run test` — a key added in only one language fails CI.
5. Dates/numbers: never hardcode `"it-IT"` in `Intl.*` — derive the locale from the current language (`useDateLocale()` for date-fns, or map `language` to an Intl locale string).
6. Static tests that assert UI copy should assert against `i18n.ts` (the Italian value or key presence) and/or assert that the component source references the `t("key")` — not against hardcoded strings in component sources.

Exception: the `/admin` area (`pages/Admin.tsx`) is internal and may stay Italian-only.

## Other conventions

- Billing/Pro: plan values are `"free" | "pro"`, price 7 EUR/month via Stripe Embedded Checkout (`ui_mode: "embedded_page"`). Pro gating UI = `ProUpgradeGate` (blurred content + paywall overlay). Server gates return 402 `{ error: "pro_required" }`.
- New pages register lazy routes in `src/App.tsx` (Wouter). Pages use `PageLayout`; modals use the Radix `Dialog` in `src/components/ui/dialog.tsx`.
- Tests are plain `tsx`-run scripts named `*.test.ts` / `*.static.test.ts`, discovered automatically by `pnpm run test`.
