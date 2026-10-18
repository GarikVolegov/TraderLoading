# Premi di livello — audit del 9 ottobre 2026

Esecuzione `20261002T103216Z`, API **produzione** su3002, database e upload separati. Utenti sintetici con XP500 e0, amministratore assegnato nel solo database audit. Non sono premi blockchain né pagamenti esterni.

Evidenze: `artifacts.local/full-audit/20261002T103216Z/milestone-runtime-{baseline,after}.json`; runner `full/milestone-runtime-flows.mjs`. Baseline **4/9 passati**, cinque difetti riprodotti; after **9/9 passati**.

| ID | Gravità / tipo | Riproduzione e atteso/osservato | Causa e correzione | Nuova prova |
| --- | --- | --- | --- | --- |
| MILE-01 | Media / bug | Livelli con suffisso, zero/negativi o overflow e payload di tipo errato. Atteso400 senza mutazione; osservate letture/scritture200 e alcuni errori500 | `parseInt` permissivo e assenza di schema body. ID positivi int32 e schema tipizzato, skills stringa JSON compatibile o array di stringhe | PASS, dati precedenti invariati |
| MILE-02 | Media / bug | HTML dichiarato PNG/PDF accettato201 e salvato come materiale. Atteso415 | Veniva controllato solo il MIME dichiarato. Verifica header, MIME ed estensione per raster/PDF; file temporaneo eliminato se invalido | PASS, entrambi415. Non dimostra esecuzione di script nel baseline |
| MILE-03 | Media / bug | Upload verso livello con suffisso accettato201. Il rischio di file residuo dopo INSERT fallita emerge dal codice; la baseline si interrompe prima di questa seconda prova | Livello validato prima di multer; cleanup su errore prima della conferma di persistenza | PASS, nessun nuovo file dopo400 e dopo500 DB; il guasto INSERT è verificato nella versione corretta |
| MILE-04 | Media / bug | PATCH `downloadable:"false"` accettata e interpretata come true. Atteso400 con flag invariato | Conversione `!!downloadable`. Booleano obbligatorio; ID rigoroso | PASS, false reale salvato e rileggibile; stringa/ID con suffisso respinti |
| MILE-05 | Alta / bug, perdita di file | Trigger DB rifiuta DELETE: API500, riga presente ma download404 perché file già cancellato | File rimosso prima della query. DELETE atomica con RETURNING prima della rimozione fisica; cleanup post-commit non invalida la risposta | PASS, dopo500 riga e download200 presenti; retry elimina entrambi |

Altre prove positive: elenco pubblico, modifica amministrativa e rilettura; utente ordinario403; upload/download con livello raggiunto, livello insufficiente e anonimo404; intestazioni private/no-store e nosniff; doppia eliminazione404; dodici salvataggi concorrenti con una sola riga; otto backfill certificati concorrenti con esattamente livelli1/2, visualizzazione autenticata del profilo e anonimo401. La concorrenza del primo salvataggio passava nel baseline: l'upsert sostituisce comunque due query separate, senza attribuirgli un difetto o guadagno prestazionale misurato.

La proprietà `downloadable` controlla il pulsante di download nella UI; non è una protezione DRM contro un utente che ha diritto a leggere il materiale. Lo stato a livello di accesso continua a essere verificato dal server. Le medaglie visibili in un altro profilo sono informazioni sociali accessibili agli autenticati per contratto, non contenuto privato per proprietario.

## Editor nell'app

Runner `full/browser-milestone-editor.mjs`, Clerk Development reale con ruolo content_manager, browser desktop/mobile. I dati del livello20 preesistenti nel **database sintetico** vengono conservati e ripristinati; allegati di questa prova rimossi. Errori503 e attese intenzionali sono contrassegnati come simulazioni; salvataggi e riletture riusciti usano API e DB effettivi.

| ID | Gravità / tipo | Riproduzione e osservazione | Intervento |
| --- | --- | --- | --- |
| MILE-UI-01 | Media / bug | PUT in attesa: campi modificabili, editor richiudibile e protezione dall'invio doppio incompleta | Snapshot dei campi, guard sincrono, fieldset e chiusura bloccati durante ogni operazione |
| MILE-UI-02 | Media / bug | PUT503 conservava la bozza ma non mostrava un errore nell'editor | Avviso inline, bozza conservata e retry |
| MILE-UI-03 | Media / bug | Upload in attesa lasciava possibile salvare/chiudere l'editor | Stesso blocco delle operazioni per upload e modifiche file |
| MILE-UI-04 | Media / bug | Upload503 non mostrava errore né istruzioni di recupero | Controllo dello stato HTTP tramite apiJSON anche per FormData; avviso esplicito, nessun allegato fantasma, input file ripristinato per retry |
| MILE-UI-05 | Media / bug | Errori su switch/eliminazione file erano registrati solo in console | Controllo HTTP anche per DELETE, errore inline; stato DB precedente conservato fino al successo |
| MILE-UI-06 | Media / bug | Lettura dettaglio503 consentiva di aprire un modulo vuoto senza distinguere indisponibilità da materiale assente | Stato errore/retry; editor bloccato fino al recupero del dettaglio |

Baseline dell'editor: **1/6 passato**, cinque difetti riprodotti; lettura indisponibile riprodotta separatamente in `browser-milestone-editor-baseline-read/report.json`. I tentativi preliminari bloccati da onboarding/check-in non sono difetti del materiale: il runner ora attende e chiude gli avvisi prima di interagire.

After: **8/8 scenari passati**, in `browser-milestone-editor-after/report.json`, senza errori JavaScript. Dopo le correzioni, l’editor viene verificato anche su mobile con tastiera e senza overflow. Rimossi i pulsanti HTML annidati nell'intestazione; titolo/descrizione/competenza associati ai rispettivi input, chiusura nominata e cancellazione visibile al focus. Il guard della richiesta copre anche la chiusura del pannello esterno.

## Limiti

Nessuna decodifica completa raster/PDF, scansione antivirus o analisi dei documenti Office/ZIP/video. La verifica header non certifica l'intero contenuto. Un errore del filesystem dopo DELETE confermata può lasciare un file orfano non leggibile tramite la route protetta: resta da introdurre una manutenzione degli orfani. Le prove non simulano la perdita di risposta dopo commit di ogni operazione e non certificano il mint dei tornei.
