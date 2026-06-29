# Pair preferiti come fonte unica (macro + calendario + risk-on/off mobile)

**Data:** 2026-06-29
**Stato:** design approvato
**Componenti:** `MacroNewsTicker.tsx`, `CalendarWidget.tsx` (+ helper/test)

## 1. Problema

L'utente vuole che i **pair preferiti** (`selectedPairs`) siano l'**unica** fonte
di verità per i pair/asset/valute usati in tutta la dashboard — in tutti i widget
e tool. In più:

1. Le **notizie macro** devono filtrare le valute direttamente dai preferiti, non
   da un selettore separato.
2. Il segnale **risk-on / risk-off** deve avere un dettaglio **pienamente visibile
   anche su mobile** (oggi è troncato).

## 2. Stato attuale (audit)

**Già guidati dai preferiti** (via `selectedPairs`/`selectedCurrencies` +
`deriveEffectiveFilterItems`), nessuna modifica:

- `VolatilityWidget`, `SentimentWidget`, `CotWidget`, `News`, `Backtest`
  (selettore con preferiti per primi), `TradingViewWatchlistWidget` (già allineato
  in un lavoro precedente).

**Divergenti (oggetto di questo spec):**

- **`MacroNewsTicker`**: deriva le valute dai preferiti *solo se* presenti
  (`pairDerivedCurrencies`); altrimenti usa un **filtro valute manuale separato**
  (`localStorage` chiave `macro-news-currencies`, funzioni `loadCurrencies`/
  `saveCurrencies`, stato `selectedCurrencies`, `toggleCurrency`, `selectAll`, UI
  "Filtra per valuta"). Inoltre il blocco sentiment (risk-on/off) è una riga
  `flex items-center gap-3` con riassunto `line-clamp-2`: su mobile il dettaglio
  non è pienamente leggibile.
- **`CalendarWidget`**: filtra gli eventi per `calendarCurrencies` (impostazione
  persistita, *seminata* dai pair tramite `syncCalendarFromPairs` ma modificabile
  con un toggle manuale `toggleCurrency`). Ha anche un filtro **Impatto**
  (`calendarImpacts`) non legato ai pair.

## 3. Decisione (confermata)

**Fonte unica rigida:** rimuovere i selettori manuali per-strumento (filtro valute
macro, toggle valute calendario). I preferiti sono l'unico controllo. Quando
l'utente non ha preferiti → **fallback** a un set di default (stesso pattern della
Watchlist). I filtri **non** legati ai pair (es. *Impatto* del calendario)
restano.

## 4. Design

### 4.1 Notizie macro — fonte unica + fallback

`MacroNewsTicker.tsx`:

- Rimuovere: `STORAGE_KEY` (`macro-news-currencies`), `loadCurrencies`,
  `saveCurrencies`, lo stato `selectedCurrencies` e i due `useEffect` che lo
  salvano, `toggleCurrency`, `selectAll`, e il blocco UI "Filtra per valuta"
  (incluso il ramo `isPairDerivedMode ? … : (manual UI)`).
- Le valute derivano **sempre** dai preferiti. Helper puro:

  ```ts
  // ALL_CURRENCIES = ["EUR","USD","GBP","JPY","CHF","CAD","AUD","NZD","XAU"]
  resolveMacroCurrencies(contextCurrencies: string[]): string[]
  // = deriveEffectiveFilterItems({
  //     requestedItems: contextCurrencies.filter(c => ALL_CURRENCIES.includes(c)),
  //     supportedItems: ALL_CURRENCIES,
  //     defaultItems: ALL_CURRENCIES,
  //   }).items
  ```

  - Preferiti con valute coperte → solo quelle.
  - Nessun preferito coperto / nessun preferito → **tutte** le valute (fallback).
- La query macro usa `effectiveCurrencies = resolveMacroCurrencies(contextCurrencies)`
  (logica `currenciesKey` / `fetchMacroNews` invariata).
- Mantenere la nota "alcune coppie preferite non sono coperte dalle notizie
  macro" quando esistono valute preferite fuori da `ALL_CURRENCIES` (calcolata via
  `deriveEffectiveFilterItems(...).unsupportedItems`).

### 4.2 Risk-on/off pienamente visibile su mobile

Stesso file, blocco `data.sentiment`:

- Sostituire la riga `flex items-center gap-3` (badge + summary `line-clamp-2`)
  con una **card responsive**:
  - **Mobile (default):** `flex-col` — badge `RISK-ON/RISK-OFF · INTENSITÀ` a
    tutta larghezza, sotto il riassunto completo **senza** `line-clamp`.
  - **Desktop (`sm:`):** `sm:flex-row sm:items-center` come oggi.
- Nessuna nuova copia (usa `data.sentiment`, `data.sentimentIntensity`,
  `data.summary`). Stili sentiment invariati (`SENTIMENT_STYLES`).

### 4.3 Calendario — valute dai preferiti

`CalendarWidget.tsx`:

- Rimuovere la sezione **Valute** del pannello filtri (i bottoni `CURRENCIES`) e
  `toggleCurrency`; rimuovere lettura/scrittura di `calendarCurrencies` nel widget.
- Le valute effettive derivano dai preferiti. Helper puro:

  ```ts
  // CALENDAR_CURRENCIES = ["USD","EUR","GBP","JPY","AUD","CAD","CHF","NZD","CNY"]
  resolveCalendarCurrencies(selectedCurrencies: string[]): string[]
  // = deriveEffectiveFilterItems({
  //     requestedItems: selectedCurrencies.filter(c => CALENDAR_CURRENCIES.includes(c)),
  //     supportedItems: CALENDAR_CURRENCIES,
  //     defaultItems: CALENDAR_CURRENCIES,
  //   }).items
  ```

- `visibleEvents` filtra con `new Set(resolveCalendarCurrencies(selectedCurrencies))`
  per il paese/valuta, **e** `selectedImpacts` per l'impatto (invariato).
- **Mantenere** il filtro **Impatto** (`calendarImpacts`, `toggleImpact`,
  `useUpdateUserSettings` per i soli impatti) e il pulsante filtri
  (`SlidersHorizontal`) che ora apre solo la sezione Impatto.
- `BackgroundContext`: lasciare `calendarCurrencies`/`syncCalendarFromPairs`
  invariati (usati altrove); il widget semplicemente non li legge più. Nessuna
  modifica al contratto API.

### 4.4 Resto della dashboard

Nessuna modifica: i widget/tool elencati in §2 sono già conformi. Lo spec lo
registra esplicitamente per chiudere il requisito "su tutta l'applicazione".

## 5. Test (TDD)

- **Helper puri** (nuovo modulo condiviso, es. `lib/favoritePairFilters.ts`, o
  co-locati e ri-esportati): `resolveMacroCurrencies`, `resolveCalendarCurrencies`.
  Test: preferiti coperti → solo quelli; vuoto → default; solo-non-supportati →
  default; misto → intersezione.
- **Static test** aggiornati:
  - `MacroNewsTicker.*.static.test.ts`: niente `macro-news-currencies`, niente
    "Filtra per valuta"/`toggleCurrency`/`selectAll`; presenza
    `resolveMacroCurrencies`; card sentiment responsive (`sm:flex-row`, niente
    `line-clamp` sul blocco sentiment).
  - `CalendarWidget` static test (nuovo o esistente): niente toggle valute /
    `setCalendarCurrencies` nel widget; presenza `resolveCalendarCurrencies`;
    filtro Impatto mantenuto.
- **Gate:** `pnpm verify` verde (typecheck + test + build). `pnpm lint` sui soli
  file toccati deve restare pulito (gli errori di lint pre-esistenti in altri file
  del branch non sono in scope).

## 6. i18n

- Rimuovere/lasciare inutilizzate solo le chiavi non più referenziate (es. label
  "Filtra per valuta" se era una chiave; mantenere parità delle 5 lingue).
- Nessuna nuova stringa visibile prevista; se necessaria, aggiungerla a tutte e 5
  le lingue, senza caratteri vietati dal test mojibake.

## 7. File toccati

- `artifacts/trader-dashboard/src/components/MacroNewsTicker.tsx`
- `artifacts/trader-dashboard/src/components/CalendarWidget.tsx`
- nuovo helper + test (`lib/favoritePairFilters.ts` + `.test.ts`)
- static test di Macro/Calendar (aggiornati/nuovi)
- eventuale `lib/i18n.ts` (solo se cambia copy)
