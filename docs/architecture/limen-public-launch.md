# LIMEN — lancio pubblico

Implementazione del percorso italiano: introduzione gratuita → candidatura → ammissione → pagamento verificato → Protocollo. Le richieste scuole sono raccolte separatamente; questa versione non attiva spazi scuola o contratti automaticamente.

## Configurazione e attivazione

1. Applicare la migrazione `0048_limen_launch` con il normale processo di migrazione, prima di avviare il nuovo backend. La migrazione conserva gli ID, i progressi e la pubblicazione delle lezioni esistenti, mantenendole riservate al Protocollo. Non modifica gli abbonamenti. Sono aggiunti quattro slot introduttivi e tre libri recuperati dai componenti originali, tutti come bozze riservate da verificare.
2. Impostare `LIMEN_OWNER_USER_ID` con l'ID Clerk del proprietario. Lo stesso account deve essere admin attivo, tramite ruoli DB o bootstrap esistente. Il permesso `content.publish` di altri amministratori **non** consente di gestire la formazione LIMEN. Senza proprietario configurato la scrittura è negata.
3. Configurare `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_STREAM_API_TOKEN` (permesso Stream, solo backend) e `CLOUDFLARE_STREAM_CUSTOMER_HOST` nel formato `customer-….cloudflarestream.com`, senza protocollo. I nuovi video richiedono URL firmati. Il browser carica direttamente tramite TUS e non riceve il token API.
4. Configurare `RESEND_API_KEY`, `EMAIL_FROM` con dominio verificato e `APP_BASE_URL` HTTPS con il dominio effettivamente usato dall'app. Non è stato cambiato il dominio. Verificare il recapito su una casella reale prima di aprire le registrazioni. Il worker parte con lo scheduler esistente: deve essere abilitato il lavoro in background.
5. Aprire `/academy?tab=teacher` con l'account proprietario. Rivedere i libri importati; completare libro introduttivo, Capitolo 0, prima e seconda lezione con esercizio. Per i quattro slot scegliere accesso **Gratuito** e pubblicare solo quando pronti. Le altre lezioni restano **Protocollo**. I video sono registrati dal docente; le scalette e gli slot vuoti non sono lezioni fruibili.
6. Configurare Stripe secondo il billing Academy esistente: prezzo live EUR 150/mese, imposte incluse, webhook e `ACADEMY_SALES_ENABLED=true`. Le vendite rimangono disabilitate finché non sono pubblicati i quattro slot gratuiti e almeno una lezione riservata. Il catalogo pubblicato deve corrispondere a quanto promesso agli allievi.
7. Eseguire `pnpm launch:check` nell'ambiente configurato. Il controllo legge configurazione, catalogo, video e prezzo senza inviare email, creare checkout o migrare dati. Non sostituisce la verifica del recapito, dei contenuti e del flusso Stripe in modalità test.

Questa implementazione non effettua deploy, acquisti di servizi o invii verso scuole. Le credenziali e i video non vengono inventati o inseriti nei file di esempio.

## Formazione e accessi

- `/academy?tab=introduction`: percorso in quattro passaggi, completamento derivato dai progressi persistenti.
- `/academy?tab=codex`: Biblioteca LIMEN; `/academy?tab=sandbox`: Laboratorio LIMEN. Le sezioni usano lo stesso catalogo server.
- `/academy?tab=course`: Protocollo e gestione del rinnovo; `/academy?tab=teacher`: contenuti e consegne per il proprietario.
- `/protocollo` e `/sandbox` sono ingressi compatibili: per i visitatori mostrano il lancio; gli utenti autenticati vengono indirizzati al catalogo protetto. I vecchi componenti e testi originali restano nel sorgente come riferimento e non sono usati come fonte di accessi.
- Registrazione dalla landing: `/sign-up?academy=1`, verifica tramite Clerk, destinazione introduzione. La lingua dei contenuti è dichiarata italiana, anche sulle altre URL linguistiche.
- Nuovi campi delle lezioni: `accessLevel` (`free`/`protocol`), `contentKind` (`book`/`lesson`), `introductionSlot`, `streamVideoId`. Le scritture vengono validate sul record completo. I libri richiedono testo; le lezioni pubblicate richiedono un video. Un video gestito deve risultare pronto presso Stream prima del salvataggio.
- Catalogo e risposte private usano `private, no-store`. Il catalogo contiene solo metadati, senza testo, URL video o risposte di altri utenti. Lezioni e progressi sono autorizzati sul server. Gli utenti gratuiti possono salvare esercizi e completamenti; il feedback richiede un abbonamento attivo.
- Una consegna settimanale per allievo, settimana lunedì–domenica Europe/Rome. La prenotazione settimanale resta anche dopo la modifica dell'esercizio: cancellare la risposta non libera una seconda consegna. È possibile correggere la consegna della stessa lezione. Feedback entro cinque giorni lavorativi è l'impegno operativo del docente, non un invio automatico generato dall'app.
- `POST /api/academy/videos/upload`: solo proprietario, crea upload TUS; `GET /api/academy/videos/:id`: stato e anteprima solo proprietario; `GET /api/academy/lessons/:id/playback`: firma la riproduzione dopo nuova autorizzazione.
- I token video durano al massimo tre ore, per coprire registrazioni fino a due ore senza riavvii periodici. Per il Protocollo scadono comunque entro il periodo pagato. Una revoca impedisce nuovi token; quelli già emessi rimangono validi fino alla loro scadenza. Il pulsante per rinnovare l'accesso richiede nuovamente l'autorizzazione server. Il video precedente rimane associato finché il nuovo non viene confermato e la lezione salvata.

## Candidature e scuole

- `POST /api/candidate-applications`: UUID di richiesta, nome, email, contatto e questionario. Non accetta più `trial_1_day`. Retry della stessa richiesta non creano nuove candidature o ricevute. Il codice mostrato è quello persistito, non un valore generato nel browser.
- `/admin/candidature`: valutazione e ammissione. L'ammissione riserva il posto e accoda l'invito, senza creare override manuali o accessi pagati. Le ammissioni sono serializzate nel DB; il limite iniziale di 25 include posti riservati e abbonati attivi. Il checkout richiede un'ammissione associata all'email dell'identità autenticata.
- I posti ammessi non vengono liberati dal normale cambio stato: per il primo gruppo restano riservati. Nessuna disponibilità pubblica viene inventata partendo dal solo numero di candidature.
- `POST /api/school-requests`: scuola, referente, email, iscritti attuali, ingressi mensili e necessità, con UUID per retry. `/admin/scuole` permette lettura, stato e note secondo i permessi admin esistenti.
- Offerta scuole: setup con accessi concordati per sei mesi e quota per i nuovi ingressi. Importi e rinnovi sono nel preventivo privato; il tuo Protocollo e feedback sono separati. Isolamento degli spazi, caricamenti dei partner e inviti saranno una successiva fase, da completare prima di attivare una scuola.

## Email e osservabilità

La coda `launch_emails` è scritta nella stessa transazione di candidatura, ammissione o richiesta scuola. Il benvenuto è deduplicato per account e coordinato con `email_lifecycle_state`: il vecchio lifecycle delega il benvenuto alla stessa coda. Al primo accesso il backend recupera l'email verificata da Clerk se non esiste ancora una copia locale; il browser non può imporre l'indirizzo del benvenuto.

Ogni minuto il worker estrae gli invii con lock `SKIP LOCKED`, applica una chiave di idempotenza Resend stabile e registra il risultato. Gli errori hanno attese crescenti. Dopo 12 tentativi, oppure quando si esce dalla finestra prudenziale di 23 ore, l'invio passa a `needs_review`: verificare presso Resend prima di inviare nuovamente, per evitare duplicati oltre la conservazione dell'idempotenza. Gli invii non vengono dichiarati recapitati dal solo salvataggio del modulo.

Il registro dei 100 invii più recenti è disponibile in `/admin/scuole` per chi ha permesso audit. La cancellazione account rimuove anche richieste e email personali collegate. Eventi analytics: CTA gratuita, primo contenuto, completamento introduzione, candidatura, richiesta scuole e attivazione dopo conferma backend; restano soggetti al consenso analytics esistente. L'evento registrazione è quello già gestito dall'app.

## Verifiche ripetibili

- `pnpm verify`: gate generale del workspace.
- `pnpm --filter @workspace/scripts exec tsx verify-limen-launch/browser.mjs`: interfaccia con fixture locali, servizi esterni intercettati; screenshot in `artifacts.local/limen-launch/`.
- `artifacts/api-server/scripts/verify-limen-launch.ts`: integrazione su cluster PostgreSQL **isolato**, porta 55449, database `limen_launch`, con tutte le migrazioni applicate prima dell'esecuzione. Non usare il database personale. Verifica autorizzazioni, quote, concorrenza, revoca, ricevute e retry; Stream e Resend sono simulati.

Le prove automatiche non certificano email realmente recapitate o pagamenti live: queste verifiche operative richiedono la configurazione dei servizi prima del lancio.
