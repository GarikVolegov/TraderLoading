# Nightshift — agente autonomo notturno (design)

**Data:** 2026-07-05 · **Stato:** approvato (brainstorming con l'utente)
**Obiettivo:** far lavorare Claude Code in autonomia sul progetto, di notte, sul Mac locale,
producendo PR pronte da revisionare la mattina.

## 1. Requisiti (decisi con l'utente)

- **Fonti di lavoro (tutte e quattro):** piano audit (229 finding, partendo dai 7 critici),
  nuove feature da PRD, manutenzione ricorrente, review automatica delle PR aperte.
- **Dove gira:** solo in locale sul Mac (toolchain, Postgres.app e credenziali già pronti).
  Niente cloud, niente GitHub Actions (scartate: API key a consumo + ambiente CI da ricreare).
- **Autonomia:** ogni task → worktree isolato → branch `auto/<id>` → gate verde → commit
  (pathspec) → push → **PR su GitHub**. Il merge resta sempre all'utente.
- **Cadenza:** finestra notturna (default 01:00–07:00). Nessun demone diurno.
- **Budget:** abbonamento **Max 5x** → default prudente 2 task pesanti/notte + fasi leggere;
  tetto imposto meccanicamente dallo script, non dal modello.

## 2. Architettura

Approccio scelto: **harness bash + `claude -p` headless** (evoluzione del pattern
`ralph/ralph.sh` già usato con successo su questo repo), lanciato da **launchd**.
Alternativa scartata: scheduling nativo di Claude Code (cron/routine) — meno controllo
meccanico su quota, timeout e kill switch per un processo non presidiato.

Tutto vive in `auto/` (git-tracked, tranne logs/reports) + un plist launchd utente:

```
auto/
  queue.json        # coda unica dei task (audit, prd, chore)
  chores.json       # chore ricorrenti (template + ricorrenza)
  config.sh         # MAX_TASKS=2, STOP_HOUR=07, BASE_BRANCH, TASK_TIMEOUT, PATH toolchain
  run.sh            # runner notturno: orchestrazione, budget, gate, push, PR
  queue.mjs         # operazioni JSON sulla coda (Node puro, unit-testato; niente jq — no brew)
  prompts/          # template prompt per tipo: audit.md, feature.md, chore.md, review.md
  reports/          # report mattutini YYYY-MM-DD.md   (gitignored)
  logs/             # log grezzi per run                (gitignored)
~/Library/LaunchAgents/com.traderloadings.nightshift.plist
```

Principio cardine: **il cervello di ogni task è `claude -p`; la disciplina è di bash**
(quanti task, quanto tempo, cosa si pusha — mai delegati al modello).

## 3. La coda (`queue.json`)

Ogni task ha il DNA delle storie Ralph:

```json
{
  "id": "AUD-001",
  "source": "audit" | "prd" | "chore",
  "title": "…",
  "description": "…",
  "acceptanceCriteria": ["…", "Typecheck passa", "Test passano"],
  "priority": 1,
  "status": "pending" | "in_progress" | "done" | "failed",
  "attempts": 0,
  "maxAttempts": 2,
  "branch": null,
  "prUrl": null,
  "notes": ""
}
```

Selezione: primo `pending` per priorità. Dopo 2 tentativi falliti → `failed`, si passa oltre
(il fallimento finisce nel report, mai in loop infinito).

**Fonti:**
- **Audit** — seed iniziale dai 7 finding critici di
  `docs/superpowers/plans/2026-07-05-audit-completo-piano-implementazione.md`
  (un task per finding, criteri di accettazione verificabili), poi gli alti a scaglioni.
- **PRD** — flusso esistente `/prd` → `/ralph`; le storie entrano in coda con `source:"prd"`.
- **Chore** — `chores.json` definisce i ricorrenti con campo `recurrence`
  (es. `weekly`: audit dipendenze, sweep `console.*`; `nightly`: `pnpm verify` sul branch
  base → se rosso, apre da solo un task di fix). A inizio notte il runner materializza in
  coda i chore scaduti (idempotente: non duplica se già presente e non concluso).

## 4. Flusso di una notte

1. **01:00** — launchd lancia `run.sh` dentro `caffeinate -i` (il Mac non si riaddormenta).
   Prerequisito una tantum: `sudo pmset repeat wakeorpoweron MTWRFSU 00:55:00`.
2. **Pre-flight** — se esiste `auto/STOP` → exit 0 immediato; `git fetch origin`;
   materializzazione chore scaduti.
3. **Fase review (leggera)** — per ogni PR aperta su `GarikVolegov/TraderLoading` senza
   review del bot: `claude -p` breve (template `review.md`, `--model sonnet`), commenti
   postati via API GitHub con il PAT dal credential helper (niente gh CLI su questo Mac).
   Solo commenti; mai approve/merge.
4. **Fase lavoro** — finché `task_svolti < MAX_TASKS` **e** ora < `STOP_HOUR`:
   - prossimo task dalla coda → `status:"in_progress"`;
   - `git worktree add .worktrees/auto-<id> -b auto/<id> origin/$BASE_BRANCH`
     (default `feat/community-management`);
   - `timeout $TASK_TIMEOUT claude -p` (default 60 min) nel worktree, con template del tipo
     + JSON del task; il prompt impone TDD e commit con pathspec;
   - **gate meccanico del runner** (indipendente dalle dichiarazioni del modello):
     `pnpm typecheck && pnpm test` nel worktree + grep anti-secret sul diff;
   - verde → push `-u origin auto/<id>` → PR via API GitHub (corpo standard: task, modifiche,
     evidenza test) → `status:"done"` + `prUrl`;
   - rosso/timeout → `attempts++` (→ `failed` se esauriti), nessun push; **worktree e branch
     lasciati in locale** per ispezione (le modifiche non committate non vanno perse);
   - verde → worktree rimosso (il branch pushato resta).
5. **Chiusura** — report `auto/reports/YYYY-MM-DD.md` (task tentati, PR aperte, gate,
   fallimenti con motivo), notifica macOS via `osascript`, exit.

## 5. Guard-rail (codificati nello script, non negoziabili)

- Lavoro **solo in worktree** sotto `.worktrees/` — mai nella working tree condivisa
  (altri agenti committano concorrentemente su `feat/community-management`).
- Push **solo su branch `auto/*`**; mai su `feat/community-management` o `main`;
  mai merge; mai `--force`; mai `git add -A` (sempre pathspec).
- PAT mai nei log (redazione dell'header Authorization); nessun segreto committato
  (grep anti-secret nel gate: pattern chiave tipo `sk-`, `-----BEGIN`, `AKIA`).
- Niente modifiche a migrazioni DB già esistenti in `lib/db/drizzle/` (il prompt lo vieta;
  il gate fallisce se il diff tocca file di migrazione pre-esistenti).
- Kill switch: soft = `touch auto/STOP`; hard = `launchctl unload …nightshift.plist`.
- Ogni run scrive un lock (`auto/.lock` con PID): mai due run concorrenti.

## 6. Gestione quota (Max 5x)

- Default: `MAX_TASKS=2` pesanti + review + chore ≈ dentro una finestra 5h del piano.
- Chore e review usano `--model sonnet`; i task audit/feature usano il modello di default.
- Tuning manuale in `config.sh` (`MAX_TASKS=1..3`) in base a quanta quota resta la mattina.

## 7. Testing del sistema

- `queue.mjs` (next-task, transizioni di stato, materializzazione chore) → unit test
  `node:test`, zero dipendenze.
- `run.sh --dry-run` → esegue tutto tranne `claude`/push/PR (stampa cosa farebbe).
- Collaudo: una "notte simulata" di giorno con `MAX_TASKS=1` su un task banale,
  supervisionata dall'utente, prima di attivare il plist.

## 8. Non-goal (per scelta)

Niente merge automatici; niente deploy; niente lavoro sulla working tree principale;
niente esecuzione se `STOP` presente; niente GitHub Actions (estensione futura possibile
per la sola review a Mac spento).

## 9. Prerequisiti / punti aperti

- Una tantum: `sudo pmset repeat wakeorpoweron` (serve password utente, manuale).
- PAT GitHub già presente nel credential helper (verificare scope `repo`).
- Seed della coda: la selezione fine dei primi task audit avviene nel piano di
  implementazione (partendo dai 7 critici pre-lancio).
