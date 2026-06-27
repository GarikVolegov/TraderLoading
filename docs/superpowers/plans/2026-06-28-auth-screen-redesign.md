# Auth Screen Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the live Clerk auth (sign-in/sign-up) onto the Claude Design auth kit — split brand panel with truthful claims + real-time rating, a segmented sign-in/sign-up toggle, and a skippable post-sign-up nickname step.

**Architecture:** Keep Clerk `<SignIn>/<SignUp>` for the real form, themed via `appearance`. Rewrite `AuthPageShell` (the chrome we own) to match the design. Extend the off-contract `/public/stats` with a server-aggregated rating. Add a gated `/welcome` page that lets the user pick their nickname (`profile.name`) reusing existing profile endpoints. All copy via `t()` across 5 languages.

**Tech Stack:** React 19, Vite, Wouter, Tailwind 4, TanStack React Query v5, framer-motion, lucide-react, Clerk (`@clerk/react`), Express 5 + Drizzle (backend), generated Orval client (`@workspace/api-client-react`).

## Global Constraints

- **Spec:** [docs/superpowers/specs/2026-06-28-auth-screen-redesign-design.md](../specs/2026-06-28-auth-screen-redesign-design.md).
- **i18n enforced:** every key added to `DICT.it` in `lib/i18n.ts` MUST also be added to `en`, `es`, `fr`, `de` (parity test). Visible copy goes through `t()`; never pass a string literal to a `title` prop.
- **No explicit `any`** in non-test source (`@typescript-eslint/no-explicit-any` = error). Tests may use `any`.
- **Tests are plain scripts:** `import assert from "node:assert/strict"` + top-level asserts + a final `console.log(...)`. No `test()`/`describe()`, no RTL. Frontend behaviour is verified by **static source-assertion** tests (`*.static.test.ts` that read the `.tsx` source and regex-match), matching `App.auth.static.test.ts`.
- **Off-contract:** `/public/*` and the rating addition stay OUT of `openapi.yaml`. `/profile*` is already on-contract (reuse the generated client; do **not** regenerate or hand-edit generated files).
- **Brand:** use the `<Rocket>` lucide icon for the logo (rocket rebrand `b0b82c1`), never the literal "TRADERLOADING"/"TRADER…LOADING".
- **pnpm only.** Toolchain may need PATH: `export PATH="$HOME/.local/node/bin:$HOME/Library/pnpm/.tools/pnpm/9.12.0:$PATH"`.
- **Gate:** `pnpm verify` green before declaring done. Don't `prettier --write` api-server files.

---

## File Structure

- `artifacts/api-server/src/services/publicStats.ts` — **new.** Pure `summarizeRatings` helper (testable, no DB).
- `artifacts/api-server/src/services/publicStats.test.ts` — **new.** Unit test for the helper.
- `artifacts/api-server/src/routes/public.ts` — **modify.** Wire the rating aggregate into `GET /public/stats`.
- `artifacts/trader-dashboard/src/lib/i18n.ts` — **modify.** Add `auth.*` keys to all 5 languages.
- `artifacts/trader-dashboard/src/components/AuthPageShell.tsx` — **rewrite.** Brand panel + mode toggle + trust rows + rating fetch.
- `artifacts/trader-dashboard/src/App.tsx` — **modify.** Clerk `appearance`; `SignUp` `fallbackRedirectUrl`; `/welcome` route.
- `artifacts/trader-dashboard/src/pages/NicknameOnboarding.tsx` — **new.** The nickname step.
- `artifacts/trader-dashboard/src/App.auth.static.test.ts` — **modify.** Assert toggle, trust rows, rating, redirect, route.
- `artifacts/trader-dashboard/src/pages/NicknameOnboarding.static.test.ts` — **new.** Assert the step's wiring.

---

## Task 1: Backend — real-time rating on `/public/stats`

**Files:**
- Create: `artifacts/api-server/src/services/publicStats.ts`
- Create: `artifacts/api-server/src/services/publicStats.test.ts`
- Modify: `artifacts/api-server/src/routes/public.ts`

**Interfaces:**
- Produces: `summarizeRatings(ratings: number[]): { average: number; count: number } | null` — `average` rounded to 1 decimal, `null` when the list is empty.
- Produces: `GET /public/stats` JSON gains `rating: { average: number; count: number } | null`.

- [ ] **Step 1: Write the failing test**

Create `artifacts/api-server/src/services/publicStats.test.ts`:

```ts
import assert from "node:assert/strict";
import { summarizeRatings } from "./publicStats.ts";

// Empty → null (so the UI hides the row, never fabricates a score).
assert.equal(summarizeRatings([]), null);

// Average rounded to 1 decimal + exact count.
assert.deepEqual(summarizeRatings([5, 4, 5]), { average: 4.7, count: 3 });
assert.deepEqual(summarizeRatings([5, 5, 5, 5]), { average: 5, count: 4 });
assert.deepEqual(summarizeRatings([4, 3]), { average: 3.5, count: 2 });

console.log("publicStats summarizeRatings checks passed");
```

- [ ] **Step 2: Run test to verify it fails**

```bash
export PATH="$HOME/.local/node/bin:$HOME/Library/pnpm/.tools/pnpm/9.12.0:$PATH"
cd artifacts/api-server && pnpm exec tsx src/services/publicStats.test.ts
```
Expected: FAIL — cannot find module `./publicStats.ts`.

- [ ] **Step 3: Write minimal implementation**

Create `artifacts/api-server/src/services/publicStats.ts`:

```ts
export function summarizeRatings(ratings: number[]): { average: number; count: number } | null {
  if (ratings.length === 0) return null;
  const sum = ratings.reduce((acc, r) => acc + r, 0);
  const average = Math.round((sum / ratings.length) * 10) / 10;
  return { average, count: ratings.length };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd artifacts/api-server && pnpm exec tsx src/services/publicStats.test.ts
```
Expected: PASS — "publicStats summarizeRatings checks passed".

- [ ] **Step 5: Wire the aggregate into the route**

In `artifacts/api-server/src/routes/public.ts`, add the import near the top (after the existing `logger` import):

```ts
import { summarizeRatings } from "../services/publicStats.js";
```

Replace the `GET /public/stats` handler body so it also reads published ratings:

```ts
router.get("/public/stats", async (_req, res) => {
  try {
    const [traderRows, tradeRows, ratingRows] = await Promise.all([
      db.select({ value: count() }).from(usersTable),
      db.select({ value: count() }).from(accountTradesTable),
      db
        .select({ rating: testimonialsTable.rating })
        .from(testimonialsTable)
        .where(eq(testimonialsTable.published, true)),
    ]);
    res.json({
      traders: Number(traderRows[0]?.value ?? 0),
      trades: Number(tradeRows[0]?.value ?? 0),
      pairs: PAIR_CATALOG.length,
      rating: summarizeRatings(ratingRows.map((row) => Number(row.rating))),
    });
  } catch (error) {
    logger.warn({ err: error }, "public stats unavailable");
    res.status(503).json({ error: "stats unavailable" });
  }
});
```

(`eq` and `testimonialsTable` are already imported in this file.)

- [ ] **Step 6: Verify typecheck + test**

```bash
export PATH="$HOME/.local/node/bin:$HOME/Library/pnpm/.tools/pnpm/9.12.0:$PATH"
cd artifacts/api-server && pnpm exec tsc --noEmit && pnpm exec tsx src/services/publicStats.test.ts
```
Expected: no tsc errors; test PASS.

- [ ] **Step 7: Commit**

```bash
git add artifacts/api-server/src/services/publicStats.ts artifacts/api-server/src/services/publicStats.test.ts artifacts/api-server/src/routes/public.ts
git commit -m "feat(api): real-time testimonial rating on /public/stats"
```

---

## Task 2: i18n — add `auth.*` keys to all 5 languages

**Files:**
- Modify: `artifacts/trader-dashboard/src/lib/i18n.ts`

**Interfaces:**
- Produces: translation keys `auth.shell.*`, `auth.toggle.*`, `auth.nickname.*` available to `t()` in every `SUPPORTED_LANGUAGE`.

- [ ] **Step 1: Add the Italian keys**

In `lib/i18n.ts`, inside the `it` dictionary object (`DICT.it`), add this block (anywhere among its keys, e.g. right after the `landing.*` keys):

```ts
    "auth.shell.brand.tagline": "Command Center",
    "auth.shell.signin.eyebrow": "Accedi",
    "auth.shell.signin.title": "Bentornato",
    "auth.shell.signin.body": "Riprendi il tuo Command Center.",
    "auth.shell.signup.eyebrow": "Crea account",
    "auth.shell.signup.title": "Fai trading rispettando il metodo.",
    "auth.shell.signup.body": "Inizia gratis. Nessuna carta richiesta.",
    "auth.shell.trust.e2ee.title": "Chat cifrate end-to-end",
    "auth.shell.trust.e2ee.desc": "Leggi solo tu e il destinatario.",
    "auth.shell.trust.readonly.title": "Sync in sola lettura",
    "auth.shell.trust.readonly.desc": "Colleghiamo MT4/MT5 con password investor.",
    "auth.shell.trust.gdpr.title": "Conforme al GDPR",
    "auth.shell.trust.gdpr.desc": "Dati nell'UE, cancellabili in un clic.",
    "auth.shell.social.reviews": "recensioni",
    "auth.shell.footer.secure": "Connessione protetta · le tue chat sono cifrate end-to-end",
    "auth.shell.legal.intro": "Continuando accetti i",
    "auth.shell.legal.terms": "Termini",
    "auth.shell.legal.privacy": "Privacy",
    "auth.toggle.signin": "Accedi",
    "auth.toggle.signup": "Registrati",
    "auth.nickname.eyebrow": "Quasi fatto",
    "auth.nickname.title": "Scegli il tuo nickname",
    "auth.nickname.subtitle": "È il nome con cui ti vedono gli altri trader. Potrai cambiarlo dopo.",
    "auth.nickname.label": "Nickname",
    "auth.nickname.placeholder": "Es. PipHunter",
    "auth.nickname.available": "Disponibile",
    "auth.nickname.taken": "Già in uso",
    "auth.nickname.checking": "Controllo…",
    "auth.nickname.continue": "Continua",
    "auth.nickname.skip": "Salta per ora",
```

- [ ] **Step 2: Add the English keys** (in the `en` dictionary object):

```ts
    "auth.shell.brand.tagline": "Command Center",
    "auth.shell.signin.eyebrow": "Sign in",
    "auth.shell.signin.title": "Welcome back",
    "auth.shell.signin.body": "Pick up your Command Center where you left off.",
    "auth.shell.signup.eyebrow": "Create account",
    "auth.shell.signup.title": "Trade by your method.",
    "auth.shell.signup.body": "Start free. No card required.",
    "auth.shell.trust.e2ee.title": "End-to-end encrypted chat",
    "auth.shell.trust.e2ee.desc": "Only you and the recipient can read it.",
    "auth.shell.trust.readonly.title": "Read-only sync",
    "auth.shell.trust.readonly.desc": "We connect MT4/MT5 with the investor password.",
    "auth.shell.trust.gdpr.title": "GDPR compliant",
    "auth.shell.trust.gdpr.desc": "Data in the EU, deletable in one click.",
    "auth.shell.social.reviews": "reviews",
    "auth.shell.footer.secure": "Secure connection · your chats are end-to-end encrypted",
    "auth.shell.legal.intro": "By continuing you accept the",
    "auth.shell.legal.terms": "Terms",
    "auth.shell.legal.privacy": "Privacy",
    "auth.toggle.signin": "Sign in",
    "auth.toggle.signup": "Sign up",
    "auth.nickname.eyebrow": "Almost there",
    "auth.nickname.title": "Choose your nickname",
    "auth.nickname.subtitle": "It's how other traders see you. You can change it later.",
    "auth.nickname.label": "Nickname",
    "auth.nickname.placeholder": "e.g. PipHunter",
    "auth.nickname.available": "Available",
    "auth.nickname.taken": "Already taken",
    "auth.nickname.checking": "Checking…",
    "auth.nickname.continue": "Continue",
    "auth.nickname.skip": "Skip for now",
```

- [ ] **Step 3: Add the Spanish keys** (in the `es` dictionary object):

```ts
    "auth.shell.brand.tagline": "Command Center",
    "auth.shell.signin.eyebrow": "Entrar",
    "auth.shell.signin.title": "Bienvenido de nuevo",
    "auth.shell.signin.body": "Retoma tu Command Center.",
    "auth.shell.signup.eyebrow": "Crear cuenta",
    "auth.shell.signup.title": "Opera siguiendo tu método.",
    "auth.shell.signup.body": "Empieza gratis. Sin tarjeta.",
    "auth.shell.trust.e2ee.title": "Chat cifrado de extremo a extremo",
    "auth.shell.trust.e2ee.desc": "Solo tú y el destinatario podéis leerlo.",
    "auth.shell.trust.readonly.title": "Sincronización de solo lectura",
    "auth.shell.trust.readonly.desc": "Conectamos MT4/MT5 con contraseña investor.",
    "auth.shell.trust.gdpr.title": "Conforme al RGPD",
    "auth.shell.trust.gdpr.desc": "Datos en la UE, borrables con un clic.",
    "auth.shell.social.reviews": "reseñas",
    "auth.shell.footer.secure": "Conexión segura · tus chats están cifrados de extremo a extremo",
    "auth.shell.legal.intro": "Al continuar aceptas los",
    "auth.shell.legal.terms": "Términos",
    "auth.shell.legal.privacy": "Privacidad",
    "auth.toggle.signin": "Entrar",
    "auth.toggle.signup": "Regístrate",
    "auth.nickname.eyebrow": "Casi listo",
    "auth.nickname.title": "Elige tu nickname",
    "auth.nickname.subtitle": "Es como te verán otros traders. Podrás cambiarlo luego.",
    "auth.nickname.label": "Nickname",
    "auth.nickname.placeholder": "Ej. PipHunter",
    "auth.nickname.available": "Disponible",
    "auth.nickname.taken": "Ya en uso",
    "auth.nickname.checking": "Comprobando…",
    "auth.nickname.continue": "Continuar",
    "auth.nickname.skip": "Omitir por ahora",
```

- [ ] **Step 4: Add the French keys** (in the `fr` dictionary object):

```ts
    "auth.shell.brand.tagline": "Command Center",
    "auth.shell.signin.eyebrow": "Connexion",
    "auth.shell.signin.title": "Bon retour",
    "auth.shell.signin.body": "Reprenez votre Command Center.",
    "auth.shell.signup.eyebrow": "Créer un compte",
    "auth.shell.signup.title": "Tradez selon votre méthode.",
    "auth.shell.signup.body": "Commencez gratuitement. Sans carte.",
    "auth.shell.trust.e2ee.title": "Chat chiffré de bout en bout",
    "auth.shell.trust.e2ee.desc": "Vous seul et le destinataire pouvez lire.",
    "auth.shell.trust.readonly.title": "Synchro en lecture seule",
    "auth.shell.trust.readonly.desc": "Nous connectons MT4/MT5 avec le mot de passe investisseur.",
    "auth.shell.trust.gdpr.title": "Conforme au RGPD",
    "auth.shell.trust.gdpr.desc": "Données dans l'UE, supprimables en un clic.",
    "auth.shell.social.reviews": "avis",
    "auth.shell.footer.secure": "Connexion sécurisée · vos chats sont chiffrés de bout en bout",
    "auth.shell.legal.intro": "En continuant, vous acceptez les",
    "auth.shell.legal.terms": "Conditions",
    "auth.shell.legal.privacy": "Confidentialité",
    "auth.toggle.signin": "Connexion",
    "auth.toggle.signup": "S'inscrire",
    "auth.nickname.eyebrow": "Presque fini",
    "auth.nickname.title": "Choisissez votre pseudo",
    "auth.nickname.subtitle": "C'est ainsi que les autres traders vous verront. Modifiable plus tard.",
    "auth.nickname.label": "Pseudo",
    "auth.nickname.placeholder": "Ex. PipHunter",
    "auth.nickname.available": "Disponible",
    "auth.nickname.taken": "Déjà pris",
    "auth.nickname.checking": "Vérification…",
    "auth.nickname.continue": "Continuer",
    "auth.nickname.skip": "Passer pour l'instant",
```

- [ ] **Step 5: Add the German keys** (in the `de` dictionary object):

```ts
    "auth.shell.brand.tagline": "Command Center",
    "auth.shell.signin.eyebrow": "Anmelden",
    "auth.shell.signin.title": "Willkommen zurück",
    "auth.shell.signin.body": "Mach mit deinem Command Center weiter.",
    "auth.shell.signup.eyebrow": "Konto erstellen",
    "auth.shell.signup.title": "Trade nach deiner Methode.",
    "auth.shell.signup.body": "Kostenlos starten. Keine Karte nötig.",
    "auth.shell.trust.e2ee.title": "Ende-zu-Ende-verschlüsselter Chat",
    "auth.shell.trust.e2ee.desc": "Nur du und der Empfänger könnt mitlesen.",
    "auth.shell.trust.readonly.title": "Schreibgeschützte Sync",
    "auth.shell.trust.readonly.desc": "Wir verbinden MT4/MT5 mit dem Investor-Passwort.",
    "auth.shell.trust.gdpr.title": "DSGVO-konform",
    "auth.shell.trust.gdpr.desc": "Daten in der EU, mit einem Klick löschbar.",
    "auth.shell.social.reviews": "Bewertungen",
    "auth.shell.footer.secure": "Sichere Verbindung · deine Chats sind Ende-zu-Ende-verschlüsselt",
    "auth.shell.legal.intro": "Mit dem Fortfahren akzeptierst du die",
    "auth.shell.legal.terms": "Nutzungsbedingungen",
    "auth.shell.legal.privacy": "Datenschutz",
    "auth.toggle.signin": "Anmelden",
    "auth.toggle.signup": "Registrieren",
    "auth.nickname.eyebrow": "Fast geschafft",
    "auth.nickname.title": "Wähle deinen Nicknamen",
    "auth.nickname.subtitle": "So sehen dich andere Trader. Du kannst ihn später ändern.",
    "auth.nickname.label": "Nickname",
    "auth.nickname.placeholder": "z. B. PipHunter",
    "auth.nickname.available": "Verfügbar",
    "auth.nickname.taken": "Bereits vergeben",
    "auth.nickname.checking": "Prüfe…",
    "auth.nickname.continue": "Weiter",
    "auth.nickname.skip": "Vorerst überspringen",
```

- [ ] **Step 6: Verify i18n parity passes**

```bash
export PATH="$HOME/.local/node/bin:$HOME/Library/pnpm/.tools/pnpm/9.12.0:$PATH"
cd artifacts/trader-dashboard && pnpm exec tsx src/lib/i18n.parity.static.test.ts
```
Expected: PASS (parity check green — all langs have the new keys).

- [ ] **Step 7: Commit**

```bash
git add artifacts/trader-dashboard/src/lib/i18n.ts
git commit -m "feat(i18n): auth shell, toggle and nickname keys (5 langs)"
```

---

## Task 3: AuthPageShell rewrite (brand panel + toggle + trust rows + rating)

**Files:**
- Modify (rewrite): `artifacts/trader-dashboard/src/components/AuthPageShell.tsx`
- Modify: `artifacts/trader-dashboard/src/App.auth.static.test.ts`

**Interfaces:**
- Consumes: `t()` keys from Task 2; `GET /api/public/stats` `rating` from Task 1.
- Produces: `AuthPageShell({ mode, children })` unchanged public signature (`mode: "sign-in" | "sign-up"`).

- [ ] **Step 1: Write the failing test (extend the static test)**

In `artifacts/trader-dashboard/src/App.auth.static.test.ts`, add these assertions **before** the final `console.log(...)`:

```ts
// Segmented mode toggle: two links, one per auth route.
assert.match(shell, /href="\/sign-in"/, "shell must have a sign-in toggle link");
assert.match(shell, /href="\/sign-up"/, "shell must have a sign-up toggle link");
assert.match(shell, /auth\.toggle\.signin/, "shell must render the sign-in toggle label via t()");
assert.match(shell, /auth\.toggle\.signup/, "shell must render the sign-up toggle label via t()");

// Truthful trust rows (chat-only E2EE, read-only sync, GDPR) via i18n keys.
assert.match(shell, /auth\.shell\.trust\.e2ee\.title/);
assert.match(shell, /auth\.shell\.trust\.readonly\.title/);
assert.match(shell, /auth\.shell\.trust\.gdpr\.title/);

// Real-time rating, hidden when absent — never a hardcoded score.
assert.match(shell, /rating\?\.count|rating\.count > 0|rating && rating\.count/, "rating row must be guarded on real data");
assert.match(shell, /public\/stats/, "shell must fetch the public stats for the rating");
assert.doesNotMatch(shell, /4\.9\/5/, "no fabricated rating literal");

// Copy is i18n'd, not hardcoded marketing.
assert.match(shell, /useLanguage|t\(/, "shell copy must go through t()");
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
export PATH="$HOME/.local/node/bin:$HOME/Library/pnpm/.tools/pnpm/9.12.0:$PATH"
cd artifacts/trader-dashboard && pnpm exec tsx src/App.auth.static.test.ts
```
Expected: FAIL (assertions about toggle/trust/rating not yet present).

- [ ] **Step 3: Rewrite the component**

Replace the entire contents of `artifacts/trader-dashboard/src/components/AuthPageShell.tsx` with:

```tsx
import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Eye, MessagesSquare, Rocket, ShieldCheck, Star } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

type AuthPageShellProps = {
  mode: "sign-in" | "sign-up";
  children: ReactNode;
};

interface PublicStatsResponse {
  traders: number;
  trades: number;
  pairs: number;
  rating: { average: number; count: number } | null;
}

async function fetchPublicStats(): Promise<PublicStatsResponse> {
  const res = await fetch("/api/public/stats");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<PublicStatsResponse>;
}

export function AuthPageShell({ mode, children }: AuthPageShellProps) {
  const { t } = useLanguage();
  const isSignIn = mode === "sign-in";

  const { data: stats } = useQuery({
    queryKey: ["auth", "public-stats"],
    queryFn: fetchPublicStats,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  const rating = stats?.rating ?? null;

  const eyebrow = isSignIn ? t("auth.shell.signin.eyebrow") : t("auth.shell.signup.eyebrow");
  const title = isSignIn ? t("auth.shell.signin.title") : t("auth.shell.signup.title");
  const body = isSignIn ? t("auth.shell.signin.body") : t("auth.shell.signup.body");

  const trust = [
    { icon: MessagesSquare, title: t("auth.shell.trust.e2ee.title"), desc: t("auth.shell.trust.e2ee.desc") },
    { icon: Eye, title: t("auth.shell.trust.readonly.title"), desc: t("auth.shell.trust.readonly.desc") },
    { icon: ShieldCheck, title: t("auth.shell.trust.gdpr.title"), desc: t("auth.shell.trust.gdpr.desc") },
  ];

  const toggleBase =
    "rounded-lg py-2 text-center text-sm font-semibold transition-colors";
  const toggleActive =
    "bg-primary text-primary-foreground shadow-[0_0_18px_hsl(var(--primary)/0.25)]";
  const toggleIdle = "text-muted-foreground hover:text-foreground";

  return (
    <main className="relative flex min-h-[100dvh] items-center overflow-hidden bg-background px-4 py-6 text-foreground sm:px-6 lg:px-10">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_30%_18%,hsl(var(--primary)/0.10),transparent_70%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,hsl(var(--background))_0%,hsl(224_55%_5%)_72%,hsl(var(--background))_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(hsl(var(--border)/0.08)_1px,transparent_1px),linear-gradient(90deg,hsl(var(--border)/0.06)_1px,transparent_1px)] bg-[size:46px_46px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] as const }}
        className="relative z-10 mx-auto grid w-full max-w-6xl items-center gap-8 lg:grid-cols-[1.04fr_0.96fr] lg:gap-10"
      >
        {/* Brand panel (hidden on mobile, per the design's @media max-width:880px) */}
        <section className="mx-auto hidden w-full max-w-xl flex-col gap-7 lg:flex">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl border border-primary/35 bg-primary/10 text-primary shadow-[0_0_24px_hsl(var(--primary)/0.12)]">
              <Rocket className="h-5 w-5" aria-label="Logo TraderLoading" />
            </div>
            <div className="min-w-0">
              <p className="font-mono text-base font-bold tracking-tight text-foreground">TraderLoading</p>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/75">
                {t("auth.shell.brand.tagline")}
              </p>
            </div>
          </div>

          <div>
            <span className="mb-3 inline-block text-[11px] font-bold uppercase tracking-[0.16em] text-primary">
              {eyebrow}
            </span>
            <h1 className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text font-mono text-4xl font-extrabold leading-[1.1] tracking-tight text-transparent lg:text-5xl">
              {title}
            </h1>
            <p className="mt-4 max-w-md text-base leading-relaxed text-muted-foreground">{body}</p>
          </div>

          <div className="flex flex-col gap-3.5">
            {trust.map(({ icon: Icon, title: rowTitle, desc }) => (
              <div key={rowTitle} className="flex items-start gap-3">
                <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                  <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{rowTitle}</p>
                  <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">{desc}</p>
                </div>
              </div>
            ))}
          </div>

          {rating && rating.count > 0 && (
            <div className="flex items-center gap-2.5 border-t border-border/60 pt-4 text-[13px] text-muted-foreground">
              <span className="inline-flex gap-0.5 text-warning">
                {[0, 1, 2, 3, 4].map((i) => (
                  <Star key={i} className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                ))}
              </span>
              <span>
                <strong className="font-mono font-bold text-foreground">{rating.average.toFixed(1)}/5</strong> ·{" "}
                {rating.count} {t("auth.shell.social.reviews")}
              </span>
            </div>
          )}
        </section>

        {/* Form card */}
        <section className="mx-auto w-full max-w-[460px] lg:justify-self-end">
          <div className="rounded-2xl border border-border/60 bg-card/90 p-4 shadow-[0_28px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:p-5">
            <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl border border-border/50 bg-secondary/40 p-1">
              <Link href="/sign-in" className={`${toggleBase} ${isSignIn ? toggleActive : toggleIdle}`}>
                {t("auth.toggle.signin")}
              </Link>
              <Link href="/sign-up" className={`${toggleBase} ${!isSignIn ? toggleActive : toggleIdle}`}>
                {t("auth.toggle.signup")}
              </Link>
            </div>

            {children}

            <p className="mt-4 text-center text-xs leading-5 text-muted-foreground/80">
              {t("auth.shell.legal.intro")}{" "}
              <Link href="/terms" className="font-semibold text-primary hover:text-primary/80">
                {t("auth.shell.legal.terms")}
              </Link>{" "}
              ·{" "}
              <Link href="/privacy" className="font-semibold text-primary hover:text-primary/80">
                {t("auth.shell.legal.privacy")}
              </Link>
            </p>
            <p className="mt-3 flex items-center justify-center gap-1.5 border-t border-border/50 pt-3 text-center text-xs text-muted-foreground/80">
              <ShieldCheck className="h-3.5 w-3.5 flex-shrink-0 text-primary" aria-hidden="true" />
              {t("auth.shell.footer.secure")}
            </p>
          </div>
        </section>
      </motion.div>
    </main>
  );
}
```

- [ ] **Step 4: Run the static test to verify it passes**

```bash
cd artifacts/trader-dashboard && pnpm exec tsx src/App.auth.static.test.ts
```
Expected: PASS — "app auth shell static checks passed".

- [ ] **Step 5: Typecheck the dashboard**

```bash
cd artifacts/trader-dashboard && pnpm exec tsc --noEmit
```
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add artifacts/trader-dashboard/src/components/AuthPageShell.tsx artifacts/trader-dashboard/src/App.auth.static.test.ts
git commit -m "feat(auth): rebuild AuthPageShell on Claude Design — toggle, trust rows, live rating"
```

---

## Task 4: Clerk appearance — align the themed form to the design

**Files:**
- Modify: `artifacts/trader-dashboard/src/App.tsx` (the `clerkAppearance` object, ~lines 100-149)

**Interfaces:**
- Consumes: nothing new. Keeps `header`/`footer`/`logoBox` hidden (asserted by `App.auth.static.test.ts`).

- [ ] **Step 1: Update the appearance elements**

In `artifacts/trader-dashboard/src/App.tsx`, in the `clerkAppearance.elements` object, replace these entries so the OAuth/input/button styling matches the glass design (jade primary, secondary-tinted inputs, rounded-xl, divider). Keep `header: "!hidden"`, `footer: "!hidden"`, `logoBox: "!hidden"` unchanged:

```ts
    socialButtonsBlockButton:
      "!border-[#334155] hover:!border-[#22c55e]/50 !bg-[#0d1527]/70 !rounded-xl backdrop-blur",
    formButtonPrimary:
      "!bg-[#22c55e] !text-[#031a0d] hover:!bg-[#4ade80] font-bold !rounded-xl !shadow-[0_10px_22px_rgba(34,197,94,0.18)]",
    formFieldInput:
      "!bg-[#0d1527]/70 !border-[#334155] !text-[#f8fafc] focus:!border-[#22c55e] focus:!ring-1 focus:!ring-[#22c55e]/40 !rounded-xl",
    otpCodeFieldInput:
      "!bg-[#0d1527]/70 !border-[#334155] !text-[#f8fafc] focus:!border-[#22c55e] !rounded-xl",
    dividerLine: "!bg-[#334155]/70",
    alert: "!bg-[#1f0d12] !border-[#ef4444]/35 !rounded-xl",
```

Also bump the shared radius variable in `clerkAppearance.variables` for consistency:

```ts
    borderRadius: "0.75rem",
```

- [ ] **Step 2: Verify the static auth test still passes** (header/footer/logo still hidden)

```bash
export PATH="$HOME/.local/node/bin:$HOME/Library/pnpm/.tools/pnpm/9.12.0:$PATH"
cd artifacts/trader-dashboard && pnpm exec tsx src/App.auth.static.test.ts && pnpm exec tsc --noEmit
```
Expected: PASS + no tsc errors.

- [ ] **Step 3: Commit**

```bash
git add artifacts/trader-dashboard/src/App.tsx
git commit -m "feat(auth): theme Clerk form to the glass/jade design"
```

---

## Task 5: Nickname onboarding step (`/welcome`)

**Files:**
- Create: `artifacts/trader-dashboard/src/pages/NicknameOnboarding.tsx`
- Create: `artifacts/trader-dashboard/src/pages/NicknameOnboarding.static.test.ts`
- Modify: `artifacts/trader-dashboard/src/App.tsx` (add `Redirect` import, `WelcomePage`, `/welcome` route, `SignUp` `fallbackRedirectUrl`)
- Modify: `artifacts/trader-dashboard/src/App.auth.static.test.ts` (assert redirect + route)

**Interfaces:**
- Consumes: generated client `useGetProfile`, `useUpdateProfile`, `getGetProfileQueryKey`, `checkProfileName`; `t()` keys from Task 2.
- Produces: `NicknameOnboarding()` component; `/welcome` route gated to signed-in users; sign-up redirects here.

- [ ] **Step 1: Write the failing static test**

Create `artifacts/trader-dashboard/src/pages/NicknameOnboarding.static.test.ts`:

```ts
import assert from "node:assert/strict";
import fs from "node:fs";

const src = fs.readFileSync("src/pages/NicknameOnboarding.tsx", "utf8");
const app = fs.readFileSync("src/App.tsx", "utf8");

// Reuses the existing profile endpoints — no new backend.
assert.match(src, /checkProfileName/, "must check nickname availability live");
assert.match(src, /useUpdateProfile/, "must save via PUT /profile");
assert.match(src, /@workspace\/api-client-react/, "must use the generated client");

// Copy via i18n.
assert.match(src, /auth\.nickname\.title/);
assert.match(src, /auth\.nickname\.skip/);

// Skippable: a skip path navigates home without forcing a save.
assert.match(src, /setLocation\("\/"\)/, "skip/continue navigates to the app home");

// Wiring: sign-up lands here; the route exists and is gated.
assert.match(app, /<SignUp[\s\S]*fallbackRedirectUrl=\{`\$\{basePath\}\/welcome`\}/, "sign-up must redirect to /welcome");
assert.match(app, /path="\/welcome"/, "the /welcome route must exist");
assert.match(app, /NicknameOnboarding/, "the /welcome route must render NicknameOnboarding");

console.log("nickname onboarding static checks passed");
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
export PATH="$HOME/.local/node/bin:$HOME/Library/pnpm/.tools/pnpm/9.12.0:$PATH"
cd artifacts/trader-dashboard && pnpm exec tsx src/pages/NicknameOnboarding.static.test.ts
```
Expected: FAIL — cannot read `src/pages/NicknameOnboarding.tsx`.

- [ ] **Step 3: Create the component**

Create `artifacts/trader-dashboard/src/pages/NicknameOnboarding.tsx`:

```tsx
import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Check, Loader2, Rocket, X } from "lucide-react";
import {
  useGetProfile,
  useUpdateProfile,
  getGetProfileQueryKey,
  checkProfileName,
} from "@workspace/api-client-react";
import { useLanguage } from "@/contexts/LanguageContext";

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export function NicknameOnboarding() {
  const { t } = useLanguage();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { data: profile } = useGetProfile({ query: { queryKey: getGetProfileQueryKey() } });

  const [name, setName] = useState("");
  const [available, setAvailable] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);
  const debounced = useDebounce(name.trim(), 300);

  const goHome = useCallback(() => setLocation("/"), [setLocation]);

  const updateProfile = useUpdateProfile({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() });
        goHome();
      },
      onError: (err: unknown) => {
        if (
          err &&
          typeof err === "object" &&
          "status" in err &&
          (err as Record<string, unknown>).status === 409
        ) {
          setAvailable(false);
        }
      },
    },
  });

  const check = useCallback(async (value: string) => {
    if (!value) {
      setAvailable(null);
      return;
    }
    setChecking(true);
    try {
      const res = await checkProfileName({ name: value });
      setAvailable(res.available);
    } catch {
      setAvailable(null);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    check(debounced);
  }, [debounced, check]);

  const canSubmit = name.trim().length > 0 && available !== false && !updateProfile.isPending;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    updateProfile.mutate({
      data: {
        name: name.trim(),
        avatarUrl: profile?.avatarUrl ?? null,
        yearsExperience: profile?.yearsExperience ?? null,
      },
    });
  };

  return (
    <main className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-background px-4 py-6 text-foreground">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_15%,hsl(var(--primary)/0.10),transparent_70%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,hsl(var(--background))_0%,hsl(224_55%_5%)_72%,hsl(var(--background))_100%)]" />
      </div>

      <div className="relative z-10 w-full max-w-[440px] rounded-2xl border border-border/60 bg-card/90 p-6 shadow-[0_28px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:p-8">
        <div className="mb-5 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl border border-primary/35 bg-primary/10 text-primary shadow-[0_0_24px_hsl(var(--primary)/0.12)]">
            <Rocket className="h-5 w-5" aria-label="Logo TraderLoading" />
          </div>
          <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary">
            {t("auth.nickname.eyebrow")}
          </span>
        </div>

        <h1 className="font-mono text-2xl font-extrabold tracking-tight text-foreground">
          {t("auth.nickname.title")}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t("auth.nickname.subtitle")}</p>

        <form onSubmit={handleSubmit} className="mt-6">
          <label className="block">
            <span className="mb-2 block text-xs font-semibold text-muted-foreground">
              {t("auth.nickname.label")}
            </span>
            <div className="relative">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("auth.nickname.placeholder")}
                autoFocus
                className="w-full rounded-lg border border-border bg-secondary/40 px-3 py-2.5 pr-10 text-sm text-foreground outline-none transition-colors focus:border-primary/55"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2">
                {checking && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />}
                {!checking && available === true && <Check className="h-4 w-4 text-primary" aria-hidden="true" />}
                {!checking && available === false && <X className="h-4 w-4 text-red-400" aria-hidden="true" />}
              </span>
            </div>
            <span className="mt-1.5 block h-4 text-xs">
              {checking && <span className="text-muted-foreground">{t("auth.nickname.checking")}</span>}
              {!checking && available === true && <span className="text-primary">{t("auth.nickname.available")}</span>}
              {!checking && available === false && <span className="text-red-400">{t("auth.nickname.taken")}</span>}
            </span>
          </label>

          <button
            type="submit"
            disabled={!canSubmit}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-bold text-primary-foreground shadow-[0_10px_22px_hsl(var(--primary)/0.14)] transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {updateProfile.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <>
                {t("auth.nickname.continue")}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </>
            )}
          </button>
          <button
            type="button"
            onClick={goHome}
            className="mt-3 block w-full text-center text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            {t("auth.nickname.skip")}
          </button>
        </form>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Wire the route + redirect in `App.tsx`**

(a) Add `Redirect` to the wouter import and import the page. The existing wouter import is `import { Switch, Route, ... } from "wouter";` — add `Redirect`. Near the other page imports add:

```tsx
import { NicknameOnboarding } from "./pages/NicknameOnboarding";
```

(b) Add a gated wrapper component near `SignUpPage` (mirrors the `AppShell` `<Show>` gating):

```tsx
function WelcomePage() {
  return (
    <>
      <Show when="signed-in">
        <NicknameOnboarding />
      </Show>
      <Show when="signed-out">
        <Redirect to="/sign-in" />
      </Show>
    </>
  );
}
```

(c) In `SignUpPage`, change the `<SignUp>` redirect to `/welcome`:

```tsx
function SignUpPage() {
  return (
    <AuthPageShell mode="sign-up">
      <SignUp
        routing="path"
        path={`${basePath}/sign-up`}
        signInUrl={`${basePath}/sign-in`}
        fallbackRedirectUrl={`${basePath}/welcome`}
      />
    </AuthPageShell>
  );
}
```

(d) Add the route inside the `<Switch>` (before the `/*?` catch-all at line ~459):

```tsx
          <Route path="/welcome" component={WelcomePage} />
```

- [ ] **Step 5: Add the redirect/route assertions to the auth static test**

These are already part of Step 1's `NicknameOnboarding.static.test.ts`. No change to `App.auth.static.test.ts` is required, but verify the existing `App.auth.static.test.ts` still passes (sign-up `path` assertion is unaffected by adding `fallbackRedirectUrl`).

- [ ] **Step 6: Run both static tests + typecheck**

```bash
export PATH="$HOME/.local/node/bin:$HOME/Library/pnpm/.tools/pnpm/9.12.0:$PATH"
cd artifacts/trader-dashboard && \
  pnpm exec tsx src/pages/NicknameOnboarding.static.test.ts && \
  pnpm exec tsx src/App.auth.static.test.ts && \
  pnpm exec tsc --noEmit
```
Expected: both static tests PASS; no tsc errors.

- [ ] **Step 7: Commit**

```bash
git add artifacts/trader-dashboard/src/pages/NicknameOnboarding.tsx artifacts/trader-dashboard/src/pages/NicknameOnboarding.static.test.ts artifacts/trader-dashboard/src/App.tsx
git commit -m "feat(auth): skippable nickname step after sign-up (/welcome)"
```

---

## Task 6: Full verification gate + docs

**Files:**
- Modify (optional): `CLAUDE.md` §7 if the auth surface migration is worth noting.

- [ ] **Step 1: Run the full gate**

```bash
export PATH="$HOME/.local/node/bin:$HOME/Library/pnpm/.tools/pnpm/9.12.0:$PATH"
pnpm verify
```
Expected: install → codegen (no diff) → typecheck → test → build all green. If codegen reports a diff, you accidentally touched a generated file — revert it (the profile/check-name client already exists; no contract change was made).

- [ ] **Step 2: Manual smoke (optional, if a dev server is available)**

```bash
pnpm start:local
```
Then: `/sign-in` and `/sign-up` show the new split panel + toggle; toggling switches routes; after a real sign-up you land on `/welcome`; typing a taken name shows "Già in uso", a free name shows "Disponibile"; "Continua" saves and lands in the app; "Salta per ora" lands in the app without renaming.

- [ ] **Step 3: Commit any doc update**

```bash
git add CLAUDE.md
git commit -m "docs: note auth surface migrated onto the design system"
```

---

## Self-Review

**Spec coverage:**
- §4.1 brand panel rewrite → Task 3. §4.2 mode toggle → Task 3. §4.3 real-time rating → Task 1 (backend) + Task 3 (frontend). §4.4 Clerk appearance → Task 4. §4.5 nickname step → Task 5. §4.6 i18n → Task 2. Truthful copy table → Task 2 (it) + Task 3 (rendered). Testing §7 → Task 1 unit + Task 3/5 static + Task 6 gate. ✓ All covered.

**Placeholder scan:** No TBD/TODO; every code/test step has full content. ✓

**Type consistency:** `summarizeRatings` signature identical in Task 1 helper, test, and route usage. `PublicStatsResponse.rating` shape (`{ average, count } | null`) matches the backend output. `useUpdateProfile().mutate({ data: { name, avatarUrl, yearsExperience } })` matches the existing `ProfileWidget` usage and the `PUT /profile` body. `useGetProfile`/`getGetProfileQueryKey`/`checkProfileName` names match the generated client imports verified in `ProfileWidget.tsx`. ✓

**Notes for the implementer:** `text-warning` and `text-red-400` are utilities already used in the codebase (`AuthPageShell` legacy / `ProfileWidget`). `<Show when="…">` is Clerk's control component already used in `App.tsx`. `Redirect` is a wouter export. Don't reformat api-server files with prettier.
