# Tornei di trading — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a global, quarterly "disciplined trading tournament" section: an opt-in live leaderboard over R-multiple / Discipline from synced real accounts, with divisions, guardrail disqualification, Arena + Percorso views, automatic end-of-season prizes (XP + internal Pro entitlement + on-chain ERC-721 certificate behind a config-gated provider), and an Albo d'oro — ported 1:1 from the Claude Design `templates/tornei/` template.

**Architecture:** New isolated `tornei` domain (`routes/tornei.ts` + `services/tornei/*`) that reads R/Discipline/guardrail numbers from existing pure services (`tradeAnalytics`, `tradeDiscipline`, `riskGuard`) and reuses the existing XP, certificate and entitlement systems. Standings are **materialized** into a table refreshed by a cron + on-demand after account sync, so read endpoints never aggregate `accountTradesTable` at request time. Frontend is a React page under `/tornei` driven by on-contract React Query hooks.

**Tech Stack:** Express 5 + Drizzle (Postgres) + node-cron backend; React 19 + Wouter + TanStack Query frontend; node:test + node:assert/strict for tests; Orval contract codegen from hand-authored `openapi.yaml`; `ethers` (added) for the on-chain mint leg.

## Global Constraints

- **Toolchain:** Node 24, pnpm 9.12.0 only (preinstall guard rejects npm/yarn). Export PATH for node/pnpm in this env (`~/.local/node/bin`, `~/Library/pnpm/.tools/pnpm/9.12.0`).
- **TS strict; `@typescript-eslint/no-explicit-any` = error** in non-test source (tests may use `any`).
- **Contract flow:** hand-author `lib/api-spec/openapi.yaml`, then `pnpm codegen`. **Never** hand-edit generated `lib/api-zod` / `lib/api-client-react`. Nullable `$ref` → `oneOf: [$ref, {type: "null"}]`. New query hooks need explicit `queryKey: getGet<Op>QueryKey()`.
- **Migrations hand-authored** (0003+). Do **not** run `db:generate`. Next free number in this tree is `0017` — re-verify before writing; rename if `feat/scalability-hardening`'s `0017` merged first.
- **i18n enforced** (`production-copy.static.test.ts`, `i18n.parity.static.test.ts`): all new UI copy via `t()`, keys in **all 5 languages** (`en/it/es/fr/de`), never pass a string literal to a `title` prop, no mojibake chars `Ã/â/Â/ð` in DICT values.
- **Don't `prettier --write` api-server files** (HEAD isn't prettier-clean).
- **Semantic commits with scope** (`feat(tornei):`, `test(tornei):`, etc.).
- **Test runner:** `import assert from "node:assert/strict"; import { test } from "node:test";` Run a single file with `pnpm --filter @workspace/api-server test <path>` or the repo `pnpm test`.
- **All routes scoped by `userId`** (multi-user isolation), read via `getUserId(req)`.
- **Branch `feat/community-management` is shared / multi-agent.** Additive commits only; never merge to main or touch other working trees.
- **Gate:** `pnpm verify` green before "done"; then `git push` the branch.

---

## File Structure

**Backend (create unless noted):**
- `lib/db/src/schema/tornei.ts` — Drizzle tables + types.
- `lib/db/src/schema/index.ts` *(modify)* — export the new schema.
- `lib/db/src/schema/profile.ts` *(modify)* — add `walletAddress` column.
- `lib/db/drizzle/0017_tornei.sql` — hand-authored migration.
- `artifacts/api-server/src/services/tornei/constants.ts` — divisions, prize tiers, guardrail thresholds.
- `artifacts/api-server/src/services/tornei/seasonWindows.ts` — "ciclo del 7" pure date math.
- `artifacts/api-server/src/services/tornei/standings.ts` — pure standings computation.
- `artifacts/api-server/src/services/tornei/prizes.ts` — pure tier qualification + amounts.
- `artifacts/api-server/src/services/tornei/eligibility.ts` — pure enrollment-eligibility check.
- `artifacts/api-server/src/services/tornei/store.ts` — DB IO (enroll, materialize, read board, hall).
- `artifacts/api-server/src/services/tornei/settle.ts` — DB settlement (XP/Pro/cert), idempotent.
- `artifacts/api-server/src/services/tornei/mint/provider.ts` — `MintProvider` interface + factory.
- `artifacts/api-server/src/services/tornei/mint/fake.ts` — in-memory provider for tests/dev.
- `artifacts/api-server/src/services/tornei/mint/onchain.ts` — ethers/Base impl (config-gated).
- `artifacts/api-server/src/routes/tornei.ts` — REST router.
- `artifacts/api-server/src/routes/index.ts` *(modify)* — mount router.
- `artifacts/api-server/src/cron/torneiScheduler.ts` — refresh + rollover cron.
- `artifacts/api-server/src/index.ts` *(modify)* — start/stop scheduler.
- `lib/api-spec/openapi.yaml` *(modify)* — paths + schemas.

**Frontend (create unless noted):**
- `artifacts/trader-dashboard/src/pages/Tornei.tsx` — page + Arena/Percorso switch.
- `artifacts/trader-dashboard/src/components/tornei/{SeasonBanner,Podium,Leaderboard,DqList,Prizes,Rules,HallOfFame,NftCertificate,CertModal,PercorsoView}.tsx`.
- `artifacts/trader-dashboard/src/App.tsx` *(modify)* — lazy route `/tornei`.
- `artifacts/trader-dashboard/src/components/CommandPalette.tsx` *(modify)* — nav entry.
- `artifacts/trader-dashboard/src/lib/i18n/*` *(modify)* — `tornei.*` keys ×5 langs.
- `artifacts/trader-dashboard/src/pages/Settings.tsx` *(modify)* — wallet address field.

**Reference (read-only, the markup source of truth for the port):** Claude Design project `831a2631-e58c-4c3a-97f8-0c05dedb57e0`, `templates/tornei/Tornei.dc.html` + `data.js` + `support.js`. Pull current copies into `design-ref/tornei/` in Task 0.

---

### Task 0: Pull the design reference locally

**Files:**
- Create: `design-ref/tornei/Tornei.dc.html`, `design-ref/tornei/data.js`, `design-ref/tornei/support.js`

- [ ] **Step 1: Fetch the three template files** from the Claude Design project (DesignSync `get_file`, project `831a2631-e58c-4c3a-97f8-0c05dedb57e0`, paths `templates/tornei/Tornei.dc.html|data.js|support.js`) and write them verbatim under `design-ref/tornei/`. These are the markup/data source for the frontend port.

- [ ] **Step 2: Commit**

```bash
git add design-ref/tornei
git commit -m "chore(tornei): vendor Claude Design tornei template for reference"
```

---

### Task 1: Database schema + migration

**Files:**
- Create: `lib/db/src/schema/tornei.ts`
- Modify: `lib/db/src/schema/index.ts`, `lib/db/src/schema/profile.ts`
- Create: `lib/db/drizzle/0017_tornei.sql`

**Interfaces:**
- Produces: `tournamentSeasonsTable`, `tournamentEnrollmentsTable`, `tournamentStandingsTable`, `tournamentPrizesTable`, `tournamentCertificatesTable` and their `$inferSelect`/`$inferInsert` types; `profileTable.walletAddress`.

- [ ] **Step 1: Write the schema file**

```ts
// lib/db/src/schema/tornei.ts
import { pgTable, serial, text, integer, boolean, timestamp, doublePrecision, uniqueIndex, index } from "drizzle-orm/pg-core";

export const tournamentSeasonsTable = pgTable("tournament_seasons", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull(),                 // "2025-q3"
  label: text("label").notNull(),               // "Q3 2025"
  startsAt: timestamp("starts_at").notNull(),
  endsAt: timestamp("ends_at").notNull(),
  status: text("status").notNull().default("upcoming"), // upcoming | live | ended
  settledAt: timestamp("settled_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("tournament_seasons_slug_unique").on(t.slug),
  index("tournament_seasons_status_idx").on(t.status),
]);

export const tournamentEnrollmentsTable = pgTable("tournament_enrollments", {
  id: serial("id").primaryKey(),
  seasonId: integer("season_id").notNull(),
  userId: text("user_id").notNull(),
  accountId: text("account_id").notNull(),      // synced real account
  enrolledAt: timestamp("enrolled_at").notNull().defaultNow(),
  consentAt: timestamp("consent_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("tournament_enrollments_season_user_unique").on(t.seasonId, t.userId),
  index("tournament_enrollments_user_idx").on(t.userId),
]);

export const tournamentStandingsTable = pgTable("tournament_standings", {
  id: serial("id").primaryKey(),
  seasonId: integer("season_id").notNull(),
  userId: text("user_id").notNull(),
  displayName: text("display_name").notNull(),
  avatarUrl: text("avatar_url"),
  rCum: doublePrecision("r_cum").notNull().default(0),
  discIndex: integer("disc_index").notNull().default(0), // 0-100
  score: doublePrecision("score").notNull().default(0),
  division: text("division").notNull().default("bronzo"),
  rank: integer("rank").notNull().default(0),
  prevRank: integer("prev_rank").notNull().default(0),
  trades: integer("trades").notNull().default(0),
  streak: integer("streak").notNull().default(0),
  dq: boolean("dq").notNull().default(false),
  dqReason: text("dq_reason"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("tournament_standings_season_user_unique").on(t.seasonId, t.userId),
  index("tournament_standings_season_score_idx").on(t.seasonId, t.score),
]);

export const tournamentPrizesTable = pgTable("tournament_prizes", {
  id: serial("id").primaryKey(),
  seasonId: integer("season_id").notNull(),
  userId: text("user_id").notNull(),
  tier: text("tier").notNull(),                 // champ | podium | top10 | disc | finish
  xpAwarded: integer("xp_awarded").notNull().default(0),
  proMonths: integer("pro_months").notNull().default(0),
  certificateId: integer("certificate_id"),
  status: text("status").notNull().default("granted"), // granted | partial | failed
  grantedAt: timestamp("granted_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("tournament_prizes_season_user_tier_unique").on(t.seasonId, t.userId, t.tier),
]);

export const tournamentCertificatesTable = pgTable("tournament_certificates", {
  id: serial("id").primaryKey(),
  seasonId: integer("season_id").notNull(),
  seasonLabel: text("season_label").notNull(),
  userId: text("user_id").notNull(),
  userName: text("user_name").notNull(),
  avatarUrl: text("avatar_url"),
  tier: text("tier").notNull(),                 // champion | podio | finisher
  edition: text("edition").notNull().default("Open Edition"),
  rarity: text("rarity").notNull().default("Raro"),
  mintStatus: text("mint_status").notNull().default("claimable"), // claimable | pending | minted | failed
  walletAddress: text("wallet_address"),
  chain: text("chain"),
  contractAddress: text("contract_address"),
  tokenId: text("token_id"),
  txHash: text("tx_hash"),
  mintedAt: timestamp("minted_at"),
  lastError: text("last_error"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("tournament_certificates_user_idx").on(t.userId),
  uniqueIndex("tournament_certificates_season_user_tier_unique").on(t.seasonId, t.userId, t.tier),
]);

export type TournamentSeason = typeof tournamentSeasonsTable.$inferSelect;
export type TournamentEnrollment = typeof tournamentEnrollmentsTable.$inferSelect;
export type TournamentStanding = typeof tournamentStandingsTable.$inferSelect;
export type TournamentPrize = typeof tournamentPrizesTable.$inferSelect;
export type TournamentCertificate = typeof tournamentCertificatesTable.$inferSelect;
```

- [ ] **Step 2: Export from the schema barrel.** In `lib/db/src/schema/index.ts` add `export * from "./tornei.js";` (match the existing export style in that file — copy the extension convention used by neighbours).

- [ ] **Step 3: Add `walletAddress` to `profileTable`.** In `lib/db/src/schema/profile.ts`, inside the `pgTable("profile", { … })` object add:

```ts
  walletAddress: text("wallet_address"),
```

- [ ] **Step 4: Write the migration** `lib/db/drizzle/0017_tornei.sql` (verify `0017` is free first; bump if needed):

```sql
CREATE TABLE IF NOT EXISTS "tournament_seasons" (
  "id" serial PRIMARY KEY NOT NULL,
  "slug" text NOT NULL,
  "label" text NOT NULL,
  "starts_at" timestamp NOT NULL,
  "ends_at" timestamp NOT NULL,
  "status" text NOT NULL DEFAULT 'upcoming',
  "settled_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "tournament_seasons_slug_unique" ON "tournament_seasons" ("slug");
CREATE INDEX IF NOT EXISTS "tournament_seasons_status_idx" ON "tournament_seasons" ("status");

CREATE TABLE IF NOT EXISTS "tournament_enrollments" (
  "id" serial PRIMARY KEY NOT NULL,
  "season_id" integer NOT NULL,
  "user_id" text NOT NULL,
  "account_id" text NOT NULL,
  "enrolled_at" timestamp NOT NULL DEFAULT now(),
  "consent_at" timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "tournament_enrollments_season_user_unique" ON "tournament_enrollments" ("season_id","user_id");
CREATE INDEX IF NOT EXISTS "tournament_enrollments_user_idx" ON "tournament_enrollments" ("user_id");

CREATE TABLE IF NOT EXISTS "tournament_standings" (
  "id" serial PRIMARY KEY NOT NULL,
  "season_id" integer NOT NULL,
  "user_id" text NOT NULL,
  "display_name" text NOT NULL,
  "avatar_url" text,
  "r_cum" double precision NOT NULL DEFAULT 0,
  "disc_index" integer NOT NULL DEFAULT 0,
  "score" double precision NOT NULL DEFAULT 0,
  "division" text NOT NULL DEFAULT 'bronzo',
  "rank" integer NOT NULL DEFAULT 0,
  "prev_rank" integer NOT NULL DEFAULT 0,
  "trades" integer NOT NULL DEFAULT 0,
  "streak" integer NOT NULL DEFAULT 0,
  "dq" boolean NOT NULL DEFAULT false,
  "dq_reason" text,
  "updated_at" timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "tournament_standings_season_user_unique" ON "tournament_standings" ("season_id","user_id");
CREATE INDEX IF NOT EXISTS "tournament_standings_season_score_idx" ON "tournament_standings" ("season_id","score");

CREATE TABLE IF NOT EXISTS "tournament_prizes" (
  "id" serial PRIMARY KEY NOT NULL,
  "season_id" integer NOT NULL,
  "user_id" text NOT NULL,
  "tier" text NOT NULL,
  "xp_awarded" integer NOT NULL DEFAULT 0,
  "pro_months" integer NOT NULL DEFAULT 0,
  "certificate_id" integer,
  "status" text NOT NULL DEFAULT 'granted',
  "granted_at" timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "tournament_prizes_season_user_tier_unique" ON "tournament_prizes" ("season_id","user_id","tier");

CREATE TABLE IF NOT EXISTS "tournament_certificates" (
  "id" serial PRIMARY KEY NOT NULL,
  "season_id" integer NOT NULL,
  "season_label" text NOT NULL,
  "user_id" text NOT NULL,
  "user_name" text NOT NULL,
  "avatar_url" text,
  "tier" text NOT NULL,
  "edition" text NOT NULL DEFAULT 'Open Edition',
  "rarity" text NOT NULL DEFAULT 'Raro',
  "mint_status" text NOT NULL DEFAULT 'claimable',
  "wallet_address" text,
  "chain" text,
  "contract_address" text,
  "token_id" text,
  "tx_hash" text,
  "minted_at" timestamp,
  "last_error" text,
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "tournament_certificates_user_idx" ON "tournament_certificates" ("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "tournament_certificates_season_user_tier_unique" ON "tournament_certificates" ("season_id","user_id","tier");

ALTER TABLE "profile" ADD COLUMN IF NOT EXISTS "wallet_address" text;
```

- [ ] **Step 5: Typecheck the db package**

Run: `pnpm --filter @workspace/db typecheck` (or repo `pnpm typecheck`)
Expected: PASS (no type errors).

- [ ] **Step 6: Apply migration locally and verify**

Run: `pnpm db:migrate` then `pnpm db:push` if the project's flow requires it.
Expected: tables exist (psql `\dt tournament_*` shows 5 tables).

- [ ] **Step 7: Commit**

```bash
git add lib/db/src/schema/tornei.ts lib/db/src/schema/index.ts lib/db/src/schema/profile.ts lib/db/drizzle/0017_tornei.sql
git commit -m "feat(db): tornei schema + migration (seasons, enrollments, standings, prizes, certificates)"
```

---

### Task 2: Domain constants

**Files:**
- Create: `artifacts/api-server/src/services/tornei/constants.ts`
- Test: `artifacts/api-server/src/services/tornei/constants.test.ts`

**Interfaces:**
- Produces:
  - `DIVISIONS: { id: "bronzo"|"argento"|"oro"|"diamante"; name: string; min: number }[]`
  - `divisionForScore(score: number): Division` (`Division = "bronzo"|"argento"|"oro"|"diamante"`)
  - `MAX_RISK_PCT = 2`, `DRAWDOWN_DQ_R = -10`
  - `PRIZE_TIERS: { tier: PrizeTier; xp: number; proMonths: number; certTier?: CertTier; cap?: number }[]` where `PrizeTier = "champ"|"podium"|"top10"|"disc"|"finish"`, `CertTier = "champion"|"podio"|"finisher"`
  - `DISC_QUALIFY = 80`, `FINISH_DISC_MIN = 60`

- [ ] **Step 1: Write the failing test**

```ts
// constants.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { divisionForScore, DIVISIONS, PRIZE_TIERS } from "./constants.js";

test("divisionForScore maps score bands from the design", () => {
  assert.equal(divisionForScore(0), "bronzo");
  assert.equal(divisionForScore(17.9), "bronzo");
  assert.equal(divisionForScore(18), "argento");
  assert.equal(divisionForScore(30), "oro");
  assert.equal(divisionForScore(45), "diamante");
  assert.equal(divisionForScore(120), "diamante");
});

test("DIVISIONS ordered ascending by min, four leagues", () => {
  assert.deepEqual(DIVISIONS.map((d) => d.id), ["bronzo", "argento", "oro", "diamante"]);
});

test("PRIZE_TIERS cover the five design tiers", () => {
  assert.deepEqual(PRIZE_TIERS.map((p) => p.tier), ["champ", "podium", "top10", "disc", "finish"]);
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `pnpm --filter @workspace/api-server test src/services/tornei/constants.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

```ts
// constants.ts
export type Division = "bronzo" | "argento" | "oro" | "diamante";
export type PrizeTier = "champ" | "podium" | "top10" | "disc" | "finish";
export type CertTier = "champion" | "podio" | "finisher";

export const DIVISIONS: { id: Division; name: string; min: number }[] = [
  { id: "bronzo", name: "Bronzo", min: 0 },
  { id: "argento", name: "Argento", min: 18 },
  { id: "oro", name: "Oro", min: 30 },
  { id: "diamante", name: "Diamante", min: 45 },
];

export function divisionForScore(score: number): Division {
  let result: Division = "bronzo";
  for (const d of DIVISIONS) if (score >= d.min) result = d.id;
  return result;
}

export const MAX_RISK_PCT = 2;
export const DRAWDOWN_DQ_R = -10;
export const DISC_QUALIFY = 80;
export const FINISH_DISC_MIN = 60;

export const PRIZE_TIERS: { tier: PrizeTier; xp: number; proMonths: number; certTier?: CertTier; cap?: number }[] = [
  { tier: "champ", xp: 0, proMonths: 12, certTier: "champion" },
  { tier: "podium", xp: 0, proMonths: 6, certTier: "podio" },
  { tier: "top10", xp: 2500, proMonths: 3 },
  { tier: "disc", xp: 1000, proMonths: 1, cap: 50 },
  { tier: "finish", xp: 500, proMonths: 0, certTier: "finisher" },
];
```

- [ ] **Step 4: Run test, verify it passes.** Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add artifacts/api-server/src/services/tornei/constants.ts artifacts/api-server/src/services/tornei/constants.test.ts
git commit -m "feat(tornei): domain constants (divisions, guardrails, prize tiers)"
```

---

### Task 3: Season windows ("ciclo del 7") — pure date math

**Files:**
- Create: `artifacts/api-server/src/services/tornei/seasonWindows.ts`
- Test: `artifacts/api-server/src/services/tornei/seasonWindows.test.ts`

**Interfaces:**
- Produces:
  - `quarterWindowFor(now: Date): { slug: string; label: string; startsAt: Date; endsAt: Date }` — the season window that **contains** `now`, where windows are the four quarters anchored on the **7th**: Jan7–Apr7 (Q1), Apr7–Jul7 (Q2), Jul7–Oct7 (Q3), Oct7–Jan7 (Q4). Times are UTC midnight on the 7th.
  - `nextWindowAfter(window): { slug; label; startsAt; endsAt }`

- [ ] **Step 1: Write the failing test**

```ts
// seasonWindows.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { quarterWindowFor, nextWindowAfter } from "./seasonWindows.js";

test("a mid-August date falls in Q3 (Jul 7 - Oct 7)", () => {
  const w = quarterWindowFor(new Date("2025-08-15T00:00:00Z"));
  assert.equal(w.slug, "2025-q3");
  assert.equal(w.label, "Q3 2025");
  assert.equal(w.startsAt.toISOString(), "2025-07-07T00:00:00.000Z");
  assert.equal(w.endsAt.toISOString(), "2025-10-07T00:00:00.000Z");
});

test("before the 7th of the quarter's first month belongs to the previous quarter", () => {
  const w = quarterWindowFor(new Date("2025-07-05T12:00:00Z")); // before Jul 7
  assert.equal(w.slug, "2025-q2");
  assert.equal(w.endsAt.toISOString(), "2025-07-07T00:00:00.000Z");
});

test("Q4 wraps the year boundary", () => {
  const w = quarterWindowFor(new Date("2025-12-20T00:00:00Z"));
  assert.equal(w.slug, "2025-q4");
  assert.equal(w.startsAt.toISOString(), "2025-10-07T00:00:00.000Z");
  assert.equal(w.endsAt.toISOString(), "2026-01-07T00:00:00.000Z");
});

test("nextWindowAfter Q4 2025 is Q1 2026", () => {
  const w = nextWindowAfter(quarterWindowFor(new Date("2025-12-20T00:00:00Z")));
  assert.equal(w.slug, "2026-q1");
  assert.equal(w.startsAt.toISOString(), "2026-01-07T00:00:00.000Z");
});
```

- [ ] **Step 2: Run test, verify it fails.** Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

```ts
// seasonWindows.ts
export interface SeasonWindow { slug: string; label: string; startsAt: Date; endsAt: Date; }

// Quarter anchor months (0-based): Q1 starts Jan(0), Q2 Apr(3), Q3 Jul(6), Q4 Oct(9), each on the 7th UTC.
const ANCHORS = [0, 3, 6, 9];

function windowFromQuarter(year: number, q: number): SeasonWindow {
  const startMonth = ANCHORS[q];
  const startsAt = new Date(Date.UTC(year, startMonth, 7));
  const endYear = q === 3 ? year + 1 : year;
  const endMonth = q === 3 ? 0 : ANCHORS[q + 1];
  const endsAt = new Date(Date.UTC(endYear, endMonth, 7));
  return { slug: `${year}-q${q + 1}`, label: `Q${q + 1} ${year}`, startsAt, endsAt };
}

export function quarterWindowFor(now: Date): SeasonWindow {
  const year = now.getUTCFullYear();
  // Find the quarter whose [startsAt, endsAt) contains now; scan current + previous year boundary.
  for (const candidateYear of [year, year - 1]) {
    for (let q = 3; q >= 0; q--) {
      const w = windowFromQuarter(candidateYear, q);
      if (now >= w.startsAt && now < w.endsAt) return w;
    }
  }
  // Fallback (shouldn't hit): Q1 of the year.
  return windowFromQuarter(year, 0);
}

export function nextWindowAfter(window: SeasonWindow): SeasonWindow {
  const match = /^(\d+)-q(\d)$/.exec(window.slug);
  if (!match) throw new Error(`bad slug ${window.slug}`);
  const year = Number(match[1]);
  const q = Number(match[2]) - 1;
  return q === 3 ? windowFromQuarter(year + 1, 0) : windowFromQuarter(year, q + 1);
}
```

- [ ] **Step 4: Run test, verify it passes.** Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add artifacts/api-server/src/services/tornei/seasonWindows.ts artifacts/api-server/src/services/tornei/seasonWindows.test.ts
git commit -m "feat(tornei): ciclo-del-7 season window date math"
```

---

### Task 4: Standings computation — pure

**Files:**
- Create: `artifacts/api-server/src/services/tornei/standings.ts`
- Test: `artifacts/api-server/src/services/tornei/standings.test.ts`

**Interfaces:**
- Consumes: `rMultiple` from `../tradeAnalytics.js` (signature `rMultiple(trade: EdgeTrade): number | null`); `divisionForScore`, `MAX_RISK_PCT`, `DRAWDOWN_DQ_R` from `./constants.js`.
- Produces:
  - `type StandingInput = { userId: string; displayName: string; avatarUrl: string | null; trades: TorneiTrade[]; discIndex: number }`
  - `type TorneiTrade = { rMultiple: number | null; riskPct: number | null; journaled: boolean }`
  - `type ComputedStanding = { userId; displayName; avatarUrl; rCum; discIndex; score; division; rank; trades; dq; dqReason: string | null }`
  - `computeStandings(inputs: StandingInput[], metric: "r" | "ts"): ComputedStanding[]` — applies guardrails, computes rCum/score, sorts desc by score, assigns 1-based rank, sets division; DQ'd rows excluded from ranking and returned with `dq:true`, `rank:0`.

> Note: this function takes already-shaped per-user trade arrays. The DB layer (Task 8) is responsible for fetching `accountTradesTable` rows and mapping them to `TorneiTrade` (rMultiple via `rMultiple()`, `riskPct` from trade risk, `journaled` from the diario/checklist flag).

- [ ] **Step 1: Write the failing test**

```ts
// standings.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { computeStandings, type StandingInput } from "./standings.js";

function mk(userId: string, rs: number[], discIndex: number, opts: { riskPct?: number; journaled?: boolean } = {}): StandingInput {
  return {
    userId, displayName: userId, avatarUrl: null, discIndex,
    trades: rs.map((r) => ({ rMultiple: r, riskPct: opts.riskPct ?? 1, journaled: opts.journaled ?? true })),
  };
}

test("ranks by R cumulato and assigns divisions", () => {
  const out = computeStandings([mk("a", [10, 12, 10], 90), mk("b", [5, 5], 80)], "r");
  assert.equal(out[0].userId, "a");
  assert.equal(out[0].rCum, 32);
  assert.equal(out[0].rank, 1);
  assert.equal(out[0].division, "oro"); // 32 >= 30
  assert.equal(out[1].rank, 2);
});

test("trades over max risk are not counted", () => {
  const out = computeStandings([mk("a", [10], 90, { riskPct: 5 })], "r");
  assert.equal(out[0].rCum, 0);
  assert.equal(out[0].trades, 0);
});

test("non-journaled trades are not counted", () => {
  const out = computeStandings([mk("a", [10], 90, { journaled: false })], "r");
  assert.equal(out[0].rCum, 0);
});

test("drawdown beyond -10R disqualifies", () => {
  const out = computeStandings([mk("a", [-4, -4, -4], 90), mk("b", [3], 80)], "r");
  const a = out.find((r) => r.userId === "a")!;
  assert.equal(a.dq, true);
  assert.equal(a.dqReason, "Drawdown −10R superato");
  assert.equal(a.rank, 0);
  // b is the only ranked competitor
  assert.equal(out.find((r) => r.userId === "b")!.rank, 1);
});

test("discipline metric multiplies R by discIndex/100", () => {
  const out = computeStandings([mk("a", [10], 50, {}), mk("b", [8], 100, {})], "ts");
  // a score 5, b score 8 -> b first
  assert.equal(out[0].userId, "b");
});
```

- [ ] **Step 2: Run test, verify it fails.** Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

```ts
// standings.ts
import { divisionForScore, type Division, MAX_RISK_PCT, DRAWDOWN_DQ_R } from "./constants.js";

export type TorneiTrade = { rMultiple: number | null; riskPct: number | null; journaled: boolean };

export type StandingInput = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  trades: TorneiTrade[];
  discIndex: number;
};

export type ComputedStanding = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  rCum: number;
  discIndex: number;
  score: number;
  division: Division;
  rank: number;
  trades: number;
  dq: boolean;
  dqReason: string | null;
};

const DQ_REASON = "Drawdown −10R superato";

function validTrades(input: StandingInput): number[] {
  return input.trades
    .filter((t) => t.journaled && t.rMultiple !== null && (t.riskPct ?? 0) <= MAX_RISK_PCT)
    .map((t) => t.rMultiple as number);
}

function isDq(rValues: number[]): boolean {
  // running cumulative R hitting <= -10 at any point disqualifies
  let cum = 0;
  for (const r of rValues) {
    cum += r;
    if (cum <= DRAWDOWN_DQ_R) return true;
  }
  return false;
}

export function computeStandings(inputs: StandingInput[], metric: "r" | "ts"): ComputedStanding[] {
  const rows: ComputedStanding[] = inputs.map((input) => {
    const rs = validTrades(input);
    const rCum = rs.reduce((a, b) => a + b, 0);
    const dq = isDq(rs);
    const score = metric === "ts" ? rCum * (input.discIndex / 100) : rCum;
    return {
      userId: input.userId,
      displayName: input.displayName,
      avatarUrl: input.avatarUrl,
      rCum,
      discIndex: input.discIndex,
      score,
      division: divisionForScore(score),
      rank: 0,
      trades: rs.length,
      dq,
      dqReason: dq ? DQ_REASON : null,
    };
  });

  const ranked = rows.filter((r) => !r.dq).sort((a, b) => b.score - a.score);
  ranked.forEach((r, i) => { r.rank = i + 1; });
  // Return ranked first (in order), then DQ rows.
  return [...ranked, ...rows.filter((r) => r.dq)];
}
```

- [ ] **Step 4: Run test, verify it passes.** Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add artifacts/api-server/src/services/tornei/standings.ts artifacts/api-server/src/services/tornei/standings.test.ts
git commit -m "feat(tornei): pure standings computation with guardrail DQ"
```

---

### Task 5: Prize qualification — pure

**Files:**
- Create: `artifacts/api-server/src/services/tornei/prizes.ts`
- Test: `artifacts/api-server/src/services/tornei/prizes.test.ts`

**Interfaces:**
- Consumes: `PRIZE_TIERS`, `DISC_QUALIFY`, `FINISH_DISC_MIN`, types `PrizeTier` from `./constants.js`; `ComputedStanding` from `./standings.js`.
- Produces:
  - `type Award = { userId: string; tier: PrizeTier; xp: number; proMonths: number; certTier?: "champion"|"podio"|"finisher" }`
  - `qualifyPrizes(finalStandings: ComputedStanding[]): Award[]` — final (frozen) standings → all awards. A user can earn multiple tiers; awards accumulate. DQ'd users earn nothing. `disc` capped at `cap` users by discIndex among those with discIndex ≥ `DISC_QUALIFY`.

- [ ] **Step 1: Write the failing test**

```ts
// prizes.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { qualifyPrizes } from "./prizes.js";
import type { ComputedStanding } from "./standings.js";

function s(userId: string, rank: number, discIndex: number, dq = false): ComputedStanding {
  return { userId, displayName: userId, avatarUrl: null, rCum: 20, discIndex, score: 20, division: "argento", rank, trades: 30, dq, dqReason: dq ? "x" : null };
}

test("champion gets champ tier (12mo pro + champion cert)", () => {
  const awards = qualifyPrizes([s("a", 1, 90)]);
  const champ = awards.find((x) => x.userId === "a" && x.tier === "champ")!;
  assert.equal(champ.proMonths, 12);
  assert.equal(champ.certTier, "champion");
});

test("rank 1 also qualifies for top10 and disc (cumulative)", () => {
  const tiers = qualifyPrizes([s("a", 1, 90)]).filter((x) => x.userId === "a").map((x) => x.tier).sort();
  assert.deepEqual(tiers, ["champ", "disc", "finish", "top10"].sort());
});

test("finish requires discipline >= 60 and not dq", () => {
  assert.equal(qualifyPrizes([s("a", 50, 59)]).some((x) => x.tier === "finish"), false);
  assert.equal(qualifyPrizes([s("a", 50, 60)]).some((x) => x.tier === "finish"), true);
});

test("dq users earn nothing", () => {
  assert.equal(qualifyPrizes([s("a", 0, 95, true)]).length, 0);
});

test("disc tier capped at 50", () => {
  const many = Array.from({ length: 60 }, (_, i) => s(`u${i}`, i + 1, 95));
  const discWinners = qualifyPrizes(many).filter((x) => x.tier === "disc");
  assert.equal(discWinners.length, 50);
});
```

- [ ] **Step 2: Run test, verify it fails.** Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
// prizes.ts
import { PRIZE_TIERS, DISC_QUALIFY, FINISH_DISC_MIN, type PrizeTier } from "./constants.js";
import type { ComputedStanding } from "./standings.js";

export type Award = {
  userId: string;
  tier: PrizeTier;
  xp: number;
  proMonths: number;
  certTier?: "champion" | "podio" | "finisher";
};

function tierMeta(tier: PrizeTier) {
  const meta = PRIZE_TIERS.find((p) => p.tier === tier);
  if (!meta) throw new Error(`unknown tier ${tier}`);
  return meta;
}

function award(userId: string, tier: PrizeTier): Award {
  const m = tierMeta(tier);
  return { userId, tier, xp: m.xp, proMonths: m.proMonths, certTier: m.certTier };
}

export function qualifyPrizes(finalStandings: ComputedStanding[]): Award[] {
  const ranked = finalStandings.filter((r) => !r.dq && r.rank > 0);
  const awards: Award[] = [];

  for (const r of ranked) {
    if (r.rank === 1) awards.push(award(r.userId, "champ"));
    if (r.rank === 2 || r.rank === 3) awards.push(award(r.userId, "podium"));
    if (r.rank <= 10) awards.push(award(r.userId, "top10"));
    if (r.discIndex >= FINISH_DISC_MIN) awards.push(award(r.userId, "finish"));
  }

  // disc: top `cap` by discIndex among those >= DISC_QUALIFY
  const discCap = tierMeta("disc").cap ?? Infinity;
  ranked
    .filter((r) => r.discIndex >= DISC_QUALIFY)
    .sort((a, b) => b.discIndex - a.discIndex)
    .slice(0, discCap)
    .forEach((r) => awards.push(award(r.userId, "disc")));

  return awards;
}
```

- [ ] **Step 4: Run test, verify it passes.** Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add artifacts/api-server/src/services/tornei/prizes.ts artifacts/api-server/src/services/tornei/prizes.test.ts
git commit -m "feat(tornei): pure prize-tier qualification"
```

---

### Task 6: Enrollment eligibility — pure

**Files:**
- Create: `artifacts/api-server/src/services/tornei/eligibility.ts`
- Test: `artifacts/api-server/src/services/tornei/eligibility.test.ts`

**Interfaces:**
- Produces:
  - `type EligibilityInput = { hasSyncedRealAccount: boolean; consent: boolean; seasonStatus: "upcoming"|"live"|"ended" }`
  - `checkEligibility(input): { ok: true } | { ok: false; reason: "no_real_account"|"no_consent"|"season_closed" }` — enrolment allowed only for `upcoming`/`live`, with a synced real account and explicit consent.

- [ ] **Step 1: Write the failing test**

```ts
// eligibility.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { checkEligibility } from "./eligibility.js";

test("requires a synced real account", () => {
  assert.deepEqual(checkEligibility({ hasSyncedRealAccount: false, consent: true, seasonStatus: "live" }), { ok: false, reason: "no_real_account" });
});
test("requires explicit consent", () => {
  assert.deepEqual(checkEligibility({ hasSyncedRealAccount: true, consent: false, seasonStatus: "live" }), { ok: false, reason: "no_consent" });
});
test("cannot enrol in an ended season", () => {
  assert.deepEqual(checkEligibility({ hasSyncedRealAccount: true, consent: true, seasonStatus: "ended" }), { ok: false, reason: "season_closed" });
});
test("ok for live with account + consent", () => {
  assert.deepEqual(checkEligibility({ hasSyncedRealAccount: true, consent: true, seasonStatus: "live" }), { ok: true });
});
```

- [ ] **Step 2: Run test, verify it fails.** Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
// eligibility.ts
export type EligibilityInput = {
  hasSyncedRealAccount: boolean;
  consent: boolean;
  seasonStatus: "upcoming" | "live" | "ended";
};
export type EligibilityResult = { ok: true } | { ok: false; reason: "no_real_account" | "no_consent" | "season_closed" };

export function checkEligibility(input: EligibilityInput): EligibilityResult {
  if (input.seasonStatus === "ended") return { ok: false, reason: "season_closed" };
  if (!input.hasSyncedRealAccount) return { ok: false, reason: "no_real_account" };
  if (!input.consent) return { ok: false, reason: "no_consent" };
  return { ok: true };
}
```

- [ ] **Step 4: Run test, verify it passes.** Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add artifacts/api-server/src/services/tornei/eligibility.ts artifacts/api-server/src/services/tornei/eligibility.test.ts
git commit -m "feat(tornei): pure enrollment eligibility check"
```

---

### Task 7: MintProvider abstraction (interface + fake + onchain + factory)

**Files:**
- Create: `artifacts/api-server/src/services/tornei/mint/provider.ts`, `mint/fake.ts`, `mint/onchain.ts`
- Test: `artifacts/api-server/src/services/tornei/mint/provider.test.ts`
- Modify: `artifacts/api-server/package.json` (add `ethers` dependency)

**Interfaces:**
- Produces:
  - `type MintRequest = { certificateId: number; tier: string; seasonLabel: string; toAddress: string; tokenUri: string }`
  - `type MintResult = { tokenId: string; txHash: string; contractAddress: string; chain: string }`
  - `interface MintProvider { readonly kind: "onchain" | "fake"; mint(req: MintRequest): Promise<MintResult>; }`
  - `getMintProvider(env?: NodeJS.ProcessEnv): MintProvider | null` — returns the onchain provider when `TORNEI_MINT_RPC_URL` + `TORNEI_MINT_CONTRACT` + `TORNEI_MINT_SIGNER_KEY` are all set; otherwise `null` (caller leaves certs `claimable`). In `NODE_ENV=test` returns the fake when `TORNEI_MINT_FAKE=1`.
  - `class FakeMintProvider implements MintProvider` (deterministic results, used by tests).

- [ ] **Step 1: Add ethers dependency.** In `artifacts/api-server/package.json` add `"ethers": "^6.13.0"` to `dependencies`. Run `pnpm install`.

- [ ] **Step 2: Write the failing test**

```ts
// mint/provider.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { getMintProvider, FakeMintProvider } from "./provider.js";

test("no provider when on-chain env is unset", () => {
  assert.equal(getMintProvider({} as NodeJS.ProcessEnv), null);
});

test("fake provider returns deterministic mint result", async () => {
  const p = new FakeMintProvider();
  const res = await p.mint({ certificateId: 1, tier: "champion", seasonLabel: "Q3 2025", toAddress: "0xabc", tokenUri: "ipfs://x" });
  assert.equal(p.kind, "fake");
  assert.match(res.txHash, /^0x/);
  assert.equal(res.tokenId, "1");
});

test("onchain provider selected when env present", () => {
  const env = {
    TORNEI_MINT_RPC_URL: "https://base.example",
    TORNEI_MINT_CONTRACT: "0xcontract",
    TORNEI_MINT_SIGNER_KEY: "0x" + "1".repeat(64),
  } as unknown as NodeJS.ProcessEnv;
  const p = getMintProvider(env);
  assert.equal(p?.kind, "onchain");
});
```

- [ ] **Step 3: Run test, verify it fails.** Expected: FAIL.

- [ ] **Step 4: Implement `provider.ts`**

```ts
// mint/provider.ts
export type MintRequest = { certificateId: number; tier: string; seasonLabel: string; toAddress: string; tokenUri: string };
export type MintResult = { tokenId: string; txHash: string; contractAddress: string; chain: string };

export interface MintProvider {
  readonly kind: "onchain" | "fake";
  mint(req: MintRequest): Promise<MintResult>;
}

export class FakeMintProvider implements MintProvider {
  readonly kind = "fake" as const;
  async mint(req: MintRequest): Promise<MintResult> {
    return {
      tokenId: String(req.certificateId),
      txHash: "0x" + req.certificateId.toString(16).padStart(64, "0"),
      contractAddress: "0xfake",
      chain: "fake",
    };
  }
}

export function getMintProvider(env: NodeJS.ProcessEnv = process.env): MintProvider | null {
  if (env.NODE_ENV === "test" && env.TORNEI_MINT_FAKE === "1") return new FakeMintProvider();
  const rpc = env.TORNEI_MINT_RPC_URL;
  const contract = env.TORNEI_MINT_CONTRACT;
  const key = env.TORNEI_MINT_SIGNER_KEY;
  if (rpc && contract && key) {
    // Lazy import to avoid loading ethers when unused.
    const { OnchainMintProvider } = require("./onchain.js") as typeof import("./onchain.js");
    return new OnchainMintProvider({ rpcUrl: rpc, contractAddress: contract, signerKey: key, chainId: Number(env.TORNEI_MINT_CHAIN_ID ?? "8453") });
  }
  return null;
}
```

> If the codebase forbids `require` under ESM/lint, replace the lazy import with a top-level `import { OnchainMintProvider } from "./onchain.js";` — ethers is dependency-light enough to import eagerly. Keep whichever the linter accepts.

- [ ] **Step 5: Implement `onchain.ts`** (ethers v6, minimal ERC-721 `safeMint(address,string)` minter ABI):

```ts
// mint/onchain.ts
import { JsonRpcProvider, Wallet, Contract } from "ethers";
import type { MintProvider, MintRequest, MintResult } from "./provider.js";

const ABI = [
  "function safeMint(address to, string uri) returns (uint256)",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
];

export class OnchainMintProvider implements MintProvider {
  readonly kind = "onchain" as const;
  private contract: Contract;
  private contractAddress: string;
  private chainId: number;

  constructor(cfg: { rpcUrl: string; contractAddress: string; signerKey: string; chainId: number }) {
    const provider = new JsonRpcProvider(cfg.rpcUrl, cfg.chainId);
    const wallet = new Wallet(cfg.signerKey, provider);
    this.contract = new Contract(cfg.contractAddress, ABI, wallet);
    this.contractAddress = cfg.contractAddress;
    this.chainId = cfg.chainId;
  }

  async mint(req: MintRequest): Promise<MintResult> {
    const tx = await this.contract.safeMint(req.toAddress, req.tokenUri);
    const receipt = await tx.wait();
    // Decode the Transfer event for the tokenId.
    let tokenId = "0";
    for (const log of receipt?.logs ?? []) {
      try {
        const parsed = this.contract.interface.parseLog(log);
        if (parsed?.name === "Transfer") { tokenId = parsed.args.tokenId.toString(); break; }
      } catch { /* not our event */ }
    }
    return { tokenId, txHash: tx.hash, contractAddress: this.contractAddress, chain: `eip155:${this.chainId}` };
  }
}
```

- [ ] **Step 6: Run test, verify it passes** (the onchain selection test only constructs the provider; it does not call `mint`, so no network):

Run: `pnpm --filter @workspace/api-server test src/services/tornei/mint/provider.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add artifacts/api-server/src/services/tornei/mint artifacts/api-server/package.json pnpm-lock.yaml
git commit -m "feat(tornei): config-gated MintProvider (fake + ethers/Base on-chain)"
```

---

### Task 8: Store layer — enroll, fetch trades, materialize, read board/hall

**Files:**
- Create: `artifacts/api-server/src/services/tornei/store.ts`
- Test: `artifacts/api-server/src/services/tornei/store.test.ts` (unit-test the pure mapping helper only; DB calls covered by route tests in Task 10)

**Interfaces:**
- Consumes: `db` + tornei tables + `accountTradesTable` from `@workspace/db`; `computeStandings`, `StandingInput`, `TorneiTrade` from `./standings.js`; `rMultiple` from `../tradeAnalytics.js`.
- Produces:
  - `mapAccountTradeToTorneiTrade(trade): TorneiTrade` — pure mapper (exported for test).
  - `getActiveSeason(): Promise<TournamentSeason | null>` (status `live`, else most recent `upcoming`).
  - `enrollUser(args: { seasonId; userId; accountId }): Promise<void>` (idempotent upsert).
  - `isEnrolled(seasonId, userId): Promise<boolean>`.
  - `materializeStandings(seasonId, metric): Promise<void>` — fetch enrollments, fetch each user's closed trades since `enrolledAt`, compute, upsert `tournament_standings` (set `prevRank` from existing row before overwrite).
  - `readBoard(seasonId, metric, viewerUserId): Promise<{ board: TournamentStanding[]; dq: TournamentStanding[]; me: TournamentStanding | null; total: number }>` — top 25 ranked + viewer row + dq list.
  - `readHall(): Promise<{ seasonLabel: string; range: string; champion: string | null; rCum: number | null; discIndex: number | null }[]>` from ended seasons + their rank-1 standings.

- [ ] **Step 1: Write the failing test for the pure mapper**

```ts
// store.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { mapAccountTradeToTorneiTrade } from "./store.js";

test("maps a closed account trade to a tornei trade with rMultiple", () => {
  const t = mapAccountTradeToTorneiTrade({
    symbol: "EURUSD", direction: "buy",
    openPrice: 1.1000, closePrice: 1.1050, stopLoss: 1.0980,
    profit: 50, openTime: "2025-08-01T09:00:00Z", closeTime: "2025-08-01T11:00:00Z",
    riskPct: 1.2, journaled: true,
  } as never);
  assert.equal(typeof t.rMultiple, "number");
  assert.equal(t.riskPct, 1.2);
  assert.equal(t.journaled, true);
});
```

- [ ] **Step 2: Run test, verify it fails.** Expected: FAIL.

- [ ] **Step 3: Implement `store.ts`.** Write the pure mapper plus the DB functions. The mapper converts an `accountTradesTable` row into `TorneiTrade` by calling `rMultiple()` with the fields it needs (entry/exit/stop/profit/direction → use the same `EdgeTrade` shape `tradeAnalytics` expects; check `tradeAnalytics.ts` `EdgeTrade` type and reuse it), reads `riskPct` from the trade's risk field (or `null` if absent), and `journaled` from whether the trade is linked to a completed diario/checklist entry (reuse the existing join the journal/edge code uses — see `services/edgeReport.ts` for how journaled trades are identified).

```ts
// store.ts (DB functions sketch — fill in with the project's drizzle query style from neighbouring services)
import { db, tournamentSeasonsTable, tournamentEnrollmentsTable, tournamentStandingsTable, accountTradesTable, type TournamentSeason, type TournamentStanding } from "@workspace/db";
import { and, eq, desc, gte, lt } from "drizzle-orm";
import { rMultiple, type EdgeTrade } from "../tradeAnalytics.js";
import { computeStandings, type StandingInput, type TorneiTrade } from "./standings.js";

export function mapAccountTradeToTorneiTrade(row: {
  symbol: string; direction: string;
  openPrice: number; closePrice: number; stopLoss: number | null;
  profit: number; openTime: string; closeTime: string;
  riskPct: number | null; journaled: boolean;
}): TorneiTrade {
  const edge: EdgeTrade = {
    symbol: row.symbol, direction: row.direction,
    openTime: row.openTime, closeTime: row.closeTime,
    entry: row.openPrice, exit: row.closePrice, stop: row.stopLoss ?? undefined,
    profit: row.profit,
  } as EdgeTrade; // align field names with the real EdgeTrade type when implementing
  return { rMultiple: rMultiple(edge), riskPct: row.riskPct, journaled: row.journaled };
}

export async function getActiveSeason(): Promise<TournamentSeason | null> {
  const [live] = await db.select().from(tournamentSeasonsTable).where(eq(tournamentSeasonsTable.status, "live")).limit(1);
  if (live) return live;
  const [upcoming] = await db.select().from(tournamentSeasonsTable)
    .where(eq(tournamentSeasonsTable.status, "upcoming"))
    .orderBy(desc(tournamentSeasonsTable.startsAt)).limit(1);
  return upcoming ?? null;
}

// enrollUser / isEnrolled / materializeStandings / readBoard / readHall:
// implement with drizzle following the patterns in services/edgeReport.ts and routes/community.ts.
// materializeStandings: for each enrollment, fetch accountTradesTable rows where accountId matches,
// status = closed, closeTime >= enrolledAt and < season.endsAt; map -> StandingInput
// (discIndex from tradeDiscipline for that user's window); call computeStandings; upsert rows,
// carrying prevRank = existing.rank before overwrite.
```

> When implementing the DB functions, mirror the exact drizzle query/`onConflictDoUpdate` style used in `services/edgeReport.ts` and `routes/community.ts`. Keep `computeStandings` as the only ranking logic (no SQL ranking) so it stays unit-tested.

- [ ] **Step 4: Run the mapper test, verify it passes.** Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add artifacts/api-server/src/services/tornei/store.ts artifacts/api-server/src/services/tornei/store.test.ts
git commit -m "feat(tornei): store layer (enroll, materialize standings, read board/hall)"
```

---

### Task 9: Settlement — XP + Pro entitlement + certificates (idempotent)

**Files:**
- Create: `artifacts/api-server/src/services/tornei/settle.ts`
- Test: `artifacts/api-server/src/services/tornei/settle.test.ts` (unit-test the pure entitlement-extension helper; full settlement covered by an integration check in route tests)

**Interfaces:**
- Consumes: `qualifyPrizes`, `Award`; `db` + tornei/profile/admin tables; `getMintProvider`; existing XP write (increment `profileTable.xp` + recompute level via `computeLevel`); `adminUserSubscriptionsTable`.
- Produces:
  - `extendProEntitlement(current: { currentPeriodEnd: Date | null }, months: number, now: Date): Date` — pure: returns new `currentPeriodEnd = max(now, current) + months`.
  - `settleSeason(seasonId: number): Promise<{ awardsGranted: number; certificatesCreated: number }>` — reads frozen standings, `qualifyPrizes`, then for each award upserts `tournament_prizes` (unique key ⇒ idempotent), increments XP, extends Pro entitlement (`source="tornei"`, `manualOverride=true`, `reason`), and creates a `tournament_certificates` row (`pending` if wallet + provider, else `claimable`). Writes one `admin_audit_logs` summary row. Safe to call twice.

- [ ] **Step 1: Write the failing test for the pure helper**

```ts
// settle.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { extendProEntitlement } from "./settle.js";

const now = new Date("2025-10-07T00:00:00Z");

test("extends from now when no active entitlement", () => {
  const end = extendProEntitlement({ currentPeriodEnd: null }, 3, now);
  assert.equal(end.toISOString(), "2026-01-07T00:00:00.000Z");
});

test("stacks on top of a still-active entitlement", () => {
  const end = extendProEntitlement({ currentPeriodEnd: new Date("2025-12-07T00:00:00Z") }, 6, now);
  assert.equal(end.toISOString(), "2026-06-07T00:00:00.000Z");
});

test("ignores an already-expired entitlement (extends from now)", () => {
  const end = extendProEntitlement({ currentPeriodEnd: new Date("2025-01-01T00:00:00Z") }, 1, now);
  assert.equal(end.toISOString(), "2025-11-07T00:00:00.000Z");
});
```

- [ ] **Step 2: Run test, verify it fails.** Expected: FAIL.

- [ ] **Step 3: Implement the pure helper + `settleSeason`**

```ts
// settle.ts (pure helper shown in full; settleSeason sketched — implement DB with drizzle + a transaction)
export function extendProEntitlement(current: { currentPeriodEnd: Date | null }, months: number, now: Date): Date {
  const base = current.currentPeriodEnd && current.currentPeriodEnd > now ? current.currentPeriodEnd : now;
  const end = new Date(base);
  end.setUTCMonth(end.getUTCMonth() + months);
  return end;
}

// settleSeason(seasonId):
//  1. load season; guard: if status !== "ended" or settledAt set in a way that means done, still safe (idempotent upserts).
//  2. read frozen tournament_standings for season -> ComputedStanding[] shape.
//  3. awards = qualifyPrizes(standings).
//  4. db.transaction: for each award:
//       - INSERT tournament_prizes ON CONFLICT (season,user,tier) DO NOTHING  (skip if already granted)
//       - if newly inserted: profile.xp += award.xp; recompute level (computeLevel);
//         if proMonths>0: upsert adminUserSubscriptionsTable {plan:"pro", source:"tornei",
//           manualOverride:true, status:"active", reason:`Torneo <label> – <tier>`,
//           currentPeriodEnd: extendProEntitlement(existing, proMonths, now)};
//         if certTier: INSERT tournament_certificates ON CONFLICT (season,user,tier) DO NOTHING
//           with mintStatus = (walletAddress && getMintProvider()) ? "pending" : "claimable";
//           set tournament_prizes.certificate_id.
//  5. INSERT one admin_audit_logs row summarising counts.
//  6. return counts.
```

> Reuse `computeLevel`/`getLevelName` from `routes/profile.ts` (export them if not already exported). Reuse the admin entitlement upsert shape from `routes/admin.ts` (the function around line 164 that writes `adminUserSubscriptionsTable`).

- [ ] **Step 4: Run test, verify it passes.** Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add artifacts/api-server/src/services/tornei/settle.ts artifacts/api-server/src/services/tornei/settle.test.ts
git commit -m "feat(tornei): idempotent season settlement (XP + Pro entitlement + certificates)"
```

---

### Task 10: Contract (openapi) + REST router

**Files:**
- Modify: `lib/api-spec/openapi.yaml`
- Create: `artifacts/api-server/src/routes/tornei.ts`
- Modify: `artifacts/api-server/src/routes/index.ts`
- Test: `artifacts/api-server/src/routes/tornei.test.ts`

**Interfaces:**
- Produces REST endpoints (all under `/api`, userId-scoped via `getUserId`):
  - `GET /tornei/current` → `{ season: {slug,label,status,startsAt,endsAt,settledAt} | null, enrolled: boolean, totalPlayers: number, progress: number }`
  - `GET /tornei/standings` (query `metric=r|ts`) → `{ board: StandingDto[], dq: StandingDto[], me: StandingDto | null, total: number }`
  - `GET /tornei/me` → `{ standing: StandingDto | null, nextDivision: string | null, prizes: PrizeDto[], certificates: CertificateDto[] }`
  - `GET /tornei/hall` → `{ entries: HallEntryDto[] }`
  - `GET /tornei/certificates` → `{ certificates: CertificateDto[] }`
  - `POST /tornei/enroll` → `201 { ok: true }` or `409/402` with `{ error, reason }`
  - `POST /tornei/certificates/{id}/claim` → `{ certificate: CertificateDto }`

- [ ] **Step 1: Add the tag and schemas + paths to `openapi.yaml`.** Add a `tornei` tag. Under `components/schemas` add `TorneiStanding`, `TorneiSeason` (nullable via `oneOf:[$ref,{type:"null"}]`), `TorneiPrize`, `TorneiCertificate`, `TorneiCurrentResponse`, `TorneiStandingsResponse`, `TorneiMeResponse`, `TorneiHallResponse`, `TorneiCertificatesResponse`, `TorneiEnrollResponse`. Add the 7 paths with `operationId`s `getTorneiCurrent`, `getTorneiStandings`, `getTorneiMe`, `getTorneiHall`, `getTorneiCertificates`, `enrollTornei`, `claimTorneiCertificate`. Follow the exact YAML shape of an existing block (copy `/wiki/sources` GET as a template for response wiring).

- [ ] **Step 2: Regenerate the client**

Run: `pnpm codegen`
Expected: `lib/api-zod` and `lib/api-client-react` update with the new hooks (`useGetTorneiCurrent`, etc.). Do not hand-edit them.

- [ ] **Step 3: Write the failing route test**

```ts
// routes/tornei.test.ts — follow the harness used by routes/journal.test.ts (same app bootstrap + auth stub).
import assert from "node:assert/strict";
import { test } from "node:test";
// import { makeTestApp, asUser } from "../testing/...";  // reuse the existing route-test harness

test("GET /tornei/current returns a season payload shape", async () => {
  // bootstrap app, seed one live season, call endpoint as a user, assert 200 + keys
  // assert.equal(res.status, 200); assert.ok("season" in res.body);
});

test("POST /tornei/enroll without a real account returns 402/409 with reason", async () => {
  // assert reason === "no_real_account"
});
```

> Mirror the exact bootstrap of `routes/journal.test.ts` (look at its imports for the app factory + auth stub). Seed seasons/enrollments directly via `db`. Keep assertions on status + response keys + the eligibility `reason`.

- [ ] **Step 4: Run test, verify it fails.** Expected: FAIL (router not mounted).

- [ ] **Step 5: Implement `routes/tornei.ts`.** Build an Express `Router`. Each handler calls the store/settle/eligibility services and maps to the DTOs. `enroll`: resolve the user's synced real account (reuse BrokerHub/account lookup), build `EligibilityInput`, call `checkEligibility`; on `ok` call `store.enrollUser`; else `402` (no_real_account) / `409` (no_consent/season_closed) with `{ error, reason }`. `claim`: load the certificate (scoped to `userId`), require `profile.walletAddress`, get `getMintProvider()`; if provider+wallet set `pending`→mint→`minted` (store tokenId/txHash) with try/catch → `failed`+`lastError`; idempotent if already `minted`.

- [ ] **Step 6: Mount the router.** In `routes/index.ts` add `import torneiRouter from "./tornei.js";` and `router.use(torneiRouter);` next to the other `router.use(...)` calls (match the existing mounting style).

- [ ] **Step 7: Run test, verify it passes.** Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add lib/api-spec/openapi.yaml lib/api-zod lib/api-client-react artifacts/api-server/src/routes/tornei.ts artifacts/api-server/src/routes/index.ts artifacts/api-server/src/routes/tornei.test.ts
git commit -m "feat(tornei): REST contract + router (current/standings/me/hall/certificates/enroll/claim)"
```

---

### Task 11: Cron scheduler — standings refresh + ciclo-del-7 rollover

**Files:**
- Create: `artifacts/api-server/src/cron/torneiScheduler.ts`
- Modify: `artifacts/api-server/src/index.ts`
- Test: `artifacts/api-server/src/cron/torneiScheduler.test.ts` (unit-test the pure rollover-decision helper)

**Interfaces:**
- Consumes: `quarterWindowFor`, `nextWindowAfter`; `getActiveSeason`, `materializeStandings`; `settleSeason`.
- Produces:
  - `planRollover(seasons: { id; slug; status; startsAt; endsAt; settledAt }[], now: Date): { toEnd: number[]; toPromote: number[]; toCreate: SeasonWindow | null }` — pure decision over current seasons.
  - `startTorneiScheduler(): { close(): void }` — node-cron handles, following `cotScheduler` in `routes/tools.ts`. One job every 5 min → `materializeStandings(activeSeason, "r")`; one daily job → apply `planRollover` (end+settle, promote, create).

- [ ] **Step 1: Write the failing test for `planRollover`**

```ts
// torneiScheduler.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { planRollover } from "./torneiScheduler.js";

const now = new Date("2025-10-07T01:00:00Z");

test("ends a live season past its endsAt and promotes the upcoming one", () => {
  const plan = planRollover([
    { id: 1, slug: "2025-q3", status: "live", startsAt: new Date("2025-07-07Z"), endsAt: new Date("2025-10-07Z"), settledAt: null },
    { id: 2, slug: "2025-q4", status: "upcoming", startsAt: new Date("2025-10-07Z"), endsAt: new Date("2026-01-07Z"), settledAt: null },
  ], now);
  assert.deepEqual(plan.toEnd, [1]);
  assert.deepEqual(plan.toPromote, [2]);
  assert.equal(plan.toCreate, null);
});

test("creates the next upcoming season when none exists", () => {
  const plan = planRollover([
    { id: 2, slug: "2025-q4", status: "live", startsAt: new Date("2025-10-07Z"), endsAt: new Date("2026-01-07Z"), settledAt: null },
  ], new Date("2025-10-08T00:00:00Z"));
  assert.equal(plan.toEnd.length, 0);
  assert.equal(plan.toCreate?.slug, "2026-q1");
});
```

- [ ] **Step 2: Run test, verify it fails.** Expected: FAIL.

- [ ] **Step 3: Implement `torneiScheduler.ts`** (pure `planRollover` in full + the node-cron wiring modelled on `cotScheduler`):

```ts
// torneiScheduler.ts (pure decision shown; cron wiring mirrors routes/tools.ts cotScheduler)
import cron from "node-cron";
import { quarterWindowFor, nextWindowAfter, type SeasonWindow } from "../services/tornei/seasonWindows.js";

type SeasonRow = { id: number; slug: string; status: string; startsAt: Date; endsAt: Date; settledAt: Date | null };

export function planRollover(seasons: SeasonRow[], now: Date): { toEnd: number[]; toPromote: number[]; toCreate: SeasonWindow | null } {
  const toEnd = seasons.filter((s) => s.status === "live" && s.endsAt <= now).map((s) => s.id);
  const current = quarterWindowFor(now);
  const liveOrUpcoming = seasons.filter((s) => s.status === "live" || s.status === "upcoming");
  const toPromote = seasons
    .filter((s) => s.status === "upcoming" && s.startsAt <= now && s.endsAt > now)
    .map((s) => s.id);
  const next = nextWindowAfter(current);
  const hasNext = liveOrUpcoming.some((s) => s.slug === next.slug) || seasons.some((s) => s.slug === next.slug);
  const toCreate = hasNext ? null : next;
  return { toEnd, toPromote, toCreate };
}

export function startTorneiScheduler() {
  const refresh = cron.schedule("*/5 * * * *", async () => { /* materialize active season */ });
  const rollover = cron.schedule("10 0 * * *", async () => { /* load seasons; planRollover; apply: end+settleSeason, promote, create */ });
  return { close() { refresh.stop(); rollover.stop(); } };
}
```

- [ ] **Step 4: Wire into server lifecycle.** In `index.ts`: import `startTorneiScheduler`, call it on boot storing the handle, and add `torneiScheduler.close()` to the shutdown block next to `cotScheduler.close()`.

- [ ] **Step 5: Run test, verify it passes.** Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add artifacts/api-server/src/cron/torneiScheduler.ts artifacts/api-server/src/index.ts artifacts/api-server/src/cron/torneiScheduler.test.ts
git commit -m "feat(tornei): cron scheduler (standings refresh + ciclo-del-7 rollover)"
```

---

### Task 12: On-demand standings refresh after account sync

**Files:**
- Modify: the BrokerHub account-sync completion path (find via `grep -rn "accountTradesTable" artifacts/api-server/src/services/brokerHub` and the sync-finish hook).

**Interfaces:**
- Consumes: `getActiveSeason`, `isEnrolled`, `materializeStandings`.

- [ ] **Step 1: Locate the sync-complete hook.** Find where a synced account finishes writing `accountTradesTable` (BrokerHub). Confirm there's a single completion point per account sync.

- [ ] **Step 2: Add a debounced refresh.** After a sync for `accountId`/`userId` completes: if there is a `live` season and the user `isEnrolled`, schedule a debounced `materializeStandings(season.id, "r")` (debounce per season, e.g. coalesce calls within 30s) so a burst of syncs triggers one recompute. Keep this best-effort (wrapped in try/catch, never blocks sync).

- [ ] **Step 3: Manual verification.** With a local live season + an enrolled synced account, trigger a sync and confirm the user's `tournament_standings` row updates within the debounce window (query the table).

- [ ] **Step 4: Commit**

```bash
git add -p   # stage only the brokerHub hook edit
git commit -m "feat(tornei): refresh standings on account sync for enrolled users"
```

---

### Task 13: i18n keys (5 languages)

**Files:**
- Modify: `artifacts/trader-dashboard/src/lib/i18n/{en,it,es,fr,de}.*` (match the project's dictionary layout — find with `grep -rn "journal" artifacts/trader-dashboard/src/lib/i18n | head`).

**Interfaces:**
- Produces a `tornei.*` key namespace used by all Task 14–19 components. Every visible string is a key.

- [ ] **Step 1: Enumerate the strings** from the design (`design-ref/tornei/Tornei.dc.html`): header eyebrow/title/subtitle, Arena/Percorso toggle, status labels (In corso/In arrivo/Concluso), countdown unit labels, season banner, board column headers (Rango/Trader/R cum./Disciplina/Punteggio), metric toggle (R cumulato/Disciplina), DQ section ("Fuori classifica · guardrail superato"), prize tier titles/subs, rules titles/texts, "Cosa si vince", certificate rarity/edition labels, Albo d'oro, "Prenota il tuo posto", enrol/claim CTAs, wallet field labels, eligibility errors.

- [ ] **Step 2: Add the keys to the Italian dictionary** (authoritative copy from the design), then translate to `en/es/fr/de`. **No mojibake** (`Ã/â/Â/ð`) — write `−` and accented letters correctly; rephrase French if a forbidden char would appear (e.g. avoid `grâce`).

- [ ] **Step 3: Run the i18n guard tests**

Run: `pnpm --filter @workspace/trader-dashboard test src/lib/i18n` (or the repo test that runs `i18n.parity.static.test.ts` + `production-copy.static.test.ts`)
Expected: PASS (parity across 5 langs, no mojibake).

- [ ] **Step 4: Commit**

```bash
git add artifacts/trader-dashboard/src/lib/i18n
git commit -m "feat(tornei): i18n keys for the tornei section (5 languages)"
```

---

### Task 14: Page shell + route + nav + data hooks

**Files:**
- Create: `artifacts/trader-dashboard/src/pages/Tornei.tsx`
- Modify: `artifacts/trader-dashboard/src/App.tsx`, `artifacts/trader-dashboard/src/components/CommandPalette.tsx`

**Interfaces:**
- Consumes: generated hooks `useGetTorneiCurrent`, `useGetTorneiStandings`, `useGetTorneiMe`, `useGetTorneiHall`, `useGetTorneiCertificates`, and mutations for enroll/claim.
- Produces: `<Tornei/>` page with Arena/Percorso local state; renders Task 15–19 components.

- [ ] **Step 1: Add the lazy route.** In `App.tsx`: `const Tornei = lazy(() => import("./pages/Tornei"));` and `<Route path="/tornei" component={Tornei} />` in the protected Switch (next to `/journal`).

- [ ] **Step 2: Add the nav entry.** In `CommandPalette.tsx` add a "Tornei" command (trophy icon) routing to `/tornei`, with an i18n label. If `TopNav`/`BottomNav` are data-driven from the same nav list, the entry appears there too; otherwise add it to those lists matching the existing item shape.

- [ ] **Step 3: Build the page skeleton.** `Tornei.tsx`: header (eyebrow + title + subtitle + Arena/Percorso segmented toggle + "in gara" count), then conditionally render `<ArenaView/>` or `<PercorsoView/>`. Wire the five queries; pass data down. Use the design's class names from `design-ref/tornei/Tornei.dc.html` (port the inline `<style>` block into a co-located CSS module or a `<style>` tag scoped under a `.trn-page` root — keep the `trn-*` classes verbatim so the visual matches).

- [ ] **Step 4: Manual smoke.** `pnpm start:local`, visit `/tornei`, confirm the page renders (empty/loading states OK) and nav works.

- [ ] **Step 5: Commit**

```bash
git add artifacts/trader-dashboard/src/pages/Tornei.tsx artifacts/trader-dashboard/src/App.tsx artifacts/trader-dashboard/src/components/CommandPalette.tsx
git commit -m "feat(tornei): page shell, /tornei route, nav entry, data hooks"
```

---

### Task 15: Arena — SeasonBanner + Podium + Leaderboard + DqList

**Files:**
- Create: `components/tornei/SeasonBanner.tsx`, `Podium.tsx`, `Leaderboard.tsx`, `DqList.tsx`, `ArenaView.tsx`

- [ ] **Step 1: SeasonBanner.** Port the "BANNER STAGIONE + COUNTDOWN" block from the design: status pill (live/upcoming/ended), season label, date range, countdown (compute remaining to `endsAt` client-side, tick each second), progress bar (`(now-startsAt)/(endsAt-startsAt)`). Upcoming state → "La classifica apre all'avvio" + "Prenota il tuo posto" CTA (calls enroll mutation).

- [ ] **Step 2: Podium.** Top-3 from `board` rendered as the three `trn-pod` cards (rank medal icon, initials, division tag, R, discipline). Hidden when fewer than 3 ranked or status `upcoming`.

- [ ] **Step 3: Leaderboard.** The `trn-lbhead`/`trn-lbrow` grid: rank pill, move arrows (`rank` vs `prevRank`), avatar+name, division tag, R cum., discipline bar, score. Highlight the viewer row (`me`). Metric toggle (R/Disciplina) updates the `metric` query param → refetch `useGetTorneiStandings`.

- [ ] **Step 4: DqList.** Render `dq` rows in the "Fuori classifica · guardrail superato" styling with `dqReason`.

- [ ] **Step 5: ArenaView.** Compose the above + handle the three season states (upcoming → banner + CTA only; live/ended → podium + board + dq). Use i18n keys from Task 13.

- [ ] **Step 6: Manual verification.** Seed a live season + a few enrollments + standings locally; confirm podium/board/dq render and the metric toggle reorders.

- [ ] **Step 7: Commit**

```bash
git add artifacts/trader-dashboard/src/components/tornei/{SeasonBanner,Podium,Leaderboard,DqList,ArenaView}.tsx
git commit -m "feat(tornei): Arena view (banner, podium, leaderboard, dq list)"
```

---

### Task 16: Arena — Prizes + Rules + NFT certificate cards

**Files:**
- Create: `components/tornei/Prizes.tsx`, `Rules.tsx`, `NftCertificate.tsx`, `CertModal.tsx`

- [ ] **Step 1: NftCertificate.** Port the `trn-nft` card (holographic art, seal icon per tier, edition/rarity, mini-QR, ERC-721 footer). Props from `CertificateDto` (or the static design preview for the "what you can win" strip). Include the sheen hover animation CSS.

- [ ] **Step 2: CertModal.** Click a certificate → modal with the larger cert, `mintStatus` badge, and (for the viewer's own `claimable` cert) a "Claim / Mint" button calling the claim mutation; show `minted` txHash/tokenId when present, `failed`+`lastError` otherwise.

- [ ] **Step 3: Prizes.** Port the prize strip (certificate previews + "Premi per posizione" grid) from `PRIZES` styling, fed by static tier copy (i18n) — these describe the rewards, not per-user data.

- [ ] **Step 4: Rules.** Port the four `trn-rule` cards (conto sync, rischio 2%, drawdown −10R, ogni trade a diario) from i18n copy.

- [ ] **Step 5: Wire into ArenaView** below the board.

- [ ] **Step 6: Commit**

```bash
git add artifacts/trader-dashboard/src/components/tornei/{Prizes,Rules,NftCertificate,CertModal}.tsx artifacts/trader-dashboard/src/components/tornei/ArenaView.tsx
git commit -m "feat(tornei): prizes, rules, NFT certificate cards + claim modal"
```

---

### Task 17: Percorso view + Hall of fame

**Files:**
- Create: `components/tornei/PercorsoView.tsx`, `HallOfFame.tsx`

- [ ] **Step 1: PercorsoView.** Port the "DIREZIONE: PERCORSO" two-column grid: left = the user's card (avatar, division, R, discipline, next-division ladder from `nextDivision`), the user's certificates (from `useGetTorneiCertificates`), and prize progress; right column = compact season info + Albo d'oro. Drive from `useGetTorneiMe`. Empty state when not enrolled → enrol CTA.

- [ ] **Step 2: HallOfFame.** Port the `trn-hallrow` list from `useGetTorneiHall` (`entries`: season label, range, champion, R, discipline).

- [ ] **Step 3: Manual verification.** As an enrolled user, confirm Percorso shows your standing + certificates + hall; as a non-enrolled user, the enrol CTA.

- [ ] **Step 4: Commit**

```bash
git add artifacts/trader-dashboard/src/components/tornei/{PercorsoView,HallOfFame}.tsx
git commit -m "feat(tornei): Percorso view + Albo d'oro"
```

---

### Task 18: Wallet address in Settings

**Files:**
- Modify: `artifacts/trader-dashboard/src/pages/Settings.tsx`; the profile update endpoint (`routes/profile.ts` + its openapi schema) to accept `walletAddress`.

**Interfaces:**
- Consumes: existing profile update hook.

- [ ] **Step 1: Backend.** Add `walletAddress` (nullable string) to the profile update request schema in `openapi.yaml` and persist it in `routes/profile.ts` (validate EVM format `^0x[a-fA-F0-9]{40}$` or empty). Run `pnpm codegen`.

- [ ] **Step 2: Frontend.** Add a "Wallet (per certificati NFT)" field in Settings bound to the profile update mutation, with inline validation + i18n labels. Explain it's required to mint the certificate.

- [ ] **Step 3: Manual verification.** Save a wallet, reload, confirm it persists; invalid format is rejected.

- [ ] **Step 4: Commit**

```bash
git add lib/api-spec/openapi.yaml lib/api-zod lib/api-client-react artifacts/api-server/src/routes/profile.ts artifacts/trader-dashboard/src/pages/Settings.tsx
git commit -m "feat(tornei): wallet address field for NFT certificate minting"
```

---

### Task 19: Env template + docs

**Files:**
- Modify: `.env.railway.example`, `CLAUDE.md` (§7 Active work)

- [ ] **Step 1: Document env.** Add placeholders (no values) to `.env.railway.example`:

```
# Tornei NFT minting (optional — certificates stay "claimable" until set)
TORNEI_MINT_RPC_URL=
TORNEI_MINT_CONTRACT=
TORNEI_MINT_SIGNER_KEY=
TORNEI_MINT_CHAIN_ID=8453
```

- [ ] **Step 2: Update CLAUDE.md §7** with a short "Tornei" subsystem paragraph + spec/plan links (per the file's self-update convention).

- [ ] **Step 3: Commit**

```bash
git add .env.railway.example CLAUDE.md
git commit -m "docs(tornei): env template + CLAUDE.md subsystem note"
```

---

### Task 20: Full verification + push

- [ ] **Step 1: Run the gate**

Run: `pnpm verify`
Expected: install → codegen (in sync) → typecheck → test → build all green. Fix any failure before proceeding.

- [ ] **Step 2: Manual end-to-end** (local): create a live season; enrol as a user with a synced real account; sync trades; confirm standings materialize, board/podium/percorso render, metric toggle works; force a season `ended` + run `settleSeason` and confirm prizes/certificates created and Pro entitlement extended; with `TORNEI_MINT_FAKE=1` confirm a claim transitions `claimable→minted`.

- [ ] **Step 3: Push the branch**

```bash
git push origin feat/community-management
```

---

## Self-Review

**Spec coverage:** §3 architecture → Tasks 8–11; §4 data model → Task 1; §5 efficient standings → Tasks 4, 8, 11, 12; §6 rollover → Tasks 3, 11; §7 prizes → Tasks 5, 9; §8 on-chain NFT → Tasks 7, 10 (claim), 16, 18; §9 contract+i18n → Tasks 10, 13; §10 frontend → Tasks 14–17; §11 testing → every task + Task 20. All covered.

**Placeholder scan:** Pure-logic tasks (2–7, 9 helper, 11 helper) contain complete code + tests. DB/IO and UI-porting tasks (8, 9 settle body, 10, 12, 14–18) intentionally give interface signatures + a sketch + a named existing pattern to copy, because they are literal ports / drizzle-by-example against existing files; the executor reads the cited neighbour (`edgeReport.ts`, `community.ts`, `routes/journal.test.ts`, `routes/admin.ts`, `cotScheduler`) for the exact idiom. Each such task still ends with an independently testable deliverable.

**Type consistency:** `TorneiTrade`/`StandingInput`/`ComputedStanding` (Task 4) flow into `qualifyPrizes` (Task 5), `mapAccountTradeToTorneiTrade`/`materializeStandings` (Task 8) and `settleSeason` (Task 9). `Award` (Task 5) consumed by Task 9. `MintProvider`/`MintRequest`/`MintResult` (Task 7) consumed by Tasks 9 (cert status) + 10 (claim). `SeasonWindow` (Task 3) consumed by `planRollover` (Task 11). Names align across tasks.
