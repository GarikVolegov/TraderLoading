# Centro operativo e indice di contesto v1

Versione storica, sostituita dal [workspace e contesto v2](pair-context-v2.md).

24 settembre 2026. Intervento successivo alla prima tranche: su richiesta del
proprietario la home è stata ridisegnata ed è stato introdotto un indice descrittivo
sperimentale. Non è una probabilità, un modello validato o un segnale di ingresso.

## Percorso quotidiano

`/` mostra il pair attivo, una sola lettura, i tre contributi, la copertura,
prezzo D1/range/evento successivo e i controlli di disciplina esistenti. Fonti e
metodo sono chiusi inizialmente. Checklist, routine e registrazione sono azioni
dirette. Il ticker animato non viene caricato sulla home. `/dashboard/widgets`
conserva gli strumenti e le preferenze del precedente layout, con un collegamento
di ritorno. `/?layout=edit` resta compatibile.

I pair provengono dalle preferenze salvate: la selezione temporanea `?pair=` non
modifica i preferiti e non può introdurre uno strumento non salvato. Il primo
preferito è il focus iniziale. Uno strumento sconosciuto dà un errore esplicito;
la home non sostituisce un altro pair. Le modifiche permanenti passano dalle
impostazioni con il precedente contratto di salvataggio.

## Contratto e calcolo

`GET /api/tools/market-context?pair=EURUSD`: dati di mercato pubblici, come
gli altri endpoint tools; non contiene dati personali. La home richiede il login. OpenAPI è la fonte del client React Query e dei validatori generati.
Il risultato dichiara `context-v1-experimental`, pair, giorno Europe/Rome,
`generatedAt`, `status`, score nullable, coverage, disagreement, componenti con
fonte/recupero/osservazione, evidenze testuali e condizioni non direzionali.

| Componente | Peso base | Misura v1 | Requisiti |
| --- | ---: | --- | --- |
| Prezzo | 45 | 100 × (ultimo close D1 − close D1 precedente) / ATR20, limitato a ±100 | Almeno 22 barre OHLC valide; ATR e range medio positivi; ultima barra della data UTC corrente, 22 barre entro 60 giorni e precedente entro 4 giorni; recupero provider entro 15 minuti, nessun fallback dopo errore |
| Notizie | 35 | Media dei segni espliciti ±100, peso exp(−età/6 ore) | Almeno due titoli originali inglesi interpretabili nelle ultime 24 ore; corpus recuperato entro 30 minuti; niente articoli sintetici, senza data o futuri |
| Retail | 20 | Percentuale long − percentuale short | Simbolo esatto Myfxbook, percentuali finite/valide con somma circa 100, stato available, recupero entro 15 minuti, niente fallback |

I contributi sono arrotondati a interi e poi aggregati con media pesata dei pesi
disponibili. Servono **prezzo e almeno un'altra componente**; diversamente score
è null. Coverage è la somma dei pesi disponibili, non confidenza. Con prezzo e
retail è 65/100 e lo stato è partial. Lo zero reale resta zero; assenza e misure
invalide diventano null. ±15 delimitano le etichette bilanciato/rialzista/ribassista;
sono soglie descrittive sperimentali. `disagreement` indica contributi validi con
segni opposti oltre queste soglie.

`warming` indica fonti in caricamento, `insufficient` mancanza dei requisiti,
`partial` copertura incompleta, `available` le tre componenti. Ogni fonte ha un
termine di 20 secondi; richieste concorrenti per pair condividono l'aggiornamento.
La cache dell'aggregatore dura 60 secondi, ma ogni lettura ricontrolla l'età degli
input. Un errore rimuove il contributo interessato. La UI nasconde lo score dopo
un errore HTTP o oltre 90 secondi senza una risposta recente.

## Fonti e limiti

- **Prezzi:** gli strumenti sono l'intersezione tra catalogo e servizio candele.
  La richiesta dell'indice esclude il warehouse senza timestamp di aggiornamento
  e richiede un recupero provider non più vecchio di 5 minuti per riusare la cache. In locale queste richieste provano prima Yahoo
  (una chiamata); in produzione resta la catena esistente, adatta a Railway.
  Le richieste pendenti sono condivise per evitare di duplicare uno storico
  lento a ogni retry della dashboard.
  `fetchedAt` è conservato dentro la cache, non rinnovato ad ogni lettura. Un
  fallimento di aggiornamento marca `stale`. Il timestamp della barra D1 è la sua
  apertura, **non l'ora dell'ultimo tick**: sono possibili ritardi del provider.
  Yahoo usa futures per XAU/XAG/indici; fonte e simbolo proxy sono esplicitati.
  Nessuna equivalenza spot/futures viene verificata. Nel fine settimana o se la
  barra corrente manca, il prezzo viene escluso. Non è ancora implementato un
  calendario di sessione specifico per mercato.
- **NewsHub:** RSS e provider già configurati, nessun nuovo abbonamento. Si usano
  i titoli originali, senza i punteggi di direzione/rilevanza del classificatore
  precedente. Le regole cercano un movimento esplicito dell'asset, invertendo
  il segno della valuta quotata nel Forex. Titoli negati, ipotetici, previsioni
  riconoscibili e movimenti ambigui vengono esclusi. Tassi Fed/rendimenti Treasury
  hanno un'ipotesi di trasmissione dichiarata su USD/XAU; non è una legge causale.
  La geopolitica contribuisce solo se il titolo dichiara il movimento dell'asset.
  Sono deduplicati URL senza query e titoli normalizzati, massimo 30 evidenze nel
  calcolo e 6 visibili. Non è una deduplicazione semantica degli eventi: articoli
  riformulati possono sovrappesare uno stesso fatto. Le regole lessicali hanno
  copertura limitata e possono sbagliare; notizie rilevanti ma non interpretabili
  non diventano automaticamente neutrali. Il modello LLM gratuito configurato
  risponde 404: questo indice non usa i suoi punteggi, ma l'arricchimento news
  generale resta una configurazione da sistemare.
- **Retail:** le righe inattive/invalide vengono escluse singolarmente; non
  invalidano gli altri strumenti della risposta. La verifica live ha riprodotto
  questo difetto (28 righe invalide su 189), ora coperto da regressione.
  Myfxbook non espone il timestamp dell'osservazione in questo
  adattatore; resta null, distinto dal recupero. Nessuna inversione contrarian
  automatica. Non si pretende che retail predica il movimento successivo.
- **Calendario:** feed settimanale/cache 4 ore, primi eventi High per le valute
  del pair nelle prossime 24 ore. `actual` non è disponibile: non si calcolano
  sorprese macro. Errori e calendario vuoto sono distinti. Non contribuisce al
  segno del punteggio.
- **Range:** (high D1 − low D1) / media del range dei 20 giorni precedenti,
  misura ampiezza e non direzione. COT e controllo del rischio restano fuori
  dall'indice; il primo richiede una verifica dei fallback, il secondo descrive
  il rispetto del piano personale.

La ricognizione degli storici e delle latenze resta in
[daily-indicator-readiness.md](daily-indicator-readiness.md). DIR-01 resta aperto
nel classificatore precedente. I quattro titoli sintetici opposti ora sono
interpretati separatamente dal nuovo calcolo e verificati da test: questo non
costituisce una correzione globale del vecchio motore news.

## Valutazione successiva

Non ci sono migrazioni o snapshot persistenti nuovi. Prima di usare il valore
come modello decisionale, raccogliere prospetticamente snapshot append-only di
input, versione, pair, orari, copertura e score; confrontarli soltanto dopo la
chiusura dell'orizzonte con prezzi coerenti. Congelare target, orario, costi,
soglie e pesi prima del test. Confrontare fuori campione con riferimenti semplici,
riportando errori e astensioni per pair/sessione, evitando dati futuri o revisioni
retroattive. Pesi e soglie attuali non sono stati calibrati. Lo score non va
trasformato in percentuale di successo.

## Verifiche riproducibili

- Test puri `marketContext.test.ts`: verso base/quote, macro opposte, negazione,
  ambiguità, fallback, assenza, età, deduplica, futuro, zero e contratto OpenAPI.
- `marketContextService.test.ts`: aggiornamento condiviso, fallimento, retry e
  timeout. `candles.test.ts`: cache con timestamp originale, errore e recupero.
- `node scripts/verify-pair-context/run.mjs`: API/Clerk isolati, desktop/mobile,
  cambio focus, stati del dato, checklist e diario, fonti e strumenti dettagliati.
- `node scripts/verify-operating-center/run.mjs`: regressioni della prima tranche,
  con i widget ora su `/dashboard/widgets`.

I test browser usano risposte simulate e non modificano dati personali; non
provano la disponibilità reale di tutti i provider né l'accesso dell'account utente.
Screenshot e rapporti sono in `artifacts.local/verify-pair-context/` e
`artifacts.local/verify-operating-center/` (ignorati da Git).

### Esito della verifica locale

`pnpm verify`: 389 file passati, 0 falliti, TypeScript e build completati.
Prerender marketing escluso con `SKIP_PRERENDER=1`. `pnpm lint:ci`: 0 errori,
34 warning preesistenti. 16 verifiche browser della nuova home e 37 dei flussi
precedenti superate, senza eccezioni JavaScript. Dopo il controllo completo,
il filtro delle righe Myfxbook è stato verificato con il suo test di regressione,
TypeScript e build API.

Servizi locali: frontend 5173, API 3001, PostgreSQL 55432. Health/readiness 200;
il form Clerk reale mostra Google/email/password senza eccezioni JavaScript.
Non è stato effettuato l’accesso con le credenziali personali. Log dei controlli
in `.local-logs/context-verify-final.log` e `.local-logs/context-login-check.json`.

Dopo la correzione Myfxbook e il riavvio API, la lettura live di EURUSD ha
restituito `available`, score presente e copertura 100/100 delle tre componenti;
non è una misura di accuratezza. Evidenza locale:
`.local-logs/context-live-eurusd-final.json`. La disponibilità resta soggetta
ai provider e viene rivalutata durante l'uso.
