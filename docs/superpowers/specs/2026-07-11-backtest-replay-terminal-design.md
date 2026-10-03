# Backtest Replay Terminal — design

**Data:** 2026-07-11 · **Branch:** `feat/community-management` · **Stato:** approvato

## Problema

Il replay backtest attuale (`pages/Backtest.tsx` → `components/ChartReplay.tsx`) è funzionale ma
è un layout a card verticale con UI eterogenea. Nel progetto Claude Design "TraderLoading Design
System" esiste il mockup `templates/backtest-replay/BacktestReplay.dc.html` (+ variante mobile):
un terminal full-screen stile TradingView/FX-Replay. Obiettivo: portare quel design in React,
alimentato da dati reali, con tutte le funzionalità e personalizzazioni del grafico.

## Decisioni (utente)

1. **Motore grafico = lightweight-charts v5.1.0** (già dipendenza). Niente port del canvas del
   mockup, niente Charting Library TradingView licenziata. UI/UX fedele al mockup.
2. **Dati = candle warehouse** (Postgres, M1, storia profonda): flag `CANDLE_WAREHOUSE` +
   seeding Dukascopy/Binance; degradazione elegante alla catena live (Yahoo/TwelveData).
3. Ramo `ralph/backtest-replay-trainer` (mai mergiato): **superato, ignorato**.
4. **Solo desktop**; la variante mobile del mockup è un task futuro.

## Feature del terminal (dal mockup)

- **Header 46px**: back/logo, simbolo della sessione, tab timeframe M1/M5/M15/H1/H4/D1 (lo
  switch preserva il timestamp della barra corrente), chip conto Saldo/Equity/P&L/DD, toggle
  pannello destro, settings, help hotkeys.
- **Tool rail 46px**: cursore/crosshair, trendline, linea orizzontale, rettangolo, Fibonacci,
  righello (pips/%/barre), long/short position, testo; impostazioni strumenti (colore 8 swatch,
  spessore 1–4, calamita OHLC, visibilità strumenti), cancella-tutto.
- **Grafico**: candele/heikin/linea, volume, watermark simbolo+TF, griglia, crosshair con tag
  prezzo/tempo it-IT, ultima-riga prezzo, pan/zoom, posizione aperta con zone R:R verdi/rosse e
  maniglie drag per entry/SL/TP, marker dei trade chiusi (triangolo entry, punto exit,
  connettore tratteggiato).
- **Indicatori**: EMA, SMA, WMA, Bollinger, VWAP (price pane); RSI, MACD, ATR, Stocastico
  (sub-pane); Volume; **custom** (sorgente close/open/high/low/hl2/ohlc4, MA, formula testuale
  con `c o h l v i` e `ema/sma/rsi`). Parametri, colore, on/off per indicatore. Default:
  EMA9, EMA21, Volume.
- **Transport bar 54px**: restart, step ±1, play/pausa, velocità 0.25/0.5/1/2/4×, scrubber
  trascinabile, orologio + "candela N/total", salto a data.
- **Order ticket**: rischio % o €, SL/TP in pips, calcolo Lotto/Rischio €/R:R
  (`lots = riskAmount/(slPips·pipValue)`), BUY/SELL; card posizione aperta con P&L live e
  "Chiudi a mercato (C)".
- **Conto**: saldo, equity curve mini, ritorno %, max drawdown.
- **Journal**: n. trade, Win Rate / Net R / Expectancy, barra W/BE/L, lista trade (direzione,
  entry→exit, uscita via SL/TP/M, P&L, R multiple, esito).
- **Hotkeys**: Space, ←/→, ↑/↓ velocità, B/S, C, R, +/− zoom, 1..6 timeframe.

## Architettura

- **Rotta full-screen** `/backtest/:id/replay` (`pages/BacktestReplay.tsx`, lazy):
  `position:fixed; inset:0; z-index:60` sopra le nav (z-50), body-scroll lock, Esc → `/backtest`.
  `ProUpgradeGate feature="backtest"` dentro la shell. Sessione via `useGetBacktestSessions()`
  + find by id. In `Backtest.tsx` la modalità "Replay Grafico" diventa card di lancio; la
  modalità Manuale resta.
- **Componenti** in `components/backtest-terminal/`: `BacktestTerminal`, `TerminalHeader`,
  `ToolRail`, `ReplayChart`, `ChartOverlays`/`PositionOverlay`/`DrawingsOverlay`,
  `IndicatorStrip`, `IndicatorDialog`, `OrderTicket`, `AccountPanel`, `JournalPanel`,
  `TransportBar`, `SettingsDialog`, `HotkeysHelp`, hook `useReplayEngine`/`useReplayHotkeys`/
  `useCandleWindow`, `terminal.css` scoped (precedente tornei.css).
- **Logica pura TDD** in `lib/replay/`: `replayCursor`, `tradeEngine` (SL/TP hit; stessa barra
  ⇒ SL, regola conservativa documentata), `lotSizing`, `accountTracker`, `journalStats`,
  `heikinAshi`, `indicatorCatalog`, `formulaParser` (parser ricorsivo-discendente — **niente
  `new Function`**), `terminalPersistence` (localStorage v2 per sessione). `wma()` aggiunta a
  `chartIndicatorEngine.ts`.
- **Riuso**: `chartReplayWindow.ts` (anchor switch TF) as-is; `chartIndicatorEngine.ts` esteso;
  `chartAnalysisTypes/Persistence.ts` + `chartDrawingGeometry.ts` estesi con
  `hline/ruler/longPosition/shortPosition/text` + magnet; `pipMultiplier.ts`;
  `chartSessionTime.ts`. **Ritiro** a fine lavoro: `ChartReplay.tsx`, `MtfContextChart.tsx`,
  `chartMtf.ts`, `ChartAnalysis{Toolbar,Panel,Overlay}.tsx`.
- **lightweight-charts v5**: sub-pane via `addSeries(def, opts, paneIndex)` +
  `setStretchFactor`; watermark `createTextWatermark`; SL/TP/entry `createPriceLine`; marker
  `createSeriesMarkers`; reveal con `setData` (seek/switch) + `series.update` (step/play);
  disegni su overlay SVG (no series-primitives) ri-proiettato su
  `subscribeVisibleLogicalRangeChange`.

## Data layer

- `GET /api/backtest/candles` (off-contract, resta off-contract): + intervallo **M1**
  (Yahoo `1m`, TwelveData `1min`, min-candles), + paging `from`/`to`/`limit`(≤5000) con
  `nextFrom`, comportamento warehouse-first già esistente invariato.
- **Nuovo** `GET /api/backtest/candles/meta?symbol=` → `{ warehouse, intervals:
  {firstTs,lastTs}|null }` dal watermark M1: bound del salto-data, avviso "storico limitato".
- Frontend `useCandleWindow`: meta + prima pagina, prefetch pagina successiva vicino alla fine,
  cache per-TF.
- **Seeding**: `CANDLE_WAREHOUSE=1 … tsx src/ingest.ts seed --symbols=… --years=5`; ordine
  EURUSD/GBPUSD/XAUUSD/NAS100/BTCUSD poi il resto; nightly `tail` già in CI; flag su
  Railway/.env.local.

## Fasi

0. Questa spec. 1. Backend M1+paging+meta (TDD). 2. Ops seeding (parallela). 3. Librerie pure.
4. Shell+chart core. 5. Trading. 6. Indicatori+settings. 7. Disegni + ritiro vecchio path +
e2e Playwright (`scripts/verify-backtest-replay/drive.mjs`) + self-review adversariale.
Ogni fase chiude `pnpm verify`-verde con commit a pathspec espliciti.

## Vincoli

Copy via `uiText()` in 5 lingue (test statici); no `any`; nessuna migrazione DB; contract
invariato; niente merge del ramo ralph.

## Rischi

Tempo di seeding Dukascopy (giorni) → fallback live + meta endpoint; limiti pane v5 (niente
legenda nativa) → chip in IndicatorStrip; rimozione vecchio path → grep importer prima.
