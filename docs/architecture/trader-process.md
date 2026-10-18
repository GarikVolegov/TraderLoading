# Processo guidato del trader

Implementazione locale aggiornata il 13 ottobre 2026. Il processo collega regole
personali, verifica, sessioni e revisioni. L’avanzamento attesta i criteri scelti e
le prove disponibili; non attesta redditività futura.

## Organizzazione corrente

Tre destinazioni principali: **Oggi, Metodo, Diario**. Il menu **Altro** apre
Risorse, Backtest e Social. Gli alias precedenti restano funzionanti. I premi XP,
le missioni, i contenuti e la community non determinano l’avanzamento del metodo.

| Spazio | Responsabilità |
| --- | --- |
| Oggi | Un prossimo passo, scelto dal server; riprende il lavoro in corso |
| Metodo | Regole versionate, protocollo personale, prove e avanzamento esplicito |
| Diario | Fatti, conti/importazioni, schede delle sessioni e revisioni |
| Risorse | Catalogo ricercabile di 27 accessi, raggruppati per attività |

Il percorso di crescita è **Definisci → Verifica → Applica → Consolida**. La
sessione segue **Checklist → Contesto → Scenario → Operatività/attesa → Chiusura**.
Il primo accesso raccoglie le condizioni osservabili del metodo, poi i limiti e la
checklist. Il nome e gli strumenti sono facoltativi. Il protocollo viene chiesto
separatamente quando il trader è pronto a verificare il metodo. Nessun numero di
rischio o soglia universale di profitto è proposto dalla piattaforma.

Oggi incorpora la definizione e il protocollo, evitando pagine vuote e rimbalzi
tra spazi. Metodo conserva gli stessi editor, senza creare un percorso parallelo.
`ProcessState.guidance` è la priorità comune: sessione effettivamente iniziata,
metodo mancante, sospensione, revisione dovuta, protocollo, verifica, avanzamento,
sessione quotidiana o giornata conclusa. Una sessione aperta resta riconciliabile
anche se sopraggiunge un obbligo. Una bozza vecchia mai avviata può essere scartata
con ownership e revisione, senza dichiarare una chiusura mai avvenuta.

## Gli strumenti entrano nel processo

| Attività | Accessi conservati |
| --- | --- |
| Contesto | Mercati, Notizie, watchlist, calendario, sessioni, calcolatore, sentiment, volatilità, COT |
| Verifica | Backtest/replay e checklist del metodo |
| Registro e materiali | Diario, revisioni, conti, archivio, contenuti, agenda, idee, widget |
| Supporti | Benessere, missioni, community, competizioni, XP, citazioni, assistenza, impostazioni |

La preparazione mostra il contesto del pair nello stesso passaggio. Solo gli
strumenti scelti nel metodo sono offerti in un pannello facoltativo; per le
versioni precedenti il riferimento iniziale è Mercati e Calendario. La bozza viene
salvata prima di uscire e `processToolHref` conserva pair, versione e ritorno a
Oggi. La vista dedicata monta il solo strumento richiesto e nasconde i selettori
che aprirebbero altri spazi. Il catalogo completo conserva ricerca nell’URL e un
gruppo aperto alla volta. L’audio parte soltanto da un comando esplicito; i clic
nei form non avviano audio né un caricamento artificiale.

## Verifica ed evidenze

Regole, protocollo e snapshot della sessione sono immutabili dopo conferma. Le
modifiche producono una nuova versione. Una sessione già presente per oggi
impedisce di cambiare la sua versione di riferimento, anche dopo la chiusura.

Ogni evidenza distingue finalità (`development`, `validation`, `live`) e ambiente
(`simulation`, `real`, `unknown`). Prima della verifica superata il lavoro
operativo guidato è una simulazione; le vecchie sessioni `practice` rimangono
sviluppo e non acquisiscono validità retroattiva. Il server sceglie la modalità,
non il client. La simulazione deve rientrare nelle date del protocollo.

Un risultato economico utile richiede rischio iniziale, P&L netto, costi inclusi,
conto, valuta e provenienza non stimata. I link a trade canonici e replay vengono
risolti dal server, rispettando ownership e piano Free/Pro. L’ambiente di un conto
importato deriva solo da dati espliciti della fonte collegata; le impostazioni di
visualizzazione non certificano un conto. I dati storici non documentati restano
`unknown`. Solo i replay strutturalmente identificati ricevono la nuova
classificazione `simulation`. Importazioni successive non riclassificano
silenziosamente operazioni già registrate.

I risultati reali non validano una simulazione. Un record incompleto o con
ambiente errato rimane consultabile e non supera i criteri economici. La data
predefinita conserva i millisecondi: una registrazione immediata non viene
retrodatata prima dell’avvio del test. L’aderenza attestata richiede la
preparazione e la riconciliazione previste; una dichiarazione storica isolata non
le sostituisce. Una giornata senza trade produce una scheda del processo, senza
inventare operazioni o profitto. La registrazione di fatti già avvenuti resta
sempre disponibile, anche durante una sospensione.

## Revisioni ricorrenti e recuperabili

La revisione riguarda i periodi conclusi con attività reale della versione in
Applica/Consolida. La base è il massimo tra inizio applicazione e introduzione
della politica di revisione: niente obblighi retroattivi sui periodi precedenti
alla modifica. Settimane comprese in un periodo di quattro settimane da rivedere
sono raggruppate in una sola conferma, con evidenze distinte.

Il modulo mostra dati già disponibili e chiede tre elementi: giudizio, una sola
azione, criterio per verificarla. Se esiste una correzione precedente pertinente,
ne chiede l’esito; un risultato negativo o non valutabile richiede una nota.
La transazione salva recap/riferimento, miglioramento ed evento immutabile con
report e controlli. Retry identici recuperano lo stesso evento; payload diversi
non riscrivono giudizio, criterio o timestamp. Le vecchie date dei recap restano
intatte e i periodi chiusi sono recuperabili senza fingere una conferma passata.

Aspettativa e drawdown vengono valutati quando il campione personale è maturo.
L’aderenza viene valutata quando esiste un dato applicabile. Un criterio personale
applicabile fallito sospende le nuove aperture reali di quella versione; fase e
storia restano inalterate. Oggi conduce a una nuova versione da verificare. Le
revisioni passate non vengono cancellate per togliere la sospensione.

## Ordini broker

Il controllo delle aperture è sul server, prima del connettore e nuovamente prima
di rilasciare un comando accodato al terminale. Un ordine reale richiede ambiente
documentato, versione applicabile senza sospensione o revisione dovuta, sessione
odierna preparata, mercato coerente, valuta, budget dichiarato e stop numerico
coerente con il piano. Il lock del processo copre l’invio diretto. Le ricevute
mantengono la semantica degli invii incerti, evitando retry automatici per un
ordine che il provider potrebbe aver già ricevuto.

Questi controlli verificano **il piano documentato**. Il contratto dei connettori
non espone uniformemente tick value/contract size: non viene certificata la
perdita monetaria effettiva implicita nei lotti. I limiti giornalieri usano le
operazioni documentate, senza compensare conti o valute diverse; non costituiscono
un limite di rischio totale del conto comprensivo di tutte le esposizioni aperte.
Chiusura, riduzione e cancellazione restano accessibili attraverso le capacità
esistenti del connettore. Un ordine opposto senza riferimento esplicito a una
posizione non è trattato come una chiusura.

## Persistenza e verifica

`contracts/trader-process.ts` condivide tipi, giorno Europe/Rome e calcolo di R.
Le migrazioni additive 0042/0043 aggiungono politica di revisione, eventi di
revisione e classificazione dell’ambiente. `processRepository.ts` carica lo stato
comune usato dalle route e dall’autorizzazione broker; `processPolicy.ts` determina
priorità e periodi. Le bozze usano ownership, revisioni e lock per utente.

La verifica isolata è descritta in
[`scripts/verify-trader-process/README.md`](../../scripts/verify-trader-process/README.md).
L’integrazione nell’istanza locale esistente richiede backup completo, ripristino
su clone, confronto delle righe precedenti e riavvio tramite `release:local`.
L’avvio ordinario non migra lo schema. Nessun deploy di produzione è implicito.
