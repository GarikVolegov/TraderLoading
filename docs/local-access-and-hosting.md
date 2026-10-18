# Accesso locale e alternative a Railway

Aggiornato il 1 ottobre 2026. L'applicazione non richiede Railway per funzionare
sul Mac: servono il frontend, il backend, PostgreSQL e una connessione Internet per
Clerk e i provider di mercato.

## Avvio su questo Mac

```sh
pnpm start:local
```

Oppure VS Code → Esegui e debug → **App: start local stack**.
Il comando carica `.env.local`, riavvia il cluster Postgres.app esistente su 55432,
avvia API su 3001 e frontend su 5173. Ora riutilizza lo schema senza `push-force`
e controlla anche su macOS se le porte sono già occupate.

Aprire **http://localhost:5173/sign-in**. L'avvio separato del frontend in VS Code
ora usa `scripts/local/startFrontendDev.ts`, che carica le variabili della radice:
il semplice comando Vite, dalla cartella dell'app, non le caricava automaticamente.

Il database PostgreSQL rimane acceso quando si termina il frontend/backend. Per
fermare il cluster locale quando nessun servizio lo usa, si può usare Postgres.app
o `pg_ctl stop` indicando il suo data directory; non eliminare `postmaster.pid`.

### Login

La configurazione locale presente usa un'istanza Clerk Development, con entrambe
le chiavi `pk_test`/`sk_test`. La produzione usa un'altra istanza con dominio
`clerk.traderloading.com`. Le due istanze hanno utenti separati; avere un account
sul sito non garantisce di averlo anche nell'ambiente locale.

Se compare “account non trovato”, usare la registrazione nell'istanza Development
oppure verificare gli utenti Development nel pannello Clerk. Se il browser mostra
un errore diverso, conservare il testo esatto: il caricamento corretto del modulo
non dimostra che l'accesso personale sia riuscito. Non è stato creato né modificato
alcun account per la verifica e non è stato introdotto un bypass dell'autenticazione.

Fonti: [ambienti Clerk](https://clerk.com/docs/guides/development/managing-environments),
[chiavi di produzione in locale](https://clerk.com/docs/guides/development/troubleshooting/using-production-keys-in-development).

Verifica eseguita: `/api/healthz` e `/api/readyz` rispondono 200, con database
disponibile; `/sign-in` mostra Google/email/password nel browser reale, senza
eccezioni JavaScript. Schermata locale: `.local-logs/local-sign-in.png`.
L'accesso con le credenziali personali rimane da confermare dall'utente.

Verifiche del codice: `pnpm verify` superato (387 file di test, TypeScript e build;
prerender marketing escluso con `SKIP_PRERENDER=1`), `pnpm lint:ci` superato con
0 errori e 34 warning preesistenti. Log: `.local-logs/local-access-verify.log` e
`.local-logs/local-access-lint.log`.

Il 1 ottobre sono state ripristinate le due tabelle mancanti del supporto e i loro
indici usando il DDL esistente 0013, dopo la prova su un database isolato. Nessuna
riga personale è stata modificata. Avvio e debug continuano a riutilizzare lo schema
senza forzarlo. Dettagli e nuove prove con autenticazione/backend reali:
[audit del 1 ottobre](audit/local-runtime-2026-10-01.md).

## Quale hosting scegliere

**Per questa fase consiglio di continuare in locale.** Non aggiunge un abbonamento
hosting e permette di consolidare i flussi prima di ripubblicarli. Il Mac deve
rimanere acceso durante l'utilizzo; non è una pubblicazione online e non offre
accesso remoto automatico.

| Soluzione | Impiego adatto | Limiti per TraderLoading |
| --- | --- | --- |
| Mac locale | Sviluppo e utilizzo personale durante la correzione dei bug | Disponibile mentre il Mac e i servizi sono accesi; Clerk/provider richiedono Internet |
| Render Free + Postgres esterno, ad esempio Neon | Anteprima online a costo hosting iniziale nullo, entro le quote | Render sospende il servizio dopo 15 minuti senza traffico; riattivazione circa un minuto. I cron si fermano durante la sospensione e il disco non conserva upload |
| VPS Linux a pagamento | Centro operativo online con processi sempre attivi | Gestione aggiornamenti, TLS, backup, spazio disco e monitoraggio; costo del server più eventuali extra |

Render sconsiglia le istanze gratuite per produzione; inoltre il suo Postgres Free
scade dopo 30 giorni. Non lo sceglierei per conservare il diario. Neon dispone di
un piano Free con limiti di storage/compute/traffico da confrontare con il warehouse
di candele e gli utenti effettivi. Il backend attuale usa WebSocket e cron: pubblicare
soltanto il frontend statico non sostituisce Railway.

Fonti: [limiti Render Free](https://render.com/docs/free),
[quote Neon Free](https://github.com/neondatabase/website/blob/main/content/faqs/free-plan-limits-and-quotas.md).

Come ordine di grandezza per un VPS, la tabella Hetzner corrente indica CX23 in
Europa a **€5,49/mese prima delle imposte**, con risorse/capacità da verificare per
il carico reale; IPv4, backup e altri servizi possono aggiungere costi.
È una possibile base per uso personale, non una garanzia di capacità dell'app.
Fonte: [listino aggiornato Hetzner](https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/).

## Passaggi per tornare online senza Railway

1. Verificare dove sono oggi il database di produzione e gli upload. Il repository
   descrive Neon come database, ma non è stato verificato l'account remoto. La
   cessazione di Railway non equivale necessariamente alla perdita del database;
   recuperare anche eventuali file conservati su un volume Railway.
2. Scegliere anteprima gratuita oppure servizio sempre attivo. Conservare il database
   esistente se accessibile; fare backup prima di ogni migrazione. Nessun `push-force`.
3. Compilare frontend e backend nello stesso servizio Node. I comandi attuali
   `pnpm build:railway` e `pnpm start:railway`, nonostante il nome, non dipendono da
   Railway e possono essere riutilizzati dopo installazione/codegen. Impostare
   `FRONTEND_DIST_DIR`, le variabili del database e le chiavi Clerk corrette.
4. Configurare storage persistente per gli upload e DNS/HTTPS. Per conservare gli
   utenti di produzione mantenere l'istanza Clerk di produzione e un dominio adatto;
   non utilizzare direttamente le chiavi live su un dominio casuale di anteprima.
5. Verificare accesso, API, WebSocket, cron e ripristino da backup prima del cambio
   DNS definitivo. Gli script `deploy/oracle`/Compose sono una base già presente,
   ma non sono stati validati né distribuiti su un nuovo VPS in questo intervento.

Nessun hosting è stato acquistato o pubblicato e nessun DNS è stato modificato.
La scelta del servizio e il budget restano necessari prima di una migrazione reale.

## Altra configurazione emersa all'avvio

Il provider LLM delle news restituisce 404 per il modello gratuito configurato,
indicando che non è più disponibile gratuitamente. È una configurazione da aggiornare,
distinta dal login. Non è stato sostituito automaticamente con il modello a pagamento.
