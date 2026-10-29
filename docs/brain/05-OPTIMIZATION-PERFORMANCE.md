---
title: "OPTIMIZATION & PERFORMANCE — Efficienza, Scalabilità e Risorse"
type: performance-guidelines
vault: aureus-os
tags:
  - aureus/performance
  - aureus/optimization
  - aureus/database
  - aureus/frontend
version: 1.0.0
last_updated: 2026-10-25
---

# ⚡ OPTIMIZATION & PERFORMANCE — Efficienza, Scalabilità e Risorse

> [!IMPORTANT]
> **PRINCIPIO CARDINE**: La velocità di esecuzione è un requisito di disciplina, non un lusso. Nessun componente o query deve introdurre latenza ingiustificata o consumare cicli CPU a vuoto.

Torna a: [[00-ATLAS]] | Precedente: [[04-BACKEND-CONTRACTS]] | Prosegui a: [[06-SECURITY-HARDENING]]

---

## 1. Ottimizzazione Frontend & Riduzione Bundle

La dimensione iniziale del bundle JS dell'app è mantenuta rigorosamente compressa (< 300 kB gzip eager):

1. **Caricamento Lazy dei Componenti Pesanti**:
   - Il terminale di replay (`BacktestReplayTerminal`, `lightweight-charts`), i grafici COT e i player video devono essere caricati dinamicamente:
   ```typescript
   const BacktestReplayTerminal = React.lazy(
     () => import("@/components/backtest-terminal/BacktestReplayTerminal")
   );
   ```
2. **Chunking Rollup & Vite**:
   La configurazione in `vite.config.ts` suddivide le librerie terze (`vendor`, `radix`, `charts`, `query`) in chunk separati per massimizzare il caching a lungo termine del browser.
3. **Preconnect & Font Optimization**:
   I font critici vengono precaricati (`<link rel="preconnect">`) con `font-display: swap` per evitare Layout Shift (CLS) e blocchi di rendering.

---

## 2. Disciplina del Polling & Chiamate di Rete

I dati finanziari e di sessione richiedono frequenza di aggiornamento elevata ma disciplinata:

1. **Pattern Stale-While-Revalidate (SWR)**:
   Leggere immediatamente dai dati in cache (render istantaneo) e aggiornare in background senza bloccare la UI.
2. **Backoff su Inattività (Tab Sfondo)**:
   - Se l'utente non interagisce o la scheda del browser è nascosta (`document.visibilityState === 'hidden'`), allungare gli intervalli di polling (es. da 8s a 60s o arresto temporaneo).
   - È vietato creare `setInterval` infiniti non vincolati al ciclo di vita del componente (`useEffect` cleanup obbligatorio).

---

## 3. Ottimizzazione Database (PostgreSQL & Drizzle)

1. **Indici Compositi Mirati**:
   Ogni tabella con volumi di transazioni (trade, log, messaggi) deve disporre di indici composti per query frequenti:
   ```typescript
   // Esempio indice composito su (userId, createdAt DESC)
   export const accountTradesTable = pgTable("account_trades", {
     // ...
   }, (table) => ({
     userCreatedIdx: index("account_trades_user_created_idx").on(table.userId, table.createdAt.desc()),
   }));
   ```
2. **Debellamento Totale delle Query N+1**:
   - Non iterare su un array di entità per eseguire una query singola per ciascuna.
   - Usare `inArray(table.id, ids)`, `json_agg` o le relazioni di Drizzle (`with: { ... }`) per raggruppare il fetch in un'unica operazione di lettura.
3. **Paginazione Obbligatoria**:
   Tutte le liste potenzialmente infinite (feed storico, messaggi canale, log di audit) devono implementare paginazione via cursor o limit/offset.

---

## 4. Gestione della Memoria e Render Reattivi

1. **Teardown dei Listener e Connessioni**:
   Ogni connessione WebSocket, listener di eventi su `window` o `AudioContext` deve rilasciare le risorse nella funzione di ritorno di `useEffect`.
2. **Evitare Re-render Inutili**:
   Memoizzare con `useMemo` o `useCallback` i calcoli finanziari complessi (calcolo Profit Factor, drawdown, R multipli) quando derivano da serie storiche di centinaia di trade.

---

## 5. Architettura Backend ad Alta Concorrenza (Massive Multi-User Readiness)

1. **HTTP Keep-Alive & Cloud Proxy Timeout Alignment**:
   - `server.keepAliveTimeout = 65_000` ms e `server.headersTimeout = 66_000` ms in `artifacts/api-server/src/index.ts`.
   - Supera i 60s di idle timeout dei Reverse Proxy (Cloudflare, AWS ALB, Railway Edge), scongiurando errori intermittenti `502 Bad Gateway` ed `ECONNRESET` in periodi di traffico intenso.
2. **Statement Timeout su Connection Pool PostgreSQL**:
   - `PG_STATEMENT_TIMEOUT_MS` configurato in `lib/db/src/poolConfig.ts` e iniettato tramite `-c statement_timeout=${ms}`.
   - Impedisce l'esaurimento del connection pool dovuto a query lente bloccanti.
3. **Thundering Herd Mitigation via SingleFlight**:
   - `singleFlight` integrato nei servizi di ingestione candele (`candles.ts`).
   - Centinaia di richieste concorrenti per lo stesso simbolo e timeframe vengono unite in un'unica operazione di fetch verso i provider esterni o la replica DB.
4. **Resilient Circuit Breaker per Provider Upstream**:
   - Modulo `artifacts/api-server/src/lib/circuitBreaker.ts` con transizioni di stato `CLOSED -> OPEN -> HALF_OPEN`.
   - Fail-fast istantaneo (0ms) in caso di timeout o errori a cascata dei provider di mercato, proteggendo il thread pool di Node.js.
5. **Caching a Due Livelli & LRU Bounded Memory Store**:
   - Cache in-memory protetta da memory-leak con evizione automatica FIFO oltre 5.000 chiavi e pulizia periodica delle chiavi scadute.
   - Integrazione seamless con Redis distribuito quando configurato.
6. **Scalabilità Orizzontale dei WebSocket via Redis Pub/Sub**:
   - Canali distribuiti per l'Hub Sociale (`limen:events:social`) e le Arene di Duello (`limen:events:battleroom`).
   - Modalità duale automatica: EventEmitter ad altissima efficienza in locale e Redis Pub/Sub con origin deduplication in produzione multi-container.
7. **Sweep Periodico delle Risorse Orfane (Battle Room Sweeper)**:
   - Spazzamento automatico ogni 5 minuti delle stanze di duello e ticker `setInterval` orfani per eliminare garbage retention a lungo termine.

---

## 6. Service Level Objectives (SLO) Sovrani di AUREUS OS

I seguenti parametri costituiscono il contratto di qualità operativo non derogabile per garantire la massima lucidità ed esecuzione all'Operatore:

| Ambito Telemetrico | Metrica & Percentile | Obiettivo Vincolante (SLO) | Azione di Ripristino |
| :--- | :--- | :--- | :--- |
| **API Read (Interne)** | Latenza `p95` | **< 300 ms** (esclusi provider terzi) | Ottimizzazione indici SQL, Caching Redis, SingleFlight |
| **API Write (Interne)** | Latenza `p95` | **< 500 ms** (esclusi provider terzi) | Transazioni brevi, code asincrone worker |
| **Realtime Gateway** | Tempo di Riconnessione | **< 5 s** con replay eventi | Fallback automatico su polling a frequenza ridotta |
| **Frontend LCP** | Largest Contentful Paint `p75` | **< 2.5 s** (Desktop & Mobile) | Code-splitting, preload font, rimozione render-blocking CSS |
| **Frontend INP** | Interaction to Next Paint `p75` | **< 200 ms** (Desktop & Mobile) | Offloading computazioni pesanti (Web Worker), zero jank |
| **App Shell Budget** | Initial JS Bundle gzip | **< 235 kB gzip** (Core Shell) | Lazy loading Recharts, Three.js, grafici e dialoghi |

---

## 7. Architettura di Scalabilità a Ruoli (`SERVICE_ROLE`)

Per scalare in produzione multi-container (Kubernetes, AWS ECS, Railway Replicas) mantenendo l'integrità del monolite modulare, il server supporta la variabile d'ambiente `SERVICE_ROLE`:

- `all` *(default)*: Modalità unificata (API HTTP, Gateway WebSocket e Cron Scheduler attivi).
- `api`: Processo dedicato all'evasione delle richieste HTTP REST; salta l'attacco di WebSocket pesanti e i cron scheduler.
- `gateway`: Processo dedicato alla persistenza e fan-out delle connessioni WebSocket (Social, Broker, News, Duelli).
- `worker`: Processo dedicato alle elaborazioni batch, code, warmup cache e pianificazioni cron, esponendo solo `/healthz` e `/readyz`.

---

## 8. Offloading Computazionale & RUM Telemetry

1. **Web Worker per Calcoli Monte Carlo**:
   - `artifacts/trader-dashboard/src/workers/monteCarlo.worker.ts` e `monteCarloDispatcher.ts`.
   - Esegue la simulazione di traiettoria Monte Carlo (migliaia di iterazioni per percentile R:R) in un thread separato.
   - Scongiura blocchi del main thread mantenendo `INP < 200 ms` anche durante analisi complesse del Diario.
2. **Real User Monitoring (RUM)**:
   - `artifacts/trader-dashboard/src/lib/rumTelemetry.ts`.
   - Monitora LCP, INP, CLS e TTFB in tempo reale sfruttando nativamente le API `PerformanceObserver` senza librerie esterne.
3. **CI Performance Gate**:
   - `scripts/local/bundleBudget.test.ts` valida automaticamente a ogni build che il bundle iniziale `index.js` non superi la soglia massima di 235 kB gzip (misurato a 203.9 kB gzip).

