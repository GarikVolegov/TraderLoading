# Nightshift (agente autonomo notturno) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un harness locale (`auto/`) che ogni notte fa lavorare `claude -p` in autonomia su una coda di task (audit, PRD, chore) in worktree isolati, con gate meccanico, push su branch `auto/*` e PR su GitHub, più una fase di review delle PR aperte e un report mattutino.

**Architecture:** Bash orchestration (`run.sh` + `github.sh` sourced) possiede budget, tempo, gate e push; le operazioni JSON sulla coda stanno in `auto/queue.mjs` (Node puro, unit-testato con `node:test`); scheduling via launchd + `caffeinate`. Spec approvata: `docs/superpowers/specs/2026-07-05-nightshift-autonomous-agent-design.md`.

**Tech Stack:** bash 3.2 (macOS di serie), Node 22 (`node:test`, zero dipendenze), curl + API GitHub (PAT dal credential helper — **niente gh CLI**), launchd, `claude` CLI headless (`-p`).

## Global Constraints

- Toolchain non su PATH: ogni comando shell inizia con `export PATH="$HOME/.local/bin:$HOME/.local/node/bin:$HOME/Library/pnpm/.tools/pnpm/9.12.0:$PATH"` (vale anche per i comandi dei task qui sotto; nei file lo mette `config.sh`).
- Binari verificati: `claude` = `~/.local/bin/claude` · node v22.12.0 · pnpm 9.12.0 · PAT GitHub presente via `git credential fill`.
- Repo GitHub canonico: `GarikVolegov/TraderLoading` (il remoto locale punta al vecchio nome ma redirige).
- **Commit SEMPRE con pathspec** (`git commit -m "…" -- <paths>`): sulla working tree lavorano più agenti in concorrenza. Mai `git add -A`.
- Si lavora direttamente sul branch corrente `feat/community-management` (come il resto della sessione).
- Niente jq, niente brew, niente nuove dipendenze npm: JSON via `node`, test via `node:test`.
- Compatibilità bash 3.2: per array vuoti con `set -u` usare l'idioma `${ARR[@]+"${ARR[@]}"}`.
- I file `auto/*.mjs` sono JS puro (niente TypeScript, niente `any` — non applicabile).
- Nessun placeholder nei file creati: tutto il contenuto è in questo piano.

---

### Task 1: `queue.mjs` — funzioni pure di coda (next/start/done/fail/recover)

**Files:**
- Create: `auto/queue.mjs`
- Test: `auto/queue.test.mjs`

**Interfaces:**
- Produces (usate dai Task 2–3 e, via CLI, da `run.sh`):
  - `nextTask(queue, kind?)` → task | null — primo `status==="pending"` per `priority` asc poi `id`; `kind`: `"chore"` (solo `source==="chore"`), `"heavy"` (tutto tranne chore), `undefined` (tutti).
  - `startTask(queue, id)` → queue (status→`in_progress`).
  - `completeTask(queue, id, prUrl = null, note = "")` → queue (status→`done`).
  - `failTask(queue, id, note = "")` → queue (attempts+1; status→`pending` sotto `maxAttempts`, altrimenti `failed`).
  - `recoverStale(queue, note?)` → string[] degli id `in_progress` falliti via `failTask`.

- [ ] **Step 1: Scrivi i test che falliscono**

Crea `auto/queue.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { nextTask, startTask, completeTask, failTask, recoverStale } from "./queue.mjs";

const mk = (over = {}) => ({
  id: "T-1", source: "audit", title: "t", description: "d",
  acceptanceCriteria: [], priority: 1, status: "pending",
  attempts: 0, maxAttempts: 2, branch: null, prUrl: null, notes: "", ...over,
});

test("nextTask sceglie il pending con priorità più bassa (tie-break per id)", () => {
  const q = [mk({ id: "B", priority: 2 }), mk({ id: "A", priority: 1, status: "done" }), mk({ id: "C", priority: 1 })];
  assert.equal(nextTask(q).id, "C");
});

test("nextTask filtra per kind: chore vs heavy", () => {
  const q = [mk({ id: "H", source: "audit", priority: 5 }), mk({ id: "K", source: "chore", priority: 50 })];
  assert.equal(nextTask(q, "chore").id, "K");
  assert.equal(nextTask(q, "heavy").id, "H");
});

test("nextTask restituisce null se non c'è nulla di pending", () => {
  assert.equal(nextTask([mk({ status: "done" })]), null);
  assert.equal(nextTask([], "chore"), null);
});

test("startTask marca in_progress", () => {
  const q = [mk()];
  startTask(q, "T-1");
  assert.equal(q[0].status, "in_progress");
});

test("completeTask salva done + prUrl + nota", () => {
  const q = [mk({ status: "in_progress" })];
  completeTask(q, "T-1", "https://github.com/x/y/pull/9", "ok");
  assert.equal(q[0].status, "done");
  assert.equal(q[0].prUrl, "https://github.com/x/y/pull/9");
  assert.match(q[0].notes, /ok/);
});

test("failTask sotto maxAttempts torna pending e incrementa attempts", () => {
  const q = [mk({ status: "in_progress" })];
  failTask(q, "T-1", "boom");
  assert.equal(q[0].status, "pending");
  assert.equal(q[0].attempts, 1);
  assert.match(q[0].notes, /boom/);
});

test("failTask a maxAttempts marca failed", () => {
  const q = [mk({ status: "in_progress", attempts: 1 })];
  failTask(q, "T-1");
  assert.equal(q[0].status, "failed");
});

test("id inesistente lancia un errore esplicito", () => {
  assert.throws(() => startTask([], "NOPE"), /NOPE/);
});

test("recoverStale fallisce tutte le in_progress e ne restituisce gli id", () => {
  const q = [mk({ id: "A", status: "in_progress" }), mk({ id: "B" })];
  const ids = recoverStale(q);
  assert.deepEqual(ids, ["A"]);
  assert.equal(q[0].status, "pending");
  assert.equal(q[0].attempts, 1);
  assert.equal(q[1].status, "pending");
  assert.equal(q[1].attempts, 0);
});
```

- [ ] **Step 2: Verifica che falliscano**

Run: `node --test auto/queue.test.mjs`
Expected: FAIL — `Cannot find module … auto/queue.mjs`

- [ ] **Step 3: Implementazione minima**

Crea `auto/queue.mjs`:

```js
// Nightshift — operazioni sulla coda dei task. Node puro, zero dipendenze.
// Le funzioni mutano `queue` in place; il salvataggio è responsabilità della CLI (Task 3).

export function nextTask(queue, kind) {
  const match = (t) =>
    t.status === "pending" &&
    (kind === undefined ||
      (kind === "chore" && t.source === "chore") ||
      (kind === "heavy" && t.source !== "chore"));
  const pending = queue.filter(match);
  pending.sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));
  return pending[0] ?? null;
}

function mustFind(queue, id) {
  const t = queue.find((x) => x.id === id);
  if (!t) throw new Error(`task non trovato in coda: ${id}`);
  return t;
}

function appendNote(existing, note) {
  return existing ? `${existing} | ${note}` : note;
}

export function startTask(queue, id) {
  mustFind(queue, id).status = "in_progress";
  return queue;
}

export function completeTask(queue, id, prUrl = null, note = "") {
  const t = mustFind(queue, id);
  t.status = "done";
  if (prUrl) t.prUrl = prUrl;
  if (note) t.notes = appendNote(t.notes, note);
  return queue;
}

export function failTask(queue, id, note = "") {
  const t = mustFind(queue, id);
  t.attempts = (t.attempts ?? 0) + 1;
  t.status = t.attempts >= (t.maxAttempts ?? 2) ? "failed" : "pending";
  if (note) t.notes = appendNote(t.notes, note);
  return queue;
}

export function recoverStale(queue, note = "run precedente interrotta") {
  const stale = queue.filter((t) => t.status === "in_progress").map((t) => t.id);
  for (const id of stale) failTask(queue, id, note);
  return stale;
}
```

- [ ] **Step 4: Verifica verde**

Run: `node --test auto/queue.test.mjs`
Expected: PASS (9 test)

- [ ] **Step 5: Commit**

```bash
git add auto/queue.mjs auto/queue.test.mjs
git commit -m "feat(auto): nightshift queue core (next/start/done/fail/recover)" -- auto/queue.mjs auto/queue.test.mjs
```

---

### Task 2: `queue.mjs` — materializzazione chore ricorrenti

**Files:**
- Modify: `auto/queue.mjs` (append in fondo)
- Test: `auto/queue.test.mjs` (append in fondo)

**Interfaces:**
- Produces: `materializeChores(queue, chores, dateISO)` → task[] aggiunti. Un chore è "dovuto" se `recurrence==="nightly"`, oppure `recurrence==="weekly"` e `weekday` (0=domenica…6=sabato, default 1) coincide col giorno UTC di `dateISO`. Id generato: `<choreId>-<dateISO>`. Non duplica se esiste già un task `<choreId>-*` con status `pending`/`in_progress`, né se l'id esatto esiste già.
- Consumes: `completeTask` dal Task 1 (nei test).

- [ ] **Step 1: Aggiungi i test che falliscono** (in coda a `auto/queue.test.mjs`; estendi l'import esistente aggiungendo `materializeChores`)

```js
const mkChore = (over = {}) => ({
  id: "CHORE-x",
  recurrence: "nightly",
  template: { title: "c", description: "d", acceptanceCriteria: [], priority: 50, model: "sonnet" },
  ...over,
});

test("nightly viene materializzato con id datato e campi di stato", () => {
  const q = [];
  const added = materializeChores(q, [mkChore()], "2026-07-06");
  assert.equal(added.length, 1);
  assert.equal(q[0].id, "CHORE-x-2026-07-06");
  assert.equal(q[0].source, "chore");
  assert.equal(q[0].status, "pending");
  assert.equal(q[0].priority, 50);
  assert.equal(q[0].model, "sonnet");
  assert.equal(q[0].maxAttempts, 1);
});

test("weekly solo nel weekday giusto (2026-07-06 è lunedì)", () => {
  const c = mkChore({ id: "CHORE-w", recurrence: "weekly", weekday: 1 });
  assert.equal(materializeChores([], [c], "2026-07-06").length, 1);
  assert.equal(materializeChores([], [c], "2026-07-07").length, 0);
});

test("non duplica se c'è già un task aperto dello stesso chore", () => {
  const q = [];
  materializeChores(q, [mkChore()], "2026-07-05");
  assert.equal(materializeChores(q, [mkChore()], "2026-07-06").length, 0);
});

test("riappare il giorno dopo quando il precedente è concluso", () => {
  const q = [];
  materializeChores(q, [mkChore()], "2026-07-05");
  completeTask(q, "CHORE-x-2026-07-05");
  assert.equal(materializeChores(q, [mkChore()], "2026-07-06").length, 1);
});

test("idempotente nello stesso giorno anche se il precedente è done", () => {
  const q = [];
  materializeChores(q, [mkChore()], "2026-07-05");
  completeTask(q, "CHORE-x-2026-07-05");
  assert.equal(materializeChores(q, [mkChore()], "2026-07-05").length, 0);
});
```

- [ ] **Step 2: Verifica che falliscano**

Run: `node --test auto/queue.test.mjs`
Expected: FAIL — `materializeChores is not a function` (o import error)

- [ ] **Step 3: Implementazione** (append a `auto/queue.mjs`)

```js
export function materializeChores(queue, chores, dateISO) {
  const weekday = new Date(`${dateISO}T00:00:00Z`).getUTCDay(); // 0=domenica
  const added = [];
  for (const chore of chores) {
    const due =
      chore.recurrence === "nightly" ||
      (chore.recurrence === "weekly" && weekday === (chore.weekday ?? 1));
    if (!due) continue;
    const id = `${chore.id}-${dateISO}`;
    const open = queue.some(
      (t) => t.id.startsWith(`${chore.id}-`) && (t.status === "pending" || t.status === "in_progress"),
    );
    if (open || queue.some((t) => t.id === id)) continue;
    const task = {
      ...structuredClone(chore.template),
      id,
      source: "chore",
      status: "pending",
      attempts: 0,
      maxAttempts: chore.template.maxAttempts ?? 1,
      branch: null,
      prUrl: null,
      notes: "",
    };
    queue.push(task);
    added.push(task);
  }
  return added;
}
```

- [ ] **Step 4: Verifica verde**

Run: `node --test auto/queue.test.mjs`
Expected: PASS (14 test)

- [ ] **Step 5: Commit**

```bash
git add auto/queue.mjs auto/queue.test.mjs
git commit -m "feat(auto): nightshift chore materialization (nightly/weekly, no-dup)" -- auto/queue.mjs auto/queue.test.mjs
```

---

### Task 3: `queue.mjs` — CLI per bash

**Files:**
- Modify: `auto/queue.mjs` (append in fondo)
- Test: `auto/queue.cli.test.mjs` (nuovo)

**Interfaces:**
- Produces (contratto CLI usato da `run.sh` nel Task 6):
  - `node auto/queue.mjs next [chore|heavy]` → stampa il JSON del task su una riga, exit 0; exit 1 se coda vuota.
  - `node auto/queue.mjs start <id>` · `done <id> [prUrl] [note]` · `fail <id> [note]` — persistono su file, exit 0.
  - `node auto/queue.mjs recover` → stampa un id per riga dei task recuperati.
  - `node auto/queue.mjs materialize <YYYY-MM-DD> [--dry]` → stampa gli id aggiunti (prefisso `[dry] ` e nessuna scrittura con `--dry`).
  - File di lavoro: `auto/queue.json` e `auto/chores.json` accanto allo script, override con env `NIGHTSHIFT_QUEUE` / `NIGHTSHIFT_CHORES` (per i test).

- [ ] **Step 1: Scrivi i test che falliscono**

Crea `auto/queue.cli.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CLI = fileURLToPath(new URL("./queue.mjs", import.meta.url));

function setup(queue, chores = []) {
  const dir = mkdtempSync(path.join(tmpdir(), "nightshift-"));
  const env = {
    ...process.env,
    NIGHTSHIFT_QUEUE: path.join(dir, "queue.json"),
    NIGHTSHIFT_CHORES: path.join(dir, "chores.json"),
  };
  writeFileSync(env.NIGHTSHIFT_QUEUE, JSON.stringify(queue));
  writeFileSync(env.NIGHTSHIFT_CHORES, JSON.stringify(chores));
  return env;
}

const run = (env, ...args) =>
  execFileSync(process.execPath, [CLI, ...args], { env, encoding: "utf8" });

const baseTask = {
  id: "A", source: "audit", title: "t", description: "d", acceptanceCriteria: [],
  priority: 1, status: "pending", attempts: 0, maxAttempts: 2, branch: null, prUrl: null, notes: "",
};

test("next stampa il task; start/done persistono su file", () => {
  const env = setup([baseTask]);
  assert.equal(JSON.parse(run(env, "next")).id, "A");
  run(env, "start", "A");
  run(env, "done", "A", "https://github.com/x/y/pull/1");
  const q = JSON.parse(readFileSync(env.NIGHTSHIFT_QUEUE, "utf8"));
  assert.equal(q[0].status, "done");
  assert.equal(q[0].prUrl, "https://github.com/x/y/pull/1");
});

test("next esce 1 a coda vuota", () => {
  const env = setup([]);
  assert.throws(() => run(env, "next"));
});

test("next filtra per kind da CLI", () => {
  const env = setup([{ ...baseTask, id: "K", source: "chore", priority: 50 }]);
  assert.throws(() => run(env, "next", "heavy"));
  assert.equal(JSON.parse(run(env, "next", "chore")).id, "K");
});

test("fail incrementa attempts e persiste", () => {
  const env = setup([{ ...baseTask, status: "in_progress" }]);
  run(env, "fail", "A", "gate rosso");
  const q = JSON.parse(readFileSync(env.NIGHTSHIFT_QUEUE, "utf8"));
  assert.equal(q[0].attempts, 1);
  assert.equal(q[0].status, "pending");
});

test("recover stampa gli id recuperati", () => {
  const env = setup([{ ...baseTask, status: "in_progress" }]);
  assert.equal(run(env, "recover").trim(), "A");
});

test("materialize scrive; --dry non scrive", () => {
  const chores = [{ id: "C", recurrence: "nightly", template: { title: "c", description: "", acceptanceCriteria: [], priority: 50 } }];
  const dry = setup([], chores);
  assert.match(run(dry, "materialize", "2026-07-06", "--dry"), /\[dry\] C-2026-07-06/);
  assert.equal(JSON.parse(readFileSync(dry.NIGHTSHIFT_QUEUE, "utf8")).length, 0);
  const wet = setup([], chores);
  assert.match(run(wet, "materialize", "2026-07-06"), /C-2026-07-06/);
  assert.equal(JSON.parse(readFileSync(wet.NIGHTSHIFT_QUEUE, "utf8")).length, 1);
});
```

- [ ] **Step 2: Verifica che falliscano**

Run: `node --test auto/queue.cli.test.mjs`
Expected: FAIL — i comandi non producono nulla (manca il main CLI), i primi assert falliscono

- [ ] **Step 3: Implementazione** (append a `auto/queue.mjs`)

```js
// ---- CLI --------------------------------------------------------------------
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

function loadJSON(p) {
  return JSON.parse(readFileSync(p, "utf8"));
}
function saveJSON(p, v) {
  writeFileSync(p, JSON.stringify(v, null, 2) + "\n");
}

export function runCli(argv, env = process.env) {
  const autoDir = path.dirname(fileURLToPath(import.meta.url));
  const queueFile = env.NIGHTSHIFT_QUEUE ?? path.join(autoDir, "queue.json");
  const choresFile = env.NIGHTSHIFT_CHORES ?? path.join(autoDir, "chores.json");
  const [cmd, ...rest] = argv;
  const queue = loadJSON(queueFile);
  switch (cmd) {
    case "next": {
      const t = nextTask(queue, rest[0]);
      if (!t) return 1;
      process.stdout.write(JSON.stringify(t) + "\n");
      return 0;
    }
    case "start":
      startTask(queue, rest[0]);
      saveJSON(queueFile, queue);
      return 0;
    case "done":
      completeTask(queue, rest[0], rest[1] || null, rest[2] ?? "");
      saveJSON(queueFile, queue);
      return 0;
    case "fail":
      failTask(queue, rest[0], rest[1] ?? "");
      saveJSON(queueFile, queue);
      return 0;
    case "recover": {
      const ids = recoverStale(queue);
      saveJSON(queueFile, queue);
      for (const id of ids) process.stdout.write(id + "\n");
      return 0;
    }
    case "materialize": {
      const dry = rest.includes("--dry");
      const dateISO = rest.find((a) => !a.startsWith("--"));
      if (!dateISO) throw new Error("materialize richiede una data YYYY-MM-DD");
      const added = materializeChores(queue, loadJSON(choresFile), dateISO);
      if (!dry) saveJSON(queueFile, queue);
      for (const t of added) process.stdout.write(`${dry ? "[dry] " : ""}${t.id}\n`);
      return 0;
    }
    default:
      process.stderr.write("uso: queue.mjs next [chore|heavy] | start <id> | done <id> [prUrl] [note] | fail <id> [note] | recover | materialize <data> [--dry]\n");
      return 2;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(runCli(process.argv.slice(2)));
}
```

- [ ] **Step 4: Verifica verde (tutti i test queue)**

Run: `node --test auto/queue.test.mjs auto/queue.cli.test.mjs`
Expected: PASS (20 test)

- [ ] **Step 5: Commit**

```bash
git add auto/queue.mjs auto/queue.cli.test.mjs
git commit -m "feat(auto): nightshift queue CLI (next/start/done/fail/recover/materialize)" -- auto/queue.mjs auto/queue.cli.test.mjs
```

---

### Task 4: dati seed (coda + chore), `config.sh`, prompt, `.gitignore`

**Files:**
- Create: `auto/queue.json`, `auto/chores.json`, `auto/config.sh`
- Create: `auto/prompts/rules.md`, `auto/prompts/audit.md`, `auto/prompts/prd.md`, `auto/prompts/chore.md`, `auto/prompts/review.md`
- Modify: `.gitignore` (append)

**Interfaces:**
- Consumes: contratto CLI del Task 3 (per la verifica).
- Produces: `config.sh` definisce le variabili lette da `run.sh` (Task 6): `MAX_TASKS`, `STOP_HOUR`, `TASK_TIMEOUT`, `CHORE_TIMEOUT`, `BASE_BRANCH`, `GITHUB_REPO`, `CLAUDE_BIN`, `LIGHT_MODEL` (+ export PATH). I prompt sono concatenati da `run.sh` così: `rules.md` + `<source>.md` + JSON del task (per questo il file di tipo si chiama come il campo `source`: `audit.md`, `prd.md`, `chore.md`).

- [ ] **Step 1: Crea `auto/queue.json`** — seed con i critici del piano audit (lo step 0.2 E2EE è ESCLUSO di proposito: richiede una decisione di prodotto dell'utente — E2EE reale vs rimozione del claim)

```json
[
  {
    "id": "AUD-0.8-gdpr-delete",
    "source": "audit",
    "title": "Cancellazione account completa (GDPR)",
    "description": "Implementa lo step 0.8 [C] «Cancellazione account completa (GDPR)» del piano docs/superpowers/plans/2026-07-05-audit-completo-piano-implementazione.md: leggi l'intera sezione 0.8 e attua tutti i suoi step.",
    "acceptanceCriteria": [
      "Tutti gli step della sezione 0.8 del piano audit implementati",
      "Test scritti prima dell'implementazione (TDD) per ogni comportamento nuovo",
      "pnpm typecheck e pnpm test verdi"
    ],
    "priority": 1,
    "status": "pending",
    "attempts": 0,
    "maxAttempts": 2,
    "branch": null,
    "prUrl": null,
    "notes": ""
  },
  {
    "id": "AUD-0.6-xp-farming",
    "source": "audit",
    "title": "Chiudere il farming di XP",
    "description": "Implementa lo step 0.6 [C/H] «Chiudere il farming di XP» del piano docs/superpowers/plans/2026-07-05-audit-completo-piano-implementazione.md: leggi l'intera sezione 0.6 e attua tutti i suoi step (reset-today senza guardia, clamp xpReward, TOCTOU/atomicità XP).",
    "acceptanceCriteria": [
      "Tutti gli step della sezione 0.6 del piano audit implementati",
      "Test scritti prima dell'implementazione (TDD) per ogni comportamento nuovo",
      "pnpm typecheck e pnpm test verdi"
    ],
    "priority": 2,
    "status": "pending",
    "attempts": 0,
    "maxAttempts": 2,
    "branch": null,
    "prUrl": null,
    "notes": ""
  },
  {
    "id": "AUD-0.11-broker-profile",
    "source": "audit",
    "title": "BrokerHub: active profile per-utente",
    "description": "Implementa lo step 0.11 [C] «BrokerHub: active profile per-utente (bug multi-tenant)» del piano docs/superpowers/plans/2026-07-05-audit-completo-piano-implementazione.md: leggi l'intera sezione 0.11 e attua tutti i suoi step.",
    "acceptanceCriteria": [
      "Tutti gli step della sezione 0.11 del piano audit implementati",
      "Test scritti prima dell'implementazione (TDD) per ogni comportamento nuovo",
      "pnpm typecheck e pnpm test verdi"
    ],
    "priority": 3,
    "status": "pending",
    "attempts": 0,
    "maxAttempts": 2,
    "branch": null,
    "prUrl": null,
    "notes": ""
  },
  {
    "id": "AUD-0.5-community-roles",
    "source": "audit",
    "title": "Community: gerarchia ruoli + privacy reale",
    "description": "Implementa lo step 0.5 [C/H] «Community: gerarchia ruoli + privacy reale» del piano docs/superpowers/plans/2026-07-05-audit-completo-piano-implementazione.md: leggi l'intera sezione 0.5 e attua tutti i suoi step (no auto-promozione a owner, privacy effettiva delle community private).",
    "acceptanceCriteria": [
      "Tutti gli step della sezione 0.5 del piano audit implementati",
      "Test scritti prima dell'implementazione (TDD) per ogni comportamento nuovo",
      "pnpm typecheck e pnpm test verdi"
    ],
    "priority": 4,
    "status": "pending",
    "attempts": 0,
    "maxAttempts": 2,
    "branch": null,
    "prUrl": null,
    "notes": ""
  },
  {
    "id": "AUD-0.9-tornei-integrity",
    "source": "audit",
    "title": "Tornei: chiudere le manipolazioni della classifica",
    "description": "Implementa lo step 0.9 [C/H] «Tornei: chiudere le manipolazioni della classifica» del piano docs/superpowers/plans/2026-07-05-audit-completo-piano-implementazione.md: leggi l'intera sezione 0.9 e attua tutti i suoi step (soglia attività minima per i premi, ecc.).",
    "acceptanceCriteria": [
      "Tutti gli step della sezione 0.9 del piano audit implementati",
      "Test scritti prima dell'implementazione (TDD) per ogni comportamento nuovo",
      "pnpm typecheck e pnpm test verdi"
    ],
    "priority": 5,
    "status": "pending",
    "attempts": 0,
    "maxAttempts": 2,
    "branch": null,
    "prUrl": null,
    "notes": ""
  }
]
```

- [ ] **Step 2: Crea `auto/chores.json`**

```json
[
  {
    "id": "CHORE-verify-base",
    "recurrence": "nightly",
    "template": {
      "title": "Verifica salute del branch base",
      "description": "Esegui pnpm typecheck e pnpm test. Se tutto è verde termina SENZA fare alcuna modifica (nessun commit). Se qualcosa è rosso, applica systematic debugging: trova la causa, scrivi il test che la fissa, correggi, e ferma il lavoro quando il gate è verde.",
      "acceptanceCriteria": [
        "pnpm typecheck verde",
        "pnpm test verde",
        "nessuna modifica se era già tutto verde"
      ],
      "priority": 50,
      "model": "sonnet"
    }
  },
  {
    "id": "CHORE-deps-audit",
    "recurrence": "weekly",
    "weekday": 1,
    "template": {
      "title": "Audit settimanale dipendenze",
      "description": "Esegui pnpm outdated -r e pnpm audit. Applica SOLO bump patch/minor chiaramente sicuri (max 5 pacchetti; in dubbio, salta e annota in AUTONOTES.md). Dopo ogni bump pnpm typecheck e pnpm test devono restare verdi. Niente major, niente pacchetti nuovi.",
      "acceptanceCriteria": [
        "solo bump patch/minor",
        "pnpm typecheck e pnpm test verdi dopo ogni bump",
        "pnpm-lock.yaml aggiornato e coerente"
      ],
      "priority": 60,
      "model": "sonnet"
    }
  }
]
```

- [ ] **Step 3: Crea `auto/config.sh`**

```bash
# Nightshift — configurazione (sourced da run.sh; niente logica qui)
export PATH="$HOME/.local/bin:$HOME/.local/node/bin:$HOME/Library/pnpm/.tools/pnpm/9.12.0:$PATH"

MAX_TASKS=2                              # task pesanti (audit/prd) per notte
STOP_HOUR=7                              # nelle run schedulate non si iniziano task dopo quest'ora
TASK_TIMEOUT=3600                        # secondi max per un task pesante
CHORE_TIMEOUT=1200                       # secondi max per chore e review
BASE_BRANCH="feat/community-management"  # branch da cui partono i worktree e verso cui aprire le PR
GITHUB_REPO="GarikVolegov/TraderLoading" # repo canonico (il vecchio nome redirige)
CLAUDE_BIN="$HOME/.local/bin/claude"
LIGHT_MODEL="sonnet"                     # modello per chore e review
```

- [ ] **Step 4: Crea i prompt**

`auto/prompts/rules.md`:

```markdown
# Regole Nightshift (agente notturno non presidiato)

Lavori in un worktree isolato del repo TraderLoadings. Nessun umano ti guarda: nel dubbio
scegli sempre la strada più conservativa.

1. Leggi CLAUDE.md del repo e rispettalo (pnpm only, TS strict senza `any`, ogni stringa UI
   nuova via t() con chiavi in tutte e 5 le lingue, ecc.).
2. TDD obbligatorio: prima il test che fallisce, poi l'implementazione, poi il verde.
3. Commit frequenti e SOLO con pathspec: `git add <file…> && git commit -m "tipo(scope): …" -- <file…>`.
   MAI `git add -A`, `git add .` o `git commit -a`.
4. VIETATO: `git push`, aprire PR, merge, `--force`, cambiare branch.
5. VIETATO modificare migrazioni esistenti in lib/db/drizzle/ (nuove migrazioni ok,
   numerate a seguire; sono hand-authored, NON usare db:generate).
6. VIETATO modificare a mano i file generati (lib/api-client-react, lib/api-zod): se tocchi
   lib/api-spec/openapi.yaml esegui `pnpm codegen` e committa il risultato.
7. VIETATO `prettier --write` su file di artifacts/api-server.
8. Niente segreti nel codice, nei test o nei commit.
9. Se il task richiede una decisione di prodotto che non ti compete, NON inventare: scrivi
   il dubbio in un file AUTONOTES.md nella root del worktree (NON committarlo) e fermati lì.
10. Prima di considerarti finito: `pnpm typecheck && pnpm test` verdi nel worktree e
    `git status` pulito (tutto il tuo lavoro committato; AUTONOTES.md può restare non tracciato).
```

`auto/prompts/audit.md`:

```markdown
# Task di tipo AUDIT

Questo task implementa una sezione del piano audit:
docs/superpowers/plans/2026-07-05-audit-completo-piano-implementazione.md

Apri la sezione indicata nella descrizione del task JSON qui sotto, leggi finding, evidenze
`file:riga` e step proposti, e implementa TUTTI gli step della sezione fino a soddisfare i
criteri di accettazione. La sezione contiene già la verifica attesa: usala come guida per i test.
```

`auto/prompts/prd.md`:

```markdown
# Task di tipo PRD (user story)

Questo task è una user story di una nuova feature. Implementala rispettando alla lettera i
criteri di accettazione del task JSON qui sotto. Se la storia cita un documento di spec in
docs/superpowers/specs/, leggilo prima di iniziare.
```

`auto/prompts/chore.md`:

```markdown
# Task di tipo CHORE (manutenzione ricorrente)

Task di manutenzione. Se dopo la diagnosi non c'è nulla da fare, termina SENZA modifiche e
senza commit: "nessuna modifica necessaria" è un esito valido e apprezzato.
```

`auto/prompts/review.md`:

```markdown
# Review PR (il tuo output è SOLO il commento)

Sotto trovi il diff di una pull request di questo repo. Scrivi SOLO il testo markdown del
commento di review, iniziando esattamente con questa riga:
<!-- nightshift-review -->
Poi: 1) verdetto in una frase; 2) elenco (max 10) dei problemi reali in ordine di gravità —
bug, sicurezza, regressioni, violazioni delle convenzioni di CLAUDE.md — ognuno con
file:riga e il perché; 3) se non trovi problemi sostanziali, dillo in una riga. Niente lodi
generiche, niente testo fuori dal commento.

## Diff
```

- [ ] **Step 5: Aggiorna `.gitignore`** (append idempotente)

```bash
for line in 'auto/logs/' 'auto/reports/' 'auto/.lock' 'auto/STOP' '.worktrees/'; do
  grep -qxF "$line" .gitignore || echo "$line" >> .gitignore
done
```

- [ ] **Step 6: Verifica**

```bash
node -e 'JSON.parse(require("node:fs").readFileSync("auto/queue.json","utf8")); JSON.parse(require("node:fs").readFileSync("auto/chores.json","utf8")); console.log("JSON ok")'
bash -n auto/config.sh && echo "config ok"
node auto/queue.mjs next
```

Expected: `JSON ok`, `config ok`, e l'ultima riga stampa il JSON di `AUD-0.8-gdpr-delete`.

- [ ] **Step 7: Commit**

```bash
git add auto/queue.json auto/chores.json auto/config.sh auto/prompts .gitignore
git commit -m "feat(auto): nightshift seed (audit criticals, chores), config, prompt templates" -- auto/queue.json auto/chores.json auto/config.sh auto/prompts .gitignore
```

---

### Task 5: `auto/github.sh` — helper API GitHub

**Files:**
- Create: `auto/github.sh`

**Interfaces:**
- Consumes: `GITHUB_REPO` e `BASE_BRANCH` da `config.sh` (già sourced dal chiamante).
- Produces (funzioni sourced da `run.sh`):
  - `gh_pat` → stampa il PAT dal credential helper (mai loggarlo).
  - `gh_api METHOD PATH [FILE_JSON]` → chiama `https://api.github.com`.
  - `gh_open_prs` → una riga `numero<TAB>branch` per ogni PR aperta.
  - `gh_pr_diff N` → diff della PR (troncato a 200 kB).
  - `gh_pr_reviewed N` → exit 0 se c'è già un commento contenente `<!-- nightshift-review -->`.
  - `gh_comment N FILE_MD` → posta il file come commento.
  - `gh_create_pr BRANCH TITLE FILE_MD` → apre la PR verso `BASE_BRANCH`, stampa l'URL.

- [ ] **Step 1: Crea `auto/github.sh`**

```bash
# Nightshift — helper API GitHub. Da sourcare DOPO config.sh.
# Richiede: curl, node, PAT nel credential helper git. Il PAT non va MAI stampato/loggato.

gh_pat() {
  printf 'protocol=https\nhost=github.com\n\n' | git credential fill | sed -n 's/^password=//p'
}

gh_api() { # gh_api METHOD PATH [FILE_JSON_BODY]
  local method="$1" apipath="$2" body="${3:-}"
  local args=(-sS -X "$method" \
    -H "Authorization: Bearer $(gh_pat)" \
    -H "Accept: application/vnd.github+json" \
    "https://api.github.com$apipath")
  [[ -n "$body" ]] && args=("${args[@]}" -H "Content-Type: application/json" --data-binary "@$body")
  curl "${args[@]}"
}

gh_open_prs() { # stampa: "<numero>\t<branch di testa>" per ogni PR aperta
  gh_api GET "/repos/$GITHUB_REPO/pulls?state=open&per_page=50" \
    | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{for(const p of JSON.parse(s))console.log(p.number+"\t"+p.head.ref)})'
}

gh_pr_diff() { # gh_pr_diff NUMERO
  curl -sS -H "Authorization: Bearer $(gh_pat)" -H "Accept: application/vnd.github.v3.diff" \
    "https://api.github.com/repos/$GITHUB_REPO/pulls/$1" | head -c 200000
}

gh_pr_reviewed() { # exit 0 se la PR ha già la review nightshift
  gh_api GET "/repos/$GITHUB_REPO/issues/$1/comments?per_page=100" \
    | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{process.exit(JSON.parse(s).some(c=>(c.body||"").includes("<!-- nightshift-review -->"))?0:1)})'
}

gh_comment() { # gh_comment NUMERO FILE_BODY_MD
  node -e 'const fs=require("node:fs");process.stdout.write(JSON.stringify({body:fs.readFileSync(process.argv[1],"utf8")}))' "$2" > "$2.json"
  gh_api POST "/repos/$GITHUB_REPO/issues/$1/comments" "$2.json" > /dev/null
  rm -f "$2.json"
}

gh_create_pr() { # gh_create_pr BRANCH TITLE FILE_BODY_MD → stampa html_url
  node -e 'const fs=require("node:fs");const [b,t,f,base]=process.argv.slice(1);process.stdout.write(JSON.stringify({head:b,base,title:t,body:fs.readFileSync(f,"utf8")}))' \
    "$1" "$2" "$3" "$BASE_BRANCH" > "$3.json"
  local out rc=0
  out=$(gh_api POST "/repos/$GITHUB_REPO/pulls" "$3.json" \
    | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const r=JSON.parse(s);if(!r.html_url){console.error("PR non creata: "+(r.message||s.slice(0,300)));process.exit(1)}console.log(r.html_url)})') || rc=1
  rm -f "$3.json"
  [[ $rc -eq 0 ]] && printf '%s\n' "$out"
  return $rc
}
```

- [ ] **Step 2: Verifica sintassi + smoke read-only**

```bash
bash -n auto/github.sh && echo "sintassi ok"
bash -c 'source auto/config.sh; source auto/github.sh; echo "PAT: $([ -n "$(gh_pat)" ] && echo presente)"; gh_open_prs; echo "open_prs: exit $?"'
```

Expected: `sintassi ok`, `PAT: presente`, poi zero o più righe `numero<TAB>branch` e `open_prs: exit 0`. (Solo chiamate read-only.)

- [ ] **Step 3: Commit**

```bash
git add auto/github.sh
git commit -m "feat(auto): nightshift GitHub API helpers (PAT via credential helper, no gh CLI)" -- auto/github.sh
```

---

### Task 6: `auto/run.sh` — il runner notturno (con `--dry-run`)

**Files:**
- Create: `auto/run.sh` (eseguibile)

**Interfaces:**
- Consumes: `config.sh` (variabili), `github.sh` (funzioni `gh_*`), CLI `queue.mjs` (Task 3), prompt (Task 4).
- Produces: branch `auto/<id>` pushati + PR; `auto/reports/YYYY-MM-DD.md`; log in `auto/logs/`. Env riconosciute: `NIGHTSHIFT_SCHEDULED=1` (abilita il check `STOP_HOUR`, la imposta il plist), `MAX_TASKS` override da ambiente non previsto (si cambia in `config.sh`).

- [ ] **Step 1: Crea `auto/run.sh`**

```bash
#!/usr/bin/env bash
# Nightshift — runner notturno. Uso: ./auto/run.sh [--dry-run]
# Guard-rail: lavora SOLO in worktree sotto .worktrees/, pusha SOLO branch auto/*, mai merge.
set -euo pipefail

AUTO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(dirname "$AUTO_DIR")"
source "$AUTO_DIR/config.sh"
source "$AUTO_DIR/github.sh"

DRY=0
[[ "${1:-}" == "--dry-run" ]] && DRY=1

TODAY="$(date +%F)"
LOG_DIR="$AUTO_DIR/logs"
REPORT_DIR="$AUTO_DIR/reports"
mkdir -p "$LOG_DIR" "$REPORT_DIR"
RUN_LOG="$LOG_DIR/run-$TODAY.log"
REPORT_LINES=()

log() { printf '%s %s\n' "$(date '+%H:%M:%S')" "$*" | tee -a "$RUN_LOG"; }
report() { REPORT_LINES=(${REPORT_LINES[@]+"${REPORT_LINES[@]}"} "$*"); }
queue() { node "$AUTO_DIR/queue.mjs" "$@"; }
task_field() { node -pe 'JSON.parse(process.argv[1]).'"$2"' ?? ""' "$1"; }

# ---- pre-flight ---------------------------------------------------------------
[[ -f "$AUTO_DIR/STOP" ]] && { log "STOP presente: esco."; exit 0; }

LOCK="$AUTO_DIR/.lock"
if [[ -f "$LOCK" ]] && kill -0 "$(cat "$LOCK")" 2>/dev/null; then
  log "run già attiva (pid $(cat "$LOCK")): esco."
  exit 0
fi
echo $$ > "$LOCK"
trap 'rm -f "$LOCK"' EXIT

cd "$REPO_DIR"
git fetch origin --quiet
mkdir -p "$REPO_DIR/.worktrees"

stale="$(queue recover || true)"
[[ -n "$stale" ]] && report "⚠️ task interrotti dalla run precedente (ritentati): $(echo "$stale" | tr '\n' ' ')"

if [[ $DRY -eq 1 ]]; then
  queue materialize "$TODAY" --dry | while read -r line; do log "materialize: $line"; done
else
  queue materialize "$TODAY" | while read -r line; do log "materialize: $line"; done
fi

clock_ok() { # nelle run schedulate non si iniziano task dopo STOP_HOUR
  [[ "${NIGHTSHIFT_SCHEDULED:-0}" != "1" ]] && return 0
  (( 10#$(date +%H) < STOP_HOUR ))
}

# ---- gate meccanico -------------------------------------------------------------
gate() { # gate WORKTREE — indipendente da ciò che dichiara il modello
  local wt="$1"
  ( cd "$wt" && pnpm install --prefer-offline >>"$RUN_LOG" 2>&1 \
      && pnpm typecheck >>"$RUN_LOG" 2>&1 \
      && pnpm test >>"$RUN_LOG" 2>&1 ) || { log "gate: typecheck/test rossi"; return 1; }
  if ( cd "$wt" && git diff "origin/$BASE_BRANCH...HEAD" -- . ':!pnpm-lock.yaml' \
      | grep -qE 'sk-[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY' ); then
    log "gate: possibile segreto nel diff"; return 1
  fi
  if ( cd "$wt" && git diff --name-only --diff-filter=MD "origin/$BASE_BRANCH...HEAD" -- 'lib/db/drizzle/*.sql' | grep -q . ); then
    log "gate: migrazione esistente modificata/cancellata"; return 1
  fi
  if ( cd "$wt" && git status --porcelain | grep -v 'AUTONOTES.md' | grep -q . ); then
    log "gate: working tree non pulita (lavoro non committato)"; return 1
  fi
  return 0
}

make_pr_body() { # make_pr_body TASK_JSON N_COMMIT
  node -e '
    const t = JSON.parse(process.argv[1]);
    const n = process.argv[2];
    const ac = t.acceptanceCriteria.map(c => "- " + c).join("\n");
    process.stdout.write(`## ${t.title}\n\n${t.description}\n\n### Criteri di accettazione\n${ac}\n\n### Gate\n- typecheck ✅ · test ✅ · anti-secret ✅ (${n} commit)\n\n_Aperta automaticamente da Nightshift (task ${t.id})._\n`);
  ' "$1" "$2"
}

# ---- fase review ----------------------------------------------------------------
log "fase review PR aperte"
while IFS=$'\t' read -r num branch; do
  [[ -z "${num:-}" ]] && continue
  if gh_pr_reviewed "$num"; then log "PR #$num già recensita"; continue; fi
  if [[ $DRY -eq 1 ]]; then log "DRY: recensirei PR #$num ($branch)"; continue; fi
  log "review PR #$num ($branch)"
  body="$LOG_DIR/review-$num.md"
  if { cat "$AUTO_DIR/prompts/review.md"; echo; gh_pr_diff "$num"; } \
      | timeout "$CHORE_TIMEOUT" "$CLAUDE_BIN" -p --model "$LIGHT_MODEL" --dangerously-skip-permissions \
      > "$body" 2>>"$RUN_LOG" && grep -q 'nightshift-review' "$body"; then
    gh_comment "$num" "$body"
    report "🔍 review postata su PR #$num ($branch)"
  else
    report "❌ review PR #$num fallita (vedi $RUN_LOG)"
  fi
done < <(gh_open_prs)

# ---- fase lavoro ------------------------------------------------------------------
work_loop() { # work_loop KIND BUDGET TIMEOUT
  local kind="$1" budget="$2" tmo="$3" launched=0
  while (( launched < budget )); do
    clock_ok || { log "oltre STOP_HOUR: non inizio altri task $kind"; break; }
    local task_json
    task_json=$(queue next "$kind") || { log "coda $kind vuota"; break; }
    local id src model title
    id=$(task_field "$task_json" id)
    src=$(task_field "$task_json" source)
    model=$(task_field "$task_json" model)
    title=$(task_field "$task_json" title)
    if [[ $DRY -eq 1 ]]; then log "DRY: lavorerei $id ($src): $title"; break; fi
    launched=$((launched + 1))
    queue start "$id"
    log "task $id ($src): $title"

    local wt="$REPO_DIR/.worktrees/auto-$id" branch="auto/$id"
    git worktree remove --force "$wt" 2>/dev/null || true
    git branch -D "$branch" 2>/dev/null || true
    git worktree add "$wt" -b "$branch" "origin/$BASE_BRANCH" >>"$RUN_LOG" 2>&1

    local prompt="$LOG_DIR/prompt-$id.md"
    { cat "$AUTO_DIR/prompts/rules.md"; echo; cat "$AUTO_DIR/prompts/$src.md"; echo
      echo '## Il tuo task'; echo '```json'; printf '%s\n' "$task_json"; echo '```'; } > "$prompt"
    local margs=()
    [[ -n "$model" ]] && margs=(--model "$model")
    if ! ( cd "$wt" && timeout "$tmo" "$CLAUDE_BIN" -p ${margs[@]+"${margs[@]}"} --dangerously-skip-permissions \
        < "$prompt" >>"$RUN_LOG" 2>&1 ); then
      queue fail "$id" "claude fallito o timeout"
      report "❌ $id: claude fallito/timeout (worktree lasciato: $wt)"
      continue
    fi
    [[ -f "$wt/AUTONOTES.md" ]] && report "📝 $id ha lasciato note: $(head -c 500 "$wt/AUTONOTES.md")"
    if ! gate "$wt"; then
      queue fail "$id" "gate rosso"
      report "❌ $id: gate rosso (worktree lasciato per ispezione: $wt)"
      continue
    fi
    local commits
    commits=$(cd "$wt" && git rev-list --count "origin/$BASE_BRANCH..HEAD")
    if (( commits == 0 )); then
      queue done "$id" "" "nessuna modifica necessaria"
      git worktree remove --force "$wt"
      git branch -D "$branch" 2>/dev/null || true
      report "✅ $id: nessuna modifica necessaria"
      continue
    fi
    if ! ( cd "$wt" && git push -u origin "$branch" ) >>"$RUN_LOG" 2>&1; then
      queue fail "$id" "push fallito"
      report "❌ $id: push fallito (worktree lasciato: $wt)"
      continue
    fi
    local prbody="$LOG_DIR/prbody-$id.md" pr_url=""
    make_pr_body "$task_json" "$commits" > "$prbody"
    pr_url=$(gh_create_pr "$branch" "[nightshift] $title" "$prbody") || pr_url=""
    queue done "$id" "$pr_url"
    git worktree remove --force "$wt"
    report "✅ $id → ${pr_url:-PR non creata, branch pushato: $branch}"
  done
}

log "fase chore"
work_loop chore 10 "$CHORE_TIMEOUT"
log "fase lavoro pesante (max $MAX_TASKS)"
work_loop heavy "$MAX_TASKS" "$TASK_TIMEOUT"

# ---- chiusura -----------------------------------------------------------------------
REPORT_FILE="$REPORT_DIR/$TODAY.md"
{
  echo "# Nightshift — $TODAY"
  echo
  if [[ ${#REPORT_LINES[@]} -eq 0 ]]; then
    echo "- nessun evento (coda vuota o solo review già fatte)"
  else
    for line in "${REPORT_LINES[@]}"; do echo "- $line"; done
  fi
} > "$([[ $DRY -eq 1 ]] && echo /dev/stdout || echo "$REPORT_FILE")"
if [[ $DRY -eq 0 ]]; then
  log "report: $REPORT_FILE"
  osascript -e "display notification \"${#REPORT_LINES[@]} eventi — vedi auto/reports/$TODAY.md\" with title \"Nightshift\"" 2>/dev/null || true
fi
log "fine run"
```

Poi: `chmod +x auto/run.sh`

- [ ] **Step 2: Verifica sintassi**

Run: `bash -n auto/run.sh && echo "sintassi ok"`
Expected: `sintassi ok`

- [ ] **Step 3: Dry-run end-to-end**

Run: `./auto/run.sh --dry-run`
Expected (nessuna scrittura su GitHub, nessun claude lanciato, coda intatta):
- eventuali righe `materialize: [dry] CHORE-verify-base-<oggi>`
- `fase review PR aperte` + una riga `DRY: recensirei PR #N (…)` per ogni PR aperta non recensita (o niente se non ce ne sono)
- `fase chore` + `coda chore vuota` (il materialize --dry non persiste)
- `fase lavoro pesante (max 2)` + `DRY: lavorerei AUD-0.8-gdpr-delete (audit): Cancellazione account completa (GDPR)`
- il report stampato su stdout
- `git status --porcelain auto/queue.json` vuoto (coda non toccata)

- [ ] **Step 4: Commit**

```bash
git add auto/run.sh
git commit -m "feat(auto): nightshift runner (review + chore + heavy loop, gate meccanico, dry-run)" -- auto/run.sh
```

---

### Task 7: launchd plist + runbook operativo

**Files:**
- Create: `auto/com.traderloadings.nightshift.plist` (template versionato; l'installazione è una copia in `~/Library/LaunchAgents/`)
- Create: `auto/README.md`

**Interfaces:**
- Consumes: `auto/run.sh` (Task 6).
- Produces: schedulazione 01:00 con `NIGHTSHIFT_SCHEDULED=1` e `caffeinate -i`.

- [ ] **Step 1: Crea `auto/com.traderloadings.nightshift.plist`**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.traderloadings.nightshift</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/bin/caffeinate</string>
    <string>-i</string>
    <string>/Users/gazz/Desktop/TraderLoadingsLOCALE/auto/run.sh</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>NIGHTSHIFT_SCHEDULED</key><string>1</string>
    <key>HOME</key><string>/Users/gazz</string>
  </dict>
  <key>StartCalendarInterval</key>
  <dict><key>Hour</key><integer>1</integer><key>Minute</key><integer>0</integer></dict>
  <key>StandardOutPath</key><string>/Users/gazz/Desktop/TraderLoadingsLOCALE/auto/logs/launchd.out.log</string>
  <key>StandardErrorPath</key><string>/Users/gazz/Desktop/TraderLoadingsLOCALE/auto/logs/launchd.err.log</string>
  <key>RunAtLoad</key><false/>
</dict>
</plist>
```

- [ ] **Step 2: Crea `auto/README.md`**

```markdown
# Nightshift — runbook

Agente autonomo notturno: ogni notte alle 01:00 lavora la coda (`queue.json`) in worktree
isolati, apre PR su GitHub e lascia un report in `reports/`. Spec:
`docs/superpowers/specs/2026-07-05-nightshift-autonomous-agent-design.md`.

## Installazione (una tantum)

```bash
cp auto/com.traderloadings.nightshift.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.traderloadings.nightshift.plist
sudo pmset repeat wakeorpoweron MTWRFSU 00:55:00   # il Mac si sveglia alle 00:55
```

## Uso quotidiano

- **Fermarlo:** `touch auto/STOP` (soft) · `launchctl unload ~/Library/LaunchAgents/com.traderloadings.nightshift.plist` (hard).
- **Riattivarlo:** `rm auto/STOP` (e `launchctl load …` se scaricato).
- **Run manuale diurna:** `./auto/run.sh` (ignora STOP_HOUR) · prova generale: `./auto/run.sh --dry-run`.
- **Report:** `auto/reports/YYYY-MM-DD.md` · log dettagliati in `auto/logs/`.
- **Quota:** regola `MAX_TASKS` in `auto/config.sh` (Max 5x → 2 di default).

## Alimentare la coda

- **Audit:** aggiungi task a `queue.json` copiando il formato esistente (description → sezione
  del piano audit, priority progressiva).
- **Feature:** genera un PRD con `/prd`, convertilo con `/ralph`, poi copia le storie in
  `queue.json` con `source:"prd"` e i campi di stato (`status:"pending"`, `attempts:0`,
  `maxAttempts:2`, `branch:null`, `prUrl:null`, `notes:""`).
- **Chore:** aggiungi template in `chores.json` (`recurrence: "nightly"|"weekly"`, `weekday` 0–6).

## Esiti di un task

- ✅ PR aperta verso `feat/community-management` → la mergi tu.
- ✅ «nessuna modifica necessaria» (chore già verdi).
- ❌ gate rosso/timeout → riprova la notte dopo (max 2 tentativi), worktree lasciato in
  `.worktrees/auto-<id>` per ispezione; poi `failed` nel report.
- 📝 AUTONOTES.md nel report = l'agente s'è fermato davanti a una decisione di prodotto.

## Note

- Lo step audit 0.2 (E2EE) NON è in coda di proposito: richiede una decisione di prodotto.
- Il gate meccanico (typecheck+test+anti-secret+migrazioni intoccate) gira comunque,
  qualunque cosa dichiari il modello.
- Se il Mac era spento alle 01:00 la run salta (launchd non recupera le StartCalendarInterval
  perse a Mac spento; a Mac acceso/sleep la recupera al risveglio).
```

- [ ] **Step 3: Verifica**

Run: `plutil -lint auto/com.traderloadings.nightshift.plist`
Expected: `auto/com.traderloadings.nightshift.plist: OK`

- [ ] **Step 4: Commit**

```bash
git add auto/com.traderloadings.nightshift.plist auto/README.md
git commit -m "feat(auto): nightshift launchd template + runbook" -- auto/com.traderloadings.nightshift.plist auto/README.md
```

---

### Task 8: collaudo supervisionato (notte simulata di giorno)

**Files:**
- Modify: `auto/queue.json` (task canarino temporaneo, poi rimosso)

⚠️ Questo task consuma quota reale e apre una PR reale: va eseguito **con l'utente presente**.

- [ ] **Step 1: Aggiungi il task canarino in testa a `auto/queue.json`** (primo elemento dell'array)

```json
{
  "id": "TEST-canary",
  "source": "prd",
  "title": "Canarino Nightshift: nota di collaudo",
  "description": "Crea il file docs/nightshift-canary.md con una riga: '# Collaudo Nightshift' seguita dalla data odierna. Nessun'altra modifica.",
  "acceptanceCriteria": [
    "Esiste docs/nightshift-canary.md con titolo e data",
    "Nessun altro file modificato",
    "pnpm typecheck e pnpm test verdi"
  ],
  "priority": 0,
  "status": "pending",
  "attempts": 0,
  "maxAttempts": 1,
  "branch": null,
  "prUrl": null,
  "notes": ""
}
```

- [ ] **Step 2: Esegui la run supervisionata**

Run: `bash -c 'source auto/config.sh; MAX_TASKS=1; export MAX_TASKS; ./auto/run.sh'` — oppure più semplice: modifica temporaneamente `MAX_TASKS=1` in `config.sh`, esegui `./auto/run.sh`, poi ripristina `MAX_TASKS=2`.

Expected, in ordine:
1. eventuale materialize del chore notturno;
2. fase review (commenti su PR aperte, se ce ne sono);
3. `TEST-canary` lavorato in `.worktrees/auto-TEST-canary`;
4. gate verde → push `auto/TEST-canary` → **PR aperta** verso `feat/community-management` con corpo standard;
5. `auto/reports/<oggi>.md` scritto + notifica macOS.

- [ ] **Step 3: Checklist di verifica con l'utente**

- [ ] La PR canarino esiste su GitHub e il diff è SOLO `docs/nightshift-canary.md`.
- [ ] `auto/queue.json`: `TEST-canary` è `done` con `prUrl` valorizzato.
- [ ] Il report elenca review + canarino; la notifica è arrivata.
- [ ] Nessuna modifica alla working tree principale (`git status` pulito a parte `queue.json`).
- [ ] Chiudi la PR canarino **senza merge** e cancella il branch remoto `auto/TEST-canary`.

- [ ] **Step 4: Pulizia e attivazione**

```bash
node -e '
  const fs = require("node:fs");
  const q = JSON.parse(fs.readFileSync("auto/queue.json", "utf8")).filter(t => t.id !== "TEST-canary");
  fs.writeFileSync("auto/queue.json", JSON.stringify(q, null, 2) + "\n");
'
git add auto/queue.json
git commit -m "chore(auto): remove nightshift canary after supervised test" -- auto/queue.json
# attivazione (dal runbook):
cp auto/com.traderloadings.nightshift.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.traderloadings.nightshift.plist
sudo pmset repeat wakeorpoweron MTWRFSU 00:55:00
```

Se qualcosa fallisce nel collaudo: systematic-debugging sul punto rotto, fix, ri-collaudo. Rischi noti da verificare proprio qui: accesso del PAT dal contesto launchd/notturno (keychain) e prima run schedulata reale la mattina dopo.

---

### Task 9: documentazione di progetto e chiusura

**Files:**
- Modify: `CLAUDE.md` (sezione 7)
- Create: `/Users/gazz/.claude/projects/-Users-gazz-Desktop-TraderLoadingsLOCALE/memory/nightshift-system.md` (+ riga in `MEMORY.md`)

- [ ] **Step 1: Aggiungi a CLAUDE.md §7** (dopo il blocco Watchlist, prima della citazione finale)

```markdown
**Nightshift (agente autonomo notturno) — attivo.** Harness locale in [auto/](auto/): ogni notte
alle 01:00 (launchd + caffeinate, `NIGHTSHIFT_SCHEDULED=1`) `run.sh` lavora la coda
`auto/queue.json` (seed: critici del piano audit; poi PRD e chore ricorrenti) in worktree
isolati `.worktrees/auto-*`, gate meccanico (typecheck+test+anti-secret), push su branch
`auto/*` e PR verso `feat/community-management`; prima passa in review le PR aperte
(commento `<!-- nightshift-review -->`). Report in `auto/reports/`, stop con `touch auto/STOP`.
Runbook: [auto/README.md](auto/README.md) · Spec:
[docs/superpowers/specs/2026-07-05-nightshift-autonomous-agent-design.md](docs/superpowers/specs/2026-07-05-nightshift-autonomous-agent-design.md).
Lo step audit 0.2 (E2EE) è fuori coda: decisione di prodotto pendente.
```

- [ ] **Step 2: Salva la memoria** — crea `nightshift-system.md` nella directory memory con frontmatter `type: project`, contenuto: Nightshift attivo da <data collaudo>, dove vive (auto/), come fermarlo (STOP/launchctl), quota Max 5x → MAX_TASKS=2, E2EE 0.2 escluso per decisione di prodotto, link [[audit-completo-2026-07]] e [[multi-agent-shared-index]]. Aggiungi la riga indice in `MEMORY.md`.

- [ ] **Step 3: Verifica finale del repo**

Run: `node --test auto/queue.test.mjs auto/queue.cli.test.mjs && bash -n auto/run.sh auto/github.sh auto/config.sh && ./auto/run.sh --dry-run`
Expected: 20 test PASS, sintassi ok, dry-run pulito.

- [ ] **Step 4: Commit + push**

```bash
git add CLAUDE.md
git commit -m "docs: register Nightshift autonomous agent in CLAUDE.md active work" -- CLAUDE.md
git push
```

---

## Self-review del piano (fatto)

- **Copertura spec:** coda+fonti (§3) → Task 1–4; flusso notturno (§4) → Task 6; review → Task 5–6; guard-rail (§5) → gate/`rules.md`/percorsi vincolati nei Task 4–6; quota (§6) → config Task 4; testing (§7) → test nei Task 1–3 + dry-run Task 6 + collaudo Task 8; scheduling/pmset (§9) → Task 7–8; non-goal rispettati (nessun merge/deploy in nessun task).
- **Scelte esplicite oltre la spec:** prompt del tipo `prd.md` nominato come il campo `source` per la concatenazione diretta; `AUTONOTES.md` come canale "decisione di prodotto necessaria"; budget = lanci di claude (anche falliti), per proteggere la quota; canarino con `maxAttempts:1`.
- **Coerenza interfacce:** contratto CLI (Task 3) = uso in `run.sh` (Task 6) verificato; nomi funzioni `gh_*` (Task 5) = chiamate in Task 6; campi task (Task 1) = seed (Task 4) = `make_pr_body` (Task 6).
