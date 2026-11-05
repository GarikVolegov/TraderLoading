---
title: "SOVEREIGN MEMORY MATRIX — Stato dell'Unione, Visione & Benchmark Globale"
type: memory-matrix
vault: aureus-os
tags:
  - aureus/memory
  - aureus/state-of-the-union
  - aureus/benchmark
  - aureus/governance
version: 1.1.0
last_updated: 2026-11-05
author: "Consiglio Direttivo AUREUS & Dirigente Sovrano"
---

# 🏛️ SOVEREIGN MEMORY MATRIX — Stato dell'Unione, Visione & Benchmark Globale

> «La lucidità non è assenza di complessità, ma padronanza geometrica del contesto. Chi non ricorda dove si trova, non può decidere dove andare.»  
> — *I Canoni del Consiglio Direttivo AUREUS*

Questa nota costituisce la **memoria stabile, incorruttibile e ad alta densità** del progetto **AUREUS OS (AUREUS PROTOCOL)**.  
È il punto di riferimento unico per sapere istantaneamente da dove procedere, quale sia la gerarchia decisionale, quali siano i benchmark industriali di riferimento e quale sia lo stato esatto del monorepo. Per l'architettura completa dei 10 flussi e il protocollo di Go-Live, consulta **[[09-DEEP-SYSTEMS-AND-LAUNCH-ROADMAP]]**.

---

## 🧭 1. STATO DELL'UNIONE (Snapshot Operativo Attivo)

| Dimensione | Stato Verificato | Dettaglio Tecnico & Garanzia |
| :--- | :---: | :--- |
| **Suite di Collaudo** | `591 / 591 PASS (100%)` | Zero fallimenti su api-server, trader-dashboard, api-zod, db, scripts |
| **Typecheck Strict** | `0 ERRORI` | Compilazione TypeScript rigorosa `tsc --build --force` immacolata |
| **Camera dei Manager (`council:critique`)** | `APPROVATO CON LODE` | Design Manager, Tech Manager e QA Manager concordi |
| **Guardiano della Notte (`aureus-daemon`)** | `ATTIVO & VIGILE` | Cron job schedulato in background con audit periodico automatico |
| **Watchdog Canary Webhook Alerting** | `MULTI-PROVIDER ATTIVO` | Dispatch asincrono dark-by-default (`watchdogAlerting.ts`) per Discord, Slack, Telegram e JSON generico con deduplicazione cooldown e collegamento diretto a `CircuitBreaker -> OPEN` |
| **Passaporto Crittografico del Sistema** | `QR SEAL SVG 21x21 + 64-HEX` | Impronta deterministica 64-hex (`systemPassportHash.ts`) + QR SVG `21x21` zero-deps (`SystemPassportCard.tsx`) in `Method.tsx` e `DailyOrderMethodConsole.tsx` con export JSON firmato |
| **Prova Immediata della Forgia (Guest 60s)** | `SANDBOX ZERO-AUTH LANDING` | Simulatore interattivo 16 candele `XAU/USD` (`GuestForgeSandboxModal.tsx`) nella Hero della `LandingPage.tsx`: Custode della Soglia (3 regole) + Replay Bar-by-Bar + Sigillo `+3.00 R` |
| **Compilatore Sistema (Anello 1)** | `5 ANELLI + 3 ARCHETIPI` | State machine `draft`→`observe`→`verify`→`active`→`suspended`, 3 archetipi istituzionali e Ordine Giornaliero mobile a 4 stadi (`Method.tsx`, `MobileChainWizard.tsx`) |
| **Prop Guardian & Cockpit (Anello 2)** | `SCUDO DRAWDOWN & BIO-LOCK` | Scudo matematico 5% Daily / 10% Total Drawdown, Bio-Lock al 75% del rischio, 1-Tap adaptive lot sizing, export MT5/cTrader e monitor BLE (`propGuardian.ts`, `smartwatchBle.ts`) |
| **Automa della Forgia EA Studio (Anello 3)** | `MQL5 & cTRADER CODEGEN` | Motore Concept-to-Bot (`eaForgeEngine.ts`) che compila le regole del Metodo in Expert Advisor MQL5 e cBot C# con casi studio storici (Gated Piano 150€) |
| **Motore Candele & Sintesi 0ms (Anello 3)** | `MULTI-TIER & OFFLINE READY` | Sintesi intraday deterministica a `0ms` (`intradaySynthesizer.ts`) + Dukascopy/TwelveData/Yahoo/Binance + `singleFlight` + Circuit Breaker + IndexedDB buffer |
| **Notaio Crittografico & Verità (Anello 4)** | `SIGILLO SHA-256 & MONTE CARLO` | Curva Zero-Leak, Virtue Radar, Sigillo d'Onore SHA-256 verificabile su `/verify/:hash` e simulazione Monte Carlo in Web Worker |
| **Architettura Patrimoniale (Anello 5)** | `5 MOTORI DI RICCHEZZA` | Allocazione surplus verso asset sovrani, Calcolatore ROI Prop Firm e Dottrina Fiscale (`FinancialArchitecture.tsx`) |
| **Navigazione Mobile & Desktop** | `COMPLETA & ELEVATA` | Nuova Sovereign Dock bar, alone dorato, drawer monastico, safe-area iOS |
| **Cockpit Operativo (Il Varco)** | `FLUIDO & BIDIREZIONALE` | Mobile Flow Ribbon con fase e bias in vista Grafico, zero cecità operativa |
| **Il Libro della Verità (Journal)** | `TELEMETRIA ATTIVA` | Mobile Sovereign Telemetry Ribbon (Win Rate, PF, Integrità, Bio-Coerenza) |
| **Risuonatore & Motore Aptico** | `SINESTESIA 432 HZ ATTIVA` | Risonanza armonica sacra a 432 Hz, doppio impulso aptico mobile per validazioni checklist Custode della Soglia, feedback swipe inerziale e cinema mode snap |
| **PWA Standalone & Fullscreen** | `NATIVO ADERENTE AL 100%` | Manifest con `display: standalone`, `orientation: any`, rimozione barre browser, splash screen ossidiana, 4 scorciatoie operative e hook `usePwaStandalone` |
| **Audio Spaziale 3D & Stereo Panning** | `STEREOFONIA PROCEDURALE ATTIVA` | Panning direzionale 3D via `StereoPannerNode` su Web Audio API: SSL a sinistra (-0.75, discesa tellurica 216→108Hz + sub 54Hz) e BSL a destra (+0.75, ascesa aurea 432→864Hz + shimmer 1296Hz), integrato in `SessionOpensOverlay`, `TradingCockpit` e `SoundFxSettings` |
| **Auto-Landscape Pivot & Fullscreen Cinema** | `ATTIVO & ERGONOMICO (100% PASS)` | Hook `useAutoLandscapeCinema` con media query 640px e ScreenOrientation API nativa; dual-thumb HUD separato (sinistra telemetria, destra operatività) in Cockpit e Forgia con safe-area notch iOS |
| **Gesture Swipe Inerziale Tattile & Bezel Edge** | `TRI-FASE ATTIVA (100% PASS)` | Rilevamento swipe bezel edge (<=36px) su canvas grafico; navigazione fluida 3-stati (Processo ↔ Grafico ↔ Custode della Soglia) con audio/aptica `synestheticSwipe()` e affordance visive pulsanti |
| **Quick Order Drawer Laterale (Forgia Rapida)** | `ATTIVO & BIO-LOCK INTEGRATO` | Drawer laterale a comparsa da destra per esecuzione rapida Buy/Sell, preset R:R (1:1, 1:2, 1:3, 1:5), chip rischio %, stepper pips SL/TP, gestione posizioni attive (Tutte a BE, Chiudi Tutte) e swipe-to-dismiss |
| **LimenResponsiveDrawer (Adaptive Bottom Sheet)** | `UNIVERSALE MOBILE & DESKTOP` | Sostituzione dei modali centrati su mobile con Bottom Sheets ergonomici (side="bottom", drag handle, swipe-down to dismiss, safe-area iOS) e Dialog imperiale su desktop |
| **Mobile Journal Trade Ledger** | `LISTA COMPATTA & ZERO SCROLL` | Eliminazione dello scroll infinito da 5000px su mobile; lista compatta luxury-broker a righe monospace, nastro KPI (Win Rate, Trade, P&L) e apertura dossier in Bottom Sheet |
| **Lessico & Lore AUREUS** | `MONASTICO & STOICO` | Bonifica totale di gergo retail in `dict.it.ts`, Leaderboard e Cockpit |
| **Compilazione Vite & Prerender** | `75 / 75 ROUTES OK` | Build SSR/SSG di produzione impeccabile con sitemap generata e bundle `< 235 kB gzip` (~167 kB effettivi) |
| **Roadmap Lancio Pubblico (Go-Live)** | `CODIFICATA IN 5 FASI` | Sicurezza AES-256-GCM/Clerk, Stabilità High-Concurrency, Compatibilità PWA Cross-Device, Velocità Core Web Vitals e Preflight Gate (`09-DEEP-SYSTEMS-AND-LAUNCH-ROADMAP.md`) |
| **Protocollo di Autonomia Agentica** | `REGOLA 98/2 ATTIVA` | Calcolo autonomo step-by-step, compattazione chirurgica dati, zero interruzioni futili |

---

## 🏛️ 2. GERARCHIA TRIPARTITA: VISIONE, CRITICA & ESECUZIONE

L'ecosistema opera secondo la **Regola del 95/5**: il 95% del lavoro manuale (codice, bugfix, typecheck, layout responsive, test) è svolto in autonomia dal Concilio Agenti; l'Utente Sovrano prende solo il 5% delle decisioni chiave tramite **Decision Memos**.

```mermaid
graph TD
    USER["👑 L'Utente Sovrano (5% Decisioni Strategiche)"]
    DIRECTOR["🏛️ Il Dirigente Sovrano (Visione Globale & Priorità)"]
    
    subgraph MANAGERS ["🛡️ Camera di Critica dei Manager (Garanzia di Completezza)"]
        TM["⚡ Tech Manager (Contratti OpenAPI, DB & Resilienza)"]
        DM["🎨 Design Manager (Limen Design System & Lore Inviolabile)"]
        QM["🛡️ QA Manager (Integrità Tipi, Zero Regressioni & Gate)"]
    end
    
    subgraph AGENTS ["⚔️ Agenti Operativi di Linea (95% Lavoro Manuale)"]
        FE["🎨 Frontend Engineer (React 19, Tailwind, Mobile UX)"]
        BE["⚡ Backend Engineer (Express 5, Drizzle, Orval)"]
        QA["🛡️ QA Sentinel (Unit & Static Tests, Self-Healing)"]
        SCOUT["🔍 Market Scout (Feed Dukascopy, Tick Data, Lore Audit)"]
        DAEMON["⏳ Autonomous Daemon (Audit Notturno Schedulato)"]
    end

    USER <-->|Decision Memo Chirugico| DIRECTOR
    DIRECTOR -->|Mandati di Visione| MANAGERS
    MANAGERS -->|Specifiche Inviolabili| AGENTS
    AGENTS -->|Consegne di Codice| MANAGERS
    MANAGERS -->|Critica Spietata: Rifiuto se Incompleto| AGENTS
    MANAGERS -->|Approvazione all'Unanimità| DIRECTOR
```

### Ruoli Inviolabili:
1. **I Dirigenti (Visione)**:
   - Fissano l'orizzonte strategico, l'identità del brand e il valore differenziante nel mercato istituzionale.
   - Non scrivono sintassi né dettagli di basso livello; comunicano con Decision Memos sintetici.
2. **I Manager (Completezza & Rigore Spietato)**:
   - **Non accettano lavori a metà o frettolosi**.
   - Se un componente mobile ha un testo che va a capo male, il Design Manager blocca il rilascio.
   - Se un endpoint non rispetta `openapi.yaml` o manca di multi-tenant isolation, il Tech Manager ordina il refactoring.
   - Se un test fallisce o il typecheck non è a zero errori, il QA Manager serra il gate di rilascio.
3. **Gli Agenti Operativi (Esecuzione Continua)**:
   - Scrivono il codice, eseguono i refactoring, creano i componenti e i test, eseguono i comandi di verifica.

---

## 🏆 3. BENCHMARK COMPARATIVO CON I TOP SOFTWARE MONDIALI

Per rendere AUREUS un'opera d'arte del software, il Concilio misura costantemente ogni componente contro i massimi standard mondiali di design, velocità ed ergonomia:

| Piattaforma di Riferimento | Benchmark d'Eccellenza | Dove AUREUS Pareggia o Supera lo Standard |
| :--- | :--- | :--- |
| **TradingView** | Fluidità candele Canvas/WebGL, timeframes istantanei, strumenti di disegno e crosshair magnetico su mobile/desktop. | AUREUS adotta Lightweight Charts v5 potenziato, ma **supera TradingView** integrando il motore di Replay con Tick Reali proprietario, la correlazione delle liquidità istituzionali (*Session Opens Overlay*) e il log del trade direttamente agganciato al frame temporale senza uscire dalla vista. |
| **Linear & Raycast** | Perfezione delle micro-interazioni, shortcut da tastiera (`[`, `⌘B`), transizioni a molla (spring physics), tema scuro Ossidiana e contrasto dorato privo di sbavature. | AUREUS implementa la stessa filosofia: scorciatoie da tastiera native per collassare la sidebar o aprire i respiri tattici (`B` per Respiro, `D` per Decompressione), haptic pulses, zero ricaricamenti di pagina e una suite di icone e stemmi nobili esclusivi. |
| **Bloomberg Terminal / FactSet** | Densità chirurgica delle informazioni, zero pixel morti, tipografia finanziaria rigorosa in monospace, telemetrie di sessione e orari di mercato in tempo reale. | AUREUS adotta font `font-mono tracking-tight` su ogni cifra e valuta, layout `flex-stretch` bilanciati per evitare gradini asimmetrici, telemetria di mercato 3D (*La Sfera dei Mercati*) e monitoraggio costante di P&L, Win Rate e Drawdown senza sacrificare l'eleganza estetica. |
| **TradeZella & Edgewonk** | Diario di trading analitico, equity curve cumulativa, metriche statistiche e filtri per tag emotivi (FOMO, Revenge). | **AUREUS demolisce TradeZella ed Edgewonk**: dove loro sono semplici fogli di calcolo passivi compilati a posteriori, AUREUS offre **Il Varco** (esecuzione guidata pre-trade per impedire la deviazione prima che avvenga), la **Curva Zero-Leak** (che calcola matematicamente il capitale reale escludendo i trade impulsivi) e l'analisi **Bio-Tension** integrata con smartwatch e battito cardiaco. |
| **Bookmap & TradingLite** | Mappe termiche di liquidità, ordini iceberg e tracciamento dello sweep dei livelli di apertura di sessione. | AUREUS integra la telemetria di sessione e gli allarmi sweep (`SESSION_SWEEP_ALERT_EVENT`) direttamente nel terminale della Forgia del Passato, avvisando l'Operatore delle prese di liquidità Asia/Londra/NY. |

---

## 🛠️ 4. STRUMENTI & SKILL SET DI SVILUPPO D'ECCELLENZA

Per garantire lo sviluppo frontend e full-stack ai massimi livelli di settore, il Concilio si avvale di:

1. **Skill Native Integrate**:
   - `frontend-design`: Creazione di interfacce production-grade con estetica non generica e finiture d'élite.
   - `ui-ux-pro-max`: Intelligenza avanzata con 50+ stili, 161 palette, 25 tipi di grafici e 99 linee guida UX per mobile/desktop.
   - `chrome-devtools` & `a11y-debugging`: Ispezione DOM, viewport mobile audit, Core Web Vitals e accessibilità.
   - `neon` suite (`neon-postgres`, `neon-auth`): Architettura cloud serverless con branching e query tuning.
2. **Estensioni Consigliate (Agent Marketplace)**:
   - `antigravity-plugins-partners/plugin/mobbin`: Archivio di oltre 600.000 schermate di app reali da cui estrarre pattern UX di riferimento (TradingView, Revolut, Linear).
   - `antigravity-plugins-partners/plugin/figma`: Conversione istantanea di mockup ad alta fedeltà in codice Tailwind/React.

---

## 🎯 5. FRONTIERA ATTIVA & ROADMAP DI LANCIO PUBBLICO

1. **Esecuzione del Protocollo di Go-Live (`[[09-DEEP-SYSTEMS-AND-LAUNCH-ROADMAP]]`)**:
   - **Fase I (Sicurezza)**: Verifica `BROKER_VAULT_KEY` AES-256-GCM, chiavi live Clerk/Stripe e isolamento `userId`.
   - **Fase II (Stabilità)**: Advisory locks transazionali, Circuit Breaker a 3 stati, `singleFlight` candele e scaling `SERVICE_ROLE`.
   - **Fase III (Compatibilità)**: Certificazione PWA Standalone su iOS Safari WebKit, Android Chrome e Desktop Ultra-Wide con `pwaAutoUpdater`.
   - **Fase IV (Velocità SLO)**: Mantenimento rigoroso del budget bundle `< 235 kB gzip` (~167 kB attuali), LCP `< 2.5s` e INP `< 200ms`.
   - **Fase V (Watchdog)**: Esecuzione sequenziale di `pnpm verify`, `pnpm preflight`, `pnpm smoke:runtime` e `pnpm council:daemon`.
2. **Sincronizzazione Internazionale Lore**:
   Allineare i dizionari `dict.en.ts`, `dict.es.ts`, `dict.fr.ts` e `dict.de.ts` al lessico AUREUS (*The Forge of the Past*, *The Book of Truth*, *The Threshold*).
3. **Espansione Connettori Istituzionali**:
   Estensione della telemetria in tempo reale nel Vault Broker (`brokerHub`) e nuovi archetipi per l'Automa della Forgia (`eaForgeEngine.ts`).
4. **Consolidamento Git**:
   Mantenere un albero git tracciato con commit atomici a ogni traguardo verificato.
