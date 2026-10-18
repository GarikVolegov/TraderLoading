# Invii in corso e recupero degli allegati — 10 ottobre 2026

Ambiente: frontend di produzione immutabile, API3002 in modalità produzione, PostgreSQL sintetico e identità Clerk Development dedicate. Nessun destinatario reale. I guasti e le attese sono controllati nel browser; le scritture riuscite e gli upload attraversano API e database reali del test.

| ID | Funzione / gravità / tipo | Riproduzione e risultato iniziale | Causa / correzione / risultato atteso |
|---|---|---|---|
| CHAT-SEND-02 | Testo / alta / bug perdita bozza | Trattenere la richiesta di invio; mentre è in corso sostituire il testo nel campo. Dopo la conferma, il nuovo testo sparisce | Il completamento cancellava indiscriminatamente il campo. Ora cancella soltanto la bozza esatta inviata e soltanto nel contesto ancora attivo |
| CHAT-SEND-03 | Invio ripetuto / media / bug duplicazione | Enter, richiesta trattenuta, secondo Enter: due POST e due righe | Il pulsante era disabilitato ma la tastiera non controllava l'invio. Un guard immediato prima della cifratura accorpa il tentativo in corso; secondo Enter non cancella la bozza |
| CHAT-SEND-04 | Allegato / media / bug recupero | Upload 200, poi risposta503 simulata prima del POST reale del messaggio: file sul server, zero messaggi, input ripulito e nessun retry | Conservati URL e metadata per account e destinatario; avviso e Riprova riusano il file caricato. Nessun secondo upload. Il risultato deve arrivare al destinatario dopo reload |
| CHAT-SEND-05 | Cambio conversazione / media / bug ciclo di vita | Trattenere la risposta dell'upload reale; passare da B a C, poi rilasciarla: parte comunque un messaggio a B dal componente smontato | Guard sul componente e sulla conversazione prima del POST. Il file resta bozza di B; tornando a B si invia esplicitamente con Riprova. **Non è stato osservato un invio a C**: il difetto riguarda la prosecuzione non controllata dopo l'uscita, non un bypass dei permessi |

La decifratura asincrona scarta inoltre i risultati di un effetto dismesso, evitando che una risposta precedente possa aggiornare la nuova vista. È una correzione preventiva del ciclo di vita, **senza un quinto difetto browser riprodotto**.

## Evidenze

Run: `artifacts.local/full-audit/20261002T103216Z/`.

- `browser-chat-sends-baseline/report.json`: **0/4**. Nuova bozza cancellata, due richieste/due messaggi, nessun recupero del file dopo 503, messaggio a B dopo cambio conversazione. Rapporti con osservazioni, screenshot e provenienza delle risposte.
- `attachmentDrafts.test.ts`: isolamento fra account e destinatari; modificare un oggetto letto non modifica il deposito; una conferma vecchia non cancella la bozza più recente.
- `browser-chat-sends-after/report.json`: **4/4**, zero errori JavaScript; una sola richiesta e riga con Enter ripetuto, nuova bozza conservata, un solo file con retry, zero messaggi a B/C al cambio conversazione e invio esplicito al ritorno a B. Il file inviato è presente nel messaggio del destinatario dopo reload.
- Runner `browser-chat-sends.mjs`: tre identità test, scritture e conteggi SQL, file unico, destinatario dopo reload e controllo mobile. Il caso503 prova **solo il guasto prima del commit**. L'upload trattenuto è un successo reale inoltrato, dichiarato `forwarded-api`; la falsa risposta503 è esclusa dalla copertura API.

La pulizia rimuove soltanto file e messaggi dei mittenti dedicati a questo runner. Le identità e le chiavi di test restano disponibili. Nessun contratto API o schema è modificato in questa tranche.

## Limiti espliciti

Il deposito della bozza è **in memoria, per la durata della SPA**. Conserva metadata e URL, non byte del file o chiavi. Permette di cambiare conversazione e tornare indietro; un reload completo lo azzera. L'avviso chiede di riprovare prima del reload. La persistenza durevole richiede un protocollo che gestisca anche la risposta persa dopo commit, evitando di reinviare alla cieca.

L'avviso definitivo usa **“Invio dell’allegato non confermato”**: una risposta mancante non dimostra che il messaggio non sia stato salvato. Il testo precedente “non inviato”, presente nei primi rapporti dopo correzione, è sostituito. Le quattro prove continuano a verificare il caso prima del commit; il testo più preciso non risolve l'idempotenza ancora aperta.

L'accorpamento degli invii riguarda il componente attivo. **Non è idempotenza lato server**: restano da provare/correggere il commit con risposta persa, retry dopo reload, più finestre e richieste dirette concorrenti. Il recupero del file non elimina automaticamente upload abbandonati: i messaggi cifrati impediscono di distinguere in sicurezza un file inutilizzato da un allegato di un messaggio salvato. Restano una procedura di riconciliazione e una politica di conservazione.

Il guard comune evita di cancellare una registrazione vocale se nessun messaggio è partito, ma il retry di audio dopo upload/errore non è coperto dalle quattro nuove prove. Non viene dichiarata verifica completa di tutti i formati, chiamate o dispositivi reali.

Riverifica precedente: `browser-chat-sends-complete/report.json`, **4/4** e zero errori JavaScript, frontend stabile `a59834756f6d62b5221bf6140c36847c05688cdca3f3c91360ecec008469d2a7`. Screenshot `mobile-pending.png` e `mobile-after-retry.png`: bozza/controllo Riprova leggibili a 390×844, nessun overflow. Quattro regressioni passano separatamente in `browser-social-boundary-chat-sends-regression/report.json` su scheda Social, cifratura/download, chiave indisponibile e immagine privata.

Gate precedente stabile `verify-08fad31b-517d-4655-85ae-72f4488f7c0c.json`: **425 file di test**, TypeScript/build e prerender 45/45 passati; lint zero errori e 35 avvisi. Confronto dei sorgenti coincidente con il gate al termine. L'API personale mantiene il codice backend già compatibile; nessuna modifica di schema. Il frontend di sviluppo è aggiornato e `local-smoke.json` verifica soltanto API 200/login desktop-mobile in sola lettura, senza login personale.

Stato finale: `chat-sends-final-state.json`, zero messaggi/ACL degli allegati per le tre identità dedicate dopo la pulizia; porte 3001/3002/5173 con HTTP 200. `chat-sends-trace-redaction.json`: dieci ZIP integri, 5.447 membri controllati, nessun ulteriore pattern testuale/JWK riconosciuto da redigere. Screenshot, byte binari e altri log non sono certificati come privi di informazioni sensibili.

Riverifica definitiva con avviso “non confermato”: `browser-chat-sends-confirmation/report.json`, **4/4**, zero errori JavaScript; frontend stabile `d39ab30b94ca83e2dbea0db35547a3ca0fb373eafc7d0703e220e22f599d9c63`. Gate `verify-25069d6d-6701-4cec-93a1-0f6ac52c2d04.json`, **425 file di test**, TypeScript/build, prerender 45/45 e lint 0 errori/35 avvisi. Il gate precedente resta evidenza della versione prima della correzione del testo.
