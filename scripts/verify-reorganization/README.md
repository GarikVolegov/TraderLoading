# Verifica della riorganizzazione

Questi controlli usano l'ambiente isolato di `scripts/verify-real-runtime/`,
con API di produzione locale su `127.0.0.1:3002` e database `tl_audit_<numero>`.
Richiedono i marker già creati in `.local-logs/`; non inizializzano né migrano
il database personale.

```sh
node scripts/verify-reorganization/api-permissions.mjs
```

Il runner crea cinque utenti sintetici e contenuti temporanei, verifica 14 casi
Free/Pro, livelli editoriali, proprietà e accesso ai canali privati/pagati.
Elimina esclusivamente le proprie fixture. Il risultato viene scritto in
`artifacts.local/reorganization/api-permissions.json`, escluso dal repository.
L'entitlement di pagamento è una fixture server: non esegue transazioni Stripe.

Per verificare manualmente l'isolamento delle conversazioni con un account Clerk
sintetico già autenticato e con chiavi chat inizializzate:

```sh
node scripts/verify-reorganization/social-fixtures.mjs prepare <ID_ACCOUNT_SINTETICO>
```

Il runner crea due contatti temporanei, un messaggio cifrato distinto per contatto
e una community privata con due canali testo. Le chiavi private dei contatti
rimangono solo in memoria. I riferimenti sono in
`.local-logs/reorganization-social-fixtures.json`. Nel browser provare una bozza
senza inviarla, cambio contatto/canale, refresh e Indietro/Avanti.

Al termine rimuovere le fixture:

```sh
node scripts/verify-reorganization/social-fixtures.mjs cleanup
```

Il cleanup verifica database, prefisso e proprietario e rimuove esclusivamente
i dati dei contatti/community creati dal runner. Non avvia chiamate, registra
audio, invia messaggi o modifica le chiavi dell'account autenticato.

Per la verifica visiva manuale con account sintetico autenticato:

```sh
node scripts/verify-reorganization/install-viewport-preview.mjs
```

L'API di audit conserva uno snapshot immutabile del frontend: una nuova build non
aggiorna lo snapshot già in uso. Per controllare la build appena verificata senza
riavviare l'API, avviare un frontend temporaneo limitato all'interfaccia locale:

```sh
PORT=4174 VITE_API_BASE=http://127.0.0.1:3002 pnpm --filter @workspace/trader-dashboard exec vite preview --host 127.0.0.1 --strictPort
```

Aprire `http://127.0.0.1:4174/reorganization-preview-mobile.html` nel browser di
test. Una sola iframe della stessa origine mostra l'app a **375 × 500 CSS px**;
i collegamenti esterni cambiano la sua destinazione. La pagina desktop usa
1100 × 760 CSS px. Il proxy `/api` usa esclusivamente l'API isolata; i controlli
di autenticazione e autorizzazione del server rimangono attivi.
Sono file temporanei nel build output ignorato: la build successiva li rimuove.
L'anteprima non simula tastiera, safe area o permessi di un dispositivo reale.
Chiudere il server temporaneo al termine delle prove.

Il controllo `artifacts/trader-dashboard/src/design-contrast.test.ts` misura i
token della palette predefinita, risolvendo gli alias e componendo gli sfondi
traslucidi dei pulsanti. Verifica 31 coppie su superfici condivise; non certifica
foto di sfondo personalizzate, opacità aggiunte dalle singole viste o tutta l'app.

Gate completo: `pnpm verify`. La build autenticata richiede la chiave pubblica
Clerk locale; non caricare tutte le integrazioni di `.env.local` nei test.
