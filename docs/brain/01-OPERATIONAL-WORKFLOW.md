---
title: "OPERATIONAL WORKFLOW — Protocollo di Lavoro e Release Gate"
type: operational-guide
vault: aureus-os
tags:
  - aureus/workflow
  - aureus/devops
  - aureus/database
version: 1.0.0
last_updated: 2026-10-25
---

# ⚙️ OPERATIONAL WORKFLOW — Protocollo di Lavoro e Release Gate

> [!IMPORTANT]
> **REGOLA GENERALE**: Nessuna riga di codice viene considerata terminata senza aver superato il gate di verifica completo. È fatto divieto assoluto di speculare, aggirare i controlli dei tipi o fare commit alla cieca.

Torna a: [[00-ATLAS]] | Prosegui a: [[02-BRAND-AND-LORE]]

---

## 1. Mappa del Monorepo (pnpm Workspaces)

La codebase è organizzata come monorepo gestito con **pnpm 9.12.0** e **Node.js 20+**:

```
TraderLoadingsLOCALE/
├── artifacts/
│   ├── api-server/         # Backend Express 5 + TS (REST, WebSockets, Schedulers)
│   └── trader-dashboard/   # Frontend React 19 + Vite 7 + Wouter (SPA)
├── lib/
│   ├── api-spec/           # Sorgente di Verità Contratti (OpenAPI 3.1 + Orval)
│   ├── api-zod/            # Schemi Zod generati da Orval (Non editare a mano)
│   ├── api-client-react/   # Client React Query generato da Orval (Non editare a mano)
│   ├── db/                 # Drizzle ORM schema + Migrazioni PostgreSQL
│   ├── pair-catalog/       # Catalogo coppie e asset finanziari
│   └── integrations/       # Integrazioni server (OpenAI, Dukascopy, etc.)
├── contracts/              # Lore AUREUS, Gradi, Lessico e Costanti di Dominio
├── docs/                   # Specifiche architetturali e vault [[00-ATLAS]]
└── scripts/                # Script di orchestrazione locale (tsx)
```

---

## 2. I Comandi Fondamentali

Esegui sempre i comandi dalla radice del monorepo:

### A. Il Gate Assoluto di Rilascio
```bash
pnpm verify
```
Esegue a cascata:
1. Controllo sincronizzazione dipendenze.
2. `codegen` dei contratti OpenAPI.
3. `typecheck` strict di tutte le librerie e applicazioni.
4. Esecuzione suite di test (unitari e di integrazione).
5. Build di produzione di frontend e backend con verifica prerender.

> [!CAUTION]
> Non aprire PR, non fare deploy e non dichiarare completata una feature se `pnpm verify` fallisce.

### B. Contratti e Generazione Codice (Contract-First)
```bash
pnpm codegen
```
Quando modifichi un endpoint o uno schema in `lib/api-spec/openapi.yaml`, **non modificare mai i file in `lib/api-zod/` o `lib/api-client-react/`**: esegui sempre `pnpm codegen` per rigenerarli.

### C. Typecheck Strict
```bash
pnpm typecheck
```
Esegue il controllo TypeScript a livello di monorepo. Non sono tollerati cast forzati ad `any` o soppressioni `@ts-ignore` non motivate e isolate.

### D. Test Runner
```bash
pnpm test
```
Esegue la suite di test locali con report immediato.

---

## 3. Gestione del Database e Migrazioni (Drizzle ORM)

Lo schema risiede in `lib/db/src/schema/`.

### Regole Inviolabili sulle Migrazioni:
1. **Nessun `push-force` su Ambienti Condivisi**: `pnpm db:push-force` è severamente vietato su database con dati persistenti.
2. **Generazione Incrementale**:
   ```bash
   pnpm db:generate
   ```
   Genera il file SQL nella cartella `lib/db/drizzle/`.
3. **Applicazione Migrazioni**:
   ```bash
   pnpm db:migrate
   ```
4. **Sequenze PostgreSQL**: Quando si aggiungono tabelle o migrazioni numerate, assicurarsi che la sequenza `drizzle.__drizzle_migrations_id_seq` sia sincronizzata per evitare collisioni di chiave primaria.

---

## 4. Avvio dell'Ambiente Locale

### Avvio Completo (Database + Backend + Frontend)
```bash
pnpm start:local
```
Questo comando avvia:
- **PostgreSQL**: Porta `5432` (o fallback automatico su `55432` su Mac/Postgres.app).
- **Backend API**: `http://localhost:3001`
- **Frontend Vite**: `http://localhost:5173`

### Avvio Soltanto Frontend (con proxy API attivo)
```bash
pnpm --filter ./scripts exec tsx local/startFrontendDev.ts
```

### Verifica Smoke Test Runtime (Senza bloccare il terminale)
```bash
pnpm smoke:runtime
```
Avvia temporaneamente i servizi necessari, effettua chiamate smoke verso le API e il frontend proxy, verifica l'assenza di `RUNTIME_ERROR` nei log e termina i processi in modo pulito.

---

## 5. Disciplina Git & Commit

- **Formato Messaggi di Commit**: Convenzione semantica obbligatoria:
  - `feat(scope): descrizione concisa`
  - `fix(scope): risoluzione bug con evidenza`
  - `refactor(scope): riorganizzazione priva di modifiche funzionali`
  - `chore(scope): manutenzione dipendenze o build`
  - `test(scope): aggiunta o correzione test`
- **Zero Segreti Committati**: Mai committare file `.env`, `.env.local` o chiavi private Clerk/Stripe/Resend. Usare sempre `.env.example` come template neutro.

---

## 6. Checklist Pre-Rilascio dell'Operatore

Prima di terminare qualsiasi sessione di lavoro:
- [ ] Ho eseguito `pnpm codegen` se ho toccato `openapi.yaml`.
- [ ] Ho eseguito `pnpm typecheck` con esito zero errori.
- [ ] Ho eseguito `pnpm test` con esito green su tutti i test.
- [ ] Ho verificato che non vi siano `any` immotivati nel codice TS non di test.
- [ ] Ho verificato che `pnpm verify` si concluda con successo.
- [ ] Ho proposto nuove idee, soluzioni e una roadmap ordinata passo-passo.

---

## 7. Regola Inviolabile di Fine Lavoro: Proattività Architetturale

> [!IMPORTANT]
> **A LAVORO FINITO, PROPORRE SEMPRE NUOVE IDEE E SOLUZIONI**:
> L'agente o lo sviluppatore non deve mai limitarsi a un'attesa passiva o a una semplice conferma di esecuzione.
> A ogni chiusura di task deve:
> 1. **Anticipare Miglioramenti**: Identificare opportunità per incrementare l'eleganza estetica, le performance, la copertura dei test o la chiarezza dell'informazione.
> 2. **Formulare Soluzioni Concrete**: Delineare architetture e opzioni attuabili senza creare debito tecnico.
> 3. **Definire una Scaletta Passo-Passo**: Presentare una sequenza progressiva, ordinata e a basso rischio per continuare a sviluppare il sistema con rigore monastico.
