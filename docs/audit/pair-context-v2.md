# Workspace del brand e contesto v2

24 settembre 2026. Sostituisce la home v1 dopo la revisione del proprietario.

## Interfaccia e avatar

- Font Fira Sans/Fira Code del brand ospitati nell'app, con licenze incluse.
  Il caricamento non dipende più da Google Fonts. Le altre preferenze tipografiche
  rimangono disponibili; il workspace usa la tipografia del brand.
- Intestazione compatta con logo e wordmark, colori giada/ambra, andamento D1
  ricavato dalle candele reali e quattro contributi. Disciplina, checklist, routine,
  diario e strumenti in una colonna laterale su desktop. Su mobile il piano
  precede gli approfondimenti COT/volatilità.
- I collegamenti a conto broker, lotti, sessioni/focus e missioni aprono i componenti
  esistenti; la pagina degli strumenti mantiene watchlist, calendario, routine,
  citazione, diario, sentiment, volatilità e COT completi. Non si aggregano obiettivi,
  conto personale o disciplina nel giudizio sul mercato.
- L'avatar aveva una causa riproducibile: `startApiDev.ts` avviava l'API dalla
  directory `scripts`, quindi gli upload relativi non puntavano alla directory
  del backend. Corretto il working directory: il file già presente nel Mac passa
  da HTTP 500 a 200. Nessun profilo è stato riscritto. Se un'immagine manca davvero,
  la navigazione usa l'immagine Clerk, poi quella del brand, poi le iniziali.

## Dati precedenti e ruolo nella lettura

| Informazione | Dove si trova | Entra nel punteggio? |
| --- | --- | --- |
| Prezzo del pair / andamento | Valore, sorgente e mini grafico D1 | Sì, movimento normalizzato ATR20 |
| News, macro, geopolitica | Contributo e fonti espandibili, area Notizie completa | Sì, solo titoli interpretabili dal modello; ambiguità escluse |
| Sentiment Myfxbook | Contributo retail, fonte e recupero | Sì, long meno short; non equivale a previsione |
| Report COT | Contributo + report, categorie e storico sotto l'indice | Sì, posizionamento settimanale; futures proxy |
| Volatilità | Range corrente/ADR20 + medie 1W/1M/3M/6M/1Y | No: ampiezza, non segno |
| Calendario | Prossimo evento High e pagina completa | No: mancano actual/sorprese macro |
| Watchlist completa / altri strumenti | Tutti gli strumenti | Nessun doppio conteggio con prezzo |
| Broker, lotti, sessioni, routine, checklist, missioni, diario | Colonna operativa, modali e pagine esistenti | No: gestione personale e disciplina |

L'ADR nella home usa 5/22/66/132/252 **sedute concluse**, escludendo la candela
in formazione. Una finestra incompleta restituisce null e mostra campioni disponibili/
richiesti. Valori in unità di prezzo, dichiarati in UI; il widget dettagliato precedente
mantiene le proprie unità pip/punti e medie storiche. Non sono quantità identiche.
Il grafico usa fino a 30 close D1 reali, senza riempimento dei buchi.

## COT esclusivamente reale

Nuovo servizio `services/cot.ts`: CFTC Socrata **Legacy Futures Only** come fonte
primaria, `deafut.txt` ufficiale come ripiego con le stesse categorie. Eliminati
report statici, riempimenti sintetici degli storici e mescolanza con Financial
Futures/Combined. Campi numerici assenti o invalidi vengono esclusi, mai convertiti
implicitamente in zero. Contratti micro/cross non vengono attribuiti al contratto
principale. Copertura: EUR, GBP, JPY, CHF, CAD, AUD, NZD, USD index, XAU, XAG.

Le osservazioni sono settimanali; la CFTC pubblica normalmente venerdì alle
15:30 America/New_York le posizioni del martedì precedente, con eccezioni festive.
Non si inventa un timestamp di pubblicazione: `publishedAt=null`. Si espongono
`date`, `fetchedAt`, fonte e stato. Controllo fonte ogni ora, riprova dopo un minuto
in caso di errore. Un precedente report reale diventa stale; nessun successo
precedente significa unavailable e lista vuota. Report oltre 45 giorni non sono
più mostrati dal servizio. Per lo score servono osservazioni entro 11 giorni e
recupero entro 2 ore; le sospensioni prolungate comportano astensione.
Questa è una soglia conservativa di età, non una verifica completa del calendario
festivo CFTC e non garantisce che non esista una revisione più recente.
Fonte: [calendario ufficiale CFTC](https://www.cftc.gov/MarketReports/CommitmentsofTraders/ReleaseSchedule/index.htm).

Lettura live verificata: 10 mercati, 12 settimane reali ciascuno; ultimo report
2026-09-15, coerente con la pubblicazione 2026-09-18 e la data della verifica.
Il report 2026-09-22 non è ancora previsto prima del 2026-09-25.

## Formula descrittiva v2

`context-v2-experimental`: prezzo **35%**, news **30%**, retail **15%**, COT **20%**.
Componenti fra −100 e +100 e media pesata dei soli contributi disponibili.
Resta obbligatorio il prezzo e almeno un altro contributo; i pesi esclusi riducono
la copertura e vengono rinormalizzati. Coverage non è accuratezza.

COT = 100 × (non-commercial long − short)/(long + short). Per XAU/XAG si usa il
futures corrispondente. Per EURUSD si usa EUR; per USDJPY si inverte JPY, senza
aggiungere l'indice USD e contarne due volte l'esposizione. Nei cross si usa la
semidifferenza delle due gambe, entrambe obbligatorie e della stessa settimana.
Crypto/indici non mappati non ricevono un COT sostitutivo. Commercial e
non-reportable sono visibili nell'approfondimento, non sommati ai non-commercial:
sarebbero categorie dello stesso mercato, non fonti indipendenti.

Questo valore descrive il livello delle posizioni: alcune attività hanno un bias
strutturale long. Non implica che i trader non-commercial prevedano la prossima
seduta; non si applica automaticamente una lettura contrarian. I pesi e le soglie
±15 sono ipotesi di prodotto **non calibrate**. Il maggiore numero di fonti non
costituisce prova di una maggiore accuratezza. Le regole news restano euristiche;
DIR-01 nel classificatore precedente non viene usato dal nuovo indice.

Prezzo Yahoo su XAU/XAG/indici può essere un futures proxy: il simbolo e la natura
del proxy sono visibili accanto al prezzo, oltre che nel metodo. Non si dichiara
un prezzo spot/tick del broker. Un recupero recente non annulla il ritardo del
provider. Stati insufficient/partial/stale continuano a escludere dati invalidi.

## Fonti da valutare successivamente per XAU/USD

Queste sono **proposte**, non nuovi feed già integrati. Priorità e utilità vanno
verificate sul target giornaliero scelto.

1. **Rendimenti reali USA e dollaro.** DFII10 (10 anni TIPS) e indice ampio USD
   DTWEXBGS come contesto macro. Sono serie osservate giornalmente, ma la pubblicazione
   e il ritardo differiscono: non chiamarle feed live. Per un uso intraday servirebbe
   una fonte con frequenza/licenza adeguata. L'ipotesi è misurare variazioni e relazioni
   mobili, non imporre correlazioni inverse costanti.
   Fonti: [DFII10](https://fred.stlouisfed.org/series/DFII10),
   [DTWEXBGS](https://fred.stlouisfed.org/series/DTWEXBGS).
2. **Sorprese macro.** Actual vs consenso per inflazione, occupazione e decisioni
   monetarie, normalizzate per tipo di evento. Occorrono un feed con actual e un
   archivio del consenso conoscibile prima del rilascio. Le revisioni vanno conservate
   separatamente; [ALFRED](https://fred.stlouisfed.org/docs/api/fred/alfred.html)
   distingue le versioni temporali, ma non sostituisce il consenso di mercato.
3. **Flussi ETF oro.** Possibile contesto di domanda su orizzonte più lento. I dati
   WGC vengono aggiornati settimanalmente/mensilmente; non vanno riciclati come
   conferma intraday nuova ogni minuto.
   Fonte: [WGC ETF holdings/flows](https://www.gold.org/goldhub/data/gold-etfs-holdings-and-flows).
4. **Volatilità implicita, volumi e open interest futures.** Possibile misura di
   regime/liquidità e rischio atteso, separata dalla direzione. Il Gold CVOL CME
   descrive volatilità implicita a 30 giorni. Accesso storico, termini e licenze
   vanno verificati prima di integrare feed redistribuiti nell'app.
   Fonte: [CME Gold options](https://www.cmegroup.com/markets/metals/precious/gold.volume.options.html).
5. **News per evento e fonte.** Deduplicazione semantica, estrazione actual/attese,
   rilevanza distinta dal segno e revisione degli errori. Evitare che dieci articoli
   sullo stesso annuncio diventino dieci conferme indipendenti.

Il [modello GRAM WGC](https://www.gold.org/goldhub/tools/gold-return-attribution-model)
è un riferimento per analizzare i fattori dell'oro; la sua attribuzione storica
non convalida un punteggio giornaliero TraderLoading.

Prima di ottimizzare: salvare snapshot immutabili, definire anticipo/target/sessione,
confrontare prezzo-solo vs +news vs +retail vs +COT fuori campione, includendo
astensioni e costi. Aggiungere ogni nuova fonte solo se porta un miglioramento
misurabile e stabile. Nessuna persistenza di snapshot o migrazione DB introdotta
in questo intervento.

## Verifica finale del 1 ottobre 2026

Gate completo: 390 file di test passati, TypeScript e build riusciti (prerender
marketing escluso); lint 0 errori/33 warning. Browser pair-context: 18 controlli;
regressione operating-center: 37 controlli. Entrambi senza eccezioni JS.
Il controllo aggiuntivo con Clerk e PostgreSQL reali in ambiente isolato è
documentato in [audit runtime](local-runtime-2026-10-01.md).
