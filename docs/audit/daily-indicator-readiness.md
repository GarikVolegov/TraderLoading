# Preparazione dell'indicatore giornaliero

Aggiornamento 24 settembre: la successiva richiesta di una home sintetica ha
portato al [modello descrittivo sperimentale v1](pair-context-v1.md). Il documento
sotto conserva la ricognizione della prima tranche; la validazione predittiva e
la raccolta degli snapshot restano da realizzare.

Ricognizione del codice locale, 23 settembre 2026. Questa è una mappa delle capacità
implementate, non una verifica della disponibilità odierna dei provider. Nessuna formula
aggregata o probabilità direzionale viene pubblicata in questa tranche.

## Fonti candidate

| Fonte / adattatore | Copertura implementata | Frequenza e ritardi | Storico effettivamente disponibile | Misura e limiti |
| --- | --- | --- | --- | --- |
| Calendario Forex Factory/Fair Economy (`routes/calendar.ts`) | Eventi per valuta; filtri USD, EUR, GBP, JPY, AUD, CAD, CHF, NZD, CNY | Feed settimanale, cache 4 ore | L'adattatore corrente legge la settimana; non conserva le versioni storiche delle pubblicazioni | Titolo, orario, impatto, forecast, previous. Manca `actual`: non permette di calcolare sorprese macro realizzate |
| NewsHub: RSS e provider opzionali (`services/newsHub`) | Associazione asset/pair; regole particolarmente sviluppate per XAU/USD; la copertura del catalogo non è uniforme | Scheduler predefinito 60 s, cache briefing macro 2 min; tempi editoriali e pubblicazioni variabili | Corpus/cache di articoli; nessuna prova di archivio completo delle informazioni conoscibili a ogni istante | Rilevanza, freschezza, impatto e classificazione testuale. `matchConfidence` misura un'associazione euristica, non probabilità di rialzo |
| Myfxbook Community Outlook | Simboli restituiti dal provider; l'intersezione con i preferiti è calcolata sulla risposta reale | Widget ogni 10 min; data dell'osservazione non fornita dall'adattatore | Solo ultimo successo in memoria, riutilizzabile per 24 h durante un errore | Percentuale retail long/short. Il posizionamento non equivale automaticamente alla direzione futura |
| CFTC COT (`routes/tools.ts`) | Mercati/valute mappati nell'adattatore CFTC | Settimanale, cron venerdì 21 Europe/Rome; data del report distinta dalla pubblicazione | Parsing delle serie disponibili e cache corrente; verificare completezza per mercato prima di un backtest | Posizionamento non-commercial/commercial. Esiste ancora fallback statico etichettato: escluderlo dall'indicatore |
| Candele (`services/candles.ts`) | Catalogo multi-asset con catene diverse: warehouse, TwelveData, Dukascopy, Binance, Yahoo e altri fallback | Cache e profondità dipendono da intervallo/fonte; la cache locale può durare un'ora. D1 non è un feed tick | Warehouse e paginazione se popolati; fallback D1 fino a circa 400 giorni, disponibilità da verificare per pair | OHLC/volume secondo provider. Alcuni fallback Yahoo usano futures per metalli/indici: dichiarare il proxy, senza trattarlo come spot equivalente |
| Volatilità/ADR | 14 pair dell'elenco `/tools/pairs`, prevalentemente Forex e metalli | Cache 30 min; refresh UI 15 min, retry iniziale 10 s; vecchia candela segnalata | Finestra massima 366 giorni; medie sul campione disponibile | Range high-low, medie e rapporto col range medio annuale. Misura ampiezza, non segno della direzione |
| Diario / controllo del rischio | Operazioni chiuse disponibili per utente; eventuali dati broker importati | Lettura UI 30 s; latenza anche legata alla sincronizzazione/importazione | Storico dell'utente effettivamente presente | Limiti, perdite consecutive, frequenza, rendimento in R quando lo stop è disponibile. Tenere distinto dal giudizio sul mercato |

## Difetti da risolvere prima di un modello direzionale

**DIR-01 — classificazioni opposte indistinguibili (riprodotto su fixture sintetiche).**
`classifyNewsArticle` con focus `XAUUSD` restituisce:

| Titolo sintetico | Direzione restituita | matchConfidence |
| --- | --- | --- |
| US Treasury yields rise | bearish | 0.80 |
| US Treasury yields fall | bearish | 0.80 |
| Fed signals a rate cut | bearish | 0.76 |
| Fed signals a rate hike | bearish | 0.76 |

Causa: regole tematiche con direzione prefissata. Stabilire che una notizia riguarda
un asset è una decisione distinta dal determinarne il verso. L'analisi futura deve
esplicitare soggetto, cambiamento, aspettative e asset di riferimento, e poter
restituire “direzione non determinabile”. La classificazione resta invariata in
questa tranche; le fixture di audit ne documentano il difetto senza sancirlo come
comportamento desiderato in un test di regressione.

Altri vincoli: deduplicazione dello stesso evento ripreso da più fonti; differenza
tra base e valuta quotata; copertura dei periodi mancanti; timestamp di pubblicazione,
prima disponibilità e revisione; allineamento dei proxy di prezzo. Escludere ogni
fallback sintetico o record senza provenienza sufficiente.

## Protocollo per la successiva valutazione

1. Per ogni pair e orizzonte scelto, congelare la definizione del target e gli orari
   prima della valutazione. Default della giornata operativa personale: Europe/Rome;
   aperture/chiusure di mercato e giorni festivi richiedono calendari specifici.
2. Registrare snapshot append-only della lettura al momento della consultazione e
   degli aggiornamenti: versione del modello, pair, orizzonte, timestamp UTC, input
   originali, fonti, timestamp di pubblicazione/prima disponibilità, stato di copertura,
   eventuale astensione e spiegazione dei contributi. Conservare le revisioni separatamente.
3. Calcolare l'esito solo dopo la chiusura dell'orizzonte, usando prezzi della stessa
   fonte e uno schema coerente. Separare movimento rialzista/ribassista/laterale dal
   rispetto delle regole personali; soglie e costi vanno fissati prima del test.
4. Usare divisioni temporali e valutazione progressiva fuori campione. Nessun titolo,
   dato rivisto o peso appreso successivamente può entrare in uno snapshot precedente.
   Dove mancano snapshot storici affidabili, iniziare una raccolta prospettica.
5. Confrontare con riferimenti semplici fissati prima del test; riportare copertura,
   quota di astensioni, errore per classe/pair/sessione e risultati con intervalli
   d'incertezza. Registrare anche peggioramenti rispetto ai riferimenti.
6. Mostrare probabilità soltanto dopo una verifica di calibrazione fuori campione.
   Un punteggio euristico o il valore `matchConfidence` non autorizzano una percentuale
   di successo. Fino ad allora usare una lettura descrittiva con motivazioni e limiti.

Deliverable successivo: specifica del modello e dataset valutabile. L'acquisizione
di nuove fonti, la persistenza degli snapshot e la formula non sono implementate qui.
