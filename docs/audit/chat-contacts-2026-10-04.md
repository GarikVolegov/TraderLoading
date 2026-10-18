# Contatti e chat — concorrenza, chiavi e recupero

Esecuzione `20261002T103216Z`, API produzione e database isolato. Nessun messaggio a persone reali; chiavi e utenti sintetici. Evidenze locali in `artifacts.local/full-audit/20261002T103216Z/`.

| ID | Gravità / tipo | Riproduzione e risultato iniziale | Causa, intervento e risultato atteso | Esito |
| --- | --- | --- | --- | --- |
| FRD-01 | Media / bug | Richiesta di amicizia verso account inesistente creava una relazione fantasma | Verifica target prima dell'insert: 404, nessuna riga | Corretta e riverificata |
| FRD-02 | Media / bug | ID con suffisso, decimale o overflow accettato/trattato impropriamente nelle scritture | Parsing intero positivo int32; 400 senza mutazione | Corretta e riverificata |
| FRD-03 | Media / bug | Richieste identiche o reciproche simultanee potevano duplicare la relazione | Lock della coppia ordinata, transazione e controllo dello stato: una relazione; una 201 e conflitti 409 | Corretta e riverificata |
| FRD-04 | Media / bug | Accettazione/rifiuto/rimozione concorrenti potevano restituire esiti discordanti con lo stato persistito | Lock di riga, controllo e transizione atomica | Corretta e riverificata |
| GLB-01 | Media / bug | Cursor della chat globale con suffisso o valore fuori intervallo non respinto correttamente | Cursor int32 positivo e pagine ordinate senza sovrapposizioni | Corretta e riverificata |
| CHAT-AT-01 | Alta / bug | Guasto alla scrittura pubblica dopo backup: 500 lasciava backup nuovo e chiave pubblica vecchia | Transazione e lock per utente: rollback di entrambe le scritture; retry aggiorna la coppia | Corretta e riverificata con fault DB |
| CHAT-AT-02 | Media / bug | Dieci payload JWK malformati o con privata/pubblica discordanti accettati | Forma P-256, coordinate/operazioni e import WebCrypto; confronto dei segreti ECDH derivati: 400 e coppia precedente conservata | Corretta e riverificata |
| CHAT-AT-03 | Media / bug | Dodici pubblicazioni iniziali parallele: sei 200 e sei 500 per vincolo univoco | Upsert atomico e lock anche prima della prima riga: dodici 200 e una sola riga | Corretta e riverificata |
| CHAT-AT-04 | Alta / bug | POST della pubblica di un'altra coppia sostituiva quella di un backup valido | Confronto nel lock condiviso con PUT backup: 409 e coppia originaria invariata | Corretta e riverificata |
| CHAT-AT-05 | Media / bug | Query della notifica falliva dopo messaggio già salvato e risposta 201: tentata seconda risposta 500 | Tutta la notifica in task separato; il guasto non cambia la risposta del messaggio | Corretta e riverificata sul vero handler con DB simulato, non push esterno |
| CHAT-BODY-01 | Media / bug | Body assente/forma impropria poteva produrre 500 nelle chat globale/privata | Validazione prima della lettura dei campi: 400 e nessun messaggio | Corretta e riverificata, sei varianti |

**10/10 contatti/globale**, `friends-global-after.json`; **7/7 atomicità chiavi**, `chat-key-atomic-after.json`; **1/1 body con sei varianti**, `chat-body-after.json`. Descrizioni complete delle cinque correzioni crittografiche e confronto baseline/after in `chat-key-atomic-findings.json`. La PUT concorrente del backup già passava nel baseline: non viene contata come difetto aggiuntivo. Test deterministici coprono il confine di giornata Europe/Rome, anche estivo/invernale; non provano presenza live degli utenti.

La chat conserva backup privati recuperabili dal server: **non protegge dall'operatore del server**. Nessuna migrazione dei messaggi storici o rotazione versionata. Non verificati primo accesso simultaneo dello stesso account su due dispositivi e lettura dello storico durante rotazione. Le precedenti prove browser/consegna WebSocket restano riferite alla versione allora misurata; la nuova riorganizzazione della UI richiede regressioni proprie.

I log degli errori delle chiavi non includono più l'errore SQL completo che poteva contenere materiale privato. Gli eventuali log grezzi precedenti sono riservati locali; non diventano automaticamente condivisibili. La redazione delle tracce è documentata in `evidence-redaction-2026-10-04.md`.
