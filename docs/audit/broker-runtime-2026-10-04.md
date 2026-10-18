# Broker — proprietà, configurazione e richieste ripetute

Esecuzione `20261002T103216Z`, API **produzione** su 3002, database sintetico separato. Queste prove usano il connettore **DEMO interno**: nessun ordine reale, conto esterno, pagamento o credenziale broker. Evidenze in `artifacts.local/full-audit/20261002T103216Z/`.

| ID | Gravità / tipo | Riproduzione, atteso e osservato | Causa e correzione | Esito / evidenza |
| --- | --- | --- | --- | --- |
| BRK-OWN-01 | Alta / bug, separazione dati | A crea un profilo; B invia POST `/brokers/profiles` con lo stesso ID. Atteso 404 e dati di A invariati; osservato 201, proprietà trasferita a B e nome sovrascritto | L'upsert cercava l'ID senza controllare il proprietario. Verifica nel blocco atomico del persistitore, prima della mutazione; il router restituisce 404 | Corretta e riverificata: `broker-runtime-baseline.json` / `broker-runtime-after.json`; test deterministico con aggiornamenti concorrenti A/B |
| BRK-CONFIG-01 | Media / bug | Inviare kind/provider sconosciuto, environment invalido o DEMO con environment live. Atteso 400 senza insert; osservato 201, fallback silenzioso a DEMO oppure DEMO etichettato live | Validazione dei valori espliciti e rifiuto DEMO/live nel persistitore. La lettura delle configurazioni storiche mantiene la compatibilità | Corretta e riverificata, quattro input nel medesimo rapporto. Nessuna connessione effettuata con questi input |
| BRK-ORDER-01 | Alta / bug, duplicazione operazioni | Un ordine DEMO, una ripetizione e sei invii concorrenti con `clientRequestId` identico. Atteso una posizione; osservate otto | Mancava una prenotazione idempotente. Receipt durevole prima dell'invio, chiave distinta per profilo/operazione/ID, fingerprint dell'intento e salvataggio dell'esito. L'INSERT univoco usa la tabella JSON esistente, senza migrazione | Corretta e riverificata: una posizione, una receipt DB; intento differente con lo stesso ID respinto. `broker-runtime-after.json`, `brokerOrderReceipts.test.ts` |
| BRK-ORDER-02 | Alta / rischio riprodotto mediante fault injection | Provider simulato accetta ma perde la risposta, oppure il salvataggio DB dell'esito fallisce. Un retry non deve inviare un secondo ordine | La receipt resta pending e il messaggio richiede verifica sul broker. Un errore del log secondario non trasforma un esito confermato in errore HTTP | Riverificata: test deterministici di risposta persa, store assente, completamento fallito e log fallito; fault DB effettivo nel runtime in `broker-restart-after.json` |

`broker-runtime-after.json`: **8/8 scenari passati**, con persistenza, anonimo 401, Free 402, proprietà, lettura, connessione, refresh, ordine, chiusura, storico e disconnessione DEMO; cancellazione e ripetizione 404. Il baseline contiene anche un errore del runner: attendeva 403 al gate Pro invece del 402 previsto. Questo non è un bug dell'app; i tre difetti di prodotto sopra sono verificati separatamente.

`broker-restart-after.json`: **1 scenario passato** dopo un vero cambio di processo API. Il nuovo connettore DEMO parte senza posizioni; ripetere l'ordine confermato restituisce l'esito precedente senza creare posizioni. Un trigger temporaneo, limitato al profilo sintetico, provoca il fallimento dell'UPDATE di completamento: l'ordine risulta non confermato, la receipt resta pending e il retry dopo rimozione del trigger non crea una seconda posizione. Trigger e funzione vengono rimossi anche in caso di errore.

La chiusura ripetuta della stessa posizione è coperta da un test deterministico con una sola operazione chiusa nello storico. Il runtime usa receipt diverse per apertura e chiusura. I messaggi distinguono mancato invio da esito non confermato.

## Limiti e lavoro residuo

- Il DEMO non conserva le proprie posizioni dopo riavvio: serve a provare che la richiesta non viene nuovamente inviata, non la riconciliazione dello stato di un broker esterno.
- Le prove concorrenti usano una sola istanza API; l'unicità DB è condivisa fra processi, ma una prova con due API contemporanee non è stata eseguita.
- L'idempotenza richiede lo stesso `clientRequestId`. Senza ID esplicito il normalizzatore ne genera uno nuovo: non è una deduplicazione di ogni ordine economicamente simile.
- Le prenotazioni pending non vengono riaperte automaticamente. Restano da implementare una procedura di riconciliazione e la gestione della conservazione delle receipt. Eliminarle senza verifica consentirebbe il reinvio.
- I controlli di connessione/permessi precedono il replay della receipt: il recupero dell'esito mentre il profilo è offline o disabilitato non è verificato né garantito.
- Nessuna prova end-to-end di MetaAPI, cTrader, MT5, SnapTrade o FXBlue esterni. Compatibilità delle configurazioni storiche e combinazioni fra kind/provider richiedono un audit separato.

Runner: `full/broker-runtime-flows.mjs after`; per la prova di riavvio, `full/broker-restart.mjs prepare`, riavviare **solo** l'API audit, quindi `full/broker-restart.mjs resume`.
