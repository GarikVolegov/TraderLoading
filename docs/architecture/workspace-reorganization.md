# Riorganizzazione dell’app autenticata

Implementazione locale del piano approvato, aggiornata il 17 ottobre 2026.
Landing e amministrazione restano fuori dal restyling. Le modifiche convivono con
il lavoro già presente nella working tree; questa nota non certifica l’intero audit applicativo.

## Cockpit operativo del 17 ottobre 2026

Questa sezione sostituisce la precedente home generica centrata sulla definizione
iniziale del metodo. Il riferimento approvato è
[TraderLoading Cockpit, versione 32](https://trading-copilot-pro-garik.fastzebra32.chatgpt.site),
commit sorgente dichiarato dal Site `45633dcaf144eb08c6d4fbe9873fb2ff32fbc078`,
protocollo `2026-10-14-r3`. Il Site è stato consultato; il lavoro e l’integrazione
riguardano la stessa app locale, senza pubblicare modifiche al Site.

La home presenta il percorso a sinistra e il grafico TradingView a destra:
**Ciclo HTF → Zona a sinistra → Schematica ITF/LTF, trigger e target → Gestione e consuntivo**.
Scalping: H1/M15/M1; Swing: Daily/H4, H1/M15, M5/M1. Il cambio di mercato o
modalità azzera le conferme; cambiare contesto o scenario invalida quelle a valle.
Compressione blocca il piano di ingresso; sola liquidità consente JTC/BTI,
re-accumuli soltanto JTC; una zona HTF mitigata permette anche TEST/POC. Il filtro
di sbilanciamento nelle aree vergini rimane una conferma manuale, senza una formula
inventata. Il grafico non determina automaticamente le risposte del trader.

Le finestre operative seguono Europe/Rome con ora legale. Weekend, chiusura,
pre-news, schematiche mancanti e controlli scaduti permettono analisi e attesa,
ma non la conferma di un nuovo piano d’ingresso. Il server convalida il protocollo,
il giorno, il mercato, la compatibilità tra scenario e trigger e i prerequisiti.
Per i piani di ingresso verifica inoltre il calendario economico corrente e le
news pertinenti imminenti: una selezione client non può rimuovere un’indisponibilità
nota delle fonti. I limiti monetari restano scelti e confermati personalmente.
Non viene imposto il numero di stop predefinito del prototipo.

L’attivazione esplicita configura una nuova versione del metodo con le regole
del cockpit e i limiti personali. I metodi precedenti non vengono riscritti.
`cockpit` è un’estensione opzionale strutturata di bozza e guida della sessione;
si conserva nel JSON già persistente e nel contratto OpenAPI/client generato.
La bozza usa revisioni e scritture serializzate esistenti, riprende tra dispositivi
e rimane separata dalla conferma. Il piano conserva anche lo snapshot quantitativo
canonico consultato; la sua insufficienza non viene trasformata in una previsione.

Il Diario proietta l’analisi, il target, il trigger, le conferme e le note della
sessione. I trade effettivi restano canonici e collegati con `processSessionId`
e `methodVersionId`; confermare il piano non crea operazioni. Il consuntivo nel
cockpit richiede un esito e una valutazione espliciti, riconcilia il riepilogo e
raccoglie una correzione facoltativa. Le correzioni e i miglioramenti precedenti
sono riproposti nella preparazione. Le giornate senza trade restano valide.

La barra principale espone Cockpit, Backtest, **Classifica XP** (scelta confermata),
Tornei e Diario. Riutilizza pagine, graduatorie, permessi Pro e URL esistenti.
Metodo, risorse e impostazioni restano accessibili dalla protezione; il contesto
si consulta nel cockpit. Su mobile si alternano percorso e grafico. Il pannello
del percorso scorre autonomamente su desktop, lasciando visibile il grafico.
Le transizioni rispettano il movimento ridotto; i controlli hanno focus visibile
e nomi accessibili espliciti.

`/?process=legacy` conserva la ripresa dei flussi precedenti, inclusi i link a
decisioni già salvate e il ritorno dagli strumenti di una bozza precedente.
Non è la home predefinita. Le sessioni già confermate mantengono le proprie
regole e annotazioni. Non sono state copiate operazioni dal Site di riferimento.
Nessuna modifica DDL è richiesta per questa integrazione.

### Verifica e integrazione del cockpit

Integrato nell’istanza esistente su `http://localhost:5173`, API su 3001,
versione **`local-6f84a44b523f8e1c`**. `pnpm release:local` ha completato
`pnpm verify` (**446 file di test**, build e prerender **45/45**),
`pnpm lint:ci` e prove su PostgreSQL temporaneo (**30 gruppi runtime e
10 gruppi browser**, inclusa la visita dei 27 accessi conservati).
Le prove del cockpit coprono ripresa della bozza tra dispositivi, rifiuto server
di trigger incompatibili, attesa, consuntivo e assenza di trade inventati.
Layout verificati a **375/768/1440 px**, insieme a tastiera e focus.

Le schermate del runner usano un grafico isolato per rendere ripetibili i test.
Una prova separata ha verificato il caricamento effettivo di TradingView con
candele e volumi: `artifacts.local/trader-process/cockpit-live-chart.png`.
Questo controllo non certifica la disponibilità di ogni fonte quantitativa o
del calendario. Il cockpit conserva il dominio della sessione giornaliera:
un piano confermato e più operazioni canoniche collegabili, senza riscrivere
il piano confermato tramite “Nuovo setup”.

Backup aggiuntivo prima dell’integrazione: **346.398.680 byte**,
`.local-logs/process-integration/2026-10-17-cockpit-v32/database.dump`,
con indice di ripristino leggibile. Il gate riutilizza inoltre il precedente
backup completo già ripristinato e verificato su clone.
Report finale:
`.local-logs/process-integration/releases/2026-10-17T16-41-56-126Z/release.json`.
Readiness API e database e risposta HTTP del frontend ricontrollate dopo il
rilascio. Nessuna scrittura di schema; processi di background disattivati.
Nessun deploy o pubblicazione del Site.

## Processo dominante e prova d’uso del 13 ottobre 2026

Questa sezione conserva l’organizzazione precedente, superata dalla sezione
cockpit del 17 ottobre, e sostituiva le precedenti
indicazioni su sei hub equivalenti, cinque strumenti permanenti e avvio della
sessione prima del metodo. Le sezioni successive conservano la cronologia.

La prova usa l’interfaccia reale con un account sintetico e handler reali su un
database temporaneo. Non altera il diario personale. Il percorso è stato
esercitato dalla definizione fino a scenario, attesa, chiusura e scheda del diario,
con visita di tutti i 27 accessi del catalogo. È una verifica automatizzata ed
esplorativa, non uno studio con trader né una misura di redditività.

| Problema osservato usando l’app | Organizzazione applicata |
| --- | --- |
| Troppi ingressi di pari importanza | Oggi, Metodo, Diario; Risorse, Backtest e Social in Altro |
| Percorsi concorrenti e ritorni tra pagine | Un prossimo passo deciso dal server; definizione e protocollo incorporati in Oggi |
| Strumenti sempre esposti e tab estranei al lavoro | Strumenti del metodo nel passaggio pertinente, vista singola e ritorno alla bozza salvata |
| Revisioni slegate dal lavoro quotidiano | Periodi conclusi recuperabili; un giudizio, un’azione e un criterio; esito della correzione precedente |
| Audio avviato da un clic nel form e attesa artificiale | Audio solo su comando esplicito, senza ritardo aggiunto al primo clic |
| Un risultato immediato escluso per troncamento della data | Timestamp predefinito con precisione conservata e indicazione delle prove fuori test |
| Etichette e storico poco raggiungibili | Revisione tradotta, impostazioni classificate correttamente, storico e revisioni di mercato accessibili su richiesta |

**Crescita:** Definisci → Verifica → Applica → Consolida. **Giornata:** Checklist
→ Contesto → Scenario → Operatività/attesa → Chiusura. Regole e limiti vengono
confermati una volta per versione; la giornata richiede controlli, decisione e
riscontro. Una sessione senza trade è valida e non produce evidenze economiche.
Il registro dei fatti resta sempre aperto.

Prima della verifica il sistema guida test/simulazione. Ambienti reali, simulati
e non documentati sono distinti anche nelle importazioni. Una revisione con
criteri personali applicabili falliti sospende nuove aperture reali e conduce a
una nuova versione da verificare, conservando fase, snapshot e storia. Il server
controlla anche le aperture broker dirette e i comandi accodati. Il controllo
attesta il piano documentato: non certifica la perdita monetaria implicita nei
lotti né il rischio totale di tutte le esposizioni del conto.

Dettagli e limiti: [`trader-process.md`](./trader-process.md). Procedura di prova:
[`scripts/verify-trader-process/README.md`](../../scripts/verify-trader-process/README.md).
Migrazioni additive 0042/0043 registrate nel journal; nessun avvio automatico delle
migrazioni e nessun deploy di produzione implicito.

### Verifica e integrazione del 13 ottobre

Aggiornamento allora integrato nell’istanza esistente su `http://localhost:5173`, API su
3001, versione **`local-fad187ccf2cca101`**. `release:local` ha completato schema,
`pnpm verify` (**444 file passati**, build e prerender **45/45**), `lint:ci`
(**zero errori, 35 warning preesistenti**) e runner isolato (**30 gruppi server,
8 gruppi browser**, visita dei **27 accessi**, nessun errore JavaScript).
Layout verificati a 375/768/1440 px; snapshot e report privati in
`artifacts.local/trader-process/`. Le integrazioni broker live non sono state
esercitate: le prove d’apertura usano callback sintetici senza inviare ordini.

Backup completo **346.242.841 byte**:
`.local-logs/process-integration/2026-10-13-guided-process/database.dump`.
Ripristino completo su clone e integrazione additiva sul clone riusciti; clone
rimosso. Applicazione locale esplicita: **102 tabelle** confrontate nelle colonne
originarie senza differenze; tabelle candle non modificate dalla DDL e comprese
nel backup. Report di rilascio:
`.local-logs/process-integration/releases/2026-10-13T20-03-52-363Z/release.json`.
Identità API e database sono state ricontrollate dopo il riavvio. Frontend, porte
e database restano quelli dell’app esistente. Ambiente interattivo e database
sintetico della prova d’uso sono stati chiusi e rimossi.

## Caricamento del contesto del 13 ottobre 2026

La home riceveva subito il contesto vuoto mentre il server raccoglieva le fonti,
ma lo interrogava di nuovo soltanto dopo un minuto. Il contratto ora espone
`refreshing`: Oggi ricontrolla ogni 1,5 secondi durante la raccolta, anche quando
è già disponibile uno score parziale, e torna alla frequenza ordinaria quando
le fonti terminano. Il timeout delle fonti rimane circoscritto a 20 secondi;
una fonte non disponibile non mantiene la pagina in caricamento indefinito.
L’attesa è indicata come raccolta, senza anticipare un verdetto di insufficienza.
I contesti originali di decisioni già registrate rimangono immutabili.
La chiusura del caricamento iniziale usa una callback stabile, evitando di
riavviare il timeout al rerender del provider. La prova della ripresa tramite
URL di una decisione verifica che l’overlay scompaia prima delle interazioni.

La cache delle notizie rivalida anche gli snapshot vecchi presenti in memoria,
considerando l’età originale di `fetchedAt`. Il loader del contesto attende la
rivalidazione nel fan-in in background, condivisa tra lettori e soggetta allo
stesso timeout; la route pubblica delle notizie mantiene lo stale-while-revalidate.
`relatedNews` espone gli articoli recenti pertinenti anche senza una direzione
misurabile. `news` e `newsConsidered` rimangono le sole evidenze direzionali dello
score: una notizia consultabile non diventa automaticamente un contributo neutro,
rialzista o ribassista. Duplicati, titoli futuri e fetch obsoleti non vengono
presentati come notizie fresche.

Il calendario economico senza eventi pertinenti è un risultato valido, distinto
da una fonte irraggiungibile. Il calendario di negoziazione usato dal modello 4h
è invece una fonte separata: la risposta distingue la sua assenza da una finestra
chiusa/non coperta. Nella configurazione locale verificata mancano calendario
reviewed e modello hash-pinned validato. La schermata lo indica esplicitamente;
prezzo, indice descrittivo, COT, sentiment e notizie restano indipendenti. Non si
attivano fixture sintetiche né si sostituiscono le probabilità con lo score.

Nessuna modifica DDL né riscrittura dei dati storici. Backup corrente prima del
rilascio: `.local-logs/process-integration/2026-10-13-market-data-fix/database.dump`
(**346.151.871 byte**). Contratto OpenAPI e client rigenerati; prove aggiunte per
caricamento progressivo, conclusione del timeout, età della cache e notizie prive
di direzione. La prova browser riproduce prima il warming e poi una risposta
parziale ancora in raccolta, senza richiedere refresh manuale.

Rilascio locale verificato: **`local-8483f15320e2ecca`**, nella stessa istanza su
`http://localhost:5173`, API aggiornata su 3001 e database attuale conservato.
`pnpm verify`: **442 file di test passati**, build e prerender **45/45**.
`pnpm lint:ci`: **zero errori, 35 warning preesistenti**. Prove su PostgreSQL
temporaneo: **26 gruppi runtime e 36 gruppi browser**, senza errori JavaScript,
compresi layout 375/768/1440 px, caricamento progressivo e link a decisioni
precedenti. Il primo tentativo ha avuto una disconnessione del browser di
prerender; la verifica completa successiva ha individuato e corretto l’attesa
dell’overlay iniziale. I gate sono stati ripetuti integralmente sul codice finale.
Report: `.local-logs/process-integration/releases/2026-10-13T11-43-03-006Z/release.json`.

Prova finale sulle fonti reali della stessa API locale: XAUUSD passa da warming
a parziale e poi disponibile in **3,04 secondi**, con quattro contributi
disponibili, sei notizie pertinenti, calendario economico disponibile senza
eventi USD ad alto impatto nella finestra e snapshot persistito. Su EURUSD
notizie, COT e sentiment sono disponibili; lo score rimane correttamente
insufficiente perché la serie prezzi non supera il controllo di continuità
(ultimo storico prima della barra corrente oltre il limite di quattro giorni).
Non si allenta il controllo per produrre un numero. Le probabilità di entrambi
restano bloccate dall’assenza del calendario di negoziazione verificato e del
modello configurato. Evidenza privata delle risposte:
`.local-logs/process-integration/2026-10-13-market-data-fix/live-sources.json`.

## Integrazione nell’app locale del 12 ottobre 2026

### Correzione del centro operativo: i pilastri della sessione

La richiesta successiva sostituisce la home centrata sull’avanzamento del metodo.
Il lavoro quotidiano parte dalla checklist e prosegue nella stessa pagina:
**Checklist → Contesto del pair → Scenario → Operatività → Consuntivo**.
Il metodo rimane il riferimento versionato delle regole, con verifica e limiti
personali invariati; non è più il prerequisito di una pagina vuota al primo accesso.

La prima sessione usa la checklist già presente o i controlli essenziali. Dopo la
scelta del pair, presenta direttamente la lettura quantitativa canonica: outlook
con i guard esistenti, score descrittivo sperimentale, prezzo, notizie, calendario
e dettagli COT/range espandibili. Probabilità non validate, vecchie o incomplete
non vengono trasformate in segnali. Il trader scrive aspettativa, condizione di
invalidazione e risposta esplicita (attesa, rivalutazione, uscita secondo regole
o risposta personale), poi sceglie piano oppure attesa. Stop e rischio iniziale
restano personali e non vengono proposti automaticamente.

Solo al primo utilizzo, lo stesso passaggio raccoglie le regole essenziali e i
limiti monetari da confermare. `POST /process/guided-start` crea metodo in fase
Definisci e sessione di pratica, confermando preparazione e piano in un’unica
transazione. Usa ownership, lock per utente, revisione della bozza e request ID;
un retry identico recupera la prima sessione, dati diversi richiedono la ripresa
dello stato esistente. Il protocollo rimane differito ad Avvia verifica.
Nelle giornate successive si recuperano regole e limiti e si compila lo scenario.

Il consuntivo confronta separatamente l’esito dell’aspettativa (verificata,
parziale, invalidata, non valutabile) e l’aderenza al piano. Nessuna scelta
positiva è preselezionata. Gli scostamenti richiedono spiegazione; note e
correzione successiva rimangono facoltative. La preparazione seguente recupera
il miglioramento della revisione, oppure la correzione dell’ultima sessione
chiusa della stessa versione. Le vecchie sessioni senza scenario strutturato
mantengono le conferme precedenti e non richiedono nuovi fatti retroattivi.

Il Diario apre **Sessioni** e proietta i record confermati del processo, senza
copiarli né creare operazioni: una sola scheda per sessione conserva pre trade,
scenario, regole originali, evidenze collegate e post trade. La bozza non compare
come preparazione documentata. `ProcessState.sessions` espone lo storico di
proprietà dell’utente; `contextSnapshots` include soltanto i contesti riferiti
dalle sue sessioni. Quando disponibile, il contesto viene congelato tramite ID
canonico e la conferma recupera o crea la stessa decisione di mercato, in modo
idempotente. I collegamenti a decisioni esistenti recuperano il contesto originale
con `GET /market-decisions/{id}` autenticato; aggiornare esplicitamente il contesto
consuma il vecchio selettore. Le operazioni effettive rimangono canoniche e separate
dalle aspettative; importazione broker non sovrascrive le annotazioni del processo.

La navigazione condivisa tra sidebar, mobile e comandi espone **Oggi, Diario,
Backtest, Social, Metodo, Risorse**. I cinque strumenti di preparazione restano
raggiungibili direttamente; le vecchie viste esplicite, articoli, replay,
conversazioni, decisioni e ritorni checkout conservano i propri URL. `/journal`
apre Sessioni, mentre `t=trades`, `t=panoramica` e le revisioni restano espliciti.
La palette e i modelli 3D esistenti vengono conservati; i nuovi passaggi usano
controlli nativi, focus sul titolo, layout mobile e fallback senza WebGL.

Il contesto mantiene lo stesso ordine su mobile e desktop, senza ereditare il
riordino del vecchio centro operativo. Notizie ed eventi indicano orari in
Europe/Rome. Il feedback della bozza passa subito a modifiche in attesa quando
si cambia una risposta: una scritta di salvataggio precedente non certifica
la nuova scelta.

Dati additivi nei JSON di piano, bozza e consuntivo; nessuna nuova migrazione o
riscrittura dello storico. Il contratto condiviso, OpenAPI e client generati
includono scenario, esito, correzione, storico e avvio combinato. Non si attribuisce
preparazione retroattiva e non si riclassifica la pratica come applicazione.

Il piano operativo ordinario, dopo la definizione e con un unico pair già
recuperato, richiede le conferme della
checklist più otto interazioni (due passaggi, aspettativa, risposta, scelta del
piano, stop, rischio e conferma). Il consuntivo ordinario richiede quattro
interazioni: apertura, esito dell’aspettativa, aderenza e conferma. Testo per
scostamenti, nota o correzione aggiunge solo il lavoro effettivamente necessario.

Le durate del precedente check breve non includono la nuova lettura del contesto
e la formulazione dello scenario; non vengono presentate come tempi verificati
per questo percorso. Le prove browser misurano interazioni automatiche, senza
sostituire una prova di usabilità umana.

Consegna locale verificata: **`local-665e71016b5ff076`**, nella stessa app su
`http://localhost:5173` e nello stesso database. Nessun deploy e nessuna nuova
migrazione. `pnpm release:local` ha completato controllo schema in sola lettura,
**`pnpm verify` (442 file di test, build, prerender 45/45)**,
**`pnpm lint:ci` (0 errori, 35 warning preesistenti)**, **26 gruppi runtime** e
**35 gruppi browser**, senza errori JavaScript. Layout verificati a 375/768/1440 px,
focus, controlli nativi, movimento ridotto e fallback WebGL. Il frontend originale
su 5173 è rimasto attivo; solo l’API locale di proprietà è stata riavviata.

Report: `.local-logs/process-integration/releases/2026-10-12T20-08-05-249Z/release.json`.
Prove browser e runtime usano identità sintetiche e database temporaneo, con
handler reali per processo, diario e decisioni. I servizi ausiliari sono fixture;
la sessione Clerk personale e i fornitori esterni non sono attestati da queste
prove. Il rilascio mantiene il backup completo con ripristino provato già
registrato dalla precedente integrazione; questa correzione non modifica lo schema.

Le sezioni di integrazione successive documentano i rilasci precedenti; la
correzione qui sopra determina il percorso e la navigazione attuali.

### Revisione del processo: orientamento e contesto operativo

La revisione del percorso ha individuato quattro ostacoli concreti: piano
confermato non visibile durante l’operatività, prossimo requisito senza un’azione
coerente, regole mostrate dalla versione attiva anziché dalla sessione, e somme
monetarie tra conti distinti nel controllo quotidiano del limite di perdita.

Oggi conserva mercato/setup, stop iniziale e rischio scelto nel riepilogo del
piano, anche durante il recap. Una sola espansione raccoglie condizioni, uscite,
attesa e limiti dello snapshot, con collegamento alla versione corretta. Il
secondo dettaglio delle regole viene omesso durante l’operatività. Per l’attesa
resta visibile il motivo confermato. Nome, versione e regole della giornata
provengono dal metodo della sessione; attivare un altro metodo non sostituisce
questo contesto. Il messaggio esplicita il cambio di versione senza richiedere
nuove conferme. Dopo una sessione di pratica o con avanzamento pronto, l’azione
di chiusura riporta a Metodo; le revisioni rimangono disponibili nel Diario.

Metodo indica il requisito utile e cosa farne, con i dettagli del criterio
stabilito. Quando resta soltanto il periodo aperto, l’azione principale porta
alla pratica in Oggi, conservando l’inserimento delle evidenze su richiesta.
Le revisioni mancanti hanno priorità rispetto al semplice trascorrere del
periodo osservato: nella finestra esistente si apre il recap corretto; fuori
finestra si mostrano le date e si prosegue con la sessione. Consolida guida il
ciclo di miglioramento senza un falso messaggio «Da completare». Un protocollo
precedente scaduto durante Definisci conduce a una nuova versione con regole
recuperate e nuova conferma personale dei limiti. Le regole o i criteri storici
non vengono modificati. Avvia verifica e inserimento delle evidenze trasferiscono
il focus all’intestazione del nuovo modulo.

Il controllo quotidiano conta una sola volta ogni trade canonico. I risultati
netti documentati restano separati per conto e valuta: un guadagno sul conto B
non nasconde il limite personale raggiunto sul conto A. Non si convertono
implicitamente importi in altre valute. I conti non identificati non vengono
fusi; costi mancanti e risultati stimati restano visibili come incompleti.
Il controllo monetario usa soltanto importi documentati con costi inclusi e
confronta il limite nella valuta del metodo. Rischio, conto, valuta o costi
insufficienti vengono segnalati, senza un indicatore ingannevole di sicurezza
o di validazione. L’allerta di pausa precede il riepilogo del piano. Nessuna
soglia finanziaria nuova viene suggerita o confermata automaticamente.

La rifinitura riguarda guida e presentazione: schema, API, modalità pratica,
gates di avanzamento e storico restano invariati. I test della nuova logica
coprono conti/valute, risultati incompleti e stimati, duplicati canonici,
giorni e versioni distinti, pratica, requisiti e finestre di revisione. Le prove
browser usano handler reali e dati sintetici su PostgreSQL temporaneo; verificano
il piano durante l’operatività, il limite di un conto con guadagni su un altro,
snapshot precedenti, protocolli scaduti e layout 375/768/1440 px.

**Revisione integrata:** versione **`local-7603003a1a257c2e`**, nella stessa app
locale su 5173, API su 3001 e database esistente. `pnpm verify` superato con
**442 file di test**, build e prerender **45/45**; `pnpm lint:ci` superato con
zero errori e **35 warning preesistenti**. Completati **25 gruppi runtime e
33 gruppi browser**, senza errori JavaScript. Il check ordinario e il recap
mantengono rispettivamente le conferme della checklist più quattro azioni e
tre azioni; la consultazione del piano è facoltativa. Nessuna nuova migrazione
o modifica dei dati storici. Report privato in
`.local-logs/process-integration/releases/2026-10-12T16-51-30-970Z/`.
Frontend originale conservato; nessun deploy pubblico. La sessione Clerk
personale e i servizi broker/pagamento live non sono stati esercitati.

### Guida visiva e modelli 3D

Metodo e Oggi adottano una composizione compatta con una scultura 3D procedurale,
griglia discreta, schede con profondità e accenti della palette esistente. Quattro
modelli rappresentano regole da costruire, evidenze da verificare, direzione
operativa e consolidamento. In Metodo la vista segue la fase della versione
consultata; l’editor rappresenta la definizione di nuove regole. In Oggi segue
preparazione, operatività/attesa, bozza del recap e chiusura confermata. Una
giornata conclusa non cambia la fase del metodo né attesta validazione o profitto.

Il componente `ProcessScene` carica separatamente il renderer Three.js soltanto
nelle pagine del processo. Le geometrie sono generate localmente, senza modelli,
texture o servizi esterni. Trascinamento desktop e frecce della tastiera ruotano
la scultura; Home ripristina la vista. Il controllo è facoltativo e non scrive
dati del processo. Su mobile il gesto verticale rimane disponibile per scorrere.
Nessun nuovo campo, conferma, premio o passaggio viene aggiunto al percorso.

Le animazioni accompagnano ingresso delle schede, scelta e cambiamento di fase.
L’ingresso del modello dura 650 ms e termina: non esiste un loop permanente.
Il renderer si ferma quando la pagina è nascosta o la scena è fuori vista;
limita la densità dei pixel e libera geometrie, materiali, osservatori e contesto
GPU allo smontaggio. `prefers-reduced-motion` rende il modello statico e disabilita
le animazioni delle schede. Se WebGL manca o il contesto viene perso, una
illustrazione accessibile conserva l’intero flusso. Le informazioni utili restano
testo e controlli HTML, indipendenti dal canvas.

Il dominio, lo schema e i dati storici restano invariati. La prova browser verifica
rendering reale tramite confronto delle immagini dopo rotazione, tastiera,
assenza di render continui, assenza di scritture ruotando il modello, fallback,
perdita del contesto grafico, movimento ridotto e corrispondenza degli stati
quotidiani. Le schermate a 375/768/1440 px conservano radio native, azione
principale unica, autosalvataggio e ripresa. Le prove autenticate usano handler
reali e identità sintetiche su database temporaneo.

**Rifinitura grafica integrata:** versione **`local-49ccb46cec04a903`**, nella stessa
app su `http://localhost:5173`, API su 3001 e database locale esistente. `pnpm verify`
superato con **441 file di test**, build e prerender **45/45**; `pnpm lint:ci`
superato con zero errori e **35 warning preesistenti**. Le prove hanno completato
**25 gruppi runtime e 28 gruppi browser**, senza errori JavaScript. L’integrazione
non richiede migrazioni aggiuntive e conserva frontend, dati e numero di azioni.
Report privato in
`.local-logs/process-integration/releases/2026-10-12T15-29-39-460Z/`;
screenshot in `artifacts.local/trader-process/`, inclusi `process-3d-introduction.png`,
`process-3d-method.png` e check/recap alle tre larghezze. Nessun deploy pubblico.

### Check rapido e mini recap

La semplificazione approvata conserva il percorso formale in Metodo e separa il
lavoro quotidiano dalla validazione. Metodo contiene due schede, **Setup** e
**Protezione**: nome facoltativo, regole complete, limiti personali e checklist
confermati. La checklist recupera quella esistente anche se arriva dopo il primo
render; altrimenti propone tre controlli modificabili. Nessun importo nuovo viene
scelto per il trader. Il protocollo può mancare durante Definisci: **Avvia verifica**
chiede campione, periodo e criteri e li congela con una sola conferma finale.
I protocolli completi delle versioni precedenti restano utilizzabili e immutabili.

Oggi mostra subito un unico modulo. La prima modifica crea una sessione non
confermata; le bozze si salvano sul server con revisione, conflitti espliciti e
ripresa tra dispositivi. **Conferma e inizia** registra preparazione e piano nella
stessa transazione. Il piano riutilizza le condizioni del metodo e chiede mercato
solo quando necessario, stop specifico e rischio monetario iniziale. Per l’attesa
basta un motivo rapido; solo «Altro» richiede testo. Stato d’animo e note sono
facoltativi e il miglioramento già scelto non viene riscritto. Le sessioni già
preparate conservano timestamp, checklist e informazioni confermate.

La giornata mostra tre stati: **Prepara → Operi o attendi → Chiudi**. L’attesa non
apre automaticamente il recap. Operazioni, strumenti e pausa restano raggiungibili.
Il recap riconcilia le operazioni mostrate e chiede **Piano rispettato / Scostamenti /
Da rivedere**, senza risposta positiva preselezionata. La spiegazione è richiesta
solo per gli scostamenti; gli altri esiti possono chiudersi senza note personali.
La scelta è strutturata: «Da rivedere» non attesta aderenza e una risposta positiva
non cancella violazioni già documentate. Il feedback riguarda il lavoro completato,
anche un’attesa coerente, senza nuovi premi, streak o obiettivi di profitto.

La migrazione circoscritta **0041** rende nullable `process_methods.protocol` e
aggiunge `process_sessions.mode`, con default `application` per le righe precedenti.
Le nuove sessioni ricevono dal server `practice` in Definisci/Verifica oppure
`application` in Applica/Consolida. La modalità non cambia dopo l’avanzamento del
metodo: le evidenze della pratica restano sviluppo e sono escluse dalla validazione,
dall’aderenza e dal periodo formale di applicazione, anche chiudendo dopo un avanzamento.
`dailyNextAction` è distinto dall’avanzamento del metodo. I vecchi endpoint rimangono
compatibili; le conferme combinate richiedono revisione e supportano retry idempotenti.
Contratto condiviso, OpenAPI e client generati includono protocollo differito,
modalità, bozza del check e valutazione strutturata del recap.

Nell’inserimento delle evidenze, risultati e date canonici non vengono richiesti di
nuovo. Le annotazioni di rischio, valuta e costi già documentate nella stessa versione
vengono riprese; valori discordanti restano da chiarire. Replay privi di dati economici
sufficienti restano consultabili, senza inventare rischio iniziale o costi.

Prima della migrazione locale è stato creato un nuovo backup completo di **345.985.105
byte**, ripristinato integralmente e provato su un database temporaneo. La migrazione
ha preservato le colonne originali di **102 tabelle**, le modalità delle sessioni
storiche e tutti i dati precedenti. Backup e prova privata sono in
`.local-logs/process-integration/2026-10-12T14-15-24-845Z-quick-check/`.
La procedura ammette solo DDL additiva e l’esatta rimozione di `NOT NULL` dal protocollo;
nessuna cancellazione o conversione delle righe storiche.

I test runtime coprono pratica, protocollo differito e congelato, rollback, ownership,
conferma atomica, revisioni e retry, sessioni già preparate e recap strutturato. Le
prove browser verificano refresh, dispositivi distinti, nessuna scelta positiva
preselezionata, layout a 375/768/1440 px, focus, tastiera e movimento ridotto. Nel
percorso ordinario sono necessari i controlli della checklist più quattro azioni
per il piano (scelta, stop, rischio, conferma); il recap richiede tre azioni
(apri, scegli, conferma). I tempi del runner sono tempi automatici, non una misura
umana: il minuto iniziale e i trenta secondi finali restano obiettivi di usabilità,
esclusi analisi del mercato e registrazione dei trade.

**Consegna integrata e verificata:** versione **`local-29ef785dfedcb322`**, app
esistente su `http://localhost:5173`, API aggiornata su 3001 e stesso database locale.
`pnpm verify` riuscito con **441 file di test**, build e prerender **45/45**;
`pnpm lint:ci` riuscito con zero errori e **35 warning preesistenti**. Il database
temporaneo ha superato **24 gruppi runtime** e **21 gruppi browser**, senza errori
JavaScript. Il check ordinario con due controlli personalizzati ha richiesto sei
interazioni (sette con i tre controlli proposti); il recap ne ha richieste tre.
I tempi automatici sono circa 3,6 s e 1 s, includendo consultazione facoltativa
nel check e screenshot nel recap, e non attestano tempi di utilizzo umano.
Report privati in `.local-logs/process-integration/releases/2026-10-12T14-25-10-133Z/`.
Frontend, porte e dati attuali sono conservati; nessun deploy pubblico.
Le prove autenticate usano identità sintetiche su database temporaneo; la sessione
Clerk personale, broker e pagamenti live non sono stati esercitati.

### Rifinitura del recap senza ripetizioni

La spiegazione di uno scostamento viene conservata una sola volta in `closure.notes`.
`closure.assessment=deviation` documenta già l’esito della revisione: non serve
copiare la nota in `closure.violations`. Le violazioni preesistenti restano separate
e non vengono cancellate dal recap. La nota mantiene il limite di 4000 caratteri;
non incontra più il limite di 500 caratteri previsto per ogni voce di violazione.
Una spiegazione vuota o contenente soltanto spazi continua a impedire la chiusura
con scostamenti. L’esito non contribuisce all’aderenza anche con l’elenco delle
violazioni vuoto.

La correzione aggiorna validazione server, modulo e contratto OpenAPI/client.
Non richiede DDL o conversioni dello storico. Il runner verifica note oltre 500
caratteri, rifiuto degli spazi, retry della chiusura e aderenza; il browser verifica
ripresa dopo refresh e conservazione di una violazione già annotata.

**Rifinitura integrata:** versione **`local-39f9c9a6c0747125`**, stessa app su
5173, stessa API su 3001 e stesso database. `pnpm verify` e `pnpm lint:ci`
superati: **441 file di test**, prerender **45/45**, zero errori e 35 warning
preesistenti. Superati **25 gruppi runtime e 22 gruppi browser**, inclusa la
regressione del recap dopo refresh. Nessuna migrazione aggiuntiva o modifica
dei recap storici. Report privato in
`.local-logs/process-integration/releases/2026-10-12T14-44-46-662Z/`.

### Scelte dirette e note su richiesta

La rifinitura confermata dall’utente privilegia meno interazioni. Nel check,
«Preparo un piano / Oggi resto fuori» e i motivi rapidi dell’attesa sono scelte
visibili: non occorre aprire un menu prima di selezionarle. Nel recap anche
«Piano rispettato / Scostamenti / Da rivedere» si sceglie direttamente. Le radio
native mantengono validazione obbligatoria, focus, frecce della tastiera e
selezione vuota iniziale. L’azione finale rimane unica per il check e per la chiusura.

La nota facoltativa del recap è chiusa inizialmente dietro «Aggiungi una nota»;
una nota già salvata si riapre con il proprio testo. Chiudere il dettaglio non
cancella la nota. Gli scostamenti mostrano subito la spiegazione obbligatoria.
La checklist continua a richiedere tutti i controlli definiti. Stop specifico e
rischio monetario iniziale sono scelti dal trader; bozze già documentate si
riprendono senza riscriverle. Criteri e conferme del metodo restano necessari.

Il cambiamento riguarda solo l’interfaccia: contratti, ownership, modalità
pratica/applicazione, dati e schema restano gli stessi. Le prove browser coprono
assenza di preselezione, navigazione con frecce, campi bloccati durante l’invio,
autosalvataggio e ripresa, note facoltative conservate dopo chiusura del dettaglio,
layout e tastiera a 375/768/1440 px.

**Scelte dirette integrate:** versione **`local-5e4d8cafc67cc18c`**, stessa
istanza frontend su 5173 e API su 3001. Gate completi riusciti: `pnpm verify`
(**441 file di test**, prerender **45/45**), `pnpm lint:ci` (zero errori,
35 warning preesistenti), **25 gruppi runtime e 24 gruppi browser**. Controllati
visivamente check e recap a 375 px, oltre alle verifiche automatiche a
375/768/1440 px. Nessuna migrazione aggiuntiva. Report privati in
`.local-logs/process-integration/releases/2026-10-12T15-01-46-829Z/`.
Nel runner il campo datetime-local normalizza i secondi zero come il browser,
così l’inserimento della data non si blocca al cambio di minuto.

### Risorse visibili per preparare l’operatività

In seguito al feedback dell’utente, i cinque accessi confermati — **Mercati,
Notizie, Calendario economico, Sessioni e Calcolatore** — sono permanenti nella
sidebar desktop, sotto «Prepara l’operatività». La sidebar scorre sulle finestre
basse senza coprire le impostazioni. Su mobile Risorse resta nella navigazione
principale e apre subito i cinque strumenti, senza espandere gruppi.

La pagina li presenta in tre passaggi: leggere il mercato, scegliere il momento
e definire il rischio. Ogni passaggio spiega cosa riportare nel piano di Oggi.
Gli accessi riprendono il pair esplicito o quello documentato nel piano; in
assenza di una decisione, un solo mercato definito nel metodo può dare il
contesto. Metodi con più mercati non ne selezionano automaticamente uno.
I link conservano il ritorno a Oggi. La consultazione non registra conferme
di preparazione o aderenza e non introduce limiti finanziari precompilati.

I cinque strumenti sono rimossi dal catalogo sottostante quando già in primo
piano: restano 27 destinazioni canoniche, senza righe duplicate nella pagina.
Gli approfondimenti del contesto sono aperti inizialmente; gli altri gruppi
restano su richiesta. La ricerca copre tutti gli strumenti e il suo azzeramento
restituisce il focus al campo. Le quattro destinazioni principali restano Oggi,
Metodo, Diario e Risorse.

Questa rifinitura è integrata nell’app locale con versione
**`local-bc95c220a4b2ad84`**: stessa istanza frontend su 5173 e stesso database,
API riavviata e pronta su 3001. Gate completi: **441 file di test**, build e
prerender **45/45**, lint con **zero errori e 35 warning preesistenti**;
**21 gruppi runtime e 23 gruppi browser** su dati sintetici. Controllati
visivamente i layout a 375/768/1440 px, navigazione diretta con pair della
sessione, assenza di righe duplicate, ricerca e focus. Report privati in
`.local-logs/process-integration/releases/2026-10-12T10-51-10-728Z/`.

Scelte confermate dall’utente: app locale con i dati attuali, introduzione breve,
recupero dello storico facoltativo, guida essenziale con esempi su richiesta.
Oggi presenta il prossimo passo e mantiene lo storico raggiungibile. Gli esempi
di Metodo non compilano campi né suggeriscono importi finanziari.

La definizione del metodo salva automaticamente campi e passaggio raggiunto.
La migrazione **0040** aggiunge identità e revisione della bozza: conflitti tra
dispositivi, conferme superate e retry non cancellano una bozza più recente.
La ripresa torna al passaggio documentato, senza saltare regole incomplete;
richiede una nuova conferma personale di regole e limiti. «Riprendi più tardi»
salva prima di tornare a Oggi. Una bozza in corso viene ripresa quando si torna
alla definizione, senza sostituirla con un’altra bozza.

Lo schema **0036–0040** è stato integrato nel database locale `traderloadings`.
Prima dell’operazione è stato creato un backup completo, ripristinato e provato
in un database temporaneo. L’integrazione ha confrontato righe e colonne originali
di **90 tabelle esistenti**, senza differenze. Le candele sono incluse nel backup,
escluse dal calcolo delle impronte e non modificate dalle migrazioni.
Il backup e i report privati sono in `.local-logs/process-integration/2026-10-12_105704/`.
L’API aggiornata risponde su **3001**, il frontend esistente resta su **5173**.
`/api/process` richiede autenticazione (401 per richieste anonime); lo schema non
presenta colonne mancanti. Nessun metodo, preparazione o aderenza storica è stato
attribuito automaticamente ai dati precedenti. Nessun deploy.

La procedura esplicita è `scripts/local/integrateTraderProcess.ts`: controllo
senza scritture per default, applicazione con `--apply --backup <dump completo>`.
Usa soltanto DDL additiva, una transazione e controlli dei dati; l’avvio ordinario
non modifica lo schema. Il journal Drizzle preesistente resta invariato: questa
è una riconciliazione locale circoscritta. L’API di questa sessione è avviata con
`LOCAL_BACKGROUND_TASKS=0`, evitando job programmati durante la revisione locale;
le funzioni restano disponibili su richiesta. La produzione ignora tale opzione.

**Verifica finale:** `pnpm verify` passato con **441 file di test**, build e
prerender **45/45**; `pnpm lint:ci` senza errori, con 35 warning preesistenti.
**21 gruppi runtime** e **22 gruppi browser** su dati sintetici, senza errori
JavaScript. Provati anche l’autosalvataggio di Metodo, il recupero del passaggio,
la riconferma dei limiti, gli esempi facoltativi e l’integrazione additiva.
Il browser di prova verifica 375/768/1440 px, tastiera e movimento ridotto;
non attesta sessioni Clerk, broker o pagamenti live. Non è disponibile un browser
collegato per ispezionare la sessione personale; i controlli sull’app reale
coprono schema, API, autenticazione anonima e conservazione dei dati.

### Rilascio collegato all’app locale esistente

La destinazione è stata riconfermata: **app locale attuale, per ora**. Il comando
`pnpm release:local` aggiorna questa stessa istanza, senza creare servizi o
ambienti pubblici. Richiede l’app già integrata e attiva su 5173/3001, il backup
con ripristino verificato e lo stesso database locale. Non esegue DDL: se lo
schema è incompleto, termina prima del riavvio; l’integrazione resta una procedura
esplicita separata. Il backup richiamato documenta l’integrazione iniziale, non è
un nuovo backup dei dati eventualmente aggiunti in seguito.

Il comando controlla proprietà dei processi e connessione locale, esegue
`pnpm verify`, `pnpm lint:ci` e il runner runtime/browser su database temporaneo.
I gate ricevono la chiave pubblica Clerk e non le credenziali delle integrazioni
personali. Un’impronta delle sorgenti deve restare identica durante la verifica.
Solo dopo questi controlli riavvia l’API del workspace, lasciando attivo lo stesso
frontend, e confronta `/api/readyz` con la versione appena verificata. Controlla
autenticazione anonima e risposta SPA per i quattro ingressi, contesti storici
e ritorno checkout; i loro comportamenti sono provati nel runner isolato.

Versione, porte, processi, gate e controlli finali vengono registrati in
`.local-logs/process-integration/releases/<timestamp>/release.json`; le
credenziali non entrano nel report. Il riavvio usa `LOCAL_BACKGROUND_TASKS=0`.
Se un gate fallisce l’API non viene riavviata. Se fallisce l’avvio, il report
resta incompleto e il log `api.log` conserva la diagnosi; non viene avviata
un’altra istanza su una porta casuale. Un lock impedisce rilasci concorrenti.
Questo comando riguarda macOS/Linux con `lsof` disponibile e non pubblica
su Railway o Vercel. L’istanza Vite locale serve i file del workspace: modifiche
successive richiedono una nuova verifica per aggiornare il report del rilascio.

Rilascio locale completato il 12 ottobre: **`local-9b344a4d44ca6e0d`**, con
`/api/readyz` pronto e versione corrispondente alle sorgenti verificate. Il
frontend ha conservato il processo 43402 su 5173; l’API è stata riavviata su 3001.
Il report finale e le copie delle **21 prove runtime** e **22 prove browser**
sono in `.local-logs/process-integration/releases/2026-10-12T10-06-33-544Z/`.
Il rilascio non ha eseguito scritture dello schema né creato metodi per l’utente.
Un primo tentativo era stato fermato da un timeout del prerender, prima del
riavvio; il gate ripetuto ha completato **45/45** pagine senza esclusioni.

## Semplificazione del processo del 12 ottobre 2026

Risorse e ricerca comandi condividono un catalogo di **27 destinazioni**, organizzate
per attività: preparare il contesto, verificare il metodo, registrare/rivedere/
organizzare e supporti facoltativi. Ogni strumento conserva l’accesso diretto e
spiega a cosa serve. Tutte le 12 tipologie di widget precedenti restano disponibili;
la griglia personale conserva preferenze e disposizione. Da Risorse si apre il
singolo widget richiesto. La ricerca conserva la query e le sezioni sono richiuse
quando si apre un’altra attività.

Oggi evidenzia il passaggio della sessione, mentre Metodo conserva il percorso di
crescita. Le bozze di preparazione, piano e consuntivo si salvano sul server e si
riprendono tra dispositivi senza attestare conferme mai date. La migrazione **0039**
aggiunge bozze e revisioni alle sessioni: scritture concorrenti producono un
conflitto esplicito e richiedono la rilettura del lavoro salvato. Consultare uno
strumento dal piano salva la bozza e conserva il ritorno a Oggi. I widget di
mercato dedicati usano il pair del piano senza modificare i preferiti.

Anche le conferme richiedono la revisione vista dal trader: un piano locale senza
modifiche non può confermare sopra una bozza più recente salvata altrove.
I retry identici conservano le conferme originali; conferme diverse concorrenti
applicano un solo piano. I campi sono bloccati durante l’invio e invii ripetuti
riusano la richiesta in corso. Il focus passa al titolo del prossimo passaggio
senza interrompere la scrittura durante l’autosalvataggio. Eliminato il doppio
collegamento di supporto al registro in Operatività. Contratto OpenAPI e client
generati includono la revisione richiesta anche per le conferme.

Catalogo, regole delle bozze e limiti delle prove sono descritti in
[trader-process.md](trader-process.md). Le attestazioni nei paragrafi datati
successivi restano come storico.

**Verifica locale dell’estensione:** `pnpm verify` passato con **438 file di test**,
build e prerender **45/45**. `pnpm lint:ci` passato, zero errori e 35 warning
preesistenti. PostgreSQL temporaneo: **19 gruppi runtime** e **19 gruppi browser**,
senza errori JavaScript, inclusi conflitti tra dispositivi, bozze non confermate,
tutte le destinazioni del catalogo, widget dedicati e pair conservato, conferme
superate/concorrenti, invii ripetuti e focus tra i passaggi. Layout
375/768/1440 px, tastiera e movimento ridotto verificati; screenshot controllati
visivamente. La migrazione 0039 è stata provata solamente nel database temporaneo.
Nessun deploy e nessuna modifica al database personale.

## Processo guidato del trader dell’11 ottobre 2026

La Home senza selettori apre **Oggi**. Il percorso **Definisci → Verifica → Applica →
Consolida** sostituisce l’insieme di centri operativi concorrenti: un metodo attivo,
versioni immutabili, protocollo personale confermato prima del test, evidenze e
revisione esplicita prima dell’avanzamento. Oggi propone il lavoro della fase e,
in Applica/Consolida, preparazione, piano, operatività e chiusura persistenti.
Attendere senza trade è valido; aderenza e risultati economici sono distinti.

Diario, importazioni e operazioni fuori piano restano disponibili. Checklist,
preparazione e obiettivo giornaliero hanno una sola conferma nella sessione.
Le revisioni riusano i recap e riportano un miglioramento verificabile nella
sessione successiva. Supporti di benessere, community, missioni e premi XP si
aprono su richiesta in Risorse. I precedenti dialoghi automatici non interrompono
più il percorso. La guida volontaria nelle Impostazioni presenta la nuova struttura.

Le migrazioni **0037 e 0038** aggiungono il dominio autenticato del processo e
l’economia persistente del replay. Le annotazioni del processo sono collegate ai
trade canonici e restano separate dalle sincronizzazioni broker. Free completa
il ciclo mediante registro manuale e test esterni; replay interno e broker
mantengono i controlli Pro. Nessun limite finanziario universale introdotto.

Dominio, API, prerequisiti, compatibilità e qualità economica:
[trader-process.md](trader-process.md). Prove riproducibili:
[`scripts/verify-trader-process/README.md`](../../scripts/verify-trader-process/README.md).
**Esito del nuovo processo:** `pnpm verify` passato, **437 file di test** riusciti,
build di produzione e prerender **45/45**. `pnpm lint:ci` passato: zero errori e
35 warning preesistenti, entro il limite di 39. Il runner su PostgreSQL temporaneo
ha superato **15 gruppi di scenari runtime** e **10 gruppi browser**, inclusi
refresh, contesto browser separato, no-trade, trade con commissioni/R netto,
versioni consultabili senza attivazione, calcolatore nel piano, layout
375/768/1440 px, tastiera e movimento ridotto. Controllati visivamente gli
screenshot di Oggi, Metodo, Risorse e calcolatore.

Le prove impiegano identità sintetiche: non attestano Clerk, broker o pagamenti
live, né telefoni fisici. Le migrazioni sono state applicate solamente al database
temporaneo; il database personale non è stato modificato. Nessun deploy eseguito.

Le attestazioni del 9 ottobre nei paragrafi successivi descrivono la precedente
riorganizzazione e restano come storico delle verifiche.

## Estensione macroeconomica dell’11 ottobre 2026

Centro operativo e Diario ora collegano pair/eventi, outlook a quattro ore,
piano trade o attesa e revisione del contesto conservato. L’indice descrittivo
resta distinto dalle percentuali, mostrate soltanto dopo validazione e controlli
dei dati. La migrazione 0036 è stata provata solo in un database temporaneo;
collector disattivato per default e nessuna accuratezza reale già attestata.
Gate completo passato: 434 file di test e prerender 45/45; 51 controlli runtime
su PostgreSQL temporaneo, 10 test Python e parità Python/TypeScript entro 1e−12.
Lint senza errori, con 35 warning. Architettura, CLI, prerequisiti di
attivazione e limiti: [macro-intelligence.md](macro-intelligence.md).

## Struttura e destinazioni

| Ingresso permanente | Responsabilità | URL |
| --- | --- | --- |
| Oggi | Checklist, contesto del pair, scenario, operatività e consuntivo | `/` |
| Diario | Schede automatiche delle sessioni, trade, risultati e revisioni | `/journal` |
| Backtest | Test e replay, con i permessi esistenti | `/backtest` |
| Social | Conversazioni, community e competizioni | `/chat` |
| Metodo | Regole, evidenze e avanzamento | `/method` |
| Risorse | Strumenti e supporti su richiesta | `/resources` |

`navHubs.ts` definisce i sei ingressi; `workspaceNavigation.ts` centralizza gli
alias e conserva i parametri. La classificazione include le query ed è condivisa
fra sidebar, mobile e ricerca comandi. Le vecchie viste esplicite restano
raggiungibili: `/?vista=mercati|notizie|strumenti`, `/backtest`, `/wiki` e `/chat`.
Articoli, pair, decisioni, replay, materiali e ritorni checkout mantengono il contesto.

Piano/Oggi nel Diario è un alias di Oggi; checklist porta a Metodo. Agenda e
Idee/Obiettivi conservano le viste locali e si aprono da Risorse. Revisione
conserva tipo, periodo e storico, con cicli di 28 giorni e finestre di modifica
esistenti. Conti e sincronizzazione aprono il broker nel registro Trade.
Le voci locali dell’agenda restano isolate per account; i dati precedenti
rimangono disponibili per importazione esplicita.

Conversazioni riunisce messaggi privati e community. La selezione di destinatario,
community e canale è nell’URL; le sessioni sono separate per utente e conversazione.
Uscita e cambio conversazione chiudono risorse vocali; una concessione tardiva del
microfono viene scartata e le tracce vengono fermate. Competizioni mantiene distinti
Classifica XP, Torneo e percorso, con i rispettivi controlli e consensi.

I ritorni Stripe nuovi contengono community e canale. I vecchi ritorni alla Home
con il solo canale vengono risolti da un endpoint autenticato: restituisce solamente
il contesto ai membri attuali o al proprietario, esclude utenti bannati e non assegna
entitlement. Le API dei contenuti continuano a verificare l’accesso a pagamento.

## Archivio e permessi

L’indice combina riferimenti con origine e identificativo distinti, senza copiare
file o creare materiali personali da risorse editoriali. Catalogo e premi condividono
l’indice; il livello richiesto è quello più restrittivo fra contenuto e raccolta.
Free consulta gli sblocchi autorizzati; gestione personale e creazione restano Pro.
Solo i materiali personali espongono modifica, eliminazione e riordino. Documenti,
mappe, video, cartelle, tag e viste sono conservati. I collegamenti dimostrativi
sono segnalati come indisponibili. La selezione del materiale è ripristinabile dall’URL.

## Notizie

Pagina, brief e ticker leggono NewsHub e aprono lo stesso dettaglio articolo.
Il brief seleziona al massimo cinque eventi sopra la soglia qualitativa, senza
riempimento minimo. Coperture duplicate mantengono attribuzioni e citazioni unite.
Feed e brief condividono filtri, personalizzazione e feedback.

I [feed ufficiali Federal Reserve](https://www.federalreserve.gov/feeds/feeds.htm) e
[BCE](https://www.ecb.europa.eu/home/html/rss.en.html) aggiungono comunicazioni originali. Il recupero
segue solo redirect HTTPS su domini ufficiali consentiti, limita tempo e dimensioni
e distingue testo completo, snippet e solo titolo. Le sintesi e gli approfondimenti
richiedono testo completo; i controlli respingono numeri e riferimenti alle attese non
sostenuti dal testo. Le etichette dichiarano provenienza, metodo di analisi e base del
contenuto. Questi controlli riducono gli errori ma non costituiscono una verifica
semantica esaustiva delle analisi AI.

Un giorno tranquillo può produrre un corpus vuoto. Un guasto delle fonti conserva
l’ultimo corpus segnalando indisponibilità; errori dell’analisi AI sono distinti dai
limiti del contenuto. Il contratto OpenAPI include questi metadati e i client vengono
rigenerati con `pnpm codegen`. Nessun nuovo servizio a pagamento.

## Verifiche e limiti

I test pertinenti coprono alias e parametri, selezioni Social, isolamento dell’agenda,
risorse editoriali e permessi, curation e brief, fonti ufficiali, evidenza numerica,
sessioni di mercato e rilascio delle risorse vocali. I test del contesto dei canali
verificano proprietario, membro, estraneo, ban e canale assente. La suite include
anche verifiche statiche: non sostituisce una prova completa dei flussi con dati reali.

Gate richiesto: `pnpm verify` (codegen, TypeScript, test, build e prerender). Per la
build locale viene passato solo `VITE_CLERK_PUBLISHABLE_KEY`, senza caricare le altre
integrazioni di `.env.local` nei test. Nessuna migrazione sul database personale.

Esito finale del 9 ottobre: **`pnpm verify` passato**, 414 file di test riusciti,
nessun fallimento, build di produzione e prerender 45/45. Lint: zero errori e 35
warning, entro il limite esistente di 39. I file generati da Orval conservano il
formato del generatore, incluse le righe vuote finali segnalate da `git diff --check`.

Controllo diretto dei quattro feed ufficiali: tutti rispondono e contengono 15 voci;
il recupero di un articolo per feed ha estratto testo originale. La lunghezza varia
per documento ed è limitata a 40.000 caratteri. Non è stata esercitata un’analisi AI
live con servizi a pagamento nell’ambiente isolato.

Verifica visiva nel browser dedicato, ambiente isolato e account sintetico Clerk:
Centro operativo, Diario e le tre viste Social su desktop. Il controllo esatto a
**375 × 500 CSS px** usa una sola iframe della stessa origine, senza modificare CSP
o autorizzazioni: controllati tab del Diario, Trade, Piano/Oggi, selettori della
Revisione, Conversazioni, Attività, Competizioni, Archivio, brief Notizie, Strumenti,
Backtest e selettore dei cinque gruppi delle Impostazioni. I cinque ingressi restano
visibili; le quattro voci Diario e le tre Social sono leggibili. Non è un'emulazione
di un telefono fisico. Il tool nativo non supporta le azioni a coordinate/scroll
in questa sessione (`noWindowsAvailable`); funzionano le azioni sull'albero
accessibile e lo scorrimento da tastiera.

Rifiniture introdotte: collezioni/tag dell'Archivio espandibili su mobile, con
ricerca e filtri vicini ai contenuti; espansione e chiusura da tastiera; pulsanti
Social e modifica profilo nominati; animazione PageLayout rispettosa del movimento
ridotto; titolo e pannelli Torneo coerenti con la sezione ospitante. Gli stati
vuoti di Trade, Archivio e Backtest mantengono un solo pulsante primario. Negli
Strumenti l'accesso alla modifica dei widget conserva vista e pair nell'URL.
La guida rapida e le FAQ aggiornano i percorsi e distinguono esportazione account,
eventi ICS dell'Agenda e stima del calcolatore con divisore configurato; le nuove
istruzioni sono disponibili nelle cinque lingue dell'app.
Sulla build finale sono stati provati apertura/chiusura del dettaglio News con
ripristino di `vista=notizie`, e ingresso/uscita dalla modifica widget con
`vista=strumenti` conservata nell'URL. Le anteprime temporanee sono state rimosse
dal build output dopo la verifica.

Il runner `scripts/verify-reorganization/api-permissions.mjs` ha superato **14/14
controlli runtime** su database `tl_audit_*`: Free/Pro dell'archivio personale,
livello effettivo collezione/contenuto, consultazione Free degli sblocchi, assenza
di copie personali, proprietà dei materiali, risoluzione dei vecchi ritorni checkout
per proprietario/membro, negazione per estranei/ban/identificativi invalidi e accesso
ai messaggi pagati solo dopo un entitlement server. Le fixture sono temporanee e
vengono rimosse dal runner. Non viene eseguito un pagamento Stripe.

Il brief e le schede indicano anche la base del contenuto (testo completo, snippet
o titolo). Le spiegazioni espandibili richiedono testo completo. Domande speculative
su decisioni future dei tassi e previsioni pluriennali sono escluse, anche quando
provengono da snapshot già salvati; le comunicazioni ufficiali mantengono la propria
provenienza. Controllo sul corpus servito dall'API di produzione isolata: risposta
200, 39 articoli con base del contenuto presente; il titolo speculativo Fed osservato
durante la verifica iniziale è escluso anche dallo snapshot salvato.
La selezione resta euristica: non certifica automaticamente la qualità
editoriale o la correttezza di ogni interpretazione delle fonti.

Le integrazioni broker esterne, pagamenti reali e chiamate fra due dispositivi
richiedono ancora una verifica end-to-end nell’ambiente configurato; non sono
attestati dal passaggio della suite. Anche safe area e tastiera di telefoni fisici,
contrasto dell'intera app e navigazione completa con tecnologie assistive richiedono
ulteriori controlli dedicati. La struttura e il codice del piano sono implementati
localmente; questi limiti impediscono di dichiarare soddisfatti tutti i criteri
di accettazione end-to-end. Nessun deploy eseguito. Comandi riproducibili in
`scripts/verify-reorganization/README.md`.

## Controlli aggiuntivi del 10 ottobre

Con fixture temporanee nell'ambiente isolato sono stati provati due contatti
accettati, ognuno con un messaggio cifrato distinto, e una community privata con
due canali testo. Cambio destinatario, Indietro/Avanti e refresh del link diretto
ripristinano il contatto e il messaggio corretti. Una bozza del contatto A non
compare in B; passando tra i canali della community anche le loro bozze restano
separate. In questa verifica le bozze vengono azzerate quando si lascia il relativo
contesto: non è stato introdotto un archivio persistente delle bozze.

I controlli del compositore privato e dei canali testo hanno nomi accessibili,
azioni di invio esplicite e aree dei pulsanti principali di 44 px. Gli input
possono restringersi nel layout mobile e usano testo da 16 px. Lo stato vuoto
del workspace Conversazioni indica ora messaggi privati e community, senza il
vecchio avviso che limitava la chat ai soli mutual follow. Anche il pulsante
completamento delle missioni nel widget ha un nome accessibile.

Il runner riproducibile è `scripts/verify-reorganization/social-fixtures.mjs`.
Non sono stati inviati messaggi o richiesti permessi microfono/camera. Le prove
non attestano registrazione vocale o chiamate effettive tra dispositivi.

Gate del 10 ottobre: **`pnpm verify` passato**, 423 file di test, zero fallimenti,
build e prerender 45/45. La vista privata a 375 × 500 CSS px mostra campo messaggio,
quattro azioni del compositore, ritorno all'elenco e navigazione principale senza
tagliare i controlli.
Anche la community è stata verificata alla stessa larghezza: senza `channel`
l'URL apre l'elenco dei canali; scegliendone uno apre la conversazione. I pulsanti
di ritorno alla community e all'elenco Conversazioni hanno nomi accessibili e
aree di 44 px. Il compositore dei canali testo rimane visibile sopra la barra
principale.

Sulla build finale è stato provato anche il ritorno canale → community → elenco
Conversazioni. Un controllo SQL conferma zero messaggi inviati dall'account di
test ai contatti e zero messaggi pubblicati nei canali durante queste prove.
Il cleanup ha rimosso contatti, chiavi pubbliche delle fixture, messaggi cifrati
di esempio, relazioni e community temporanea, conservando l'account di test
preesistente. Le pagine temporanee di anteprima vengono rimosse dal build output.
Lint del 10 ottobre: zero errori e 35 warning, entro il limite esistente.

## Contrasto, focus e movimento ridotto

I token della palette predefinita vengono misurati dal test
`artifacts/trader-dashboard/src/design-contrast.test.ts`: **31 coppie** fra testo,
etichette dei pulsanti, navigazione attiva e focus sulle superfici comuni. Il
calcolo risolve gli alias HSL e compone i fondi traslucidi prima di confrontare
le luminanze, senza arrotondare la soglia del test. Dopo le correzioni, il minimo
del testo verificato è **4,647:1**. Riferimenti:
[contrasto del testo](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)
e [animazioni da interazioni](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html).
Il risultato riguarda queste coppie della palette: non attesta ogni componente,
foto personalizzata, overlay o ulteriore opacità presente nell'app.

Il testo dei controlli rossi pieni e dei badge di notifica usa ora il colore
scuro previsto dalla palette; l'hover dei pulsanti distruttivi mantiene contrasto
sufficiente. Il focus comune usa giada opaca. Input e textarea condivisi usano
placeholder più leggibili e anelli di focus opachi. La ricerca Conversazioni e
il compositore dei canali mostrano il focus sull'intero contenitore; il campo
dei messaggi privati ha il proprio anello. Le azioni contestuali nascoste dal
mouse in Obiettivi, canali, file e commenti diventano visibili anche quando il
focus entra nella riga. Nessuna cancellazione è stata eseguita per provarle.

La toolbar Archivio aggiunge il nome accessibile della ricerca, testo da 16 px
su mobile, azioni di 44 px e stato `aria-pressed` per densità e modalità di
visualizzazione. Le intestazioni delle pagine usano H1; su mobile il titolo
compresso resta disponibile nell'albero accessibile.

Il contenitore autenticato configura Framer Motion per la preferenza di movimento
ridotto e salta le animazioni quando questa è attiva al montaggio. Diario, chat
privata e canali scelgono scorrimento immediato con la stessa preferenza; il
listener esistente segue i cambiamenti e viene rimosso allo smontaggio. Le regole
CSS riducono anche animazioni, transizioni e scala dei pulsanti premuti. Landing
e pannello amministrativo non ricevono il nuovo contenitore MotionConfig.

Il gate ha rilevato un'asserzione Backtest precedente alla nuova transazione di
salvataggio. Il codice conserva il controllo di proprietà: filtra la sessione
per utente, la blocca nella transazione, restituisce 404 in assenza del
proprietario e inserisce soltanto dopo il controllo. Il test è stato aggiornato
per verificare questi vincoli; il salvataggio non è stato modificato in questa
rifinitura.

Gate finale di questa rifinitura: **`pnpm verify` passato**, 424 file di test,
zero fallimenti, build e prerender **45/45**; lint **zero errori e 35 warning**.
Log locali: `/tmp/trader-reorganization-accessibility-complete-gate.log` e
`/tmp/trader-reorganization-accessibility-complete-lint.log`.

Un primo tentativo di verifica della nuova toolbar a 375 px è stato interrotto:
il tool nativo aveva perso l'accesso alla finestra del browser di test
(`noWindowsAvailable`, poi `timeoutReached`). Alla ripresa il browser dedicato è
tornato accessibile ed è stato possibile completare i controlli seguenti.

### Toolbar Archivio: verifica completata

Nel browser dedicato, con account sintetico e API isolata, la toolbar è stata
verificata a **375 × 500** e **1100 × 760 CSS px**. Su mobile ricerca, densità e
modalità di visualizzazione vanno a capo senza tagliare i controlli; rimangono
visibili tutti e cinque gli ingressi principali. Su desktop la toolbar è
ordinata su una riga e i nomi delle cinque sezioni della sidebar sono leggibili.
Gli screenshot mostrano il focus giada sulla ricerca e sul pulsante Densità.
Tab, Shift+Tab e Invio permettono di cambiare densità e modalità Griglia/Lista;
l'albero accessibile aggiorna lo stato selezionato. Le selezioni iniziali sono
state ripristinate al termine della prova.

La verifica ha individuato e corretto un problema: azzerando i filtri il pulsante
«Azzera» scompare e il focus tornava al corpo della pagina. Ora torna al campo di
ricerca. Sulla build finale sono stati provati inserimento della ricerca, Tab →
Invio su «Azzera», campo vuoto e focus sul campo; il Tab successivo raggiunge
Densità. Non sono stati creati, modificati o eliminati contenuti dell'archivio.

Gate dopo questa correzione: **`pnpm verify` passato**, 424 file di test,
zero fallimenti, build e prerender **45/45**; lint **zero errori e 35 warning**.
Log: `/tmp/trader-reorganization-archive-focus-gate.log` e
`/tmp/trader-reorganization-archive-focus-lint.log`. Il frontend temporaneo su
4174 viene chiuso e le anteprime vengono rimosse dal build output normale;
lo snapshot dell'API di audit rimane intatto. Queste prove non simulano un
dispositivo fisico né costituiscono una verifica completa con screen reader.
