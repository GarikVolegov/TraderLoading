# Candle warehouse — runbook di seeding (replay terminal)

Il Replay Terminal (`/backtest/:id/replay`) serve le candele **warehouse-first**
(`CANDLE_WAREHOUSE=1`): M1 nativo in Postgres, aggregato in SQL a M5→D1, con
fallback automatico alla catena live (Yahoo/TwelveData/Binance/Dukascopy) dove il
warehouse non copre. Senza seeding il terminal funziona comunque, ma con storico
intraday limitato (avviso "storico limitato" nella UI, che legge
`GET /api/backtest/candles/meta`).

## Seeding locale / one-off

```bash
cd artifacts/api-server
export DATABASE_URL=...          # Postgres locale o Neon (prod)
npx tsx src/ingest.ts seed --symbols=EURUSD --years=5
```

- **Sorgenti**: Dukascopy (FX/metalli/indici, M1 tick-volume — lento: file
  per-giorno, ~30–60 min/anno/simbolo) e Binance (BTCUSD/ETHUSD — veloce,
  ~40 min per 5 anni).
- **Ordine consigliato**: prima i simboli usati nelle sessioni reali —
  `BTCUSD` (canarino veloce), `EURUSD`, `GBPUSD`, `XAUUSD`, `NAS100` — poi il
  resto del registry (`services/candleRegistry.ts`).
- I chunk sono **mensili e idempotenti** (upsert): un chunk fallito
  ("fetch failed" transitorio di Dukascopy) non blocca gli altri. Per riparare i
  buchi rilancia il seed sul range interessato:
  `npx tsx src/ingest.ts seed --symbols=EURUSD --from=2023-11-01 --to=2024-01-01`.
- Verifica copertura:
  ```sql
  SELECT symbol, res, to_timestamp(first_ts)::date AS first,
         to_timestamp(last_ts)::date AS last, status
  FROM candle_ingestion_state ORDER BY symbol;
  ```
  I buchi interni si vedono confrontando `count(*)` per mese:
  `SELECT date_trunc('month', to_timestamp(ts)) m, count(*) FROM candle WHERE symbol=1 GROUP BY m ORDER BY m;`

## Attivazione

1. Locale: `CANDLE_WAREHOUSE=1` in `.env.local` (già fatto il 2026-07-12).
2. Railway: aggiungere `CANDLE_WAREHOUSE=1` alle variabili del servizio
   (DATABASE_URL punta a Neon → il seed va eseguito **contro Neon**).
3. Il nightly **tail** (`.github/workflows/candle-tail.yml`, 01:00) mantiene
   fresco il warehouse dal watermark; ha anche `workflow_dispatch` con
   `mode=seed` per backfill da CI (attenzione al timeout di 30 min: per un seed
   5y usa run per-simbolo in locale).

## Stato attuale (2026-07-12, Postgres locale)

- BTCUSD: 2021-07 → oggi (2.63M barre M1, Binance) ✅
- EURUSD: 2021-07 → oggi con alcuni mesi da riseminare (chunk Dukascopy
  falliti per errori di rete; vedi query sopra) ⚠️
- Altri simboli: da seminare (fallback live attivo nel frattempo).

## Riparazione buchi (heal DB-driven)

Il seeding profondo via Dukascopy rate-limita: le corsie parallele fanno
fallire molti chunk mensili, lasciando buchi interni anche quando `first_ts`/
`last_ts` coprono l'intervallo. Per riempire **solo i mesi mancanti** (invece di
ri-seedare interi simboli):

```
CANDLE_WAREHOUSE=1 DATABASE_URL=<neon> \
  pnpm --filter @workspace/api-server exec tsx src/services/ingest/healGaps.ts 5
```

`healGaps.ts` interroga il DB per i mesi con dati di ogni simbolo, calcola i
mesi mancanti negli ultimi N anni (default 5) e ri-seeda **solo quelli**,
single-lane con pause di 4s (l'ingest ha retry+backoff per-chunk). Idempotente,
riavviabile. A fine run stampa un riepilogo `healed/missing` per simbolo.

**Nota rate-limit:** eseguire il heal **single-lane** (una sola istanza). Corsie
parallele su Dukascopy saturano e rifanno fallire i chunk. Le crypto (BTC/ETH via
Binance) non hanno questo problema e si seedano velocemente.
