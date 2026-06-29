# Watchlist Realtime — pair preferiti + deep-link all'app

**Data:** 2026-06-29
**Componente:** `artifacts/trader-dashboard/src/components/TradingViewWatchlistWidget.tsx`
**Stato:** design approvato

## 1. Problema

La **Watchlist Realtime** della dashboard oggi:

1. Mantiene una **lista propria** di simboli in `localStorage`
   (`tl_tradingview_watchlist_symbols_v1`), con un editor manuale (dialog
   `SymbolEditorDialog`), suggestion e validazione. Questa lista è **scollegata**
   dai "pair preferiti" (`selectedPairs`) usati dal resto della dashboard.
2. Al tap su un pair apre `tradingview.com/chart?symbol=...` in una nuova scheda,
   senza alcun tentativo di aprire l'app TradingView installata sul dispositivo.

Si vuole:

1. Mostrare **solo i pair preferiti dall'utente** (`selectedPairs`), come nel
   resto della dashboard — unica fonte di verità.
2. Al tap su un pair: aprire **l'app TradingView se installata sul dispositivo**
   (e portare al pair), **altrimenti** aprire il pair sul web (Safari/Chrome),
   dove l'utente è già loggato.

## 2. Decisioni (confermate con l'utente)

- **Destinazione del tap:** TradingView (coerente col widget attuale; supporta
  forex/metalli/indici/crypto; ha deep-link reali).
- **Editor manuale:** rimosso. La watchlist è 100% guidata da `selectedPairs`.
  L'icona ingranaggio diventa una **scorciatoia** alle impostazioni "Pair
  Preferiti".
- **Meccanismo deep-link:** Universal/App Links (vedi §4).

## 3. Sorgente dati — solo i preferiti

Il widget legge `selectedPairs` da `useBackground()` (context già usato in tutta
la dashboard, sincronizzato con le impostazioni utente). Vengono **eliminati**:
lista `localStorage`, `tradingViewWatchlistStorage`, `SymbolEditorDialog`,
`suggestTradingViewSymbols`, `normalizeTradingViewSymbol`,
`normalizeTradingViewWatchlistSettings`, `DEFAULT_TRADING_VIEW_WATCHLIST_SYMBOLS`
e la UI dei simboli non validi.

I simboli del catalogo (`EURUSD`, `XAUUSD`, `US30`, `BTCUSD`, …) vengono mappati
a simboli TradingView (con prefisso provider) da una **funzione pura**:

```
mapCatalogPairToTradingViewSymbol(symbol: string): string
```

Regole di mapping:

| Categoria catalogo | Esempio input | Output TradingView |
|---|---|---|
| Forex (6 lettere) | `EURUSD`, `USDMXN` | `FX:EURUSD`, `FX:USDMXN` |
| Metalli | `XAUUSD`, `XAGUSD` | `OANDA:XAUUSD`, `OANDA:XAGUSD` |
| Indici | `US30` / `NAS100` / `SPX500` | `CAPITALCOM:US30` / `CAPITALCOM:US100` / `CAPITALCOM:US500` |
| Crypto | `BTCUSD`, `ETHUSD` | `COINBASE:BTCUSD`, `COINBASE:ETHUSD` |

Mapping esplicito (tabella) per metalli/indici/crypto; fallback `FX:<symbol>` per
qualsiasi simbolo a 6 lettere non in tabella; per simboli non riconoscibili si
ricade sul simbolo grezzo (l'embed TradingView mostrerà il proprio stato di
errore, già gestito da `onError`).

L'embed live per pair resta invariato (`buildTradingViewMiniSymbolConfig`,
script `embed-widget-mini-symbol-overview.js`).

## 4. Tap sul pair → deep-link

Funzione pura:

```
buildTradingViewDeepLink(tvSymbol: string): string
// => "https://www.tradingview.com/chart/?symbol=<encoded>"
```

È l'**universal link** di TradingView. Comportamento al tap:

- **Mobile** (`useIsMobile()` true): navigazione **same-tab** verso l'URL.
  Su iOS/Android il SO instrada automaticamente all'app TradingView se
  installata (universal link / app link), altrimenti apre il browser dove
  l'utente è già loggato. Same-tab è più affidabile dell'apertura in nuova
  scheda per l'handoff all'app su iOS.
- **Desktop:** apertura in **nuova scheda** (`target="_blank"`, `rel="noopener
  noreferrer"`) — non esiste app, va al web.

**Vincolo accettato:** dal browser non è possibile rilevare se l'app nativa è
installata (i browser lo impediscono di proposito). Gli universal link sono
l'unico meccanismo affidabile per "app se presente, altrimenti web"; la scelta
app-vs-web è demandata al sistema operativo. Niente custom scheme + timeout
(undocumented per TradingView, fragile).

## 5. Ingranaggio → scorciatoia Preferiti

L'icona ⚙️ nell'header non apre più il dialog: naviga a
`/settings?section=pairs` (stessa convenzione di `PlanBadge` →
`/settings?section=abbonamento`). Il badge "LIVE" resta invariato.

## 6. Stato vuoto

Se `selectedPairs` è vuoto, mostra un empty state con CTA "Scegli i tuoi pair"
che porta a `/settings?section=pairs`. Copy via i18n.

## 7. i18n

Le stringhe nuove (empty state, tooltip ingranaggio, aria-label tap) usano
`uiText()`/chiavi nel namespace `tradingview.watchlist.*`, aggiunte a **tutte e 5
le lingue** (vincolo `production-copy.static.test.ts`), senza caratteri vietati
dal test mojibake (`i18n.parity.static.test.ts`). Le chiavi non più usate
(editor/suggestion) possono restare nel dizionario.

## 8. Test (TDD)

- **Funzioni pure (unit, prima del codice):**
  - `mapCatalogPairToTradingViewSymbol` — forex, metalli, indici, crypto,
    fallback.
  - `buildTradingViewDeepLink` — encoding del simbolo, prefisso URL.
- **Riscrittura `TradingViewWatchlistWidget.static.test.ts`:** rimuove le
  asserzioni su export eliminati; aggiunge asserzioni sulla struttura del
  sorgente (nessuna `STORAGE_KEY`, nessun `SymbolEditorDialog`, legge
  `selectedPairs`/`useBackground`, ingranaggio → `/settings?section=pairs`,
  embed `mini-symbol-overview` mantenuto).
- **`Dashboard.tradingview-watchlist.static.test.ts`:** invariato (la
  registrazione del widget nella dashboard non cambia).
- **Gate:** `pnpm verify` verde prima di dichiarare fatto.

## 9. Note / fuori scope

- **Performance:** ogni pair resta un embed live (iframe); con molti preferiti
  sono molti iframe. Manteniamo il formato attuale; eventuale alleggerimento
  (lista prezzi/sparkline) è fuori scope.
- Nessuna modifica al contratto API (`selectedPairs` già esposto da
  `GET /user/settings`).

## 10. File toccati

- `artifacts/trader-dashboard/src/components/TradingViewWatchlistWidget.tsx` (riscrittura sostanziale)
- `artifacts/trader-dashboard/src/components/TradingViewWatchlistWidget.static.test.ts` (riscrittura)
- `artifacts/trader-dashboard/src/lib/i18n.ts` (nuove chiavi, 5 lingue)
