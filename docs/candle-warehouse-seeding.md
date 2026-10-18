# Storico permanente per il backtest

Aggiornato il 10 ottobre 2026. Il replay usa PostgreSQL e una sola fonte di
quotazioni M1 per strumento. Cache e provider live non sostituiscono i periodi
mancanti. Le altre viste di mercato mantengono la loro catena di fonti esistente.

## Strumenti e copertura

Il primo obiettivo è uno storico di cinque anni per **XAUUSD, EURUSD e USOIL**.
I timeframe M1, M5, M15, M30, H1, H4, D1 e W1 derivano dalle stesse M1.
USOIL corrisponde al CFD WTI Dukascopy `lightcmdusd`, prezzo bid; non viene
sostituito con futures Yahoo. La simulazione dichiara tick 0,01 e lotto 1.000 barili.

Il controllo del database locale ha rilevato EURUSD fermo al 13 luglio 2026,
XAUUSD al 30 giugno 2025, USOIL senza candele. Questi dati **non costituiscono cinque
anni completi su tutti e tre gli strumenti**. La UI mostra intervallo, fonte,
numero di M1 e giorni feriali da verificare. I weekend non contano come giorni
mancanti; festività e altre chiusure richiedono verifica. Non vengono inventate
candele per nascondere i buchi. Il controllo dei giorni non certifica ogni minuto
intraday e non equivale a uno storico consolidato di tutto il mercato.

## Importazione online

```bash
pnpm backtest:sync
# Solo uno strumento o un intervallo; to è esclusivo:
pnpm backtest:sync --symbols=XAUUSD --from=2024-01-01 --to=2025-01-01
pnpm backtest:tail
```

I comandi caricano `.env.local` e usano lo stesso database del launcher locale;
`LOCAL_DATABASE_URL` permette di scegliere un database esplicito. Non stampano
credenziali. Il seed lavora per mesi, dal più recente, alternando i tre strumenti.
Una sola corsia per database evita importazioni concorrenti. Il ledger
`candle_import_chunks` registra importazioni in corso, riuscite e fallite.
Rilanciare il comando conserva quanto salvato e salta solo intervalli verificati
con righe ancora presenti. I mesi parziali restano riparabili. Errori della fonte
non avanzano il watermark e non certificano un periodo vuoto.

`pnpm start:local`, con `CANDLE_WAREHOUSE=1`, avvia un worker separato: seed
riprendibile iniziale, poi aggiornamento ogni ora; fallimenti vengono ritentati
con pausa. `BACKTEST_HISTORY_SYNC=0` disattiva quel worker. Il launcher non applica
migrazioni. Lo schema aggiuntivo è nella migrazione `0035_candle_import_chunks.sql`;
nel database locale è stata aggiunta solo questa tabella, senza cambiare le
altre tabelle o le righe personali. Per altri ambienti seguire la normale
procedura di migrazione, senza usare `db:push` sulla tabella partizionata.

La GitHub Action `candle-tail.yml` mantiene il tail notturno di tutti i simboli
supportati. L'avvio manuale permette simboli e anni, con seed riprendibile e
finestra di esecuzione più lunga. Le modifiche devono essere pubblicate prima
che la nuova configurazione CI sia attiva.

### Accesso alla fonte

Durante questa verifica Dukascopy ha restituito **HTTP 429** con rimando alla
[procedura ufficiale di esportazione](https://www.dukascopy.com/wiki/en/development/data-export/).
Il bulk indicato dalla fonte usa S3 Requester Pays e richiede configurazione AWS.
Su questo computer AWS CLI e credenziali non sono configurate. Non sono stati
attivati servizi o download a pagamento. Retry e persistenza correggono la
pipeline, ma non risolvono l'accesso esterno: lo storico mancante resta tale
finché una fonte accessibile o un'esportazione completa viene fornita.

È stata verificata anche [HistData, download gratuiti](https://www.histdata.com/download-free-forex-data/).
Alcuni archivi EURUSD, XAUUSD e WTIUSD sono scaricabili, ma per WTIUSD le pagine
2024–2025 non hanno fornito un download utilizzabile. Il file settembre 2026
contiene inoltre sei timestamp duplicati con OHLC differenti. Non è quindi una
sostituzione verificata per cinque anni completi di USOIL. Questi file non sono
stati importati né rinominati come Dukascopy. HistData dichiara quotazioni bid e
timestamp EST fisso, UTC−5 senza ora legale, nella
[specifica ufficiale](https://www.histdata.com/f-a-q/data-files-detailed-specification/).
Un eventuale supporto futuro deve mantenere separati fonte, timezone e conflitti.

## Importazione CSV senza accesso online

```bash
pnpm backtest:import --symbols=XAUUSD --source=dukascopy --file="/percorso/XAUUSD-M1.csv"
pnpm backtest:import --symbols=EURUSD --source=dukascopy --file="/percorso/EURUSD-M1.csv"
pnpm backtest:import --symbols=USOIL --source=dukascopy --file="/percorso/USOIL-M1.csv"
```

Importare solo esportazioni **M1 Dukascopy del simbolo dichiarato**, con prezzo
bid. `--source=dukascopy` dichiara la provenienza: il parser non può certificarla
né riconoscere automaticamente il timeframe o il lato delle quotazioni.
CSV di altri broker non vanno rinominati come Dukascopy o mescolati al feed.
Il comando rifiuta anche simboli il cui feed canonico è differente, per evitare
che un CSV sostituisca accidentalmente dati Binance già salvati.

Formato supportato: separatore virgola o punto e virgola; colonne `Time (UTC)`
o `Gmt time`, `Open`, `High`, `Low`, `Close`, `Volume` facoltativo. Le date possono
essere `03.06.2024 09:17:00.000` sotto intestazione UTC oppure ISO con timezone
esplicito. Timestamp devono essere minuti interi e OHLC validi; duplicati o
valori non validi bloccano l'importazione. Per file molto grandi preferire
esportazioni annuali. L'importazione usa le date effettive del CSV e il medesimo
ledger; nessuna lettura di rete. Il replay è utilizzabile sui dati salvati anche
quando la fonte online non risponde.

## Verifiche riproducibili

```bash
pnpm verify
pnpm lint:ci
node scripts/verify-backtest/history-runtime.mjs
```

Il runner runtime crea un database PostgreSQL locale `tl_audit_*`, usa candele
sintetiche dichiarate e lo elimina al termine. Verifica salvataggio, ripresa,
riparazione di un intervallo parziale, fonte coerente, aggregazione SQL, candela
parziale senza prezzi futuri, persistenza dopo riavvio del processo e import CSV.
Non modifica i dati personali e non chiama provider esterni.

Esito locale del 10 ottobre 2026: **423 file di test passati**, typecheck,
build e prerender **45/45**; lint **0 errori, 35 warning preesistenti**. Il runner
PostgreSQL ha superato dieci verifiche, inclusi fine archivio, paginazione prima
del primo dato e limiti del calendario indipendenti dall'obiettivo quinquennale.
L'API locale riavviata ha superato anche i controlli su metadata reali dei tre
strumenti, warm-up di 250 barre con clock esatto, risposta 409 per USOIL vuoto e
rifiuto di date impossibili. Verifica visiva desktop con fixture sintetica dichiarata:
selezione 10 giugno 2024 09:17 UTC, passaggio M1/H4 senza spostare il clock,
ripristino dopo reload e ricerca/configurazione RSI. I file di preview sono stati
rimossi. La verifica visiva non certifica la completezza delle quotazioni né
costituisce un test su dispositivo mobile reale.

La data iniziale delle nuove sessioni e il clock del terminale sono conservati
nel browser tramite localStorage; la scelta resta salvata anche prima di aprire
il primo replay. Le candele sono invece persistenti in PostgreSQL. Il clock e le
impostazioni del terminale non sono ancora sincronizzati tra dispositivi.
