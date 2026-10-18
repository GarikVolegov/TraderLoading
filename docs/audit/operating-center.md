> Aggiornamento successivo: [audit runtime del 1 ottobre](local-runtime-2026-10-01.md) e [contesto v2/COT](pair-context-v2.md). Il registro seguente conserva i risultati della prima tranche.

# Centro operativo — audit della prima tranche

Verifiche del 23–24 settembre 2026, sulla copia locale. Le modifiche già presenti
alla navigazione e alla watchlist sono state conservate. Nessuna migrazione,
avvio con `push-force`, scrittura nel database personale o pubblicazione.

## Correzioni ed evidenze

Gravità: **alta** = blocco del percorso o informazione operativa fuorviante;
**media** = percorso incompleto o comportamento che richiede un aggiramento.

| ID | Gravità / tipo | Riproduzione iniziale | Comportamento atteso e correzione | Evidenza |
| --- | --- | --- | --- | --- |
| BOOT-01 | Alta, bug | Aprire l'app: `Library is not defined` nella navigazione | Import delle icone completi; apertura desktop/mobile | Browser isolato, nessuna eccezione non gestita |
| PAIR-01 | Alta, bug | Selezionare un simbolo non coperto da un widget | Solo intersezione supportata; indicare copertura mancante, mai sostituire con i default | Test resolver e browser: EURUSD, BTCUSD, selezione mista, UNKNOWN |
| PAIR-02 | Alta, bug | Far fallire il PUT delle preferenze/onboarding | Selezione precedente mantenuta; bozza aperta, errore visibile e retry; aggiornamento solo dopo successo | Browser: errore e retry, ricaricamento, onboarding; anche preferenze mobile |
| SENT-01 | Alta, bug | Provider sentiment configurato ma in errore, cache vuota | Nessun dato dimostrativo; disponibile/ultimo dato/indisponibile con provenienza | Test servizio: assenza credenziali, errore iniziale, cache, scadenza, recupero, risposta invalida e concorrenza; stati UI nel browser |
| VOL-01 | Alta, bug | Volatilità mancante o invalida | Nessuno zero inventato né etichetta verde “Spazio”; uno zero misurato rimane valido | Test helper e snapshot; browser con 503, null, cache precedente, zero reale |
| VOL-02 | Alta, bug | Cache scaduta o ultimo D1 appartenente a una giornata precedente | Stato vecchio riconoscibile; fonte, recupero e apertura della candela distinti | Test snapshot e browser stale; nessuna verifica live di Redis/provider |
| RISK-01 | Alta, bug di visibilità | `/journal/edge` restituisce un limite superato | Avviso visibile su dashboard e panoramica diario; errore della verifica esplicito | Fixture perdita −120 / limite 100; scenario 503; test esistenti dei calcoli/soglie |
| CHECK-01 | Alta, testo fuorviante | Completare tutti gli elementi della checklist | “Checklist completata”; l'avviso sui limiti resta indipendente | Browser con checklist completa e perdita giornaliera superata |
| JRN-01 | Media, bug | Aprire `?t=idee`, `?t=obiettivi` o ripetere “Nuovo Trade” dal tab trades | Tab corretti e apertura ripetibile del modulo; conservare `t=trades` consumando `new=1` | Test routing/statici esistenti e browser registrazione/revisione |
| JRN-02 | Media, accessibilità | Provare a modificare una voce del diario da touch/tastiera | Azioni visibili su mobile e con focus da tastiera | Correzione CSS; apertura nuovo trade mobile verificata |

La verifica del rischio viene invalidata anche dopo salvataggio/eliminazione di
una voce: il pannello rilegge il contratto esistente senza introdurre altre soglie.
I testi aggiunti sono presenti nelle cinque lingue dell'applicazione.

## Risultati delle verifiche

- `pnpm verify`: **387 file di test passati, 0 falliti**, codegen, TypeScript e build
  completati. Prerender marketing escluso tramite `SKIP_PRERENDER=1`; non è stato
  validato il rendering con l'autenticazione esterna reale. Restano gli avvisi di
  build sulle dimensioni di alcuni chunk.
- `pnpm lint:ci`: **0 errori, 34 warning**, entro il limite del repository (39).
- Dopo l'ultima correzione dei simboli sconosciuti: TypeScript, tutti i 387 file
  di test e build frontend rieseguiti con successo; prove browser sul codice aggiornato.
- Runner browser: avvio e flussi principali in italiano, Europe/Rome; desktop
  1440×1000, mobile 390×844: **37 controlli passati, 0 eccezioni JavaScript non
  gestite**, attendendo la scomparsa della schermata di caricamento. Il rapporto
  JSON elenca ogni asserzione superata.
- `git diff --check`: nessun errore di whitespace.

Comandi e isolamento: [istruzioni del runner](../../scripts/verify-operating-center/README.md).
Evidenze locali: [rapporto browser](../../artifacts.local/verify-operating-center/report.json),
[dashboard desktop](../../artifacts.local/verify-operating-center/desktop.png),
[dashboard mobile](../../artifacts.local/verify-operating-center/mobile.png),
[salvataggio fallito mobile](../../artifacts.local/verify-operating-center/mobile-save-error.png).
Log completi sotto `.local-logs/operating-center-*.log` (file locali ignorati da Git).

### Portata effettiva del browser

Le API sono simulate in memoria, con i componenti e il routing reali dell'app.
Si prova la registrazione di una voce con simbolo, prezzi, stop, P&L e note, il
ricaricamento, la revisione delle note e l'apertura ripetuta del modulo. Non si
certifica la persistenza backend o la sincronizzazione broker. Il guard restituisce
un report di test prestabilito: il browser verifica visibilità e indisponibilità,
non il ricalcolo a partire dal trade inserito.

Aree aperte senza eccezioni JavaScript: diario (trades/idee/obiettivi), news,
calendario, checklist, routine, backtest, wiki, missioni, orologio, broker, pro,
supporto, biblioteca, traguardi, chat e tornei. Le funzionalità interne di tutte
queste aree **non** sono certificate. Endpoint secondari non coperti dalla fixture
(rischio di rovina/correlazione/recap, sessioni backtest, contenuti wiki/biblioteca,
ticket, certificati, feed social e tornei) rispondono intenzionalmente 503 e sono
elencati nel rapporto. Questi 503 non sono evidenza di un guasto reale dei servizi.

## Problemi aperti e decisioni per la tranche successiva

| ID | Gravità / tipo | Riproduzione o evidenza | Comportamento atteso / prossimo intervento |
| --- | --- | --- | --- |
| DIR-01 | Alta, bug | `probe-news.mjs`: yields rise/fall entrambi bearish 0.80; rate cut/hike entrambi bearish 0.76, tutti rilevanti per XAUUSD | Separare rilevanza e direzione; validare il segno sul pair. Nessuna conversione automatica in probabilità |
| COT-01 | Alta per l'indicatore, limite dati | Adattatore COT mantiene fallback statico etichettato | Escluderlo da qualsiasi lettura quantitativa aggregata; sostituire con indisponibilità prima di usarlo nel modello |
| TIME-01 | Media, bug | `ChecklistDashboardWidget.todayKey()` usa `toISOString()`; a mezzanotte Rome il giorno UTC può essere quello precedente | Allineare reset e persistenza della checklist al giorno operativo Europe/Rome |
| CHECK-02 | Media, scelta di prodotto | La checklist giornaliera non è associata al pair o a un singolo setup | Definire se il completamento vale per giornata, strumento o operazione; non attribuirgli una validazione del rischio |
| CHECK-03 | Media, bug di coerenza | Completare la checklist dashboard: il widget usa stato locale mentre `WelcomeNotification` conta `completed` dalla API; nella prova appare 1/1 nel widget e 0/1 nel riepilogo | Unificare la fonte del completamento giornaliero fra widget, pagina e riepiloghi |
| JRN-03 | Media, limite del flusso | Il modulo di modifica ripristina note/titolo ma inizializza a vuoto i campi del trade collegato | Recuperare e visualizzare i dati già registrati prima di consentirne la revisione; salvare solo note continua a preservare il trade esistente |
| WATCH-01 | Media, informazione da chiarire | La watchlist usa candele D1; freschezza della barra non dimostra aggiornamento tick | Riallineare “Realtime/Live” alla frequenza effettiva o integrare un feed adatto |
| LOT-01 | Alta prima dell'uso multi-asset, limite di modello | Il calcolatore usa un divisore configurato, non un contratto di valore-pip/conversione per ciascun strumento | Verificare per mercato e valuta del conto; non usare questo valore come controllo universale della size |
| MACRO-01 | Limite dati | Il calendario corrente espone forecast/previous, senza actual | Acquisire il valore pubblicato e le revisioni prima di calcolare sorprese macro |
| HIST-01 | Limite dati | Assenza di archivio completo delle letture conoscibili all'istante di consultazione | Raccolta prospettica e valutazione senza dati futuri, come nel protocollo allegato |
| CONFIG-01 | Configurazione, non bug provato | Myfxbook richiede credenziali; broker, auth e altri provider richiedono servizi reali | Verifica d'integrazione in un ambiente di test dedicato; non dichiarare funzionanti connessioni mai esercitate |

News e calendario completi mantengono i propri controlli di esplorazione. La
coerenza dei preferiti è applicata ai consumatori del filtro condiviso (sentiment,
volatilità, watchlist, COT, calendario dashboard, ticker macro); il catalogo può
ricondurre crypto/indici alla valuta quotata, senza implicare copertura specifica
dell'asset da parte di un calendario macro.

Contratti: [disponibilità e provenienza](../market-data-contract.md).
Fonti e protocollo futuro: [preparazione dell'indicatore](daily-indicator-readiness.md).
La formula aggregata e la raccolta storica delle letture non sono implementate.
