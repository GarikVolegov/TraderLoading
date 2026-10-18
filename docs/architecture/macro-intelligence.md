# Notizie macro e direzionalità a quattro ore

Implementazione locale, aggiornata l’11 ottobre 2026. Universo iniziale:
EURUSD, GBPUSD, USDJPY, USDCHF, AUDUSD, USDCAD, NZDUSD e XAUUSD. Il percorso
riutilizza Centro operativo e Diario: **pair → eventi → probabilità/scenari →
piano trade o attesa → revisione**. Non sono stati introdotti servizi a pagamento.

## Evidenze e archivi temporali

Le notizie conservano `articleId`, `eventId`, `sourceDocumentId`, `firstSeenAt`
e stato di archiviazione. La stessa versione del documento conserva il primo
recupero; una revisione crea un documento distinto. Quando tipo, periodo e
rilascio sono documentati, l’identità dell’evento li combina; in assenza di questi
elementi resta l’identità dell’articolo. Non si presume una deduplicazione
semantica completa fra tutti gli editori.

Le comunicazioni ufficiali, il testo disponibile e il metodo di analisi restano
distinti. Actual, consenso, precedente e revisione mancanti restano null; il
consenso è utilizzabile soltanto con un timestamp precedente al rilascio. Gli
effetti per pair separano fatto, scenario e invalidazione; un tema macro da solo
non autorizza un segno direzionale. Pagina, brief e ticker condividono selezione,
focus e dettaglio; gli identificativi nuovi conservano la compatibilità con gli
URL precedenti. Il brief contiene al massimo cinque eventi, senza riempimento.

Documenti, osservazioni di prezzo e snapshot vengono inseriti senza riscrivere
le versioni già archiviate nel percorso applicativo. Esiti e decisioni sono
record separati. `closeAt` descrive il momento del dato; `availableAt` e
`firstSeenAt` descrivono quando il sistema lo conosceva. Un import storico non
retrodata la conoscenza del sistema. Gli snapshot visualizzati conservano
contenuto, cutoff, versione del modello e target; un refresh non modifica il
contesto di una decisione già salvata. Si tratta di immutabilità applicativa,
non di una protezione contro scritture SQL amministrative fuori dall’app.

Il profilo macro richiede anche copertura del corpus registrata nel tempo: un
periodo senza eventi e un guasto della raccolta non sono equivalenti. Copertura
assente o insufficiente comporta astensione; non produce caratteristiche macro
artificialmente azzerate.

## Prezzi, target e modelli

La serie canonica del modello è **Dukascopy bid M1**. Non viene combinata con
Yahoo futures, altri provider o prezzi del broker. H1 richiede sessanta minuti
completi; l’esito richiede tutti i 240 minuti del target e il prezzo finale
esatto. Non si riempiono buchi. Un prezzo vecchio, una finestra incompleta o un
calendario non verificato mantengono le probabilità null.

Il target è il rendimento logaritmico del bid fra cutoff e quattro ore dopo.
La fascia laterale usa ±0,5 volte la deviazione standard campionaria degli ultimi
120 rendimenti H1 validi, senza trasformare chiusure settimanali o manutenzioni
in rendimenti di un’ora. Questo esito misura la direzione del mercato; non è il
profitto di un trade dopo spread, slippage, ingresso e stop.

Il modello offline è una regressione logistica multinomiale L2 con ordine delle
classi `up / flat / down`, scaler appreso soltanto sul training e calibrazione
di temperatura separata. Il profilo base ha sette caratteristiche di prezzo,
volatilità e ora. Il profilo opzionale `price_macro_v1` aggiunge tre
caratteristiche e dichiara le sorgenti `dukascopy_bid` e `macro_pit_v1`. Richiede
prezzi e macro prospettici confrontabili, copertura reale e confronto con il
modello di solo prezzo sulle stesse righe. Il profilo base dichiara soltanto
`dukascopy_bid`; l’interfaccia rende esplicita questa differenza.

La ricerca usa finestre temporali di 24 mesi training, tre calibrazione e tre
test, avanzando tre mesi; servono almeno due finestre complete prima del holdout
finale separato. I target vengono esclusi quando attraversano un confine dello
split. Il holdout deve conservare almeno 183 giorni osservati.

Le percentuali richiedono **sia** evidenza storica verificabile **sia** una coorte
prospettica della stessa versione: almeno 500 esiti, almeno 75 per classe,
almeno 183 giorni, errore di calibrazione ≤0,05 per classe, miglioramento rispetto
alla baseline e nessun peggioramento della log-loss. La coorte non sovrapposta è
fissata prima degli esiti alle ore UTC 00/04/08/12/16/20. Il confronto usa blocchi
settimanali e soglia conservativa `p ≤ 0,05/8`; il profilo macro deve superare
anche il riferimento di solo prezzo. Un booleano `passed` scritto nell’artefatto
non basta: l’API verifica schema, hash, report e metriche.

La UI aggiunge controlli su stato, validazione, versione, somma e finitezza delle
probabilità, pair, cutoff, età del riferimento e target. Mostra percentuali intere
soltanto quando tutti i controlli passano. L’indice descrittivo −100/+100 e la sua
copertura restano separati dalla probabilità predittiva.

## Raccolta e attivazione

La migrazione [0036_market_intelligence.sql](../../lib/db/drizzle/0036_market_intelligence.sql)
aggiunge archivi di documenti/corpus, osservazioni, snapshot, esiti e decisioni.
In questo intervento è stata applicata **soltanto a un database temporaneo di
verifica**, poi eliminato. Non è stata applicata al database personale o a un
ambiente di produzione; non è stato eseguito un deploy.

Il collector è disattivato per default: soltanto
`MACRO_INTELLIGENCE_COLLECTOR=1` avvia raccolta e acquisizione degli snapshot
prospettici. Download e training non avvengono nel percorso della richiesta HTTP.
Abilitare il collector non abilita automaticamente le percentuali.

Prima di mostrare percentuali in un ambiente configurato occorrono:

- migrazione applicata all’ambiente scelto e archivi disponibili;
- calendario rivisto per l’intero periodo pertinente, con eccezioni documentate,
  `DIRECTIONAL_CALENDAR_PATH` e `DIRECTIONAL_CALENDAR_SHA256` coerenti;
- artefatti e report verificati in `DIRECTIONAL_MODEL_DIR`, con
  `DIRECTIONAL_MODEL_SHA256_<PAIR>` configurato per ciascun pair approvato;
- superamento dei controlli storici e della raccolta prospettica della medesima
  versione. Calendario, modello o dati assenti mantengono l’astensione.

L’identità runtime del modello include l’hash dell’artefatto. Cambiare coefficienti
o report, anche riusando il nome della versione, crea una coorte prospettica
distinta. Durante la verifica il candidato va conservato immutato.

Il calendario considera gli orari locali di New York e il cambio dell’ora,
oltre alle chiusure eccezionali verificate. Una semplice lista di festività
civili non dimostra gli orari del provider per ogni strumento.

Comandi, schemi JSONL, dipendenze Python fissate, generazione del calendario,
`build-dataset`, `train` e fixture sono documentati nel
[manuale della CLI](../../tools/directional-model/README.md). La CLI produce
candidati di ricerca e report riproducibili; non installa hash autorizzati,
non modifica il database e non approva un modello live. Le fixture sintetiche
dei profili a sette e dieci caratteristiche verificano il software e vengono
escluse dall’autorizzazione alla pubblicazione di probabilità.

Il [runbook di raccolta ed export](../../scripts/market-intelligence/README.md)
fornisce i comandi per importare prezzi, esportare snapshot risolti e derivare
caratteristiche macro da acquisizioni reali. Gli export usano transazioni di sola
lettura, mantengono i tempi originali e non sovrascrivono file già presenti.
Il collector registra la revisione della qualità ogni settimana; ogni richiesta
ricalcola i controlli e nasconde le percentuali quando falliscono.

## Decisioni, diario e revisione

`GET /tools/market-context?pair=…&horizon=4h` aggiunge outlook e `snapshotId`.
`POST /market-decisions` registra `trade` o `wait`, nota e snapshot; i retry per
utente/snapshot/scelta conservano la decisione già scritta.
`GET /market-decisions` restituisce solo le decisioni dell’utente con paginazione,
contesto originale ed eventuale esito valutato.

Il salvataggio non invia ordini. La nota del diario conserva il collegamento
tramite `marketDecisionId`, controllato dal server per proprietà dell’utente e
della voce. Pair e orizzonte vengono trasportati; ingresso, stop, profitto e
rischio non vengono inventati. Fallimenti del salvataggio conservano la bozza e
non mostrano una conferma. Eliminare la voce del diario rimuove il collegamento,
senza cancellare la decisione di mercato.

La Revisione separa gli esiti del mercato dai risultati dei trade effettivi.
Panoramica, curva R e KPI usano la stessa popolazione server di trade chiusi;
espongono numerosità R e trade senza R calcolabile. Il risultato monetario netto
include i costi già registrati. Correttezza direzionale e redditività restano due
misure diverse; la calibrazione non usa soltanto i trade scelti dall’utente.

## Verifiche e limiti attuali

- Runner [runtime isolato](../../scripts/verify-macro-intelligence/runtime.ts):
  **51 controlli passati** su database temporaneo. Autenticazione del runner e
  dati di mercato sono sintetici; proprietà, retry, paginazione, collegamenti e
  archivi sono esercitati contro PostgreSQL reale isolato. Anche il resolver reale
  conserva gli esiti incompleti e il lettore prezzi esclude acquisizioni future
  e preserva la prima versione dopo revisioni e import ripetuti.
- Python: **10 test passati**; parità delle probabilità Python/TypeScript per i
  due profili entro **1e−12**, su fixture sintetiche.
- UI: **7 controlli passati**, viewport 375×500 e 1100×760, componenti reali con
  CSS dell’app e API intercettate. Verificati occultamento delle probabilità,
  interi, assenza di overflow, Tab/Invio, errore 503 con bozza conservata e retry
  con collegamento al diario; zero eccezioni JavaScript.
- **`pnpm verify` passato**: 434 file di test, zero fallimenti, client rigenerati,
  TypeScript, build di produzione e prerender **45/45**. Al gate è stata passata
  soltanto la chiave pubblica Clerk necessaria alla build.
- Lint completo: **zero errori e 35 warning**, entro il limite esistente di 39.
  La generazione dello schema Drizzle è stata verificata in una cartella temporanea;
  le migrazioni precedenti del repository restano intatte.

Report UI locale: `/tmp/trader-macro-ui-audit-report.json`; screenshot
`/tmp/trader-macro-ui-audit-375.png` e `/tmp/trader-macro-ui-audit-1100.png`.
La pagina temporanea è stata rimossa. Queste prove non misurano accuratezza o
profitto su mercati reali, non provano un modello già abilitato e non sostituiscono
verifiche reali di provider, autenticazione completa, broker, dispositivi fisici
o tecnologie assistive. Storico macro prospettico e consenso pre-rilascio
insufficienti non possono essere ricostruiti con titoli o revisioni future.
