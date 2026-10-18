# Verifica locale con backend reale

Eseguire dalla radice. Usa PostgreSQL gestito locale su 55432 e credenziali di
sviluppo del launcher (`trader`). Crea un database nuovo `tl_audit_*` con **solo lo
schema**, senza copiare dati personali. Ripristina in tale copia il DDL supporto
0013 già presente. Richiede `pg_dump`/`psql` PostgreSQL 16 sul PATH, oppure
`AUDIT_PG_BIN` con la directory dei binari. Non usare il database personale come
destinazione del runner.

```sh
node scripts/verify-real-runtime/prepare.mjs
node scripts/verify-real-runtime/start-api.mjs
```

Lasciare il secondo comando attivo; in un altro terminale:

```sh
node scripts/verify-real-runtime/run.mjs
pnpm --filter ./scripts exec tsx verify-real-runtime/profile-concurrency.mjs
```

Porte riservate: API 3002, Vite 5182. Fermare eventuali processi di una precedente
verifica prima di ripartire. Serve l'identità Clerk Development di test già usata
dagli altri runner (`verify+clerk_test@example.com`); il runner rifiuta una chiave
Clerk di produzione. Non crea account, non invia email e non collega broker. Il
profilo Pro sintetico è inserito esclusivamente nel DB temporaneo. La creazione e
la risposta a un ticket verificano la persistenza interna, senza inviare notifiche
esterne (chiavi/flag email non passati all'API).

L'API legge solo una lista limitata di variabili: connessione DB temporanea,
cartella upload di test e Clerk. Nessuna fixture per API o Clerk nel browser.
I provider pubblici di calendario/notizie possono variare. Il rapporto distingue
errori HTTP da errori JavaScript. Le 17 aperture non equivalgono alla certificazione
di ogni flusso: si esercitano esplicitamente preferenze, diario, checklist, supporto
e navigazione mobile/desktop.

Output ignorato da Git: `artifacts.local/verify-real-runtime/`, `.local-logs/runtime-*`.
Terminare l'API di test con Ctrl+C. Il database temporaneo resta disponibile per
ispezionare le evidenze; il suo nome è in `.local-logs/runtime-db.json`. Nessuno
script cancella o modifica automaticamente il database personale.

## Audit completo riproducibile (runner `full/`)

Il nuovo gruppo di runner usa la build di produzione sulla sola porta **3002**.
L'app personale può restare su **5173/3001**. Non avviare il launcher che forza lo
schema e non usare `db:push`. La configurazione locale attuale richiede Postgres
16 su 55432; `prepare.mjs` legge lo schema di `traderloadings`, non le sue righe.

Prima esecuzione, con nessuna API di audit attiva:

```sh
export AUDIT_PG_BIN="/Users/gazz/Applications/Postgres.app/Contents/Versions/16/bin"
node scripts/verify-real-runtime/full/init.mjs
node scripts/verify-real-runtime/full/verify.mjs
AUDIT_API_MODE=production node scripts/verify-real-runtime/start-api.mjs
```

`init.mjs` conserva patch, file non tracciati e versioni in una cartella nuova,
crea un database con schema e sole identità sintetiche, poi registra i marker in
`.local-logs/`. Rifiuta una porta audit già occupata. `seed.mjs` rifiuta un database
popolato: non azzera più tabelle per ripetere un test. Il launcher rifiuta anch'esso
una porta occupata prima di sovrascrivere log/marker. Clerk deve avere chiavi
Development (`sk_test_`); i browser creano/utilizzano solo identità `+clerk_test`.
Le assegnazioni di ruoli e Pro avvengono nel database temporaneo.

In un secondo terminale, eseguire i runner **in sequenza**: alcuni verificano
sospensione, connessioni e rollback con trigger temporanei sul solo database audit.

```sh
node scripts/verify-real-runtime/full/api-flows.mjs
node scripts/verify-real-runtime/full/domain-flows.mjs after
node scripts/verify-real-runtime/full/milestone-flows.mjs after
node scripts/verify-real-runtime/full/profile-flows.mjs
node scripts/verify-real-runtime/full/admin-flows.mjs after
node scripts/verify-real-runtime/full/support-atomicity.mjs after
node scripts/verify-real-runtime/full/misc-flows.mjs after
node scripts/verify-real-runtime/full/community-flows.mjs after
node scripts/verify-real-runtime/full/social-flows.mjs after
node scripts/verify-real-runtime/full/social-boundary-runtime.mjs after-private
node scripts/verify-real-runtime/full/remaining-internal.mjs after
node scripts/verify-real-runtime/full/crud-cleanup.mjs after
node scripts/verify-real-runtime/full/library-admin-flows.mjs after
node scripts/verify-real-runtime/full/friends-global-flows.mjs after
node scripts/verify-real-runtime/full/chat-key-atomic.mjs after
node scripts/verify-real-runtime/full/chat-body-flows.mjs after
node scripts/verify-real-runtime/full/milestone-runtime-flows.mjs after
node scripts/verify-real-runtime/full/access-runtime-flows.mjs after
node scripts/verify-real-runtime/full/news-preferences-runtime.mjs after
node scripts/verify-real-runtime/full/broker-runtime-flows.mjs after
node scripts/verify-real-runtime/full/market-tools.mjs after
node scripts/verify-real-runtime/full/timestamps.mjs after
node scripts/verify-real-runtime/full/websockets.mjs
node scripts/verify-real-runtime/full/clerk-revocation.mjs after
node scripts/verify-real-runtime/full/recovery.mjs
node scripts/verify-real-runtime/full/browser.mjs
node scripts/verify-real-runtime/full/browser-extra.mjs
node scripts/verify-real-runtime/full/browser-settings.mjs after
node scripts/verify-real-runtime/full/browser-social-boundary.mjs complete
node scripts/verify-real-runtime/full/browser-chat-sends.mjs complete
node scripts/verify-real-runtime/full/browser-replay.mjs after
node scripts/verify-real-runtime/full/browser-admin.mjs after
node scripts/verify-real-runtime/full/browser-library-editor.mjs after
node scripts/verify-real-runtime/full/browser-milestone-editor.mjs after
node scripts/verify-real-runtime/full/browser-news-preferences.mjs after
node scripts/verify-real-runtime/full/browser-workspaces.mjs after
node scripts/verify-real-runtime/full/browser-community.mjs after
node scripts/verify-real-runtime/full/browser-social.mjs after
node scripts/verify-real-runtime/full/browser-key-switch.mjs after
node scripts/verify-real-runtime/full/story-pending-review.mjs after
node scripts/verify-real-runtime/full/browser-push-preferences.mjs after
node scripts/verify-real-runtime/full/browser-referral.mjs after
node scripts/verify-real-runtime/full/browser-broker-pro-tornei.mjs after
node scripts/verify-real-runtime/full/load.mjs after
node scripts/verify-real-runtime/full/browser-performance.mjs after
node scripts/verify-real-runtime/full/browser-spa-performance.mjs
pnpm lint:ci
node scripts/verify-real-runtime/full/coverage.mjs
node scripts/verify-real-runtime/full/local-smoke.mjs
```

- `verify.mjs` esegue `pnpm verify` fornendo alla build la sola chiave pubblica Clerk.
- `load.mjs` dura almeno 15 minuti: tre fasi di cinque minuti con 1/5/20 identità.
  Non eseguire misure insieme ad altri benchmark/build. `browser-performance.mjs`
  misura separatamente 100/1.000/10.000 voci con 3 reload freddi e 10 caldi.
  `browser-spa-performance.mjs` misura 60 clic reali senza reload, dopo un warm-up,
  usando il dataset 10.000 esistente e bloccando le API dei provider esterni.
  Il percorso supporto apre prima la relativa sezione impostazioni: il tempo di
  preparazione è registrato separatamente. Non riutilizzare un tentativo fallito
  come report finale; il 422 per campione R assente deve combaciare con API e UI.
- `browser-replay.mjs` usa candele sintetiche intercettate nel browser, ma salva
  sessioni/trade nell'API e DB reali di audit. Non certifica i provider di candele.
- `browser-extra` e `browser-settings` introducono risposte 503 intenzionali per
  verificare conservazione delle bozze/preferenze e retry; sono distinte dai crash.
- I controlli API verificano gli status attesi, non che ogni risposta sia 200.
  Rapporti e screenshot sono nella cartella del run; le tracce vengono ripulite
  da JWT, ID di sessione, campi segreti e JWK private, anche in risorse JSON senza
  estensione. Per ripulire le tracce dopo un’esecuzione usare
  `python3 scripts/verify-real-runtime/full/redact-traces.py <trace.zip> [<altra-trace.zip>]`.
  Non eseguire la redazione ZIP durante benchmark. Non condividere
  `.local-logs/full-audit-users.json`, dump, patch o archivi non revisionati: il dump
  sintetico esclude le sessioni ma conserva altri dati privati di test.
- `coverage.mjs` rifiuta report con un altro `runId`, esclude attribuzioni ambigue e
  non conta una route parametrica quando è stata raggiunta una route letterale
  precedente; le dichiarazioni duplicate in blocchi condizionali restano non
  attribuite. Le prove API sono associate a un `executionId`, oltre al `runId`:
  un after-report non può certificare richieste di un precedente baseline. I
  rapporti browser con cartella temporale devono essere richiamati dal rispettivo
  indice `*-findings.json` revisionato, non scelti cercando la cartella più recente.
  Risposte sintetiche nel browser sono prove del consumer UI, escluse dalla
  copertura API. `response-provenance.mjs` distingue API, inoltro di risposta reale
  e risposta simulata. I vecchi scenari misti simulati e gli errori senza provenance
  sono esclusi conservativamente; le candele sintetiche del replay non attestano
  il provider. Il conteggio è copertura dei soli scenari citati, non certificazione.
- Il test `local-smoke` apre soltanto il login personale senza autenticarsi né
  modificare dati. Per avviare l'app personale senza applicare schema, usare in
  terminali separati `pnpm --filter ./scripts exec tsx local/startApiDev.ts` e
  `pnpm --filter ./scripts exec tsx local/startFrontendDev.ts` con Postgres attivo.

I runner `probe-*` e i file `*-baseline.json` servono a investigare/riprodurre i
problemi: non sostituiscono le regressioni sopra. Il bootstrap completo è stato
provato su un database nuovo poi eliminato, ripristinando i marker del run attivo;
le protezioni contro avvio doppio e reseed sono state verificate separatamente.

I runner referral e pending story producono cartelle temporali: dopo una nuova
esecuzione aggiornare i riferimenti `evidenceAfter` negli indici dei rilievi con il
rapporto effettivamente controllato prima di rigenerare la copertura. Non copiare
l’esito di un tentativo precedente. Referral prova registrazioni Clerk Development;
broker/Pro/tornei distingue API locali da risposte provider simulate. Gli scenari
che restituiscono il gate o l’indisponibilità attesi non provano il percorso positivo.

Le connessioni applicative e le fixture sintetiche usano UTC per i timestamp; la
giornata operativa è Europe/Rome. Non correggere le righe storiche personali
automaticamente: timestamp senza fuso possono avere provenienze differenti.

### Richieste broker ripetute e riavvio

`broker-runtime-flows.mjs` usa soltanto il DEMO interno. La prova durevole richiede
un vero riavvio della sola API audit, conservando lo stesso DB sintetico:

```sh
node scripts/verify-real-runtime/full/broker-restart.mjs prepare
# Fermare soltanto il launcher audit su 3002; non API personale o PostgreSQL.
AUDIT_API_MODE=production node scripts/verify-real-runtime/start-api.mjs
# In un altro terminale:
node scripts/verify-real-runtime/full/broker-restart.mjs resume
```

`resume` controlla il cambio PID e provoca un errore di completamento tramite
trigger temporaneo limitato al profilo di test. Non eseguire altri runner durante
questa prova. Le receipt e il profilo vengono rimossi dopo la verifica riuscita.
Una fixture incompleta impedisce un nuovo `prepare`; ispezionarla prima di
ripartire. Il gate Free previsto restituisce 402, non 403.

`browser-workspaces.mjs` verifica la riorganizzazione della navigazione e
creazione/rilettura/eliminazione dell'agenda locale per un account Clerk sintetico.
I provider mercato sono dichiarati indisponibili mediante fixture: non è una
verifica dei loro dati. `browser-news-preferences.mjs` usa articoli sintetici ma
salva preferenze e feedback nel backend isolato; `news-preferences-runtime.mjs`
esercita i guasti DB e il filtro dei voti sullo snapshot sintetico effettivo.

`renew-sessions.mjs` rinnova soltanto le 24 sessioni sintetiche del marker corrente
per una nuova fase, senza cambiare ruoli o sessioni Clerk/personali. Non eseguirlo
durante le prove di revoca o sospensione. `milestone-runtime-flows.mjs` esercita
upload e guasti INSERT/DELETE nel sandbox; non avviare altri upload mentre opera.
`browser-milestone-editor.mjs` conserva e ripristina i dati del livello20 nel
solo database sintetico e rimuove gli allegati creati dalla prova. Le richieste
503 sono simulate, il percorso riuscito salva e rilegge dati reali nel sandbox.

`tournament-certificates.mjs` prova proprietà, metadati e SVG con certificati
sintetici; richiede provider di conio assente e non chiama una blockchain.
`voice-runtime-flows.mjs` prova presenza/segnali e guasti DB su identità proprie;
`browser-voice.mjs` usa due utenti Clerk Development e microfoni sintetici, senza
STUN/TURN, e registra i byte RTP ricevuti. Non usa il microfono reale.

`restart-api.mjs` riavvia soltanto il PID3002 verificato in produzione sul DB
del marker audit e attende readiness. Non avvia lo schema e non tocca la3001.
`full/verify.mjs` passa al gate soltanto un ambiente consentito e la chiave
pubblica Clerk, senza importare i helper browser che caricano dotenv. Conserva
fingerprint prima/dopo in `gates/`: modifiche ai sorgenti impediscono un PASS.
La suite unit usa directory broker/upload temporanee per ogni processo e un URL
DB non utilizzabile, con credenziali provider escluse; le integrazioni usano invece
il database audit effettivo. I percorsi standard dell'app personale non cambiano.

Il launcher API conserva una copia frontend privata e stabile per processo in
`artifacts.local/runtime-frontends/<database>/`: una build Vite successiva non
sostituisce gli asset durante le prove. Manifest prima/dopo e della copia devono
coincidere; il marker registra l'hash. I rapporti voce/workspace nuovi lo riportano.
Non collocare gli asset serviti sotto `.local-logs`: Express sendFile rifiuta i
segmenti nascosti del percorso. Il riavvio controlla readiness sia API sia HTML.
`node scripts/verify-real-runtime/frontend-snapshot.test.mjs` verifica isolamento,
mutazione concorrente, corruzione e symlink usando solo directory sintetiche.

`node scripts/verify-real-runtime/full/compression-abort.mjs <etichetta>` prova il
middleware installato su un server HTTP effimero: dodici risposte gzip sintetiche
interrotte, stream nativi distrutti e cleanup. Nessuna richiesta all'app personale,
al DB o a provider; non è una prova di esaurimento memoria dell'intera API.

### Replay con API candele reale e dati sintetici

`full/replay-fixture.mjs prepare` rifiuta un warehouse EURUSD già popolato,
applica il solo DDL0035 esistente al DB audit e inserisce4.320 M1 dichiarate
sintetiche. `AUDIT_CANDLE_WAREHOUSE=1 node scripts/verify-real-runtime/restart-api.mjs`
abilita il warehouse solo nell'API isolata. `full/candle-runtime.mjs <etichetta>`
prova input, pagine SQL, OHLC osservato e metadata; `full/replay-save.mjs`
prova concorrenza, rollback e ricevute con identità locali effimere. Quest'ultimo
elimina un account con ID sintetico non Clerk: la DELETE Clerk Development
può restituire404, senza coinvolgere un utente reale.

`full/replay-restart.mjs prepare`, vero riavvio API, quindi `resume` prova la
ricevuta durevole. `full/browser-replay-runtime.mjs <etichetta>` usa Clerk
Development, le candele SQL e salvataggi reali; i guasti HTTP dichiarati sono
prima del commit o dopo un vero commit. La seconda prova richiede che il retry
restituisca lo stesso trade. Comprende grafico, ordini pendenti/cancellazione,
impostazioni, focus/tastiera, PNG e mobile. Terminare con
`full/replay-fixture.mjs cleanup` e riavviare l'audit senza il flag warehouse.
Non avviare contemporaneamente altri fault test sullo store o importazioni.
