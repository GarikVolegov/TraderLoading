# Certificati dei tornei e canali vocali — 9 ottobre 2026

Prove su API in produzione locale, database `tl_audit_1790937137013` e identità sintetiche. Nessuna migrazione, chiamata alla blockchain, pagamento o modifica ai dati personali.

## Rilievi API corretti e riverificati

| ID | Funzione / gravità / tipo | Riproduzione e risultato osservato | Atteso, causa e intervento | Nuova prova |
|---|---|---|---|---|
| CERT-01 | Immagine certificato / media / bug | Creare certificato sintetico; leggere i metadati pubblici; aprire il campo `image`: 404 | Risorsa leggibile. Mancava la route indicata dai metadati; aggiunto SVG statico contenente soltanto gli attributi del premio, con escaping XML, CSP sandbox e nosniff | 200 SVG; testo speciale preservato come testo, nessuna risorsa esterna, account o wallet |
| CERT-02 | Identificativi certificati / media / bug | GET metadata e POST claim con `1.5` o `2147483648`: 500; notazione esponenziale interpretata come numero | 400 prima della query. `Number` e `isFinite` non verificavano interi PostgreSQL; ora formato decimale canonico positivo entro int32 su metadata, immagine e claim | Tutte le varianti invalide 400; record assente 404; autenticazione del claim mantenuta |
| VOICE-API-01 | Identificativi canali / media / bug | Sostituire ID valido con `<id>tail`: join/ping/leave/presence/signal/signals accettano200; ID fuori int32 o `abc`:500 | 400 senza alias. `parseInt` autorizzava un numero mentre la segnalazione usava il testo originale come scope; validazione unica e scope ricavato dall'intero verificato | Tutte le sei route respingono i cinque ID invalidi |
| VOICE-API-02 | Segnalazione WebRTC / media / bug | POST senza body:500; tipo arbitrario, destinatario array, dati oggetto o stringa eccessiva:200 | 400. Validazione del body: destinatario stringa limitata, tipo offer/answer/ice, dati stringa entro128KiB; nessuna interpretazione forzata dell'SDP | Rifiuti400 e conteggio dei segnali invariato |
| VOICE-API-03 | Destinatario / media / bug | Membro invia offer a utente estraneo alla community:200 | Non accettare destinazioni fuori community. Mancava il controllo del destinatario; ora la membership viene verificata prima dell'INSERT | 404 e nessun nuovo segnale. La baseline non dimostra lettura dei dati da parte dell'estraneo: il polling era già protetto |
| VOICE-API-04 | Uscita e riconnessione / media / bug | Accodare offer, uscire e controllare `signals`: una riga rimane; ingresso successivo poteva ricevere la negoziazione precedente | Pulizia dei segnali in entrata/uscita nella stessa transazione della presenza | Nessun residuo; guasti INSERT/DELETE preservano lo stato precedente e il retry riesce |
| VOICE-API-05 | Eliminazione canale/community / media / bug | Accodare offer e cancellare canale o community:200, ma la relativa riga `signals` rimane | Eliminare anche i segnali canonicali dei canali cancellati nella transazione esistente | Zero segnali dopo entrambe le eliminazioni |
| VOICE-API-06 | Timestamp ingresso / media / bug | Impostare la presenza esistente al giorno precedente; ripetere join: il campo pubblico joinedAt resta quello vecchio | Rinnovare joinedAt anche nell'upsert; i peer possono riconoscere la nuova sessione usando un campo già esistente | joinedAt recente dopo il nuovo ingresso |

Evidenze nell'esecuzione `artifacts.local/full-audit/20261002T103216Z/`:

- `tournament-certificates-baseline.json`: **5/7**; `tournament-certificates-after.json`: **7/7**.
- `voice-runtime-baseline.json`: **4/7**; `voice-runtime-baseline-cleanup.json`: **7/8**; `voice-runtime-baseline-deletion.json`: **8/10**; `voice-runtime-baseline-renewal.json`: **10/11**; `voice-runtime-after.json`: **11/11**. Sono revisioni progressive differenti, non risultati da sommare.
- `community-flows-voice-regression.json`: **16/16**, regressione dell'area community dopo le correzioni.
- Richieste associate all'execution ID in `api-requests.jsonl`. I rapporti precedenti non certificano il codice successivo.

Ulteriori verifiche: certificati visibili soltanto al proprietario; claim anonimo401 e altro proprietario404; wallet mancante400; provider di conio assente503 anche su otto richieste contemporanee, senza modificare il certificato. Un certificato già marcato minted **nel solo fixture DB** restituisce il risultato senza chiamare un provider. Non è prova di conio reale o simulato. I metadati e l'immagine sono pubblici per contratto ERC-721 e contengono soltanto attributi del premio.

Presenza vocale: otto join concorrenti lasciano una sola riga; heartbeat scaduto escluso, ping ripristina la presenza; otto polling concorrenti consegnano un segnale una volta; scadenza30s rispettata. Il membro rimosso riceve403 su ping/polling/invio e può ripetere la pulizia della propria presenza.

## Limiti e configurazioni

La validità SDP/ICE viene interpretata dal browser; la nuova validazione server ne controlla tipo e dimensione. Il destinatario deve essere membro; questa prova non certifica tutte le combinazioni di canali a pagamento, revoca simultanea e più istanze API. La presenza non dimostra trasmissione audio.

Il renderer non include nomi utenti o avatar e non carica font esterni. La pubblicazione ERC-721 su wallet, un URL assoluto pubblico configurato, RPC, contratto e signer restano non verificati. Il conio reale non viene attivato dall'audit.

Il primo tentativo di riverifica certificati è partito prima che l'API fosse pronta: errori `fetch failed`, limite del runner, non bug applicativo. Ripetizione dopo readiness:7/7. Il nuovo `restart-api.mjs` verifica PID, comando, database e modalità produzione, archivia il log privato, riavvia soltanto la3002 e attende readiness. Nessuno schema viene forzato.

## Rilievi del browser

Microfono sintetico di Chromium, due identità Clerk Development Pro nel solo DB isolato, candidati WebRTC host locali senza STUN/TURN. I messaggi SDP passano dall'API reale; i byte audio ricevuti sono misurati con `RTCPeerConnection.getStats`, non dedotti dalla scritta “Connesso”. L'errore503 dell'ingresso è una fixture HTTP esplicita.

| ID | Gravità / tipo | Riproduzione, osservato e causa | Intervento |
|---|---|---|---|
| VOICE-UI-01 | Media / bug | Ingresso503: cattura fermata correttamente, ma nessun avviso visibile | Errore inline con `role=alert`, selezione riprovabile |
| VOICE-UI-02 | Alta / bug | Sincronizzare due aggiornamenti reali della presenza: entrambi i peer inviano offer; `setRemoteDescription` fallisce in stato stable, connessioni failed e zero byte ricevuti | Un solo iniziatore determinato dagli ID; attendere la descrizione locale, conservare ICE arrivati prima della descrizione remota |
| VOICE-UI-03 | Media / bug accessibilità | Pulsanti microfono/uscita senza nome: non selezionabili per ruolo e nome, né interpretabili da lettore di schermo | Nomi nelle cinque lingue e stato premuto del mute; controlli touch48px |
| VOICE-UI-04 | Media / bug | Dopo rimozione membership, polling403 e heartbeat respinto, ma cattura ancora attiva dopo15s; risposte heartbeat ignorate | Helper JSON che verifica HTTP;401/402/403/404 arrestano cattura e peer e rendono visibile il motivo |
| VOICE-UI-05 | Alta / bug | Premere mute e leggere `MediaStreamTrack.enabled`: rimane true. La formula `enabled=!isMuted` manteneva anche lo stato UI invariato | `enabled=isMuted`: primo clic disabilita, secondo riabilita; verificare la traccia reale |
| VOICE-UI-06 | Media / bug | Rinviare una answer già applicata: il consumer tenta nuovamente `setRemoteDescription`, che fallisce in stato stable | Ignorare risposte fuori dallo stato have-local-offer; associare messaggi e ICE alla negoziazione tramite UUID nel JSON opaco `data` |
| VOICE-UI-07 | Media / bug | Ripetere più ingressi/uscite nella sequenza: la connessione successiva non si stabilisce entro20s; il server conserva un'epoca di ingresso vecchia e il peer riusa una connessione precedente | Rileggere la presenza prima di attivare l'ingresso e ricreare il peer al cambio joinedAt; riverifica dell'intera sequenza8/8 |
| VOICE-RES-01 | Media / miglioramento | Il codice chiudeva i peer soltanto lasciando tutta la stanza. La prima prova di uscita dell'altro peer era bloccata dalla negoziazione; non è una baseline riuscita di questo rilievo | Chiudere peer/audio/coda ICE all'assenza nella presenza; nuova prova su uscita SPA, dopo connessione effettiva |

Le chiavi API e i campi risposta esistenti non cambiano. `data` rimane una stringa; il JSON WebRTC include un identificativo della negoziazione, e i payload legacy senza identificativo restano accettati. Nessun file client generato è modificato a mano. La risorsa SVG risolve il campo `image` già presente nei metadati.

Evidenze browser: `browser-voice-baseline/report.json` (1/6; prova di uscita bloccata prima di misurare la pulizia), `browser-voice-baseline-race/report.json` (collisione, stati e avvisi), `browser-voice-baseline-stale/report.json` (answer ripetuta), `browser-voice-after-intermediate/report.json` (mute ancora true), `browser-voice-after-rejoin/report.json` (riconnessione incompleta), `browser-voice-after/report.json` (**8/8**, nessun errore JavaScript non gestito). Tracce ZIP e screenshot nelle rispettive cartelle. Gli avvisi previsti comprendono503 simulato,403 dopo revoca e richieste leave cancellate dal cambio completo del documento; sono conservati nel rapporto.

Tentativi esclusi: `baseline-harness-selector` usava un nome del canale errato; `after-harness-route` è interrotto da un handler Playwright rimosso prima del completamento, fixture residuo rimosso attraverso l'API del suo proprietario sintetico; `after-reload-deadline` imponeva12s a un'uscita per navigazione completa del documento, mentre il recupero per heartbeat è15s più il polling10s. La riverifica usa una navigazione SPA reale per l'uscita normale. Il limite per chiusura improvvisa/refresh rimane quello di scadenza della presenza; non si promette disconnessione remota istantanea.

Restano non verificate trasmissione fra dispositivi/reti diverse, NAT/TURN, permessi del microfono nei browser mobili reali, più di due interlocutori, più finestre dello stesso account e revoca atomica simultanea all'invio/deletion. Il rilascio risorse locale non può arrestare un client esterno modificato. I vecchi segnali con scope non canonico non sono migrati.

Riverifica del 10 ottobre sulla nuova API: **7/7 certificati e 11/11 vocali** (`tournament-certificates-current-20261010.json`, `voice-runtime-current-20261010.json`). Browser su copia stabile della build: **8/8**, zero errori JavaScript (`browser-voice-stable-20261010/report.json`). La precedente prova `browser-voice-current-20261010` ha7/8 ma mescola due build durante una compilazione concorrente: esclusa dalla certificazione, con evidenza404 conservata. I due tentativi `*-immutable-20261010` falliscono prima del login per la collocazione della copia sotto un percorso nascosto, poi corretta. Dettagli del processo in [audit-harness-2026-10-09.md](audit-harness-2026-10-09.md).
