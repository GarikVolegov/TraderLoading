# Piano di implementazione — Audit completo TraderLoadings (verso l'app perfetta)

> Prodotto da un audit a sciame multi-agente (2026-07-04/05) su **tutti i 22 sottosistemi**.
> **229 finding** (7 critici · 65 alti · 105 medi · 52 bassi) + **48 idee innovative** su 4 lenti
> (AI-native, gap competitivo, psicologia/community, quant/dati). Ogni finding ha evidenza `file:line`.
>
> Questo documento è il piano operativo a step, ordinato per priorità. Le fasi 0–1 sono **bloccanti per il
> lancio** (sicurezza, integrità dati, correttezza finanziaria). Le fasi 2–4 portano l'app da "buona" a
> "perfetta nei dettagli". La fase 5 è la roadmap di innovazione.

## Come leggere il piano

- Ogni **step** è un'unità di lavoro con: file coinvolti, cosa fare, e **criterio di verifica** (il gate verde).
- Sigle: `[C]` critico · `[H]` alto · `[M]` medio · `[L]` basso.
- Metodo consigliato (coerente con Superpowers del progetto): per ogni step → `test-driven-development`
  (scrivi prima il test che fallisce), poi implementazione, poi `pnpm verify`, poi commit atomico con scope.
- Molti finding sono **confermati da più agenti indipendenti** (segnati "⋆ multi-conferma"): priorità alta.

---

## FASE 0 — Sicurezza & integrità dati (BLOCCANTE, pre-lancio)

Falle che espongono dati altrui, permettono abuso/exploit, o perdono valore reale (XP/Pro/NFT/soldi).
Nessun lancio pubblico prima di chiudere questa fase.

### 0.1 [H] ⋆ Chiudere l'accesso ai file privati serviti senza autenticazione
**Confermato da 3 aree** (security-auth, archive-wiki, social-chat). Oggi `/api/uploads/{wiki,chat-files,voice}`
è servito da `express.static` dietro il solo `publicUploadGuard`, che valida solo estensione/percorso — **nessun
controllo di ownership**. URL enumerabili (userId Clerk + `Date.now()` + slug del nome file).
- File: `artifacts/api-server/src/app.ts:107-116`, `lib/security.ts:288-305`, `services/wikiStorage.ts:224`,
  route modello già corretta in `routes/community.ts:674-700`.
- **Step:**
  1. Rimuovere `wiki`, `chat-files`, `voice` da `ALLOWED_UPLOAD_DIRS` del guard pubblico.
  2. Aggiungere route autenticate dedicate che verificano ownership/partecipazione prima di `sendFile`/stream:
     - `/uploads/wiki/:key` → `wikiSourcesTable.userId === getUserId(req)`.
     - `/uploads/chat-files/:f` e `/uploads/voice/:f` → richiedente è mittente o destinatario del messaggio.
  3. In alternativa scalabile: URL S3/R2 **firmate a scadenza**.
- **Verifica:** test che un utente A riceve 403 su un file di B; il file legittimo resta accessibile al proprietario.

### 0.2 [C/H] ⋆ E2EE reale (o rimuovere il claim) + hardening chat
**Critico** (social-chat) + alto (security-auth): la chiave **privata** ECDH è archiviata **in chiaro** sul
server (`user_e2ee_key_backups.private_key_jwk` = `text`), inviata sempre all'init; derivazione HKDF
deterministica con salt fisso → chiunque acceda al DB decifra **tutti** i DM presenti e passati. La UI mostra
il lucchetto "E2EE".
- File: `lib/db/src/schema/chat.ts:39-48`, `routes/chat.ts:117-168`, `hooks/useE2EEKeys.ts:32`, `lib/e2ee.ts:227-238`.
- **Step:**
  1. **Non caricare mai la chiave privata in chiaro.** Se serve backup cross-device: cifrarla lato client con
     chiave derivata (Argon2/PBKDF2 + AES-GCM) da una passphrase/recovery-code scelta dall'utente; il server
     riceve solo il blob wrapped. Altrimenti: chiavi per-device con flusso di recupero esplicito.
  2. **Bug perdita cronologia (H, social-chat):** in `e2ee.ts:158-195` distinguere "nessun backup" (null) da
     "caricamento fallito" (eccezione). Su eccezione **fallire chiuso**: mai rigenerare/sovrascrivere il backup.
  3. **Media chat non cifrati (H):** cifrare i byte dell'allegato lato client con la shared key prima
     dell'upload, oppure servirli via route autenticata (vedi 0.1).
  4. Se non si implementa E2EE reale a breve: **rimuovere la dicitura "E2EE"** e documentare "cifratura at-rest
     con chiavi in custodia del server".
- **Verifica:** il server non può derivare la shared key da soli dati DB; test del ramo "load throw" che non
  sovrascrive; media non scaricabile senza auth.

### 0.3 [H] SSRF nell'ingestione URL dell'archivio
`fetchUrlText()` valida solo il protocollo, poi fa fetch server-side verso host arbitrario con
`redirect:'follow'`: raggiungibile `169.254.169.254` (metadata cloud), `localhost:3001`, reti interne 10/172/192.
- File: `services/wikiProcessor.ts:256-278`, `routes/wiki.ts:123-149`.
- **Step:** risolvere il DNS e rifiutare IP privati/loopback/link-local (`127/8,10/8,172.16/12,192.168/16,169.254/16,::1,fc00::/7`);
  `redirect:'manual'` con ri-validazione ad ogni hop; allowlist schemi/porte.
- **Verifica:** test che `http://169.254.169.254/...` e un redirect verso IP interno vengano bloccati.

### 0.4 [H] WebRTC signaling senza controllo di relazione
`POST /social/calls/signal` accetta un `to` arbitrario e inoltra `type`/`data` senza validazione né mutual-follow
(mentre i DM lo richiedono): spam di chiamate in arrivo + canale dati occulto verso chiunque.
- File: `routes/social.ts:586-598` (vs `routes/chat.ts:249-253`), `components/social/MessaggiTab.tsx:493-501`.
- **Step:** `areMutualFollowers(from,to)` prima di `pushSignal`; allowlist `type ∈ {offer,answer,ice,hangup}`;
  cap dimensione `data`; rate-limit per mittente.
- **Verifica:** segnale verso un non-amico → 403; `type` fuori allowlist → 400.

### 0.5 [C/H] Community: gerarchia ruoli + privacy reale
**Critico:** chi ha `roles.manage` si auto-promuove a owner (nessuna gerarchia; può editare il ruolo Admin o
assegnarselo; ban/kick/mute proteggono solo il `creatorId`). **Alto:** le community "private" non lo sono
(`isPublic` filtra solo la discovery; detail/join/messaggi aperti a chiunque conosca l'id `serial`).
- File: `routes/communityRoles.ts:87-107,188-211`, `services/communityPermissions.ts:42-48`,
  `routes/communityModeration.ts:29-32,116-119`, `routes/community.ts:61-70,158-252`, `schema/community.ts:3-9`.
- **Step:**
  1. Introdurre `position`/rank sui ruoli: un attore modifica/assegna solo ruoli di posizione **inferiore** alla
     propria e non concede permessi che non possiede; blocco su ruolo Admin auto-seed; ban/kick/mute/role-change
     solo verso rank inferiori.
  2. Gate `isPublic` su detail/join/lettura messaggi per i non-membri; per le private, inviti/richieste con
     approvazione. In alternativa rimuovere l'illusione di privacy.
- **Verifica:** test di escalation (roles.manage non ottiene community.manage); non-membro su community privata → 403.

### 0.6 [C/H] ⋆ Chiudere il farming di XP
**Critico:** `DELETE /missions/reset-today` senza guardia (anche non-auth) → ciclo `complete → reset → complete`
= XP illimitato. **Alto:** `xpReward` senza clamp server-side (template a 1_000_000). **Alto:** TOCTOU sul
complete (UPDATE non condizionale) + XP read-modify-write non atomico.
- File: `routes/missions.ts:65-72,107-131`, `routes/mission-templates.ts:23-79`, `routes/profile.ts:336`.
- **Step:**
  1. Rimuovere/limitare a dev-admin `reset-today` (env-gated).
  2. Validare `xpReward` con Zod + clamp (es. 1..100) in POST/PUT template.
  3. `UPDATE ... WHERE id=? AND completed=false RETURNING` (0 righe → 400); XP con `sql\`xp + ${reward}\``;
     complete+XP+streak in transazione.
  4. (Opz.) ledger award per `(userId, templateId, giorno)` per idempotenza.
- **Verifica:** test che reset+recompletamento non aumenta XP; due complete concorrenti accreditano una volta sola.

### 0.7 [H] DoS Monte Carlo
**Confermato 2 volte** (api-architecture, market-data). `/tools/montecarlo` è pubblico (non nel productionAuthGate)
e `numTrades` non è cappato: `numTrades=5e7` blocca l'event loop del servizio singolo Railway per minuti.
- File: `routes/tools.ts:40-57,105,148-151`, `middlewares/productionAuthGate.ts:11-23`.
- **Step:** clamp `numTrades ≤ 1000`, `simCount ≤ 200` (già), validare/limitare `riskPercent/initialBalance/avgR/lossR`
  → 400 fuori range; valutare `/tools` dietro auth in produzione + rate-limit dedicato ai calcoli pesanti.
- **Verifica:** `numTrades` enorme → 400 immediato; l'event loop non si blocca.

### 0.8 [C] ⋆ Cancellazione account completa (GDPR)
**Confermato 2 volte** (database, archive-wiki). `deleteLocalAccountData` dimentica intere famiglie di tabelle
con dati personali: `wiki_*` (l'informativa promette esplicitamente la cancellazione dell'archivio),
`testimonials` (recensione pubblica col nome reale resta online), `review_prompt_state`, `support_*`,
`tournament_*` (display_name/avatar/wallet), `community_roles/bans/mutes/reviews/review_reports`,
`admin_user_subscriptions` (stripe_customer_id).
- File: `services/accountDeletion.ts:94-187` (+ disclosure `:42-49`), `schema/wiki.ts`, `schema/tornei.ts:57-63`, `schema/marketing.ts`.
- **Step:**
  1. Estendere la transazione con i DELETE mancanti (ordine FK: `wiki_ingest_jobs→wiki_sources→wiki_folders`; ecc.).
  2. Iterare gli `storageKey` wiki per rimuovere i file su disco/S3.
  3. Per l'albo d'oro tornei: DELETE **oppure** anonimizzare `display_name/avatar`.
  4. **Test statico anti-regressione:** confronta l'elenco delle tabelle con colonna `user_id` nello schema con
     quelle coperte dalla cancellazione → fallisce se ne compare una nuova non gestita.
- **Verifica:** dopo delete account, nessuna riga con quell'userId in tutte le tabelle personali; file storage rimossi.

### 0.9 [C/H] Tornei: chiudere le manipolazioni della classifica
**Due critici + due alti.**
- **[C] Attività zero premiata:** iscriversi senza fare nulla dà `disciplineIndex=100` → tier finish (500 XP + NFT)
  e disc (1000 XP + 1 mese Pro); con <10 iscritti anche top10 (2500 XP + 3 mesi Pro). File:
  `services/tornei/tradeMapping.ts:47`, `prizes.ts:31-44`, `standings.ts:56-79`, `store.ts:119-158`.
  → Soglia attività minima (`trades ≥ N` e/o `rCum ≠ 0`) come precondizione di **qualsiasi** tier;
  `disciplineIndexFor` neutro/escluso senza trade.
- **[C] Cherry-picking:** cancellare l'entry di diario di un trade perdente (`onDelete:"set null"`) lo rende
  non-journaled → esce da `rCum` **e** dalla DQ −10R. File: `tradeMapping.ts:41`, `standings.ts:39-53`,
  `schema/account.ts:27`, `routes/journal.ts:544-563`.
  → Non basare l'idoneità sul link mutabile: contare i trade chiusi del conto (o flag immutabile "in-torneo"
     congelato all'iscrizione); DQ su **tutti** i trade chiusi della finestra.
- **[H] Conti demo contano:** `hasSyncedRealAccount = synced!==null` non verifica l'ambiente; i deal `source:"demo"`
  finiscono in `account_trades`. File: `eligibility.ts:5,16`, `store.ts:64-73,128-142`, `demoConnector.ts:126,137`.
  → Persistere environment live/demo su `account_trades`; escludere demo in eligibility + materializeStandings.
- **Verifica:** iscritto a zero attività non riceve premi; loser cancellato dal diario resta in rCum/DQ; conti demo esclusi.

### 0.10 [H] Tornei: settle atomico + mint sicuro
- **[H] Settle non transazionale** (⋆ database + tornei): crash tra insert-premio (`onConflictDoNothing` marker)
  e side-effect (XP/Pro/certificato) → premio "assegnato" ma mai erogato, irreversibile. `status` esiste ma
  sempre 'granted'. File: `services/tornei/settle.ts:66-137`, `schema/tornei.ts:87`.
  → Avvolgere ogni award in `db.transaction`, **oppure** macchina a stati `pending→granted` con ripresa dei parziali.
- **[H] Double-mint race:** `POST /tornei/certificates/:id/claim` legge→check→`pending`→`mint()` senza lock/CAS →
  due click = due `safeMint` on-chain (gas reale). File: `routes/tornei.ts:288-341`, `mint/onchain.ts:37-39`.
  → Update condizionale atomico `SET mintStatus='pending' WHERE id=? AND mintStatus IN ('claimable','failed') RETURNING`;
     mint solo se ha toccato una riga; idempotency key lato provider.
- **[H] Certificati 'pending' orfani:** il settle marca 'pending' ma non conia mai, e la UI disabilita il claim su
  'pending' → vicolo cieco. File: `settle.ts:151,163`, `components/tornei/CertModal.tsx:107`.
  → O il settle lascia 'claimable', o un worker concia i pending; la UI deve permettere retry di 'pending'.
- **Verifica:** kill del processo a metà settle → riesecuzione completa l'erogazione; doppio claim concorrente → un solo mint.

### 0.11 [C] BrokerHub: active profile per-utente (bug multi-tenant)
`activeProfileId` è **globale** (unica riga `store_key='default'`): quando l'utente B collega il suo conto,
l'utente A al reload vede `activeProfileId=null` → nessun polling → dashboard "Nessun conto" a saldi zero.
Ogni "Connetti" ruba il puntatore, in ping-pong.
- File: `services/brokerHub/databaseProfileStore.ts:26-43`, `profileStore.ts:14-17,321-330`, `runtime.ts:219`,
  `routes/brokers.ts:791-806`.
- **Step:** rendere l'active profile per-utente (mappa `userId→profileId` nel JSONB, `activateProfile(userId,id)`),
  oppure eliminare il concetto lato server e far scegliere al client il primo profilo owned `connected`.
- **Verifica:** test multi-utente — due utenti collegano conti diversi, entrambi vedono il proprio.

---

## FASE 1 — Correttezza dei dati finanziari

Bug che producono numeri **sbagliati** su metriche che il trader usa per decidere. Alta priorità: minano la
credibilità del prodotto (un coach/journal che mente non serve).

### 1.1 [H] ⋆ Commissioni e swap nelle metriche del coach
Edge/discipline/riskGuard usano il **profit lordo**: `loadClosedEdgeTrades` non seleziona `commission`/`swap` (già
in DB). Conseguenze: lo stesso trade è "win" nell'edge (lordo) e "loss" nel diario (netto); il guard cash confronta
`maxDailyLoss` contro una perdita sottostimata → **falso negativo** (non scatta quando dovrebbe).
- File: `services/edgeData.ts:16-24`, `brokerHub/accountDataSync.ts:39,159-161`, `tradeAnalytics.ts:247-263`, `riskGuard.ts:126-129`.
- **Step:** selezionare `commission/swap` e passare alle analytics un P&L **netto** (`profit+commission+swap`) per:
  segno R, classificazione win/loss, netProfit, profit factor, `daily_loss_cash`.
- **Verifica:** test scalper con costi — coach e diario concordano sul win/loss; il guard cash scatta col netto.

### 1.2 [H] R-multiple con stop=0
`rMultiple` non verifica `stopLoss>0`: i trade MT4/MT5 senza stop arrivano con `stopLoss=0` → `riskDistance=|entry|`
→ R fasulla ≈0.0009 che inquina expectancy e stop-discipline. Il client scarta `price==0` → server e client divergono.
- File: `tradeAnalytics.ts:115-119`, `fxBlueConnector.ts:89,230,309`, `accountDataSync.ts:19-21`, `lib/parseTradeContent.ts:60-63`.
- **Step:** trattare `stopLoss<=0` (o `entry===stop`) come "nessuno stop" → `null`, allineato al client (o
  normalizzare a null in `loadClosedEdgeTrades`/`accountDataSync`). Test con stop=0.
- **Verifica:** un trade senza stop non entra in `tradesWithR`; stessa R su server e client.

### 1.3 [M] Coerenza fuso orario nel coach
`riskGuard`/`journalRecapPeriods` usano Europe/Rome; overtrading/day-of-week/session e il filtro periodo del recap
usano UTC → stessi trade attribuiti a giorni/settimane diversi (off-by-one attorno a mezzanotte per un europeo).
- File: `riskGuard.ts:93`, `journalRecapPeriods.ts:12`, `tradeDiscipline.ts:109-113`, `tradeAnalytics.ts:130-144`, `journalRecapDraft.ts:39-45`.
- **Step:** centralizzare il bucketing giorno/settimana/sessione su un fuso unico (idealmente per-utente, minimo Europe/Rome ovunque).
- **Verifica:** un trade notturno cade nello stesso "giorno" per guard, discipline e recap.

### 1.4 [M] Recap AI nella lingua dell'utente
`RECAP_SYSTEM_PROMPT` forza output in italiano e numeri `it-IT`, senza parametro lingua → EN/FR/DE/ES ricevono il
recap in italiano (le push riskGuard invece sono già localizzate). Rischia anche il gate i18n.
- File: `journalRecapDraft.ts:118-123,70`, `routes/journal.ts:484-488`, `riskGuardPush.ts:104-111` (pattern corretto).
- **Step:** passare `getUserNotificationLanguage(userId)` a `buildRecapMessages`; parametrizzare system prompt + locale numerico.
- **Verifica:** recap generato in EN per un utente EN.

### 1.5 [H] Billing: fine periodo, webhook morti, dispute/refund
- **[H] `currentPeriodEnd` sempre null:** legge `subscription.current_period_end`, che nell'API pinnata
  `2026-05-27.dahlia` è migrato su `SubscriptionItem` → sempre `undefined` → null in DB → data rinnovo "non
  disponibile" ovunque e `isProSubscription` scadenza mai valutata. File: `routes/billing.ts:157,171`, `lib/billing.ts:37`.
  → usare `subscription.items.data[0].current_period_end`.
- **[H] Handler invoice codice morto:** `invoice.subscription` non esiste più (migrato in
  `invoice.parent.subscription_details.subscription`) → `payment_failed/succeeded` non fanno nulla. File: `billing.ts:472-481`.
  → leggere il nuovo path, o rimuovere i rami affidandosi a `customer.subscription.updated`.
- **[H] Nessuna gestione dispute/refund:** un chargeback/refund non cancella l'abbonamento Stripe → Pro resta attivo.
  File: `billing.ts:458-482`, `lib/billing.ts:33-39`.
  → handler `charge.dispute.created`/`charge.refunded` (+ `customer.subscription.paused`) che revocano l'entitlement.
- **Verifica:** test con shape Stripe reale (items.data[0]) → `currentPeriodEnd` persistito; dispute → Pro revocato.

### 1.6 [H] Backtest: pip corretti + costi di transazione
- **[H] Moltiplicatore pip fisso ×10000:** sbagliato per JPY(×100)/oro(×10)/indici(×1)/crypto(×1); la modalità
  manuale e quella grafico danno numeri incoerenti per lo stesso strumento. File: `lib/backtestTradeResult.ts:21`,
  `pages/Backtest.tsx:187-201`, `components/ChartReplay.tsx:89-96` (già corretto).
  → estrarre `getPipMultiplier(symbol)` in `lib/pipMultiplier.ts` condiviso da form manuale e ChartReplay.
- **[H] Nessun spread/commissioni/slippage:** replay a prezzo mid, fill esatto a SL/TP anche in gap → risultati
  sistematicamente ottimistici. File: `ChartReplay.tsx:566,593,683-704`.
  → spread per-simbolo su entry/exit, commissione per lotto, fill gap-aware (open peggiore quando la candela apre oltre il livello).
- **Verifica:** pips di un trade JPY corretti; una strategia con costi mostra expectancy inferiore al mid.

---

## FASE 2 — Robustezza & operatività

Resilienza, degrado pulito, osservabilità. Ciò che tiene l'app in piedi in produzione e permette di accorgersi
quando qualcosa si rompe.

### 2.1 [H] ⋆ Timeout e resilienza sulle chiamate broker
**Confermato 2 volte** (api-architecture, broker-hub). I connettori (FX Blue, MetaAPI, SnapTrade) fanno fetch
**senza `AbortSignal.timeout`** → un provider lento appende la sync/richiesta fino a ~5 min (default undici).
Inoltre la health del profilo non degrada mai a `error`/`stale` quando il broker è down.
- File: `brokerHub/fxBlueConnector.ts:431-437`, `metaApiProvider.ts:269,281`, `snapTradeProvider.ts:181`, `runtime.ts:156-167`.
- **Step:** `AbortSignal.timeout(10-15s)` su tutte le fetch (o via `lib/httpRetry.ts`); backoff esponenziale
  sull'autoSync dopo errori (10s→30s→2m, cap 10m); health `error`/`stale` dopo N failure + "Ultimo aggiornamento X min fa" in UI.
- **Verifica:** provider che non risponde → richiesta chiude in ≤15s, chip profilo passa a stale.

### 2.2 [H] BrokerHub: cache snapshot + import fuori dal read-path
Ogni lettura snapshot/history rifà il fetch FX Blue completo (`orderlist limit=999999`) e re-importa **tutti** i
deal (SELECT+UPDATE per ognuno); client polla ogni 10s + autoSync 10s mai fermato → ~1000+ scritture/10s per utente,
6-9 fetch a fxblue.com/10s (rischio ban), refresh tornei ad ogni ciclo. Il WS broker esiste ma il frontend non lo usa.
- File: `runtime.ts:97,169-192,279-307`, `accountDataSync.ts:138-199,240-247`, `useBrokerHub.ts:97-113`.
- **Step:** cache SWR TTL 60-120s sullo snapshot (come volatility/watchlist); import solo nell'autoSync; skip UPDATE
  se il deal non è cambiato (hash/closedAt/profit); import solo ticket nuovi/modificati; fermare autoSync dopo N cicli
  senza lettori o usare il WS esistente per push.
- **Verifica:** N letture consecutive → 1 fetch upstream; nessun UPDATE su deal invariati.

### 2.3 [H] ⋆ NewsHub: cadenza sana + SWR reale + errori visibili
**Confermato 3 volte** (news-macro ×2, observability). Il runtime chiama `refresh({force:true})` **ogni 60s, 24/7**
anche con zero utenti → ~14 fetch RSS + fino a 90 chiamate a translate.googleapis.com + 2 LLM + scrittura Neon,
~1440 rebuild/giorno (rischio ban IP, quota LLM bruciata). Inoltre `GET /api/news` **non** è SWR reale: il primo
utente dopo la scadenza paga il rebuild inline (~35-40s). E il refresh periodico ingoia ogni errore (`catch(()=>undefined)`).
- File: `index.ts:160`, `newsHub/runtime.ts:117-123,85-99`, `runtimeSingleton.ts:5-11`, `routes/news.ts:897-941`.
- **Step:**
  1. Allineare il cron alla finestra snapshot (`NEWS_SNAPSHOT_FRESH_MS`, ~10 min) o passare `force:false`; tick
     "live" leggero solo RSS senza traduzioni/LLM se serve freschezza.
  2. SWR reale: servire subito lo snapshot esistente (anche scaduto) e ricostruire in background con lock per-chiave.
  3. Nel catch: `logger.warn({err})` + `captureError(err,{surface:'background',job:'news-refresh'})` con dedup.
- **Verifica:** con zero utenti nessun rebuild LLM al minuto; `GET /api/news` risponde <1s da snapshot; un feed rotto genera un evento Sentry.

### 2.4 [H] Market data: "Live" onesto, copertura pair, fallback intraday Railway
- **[H] Prezzi congelati fino a 6h ma badge "Live":** watchlist/volatility servono dalla cache D1 (TTL 6h) mentre
  UI dice "Live" e non mostra timestamp. File: `services/candles.ts:91,142-147,489-497`, `routes/tools.ts:318`.
  → TTL differenziato per la finestra "latest" (2-5 min con fonte veloce) o aggiornare solo l'ultima candela con
    una quote leggera; mostrare `item.time`; spegnere "Live" oltre soglia d'età.
- **[H] Metà catalogo senza fonte:** ~44 pair nel catalogo, solo 20 mappati → preferiti (CADJPY, EURAUD…) resi "—"
  per sempre in un widget "Live". File: `pair-catalog/src/index.ts:8-57`, `candles.ts:8-18,107-111`, `tradingViewWatchlist.ts:7`.
  → estendere le mappe simbolo (Dukascopy lowercase, TwelveData `CAD/JPY`); nel frattempo hint "non disponibile" invece del trattino muto.
- **[H] Intraday FX Railway = solo Yahoo (IP-bloccato) senza TwelveData:** replay M5-H4 inutilizzabile in prod
  senza key. File: `candles.ts:20-23,34-37,318-324,358-370`.
  → fallback Dukascopy M1 + `aggregateInterval` dietro SWR/warm; o accelerare seed+`CANDLE_WAREHOUSE`.
- **Verifica:** watchlist mostra età reale e aggiorna l'ultima barra in minuti; pair esotici popolati o etichettati; replay intraday FX funziona senza TwelveData.

### 2.5 [H] Infra: risolvere le contraddizioni di deploy
- **[H] Guard Redis fa crashare il boot documentato:** `assertRedisConfigured()` lancia se `NODE_ENV=production` &&
  `REDIS_URL` vuoto, ma `.env.railway.example` e CLAUDE.md dicono "Redis opzionale su singola istanza" con `REDIS_URL=`
  → crash-loop (`restartPolicyType=ALWAYS`). File: `index.ts:36`, `redisClient.ts:23-28`, `.env.railway.example:14,72`.
  → guard non-fatale su singola istanza (warn dietro `EXPECTED_REPLICAS`), **oppure** rendere `REDIS_URL` obbligatorio nel template+doc.
- **[H] Solo wiki su object-store; il resto su disco effimero:** avatar/journal/community/chat/voice su disco locale
  → spariscono ad ogni redeploy senza Volume. File: `settings.ts:162-169`, `journal.ts:71-90`, `social.ts:17/52/477`, `community.ts:20-24`.
  → chiarire che il Volume è obbligatorio, **o** estendere l'astrazione storage a tutti gli upload, + warning al boot se `UPLOADS_DIR` non è persistente.
- **[H] Nessun backup/restore DB Neon né rollback migrazioni:** forward-only, `preDeploy db:migrate` senza snapshot.
  → documentare/verificare PITR/branch Neon (o `pg_dump` schedulato via GitHub Action→R2), definire RPO/RTO, runbook di rollback.
- **Verifica:** deploy col template pulito parte senza crash; un redeploy non perde gli avatar; runbook di restore provato.

### 2.6 [H] Observability: rendere visibili i fallimenti
- **[H] Sentry frontend senza source map:** `sourcemap:false`, nessun `@sentry/vite-plugin` → stack trace prod
  illeggibili. File: `vite.config.ts:75`, `lib/observability.ts`. → `sourcemap:'hidden'` + upload source map con lo stesso `release`.
- **[H] Cron critici non riportano a Sentry:** torneiScheduler/push/broker-sync solo `console.error` (settleSeason
  tocca XP/Pro/mint!). File: `cron/torneiScheduler.ts:74-84`, `push.ts:277-279`, `brokerHub/runtime.ts:158`.
  → helper `reportJobError(err,{job})` = `logger.error` + `captureError`, usato ovunque (priorità settleSeason).
- **[H] Sentry backend senza scrub PII/segreti:** il logger redige `Authorization`/token, Sentry no → segreti in
  chiaro verso terzi. File: `lib/observability.ts:22-27`, `index.ts:131-135`. → `beforeSend` con la stessa lista di scrubbing.
- **[H] `/readyz` non controlla Redis:** obbligatorio in prod ma non verificato → resta "ok" con Redis down. File:
  `routes/health.ts`, `redisClient.ts`. → check Redis (PING con timeout) + stato `degraded`.
- **Verifica:** un errore prod ha stack leggibile; un cron fallito appare in Sentry; nessun token negli eventi; `/readyz` = degraded con Redis giù.

### 2.7 [H] Frontend: resilienza sessione e deploy
- **[H] Chunk stantii dopo deploy:** route lazy senza gestione `vite:preloadError` → navigazione crolla su
  "Something went wrong" (schermata full-screen EN) ad ogni deploy. File: `App.tsx:49`, `main.tsx:9`, `RootErrorBoundary.tsx:20`.
  → listener `vite:preloadError` con reload once-per-session (guard sessionStorage) + retry sugli import lazy; error boundary attorno all'AppRouter che tiene viva la nav.
- **[H] Nessuna gestione 401/sessione scaduta + retry globale off:** al risveglio dallo sleep con cookie scaduto i
  widget restano rotti; sessione revocata → swap brusco alla landing senza messaggio. File: `App.tsx:80-91,429-436`,
  `apiFetch.ts:36-40`, `custom-fetch.ts:313`.
  → retry intelligente (non su 4xx), `refetchOnWindowFocus:true`, su 401 un retry con token fresco o toast "Sessione scaduta" + redirect a /sign-in.
- **Verifica:** deploy con SPA aperta → nav a route nuova ricarica invece di crashare; cookie scaduto → refetch al focus recupera i widget.

### 2.8 [M] API: errori uniformi e validazione
- **[M] ZodError → 500 invece di 400:** input malformato produce 500 + rumore Sentry. File: `routes/journal.ts:318`,
  `profile.ts:202`, `app.ts:155-162`. → error middleware che mappa ZodError a 400 (escluso da captureError).
- **[M] Shape errori non uniforme + messaggi persi:** `apiJSON` scarta il body `{error}` (tutti gli off-contract
  vedono solo lo status). File: `admin.ts:904`, `community.ts:359`, `lib/apiFetch.ts:36-38`. → standardizzare `{error}`; far leggere ad `apiJSON` il body come `apiFetch`.
- **[M] Validazione assente sugli off-contract** (`req.body as`): schemi Zod leggeri con clamp. File: `tools.ts:49,1632`, `wiki.ts:50`, `settings.ts:194`.
- **[M] Paginazione feed social:** `/social/feed` e `/social/stories` con `limit(50)` fisso senza cursore. File: `social.ts:347,379`. → cursore come community/chat.
- **Verifica:** body invalido → 400 con dettagli; UI off-contract mostra il messaggio reale; feed scorre oltre 50.

### 2.9 [H/M] Database: integrità referenziale e indici
- **[H] Righe orfane** (⋆ database + community): delete community/canale/post non pulisce
  messaggi/file(disco)/reviews/reports/voice_presence/likes/comments (nessuna FK). File: `community.ts:716-721,320`,
  `social.ts:293`, `schema/community.ts`. → FK `ON DELETE CASCADE` o delete espliciti in transazione + unlink file.
- **[M] Indici mancanti** su `ideas/checklist_items/quotes/checkins` (widget molto pollati, seq scan). File: `schema/extras.ts`.
  → migrazione con indici `(user_id, …)`.
- **[M] Audit trail moderazione assente:** nessun log di ban/kick/delete/role-change. → tabella append-only `community_moderation_log`.
- **Verifica:** delete community → zero orfani; EXPLAIN usa gli indici; ogni azione mod è tracciata.

---

## FASE 3 — UX, i18n, mobile, accessibilità, design

Il salto da "buona" a "perfetta nei minimi dettagli": ciò che l'utente percepisce come cura.

### 3.1 [H] ⋆ i18n: chiudere il debito e blindare il gate
**Confermato 2 volte** (frontend-core, i18n-a11y). ~343 chiavi `auto.ui.*` hanno il testo **italiano** in tutte e 5
le lingue; copy hardcoded fuori da `t()` su superfici reali (LoadingScreen, widget dashboard, News, account-bridge,
PairOnboardingScreen — **primo schermo obbligatorio**, PairSelectionModal, LanguageSettings, PinSettings…). Il gate
`production-copy.static.test.ts` ha un buco strutturale (regex single-line, ignora JSX multi-linea, ternari, template literal).
- File: `lib/i18n/dict.en.ts:385,611`, `LoadingScreen.tsx:5`, `Dashboard.tsx:76`, `PairOnboardingScreen.tsx`, `PairSelectionModal.tsx`, `production-copy.static.test.ts:130-132`.
- **Step:**
  1. Passata di traduzione batch sulle 343 chiavi identiche it/en (script diff `dict.it` vs `dict.en`).
  2. Migrare i literal hardcoded a `t()`/`uiText()` con valori nelle 5 lingue, priorità onboarding/settings/modali.
  3. **Riparare il gate:** normalizzare newline prima del match (o parser JSX/AST tipo `i18next/no-literal-string`),
     intercettare i ternari `{…}` e i backtick; aggiungere un test che fallisce se una chiave = italiano in >N lingue.
- **Verifica:** un utente EN non trova italiano su onboarding/settings/dashboard; il gate cattura un literal JSX multi-linea.

### 3.2 [H/M] Design system: allineare le superfici fuori standard
- **[H] Tornei = design system legacy autonomo** (verde/navy) invece di jade/graphite: `tornei.css` ridefinisce
  tutto con palette pre-redesign + decine di `hsl(142…)` inline. File: `components/tornei/tornei.css:8,14,37,137-141,356-367` + componenti tornei.
  → rimappare i token scoped sui globali (`--accent-jade`/`--success`, `--surface-*`, `--radius`, `--font-mono`, `--ease-glass`); segmented control → `Tabs`.
- **[H] Form Clerk ancora verde #22c55e + navy** accanto al pannello brand jade (prima schermata utente). File: `App.tsx:129-165,373-397`, `AuthPageShell.tsx`.
  → `clerkAppearance` sui valori del sistema (colorPrimary `#51a488`, superfici da token); stessi valori a RootErrorBoundary e clerk-key-error.
- **Verifica:** navigando a /tornei e alla schermata di login la palette è jade/graphite coerente col resto.

### 3.3 [H] Mobile & PWA: raggiungibilità, notifiche, notch
- **[H] Sezioni irraggiungibili su mobile:** la bottom bar mostra 5 voci; Tornei/News/Milestones/Library ecc. solo
  in sidebar desktop o CommandPalette (apribile solo con Cmd+K). File: `BottomNav.tsx:233,251-290`, `TopNav.tsx`, `CommandPalette.tsx:44-46`.
  → voce "Altro" nella bottom bar che apre uno `sheet` con tutte le rotte (primitivo già presente).
- **[H] Promemoria/macro/goal non arrivano ad app chiusa:** solo `setTimeout` in-tab, ma la UI promette "anche ad app
  chiusa". File: `DailyAlarmNotifier.tsx:25-42`, `MacroNotifier.tsx:44-64`, `GoalReminders.tsx:30`, `routes/push.ts`.
  → scheduler server che emette push reali (dailyReminderTime già in settings; calendario macro già server), o correggere la copy.
- **[H] Notch iOS PWA:** `viewport-fit=cover` + `black-translucent` ma nessun `safe-area-inset-top` → TopNav sotto la
  status bar. File: `index.html:5,109`, `TopNav.tsx:26`. → token `--safe-top: env(safe-area-inset-top)` come padding.
- **Verifica:** su iPhone installato tutte le rotte sono raggiungibili al tocco, la TopNav non è coperta, un reminder arriva ad app chiusa.

### 3.4 [H] Accessibilità dei modali
~15 overlay custom (fixed inset-0 + portal) senza focus-trap, Escape, `role=dialog`/`aria-modal`, ritorno del focus
(WCAG 2.4.3). Il più critico è `ReviewPromptModal`, montato globalmente e aperto in auto dopo 1.5s.
- File: `components/ui/modal.tsx:15-69`, `ReviewPromptModal.tsx:71-124`, modali social (CreatePost/Community/Channel), `PairSelectionModal.tsx`.
- **Step:** migrare su `components/ui/dialog.tsx` (Radix, già a norma), o hook condiviso `useDialogA11y`
  (focus-trap + Escape + aria + restore focus) applicato a partire da ReviewPromptModal e dai modali della community.
- **Verifica:** tastiera/screen reader — il focus resta nel modale, Escape chiude, il focus torna al trigger.

### 3.5 [M] Coach anche per il journaling manuale
Tutto il coach legge da `accountTradesTable` (solo broker sync); il modale manuale cattura solo titolo/note/esito →
chi fa journaling a mano vede overview, expectancy, disciplina ed equity **vuoti**, benché il prodotto prometta
"trading journal con coach".
- File: `JournalEntryModal.tsx:279-283`, `edgeData.ts:15-27`, `journal/JournalOverview.tsx:50-56`.
- **Step:** campi strutturati opzionali (symbol/direzione/entry/stop/exit/volume) → persistere una riga trade
  equivalente (o estendere l'edge a leggere le entry manuali parsabili).
- **Verifica:** una voce manuale con prezzi alimenta KPI/edge/equity.

### 3.6 [M/L] Community: chiudere il loop di moderazione lato prodotto
`DELETE /community/messages/:id` esiste ma la chat non ha pulsante delete; nessun "segnala messaggio"/utente
(solo recensioni). File: `communityModeration.ts:156-184`, `social/TextChannelView.tsx:178-240`.
- **Step:** menu contestuale delete (per `messages.moderate` o autore) + report messaggi (endpoint + tabella + coda), riusando lo schema report recensioni.
- **Verifica:** un moderatore cancella un messaggio dalla UI; un membro può segnalarlo.

---

## FASE 4 — Growth & testing

### 4.1 [H] Ciclo email di lifecycle
Resend è **già configurato** (`services/email/*`) ma usato solo per i ticket: nessuna welcome, digest, riattivazione.
La leva di retention più grande, inutilizzata.
- File: `services/email/ticketEmails.ts`, `emailCopy.ts`, `emailLayout.ts`.
- **Step:** (1) welcome al primo sign-up; (2) digest settimanale opt-out (recap edge+discipline già in `edgeReport.ts`,
  missioni, standing tornei) via node-cron; (3) win-back per inattivi da N giorni. Riusare `emailLayout` + estendere
  `EmailCopy` nei 5 lingue, dietro `isEmailConfigured()`.
- **Verifica:** un nuovo utente riceve la welcome; il cron invia il digest a chi non ha opt-out.

### 4.2 [H] Referral / inviti
Nessun referral in tutto il codice, benché il prodotto sia social/community/tornei. Il footer usa `/sign-up` come
"community" placeholder.
- **Step:** codice/link per utente, attribuzione al sign-up (Clerk metadata o tabella), reward idempotente
  (XP o giorni Pro interni riusando `proEntitlement` dei tornei) all'attivazione dell'invitato; card "Invita e guadagna".
- **Verifica:** un invito accettato accredita il reward una sola volta.

### 4.3 [H] Analytics di prodotto + conversione sign-up
`trackEvent` esiste ma non è **mai** chiamato (solo `sign_up`) → nessuna telemetria del funnel. E la conversione
`sign_up` è sotto-contata (finestra 15 min + consenso cookie + reload): nel caso tipico non viene mai registrata.
- File: `lib/analytics.ts:13,46,55-71`, `SignUpConversionTracker.tsx:18`, `CookieConsentPopup.tsx:19-23`.
- **Step:** strumentare gli eventi chiave (pair_selected, tutorial_completed/skipped, broker_connected, first_journal_entry,
  first_backtest, pro_upgrade, review_prompt); su accettazione cookie ri-chiamare `trackSignUpConversion` (o allargare la finestra).
- **Verifica:** GA4 riceve gli eventi del funnel; la conversione parte anche accettando i cookie dopo 15 min.

### 4.4 [H] Testing: coprire i percorsi critici davvero
- **[H] Nessun test d'integrazione DB:** CI senza Postgres; le migrazioni non vengono mai applicate; l'SQL Drizzle
  non è mai eseguito. File: `.github/workflows/ci.yml`, `scripts/local/dbMigrations.test.ts:20-49`.
  → job CI `services: postgres:16` (+ redis) che applica `db:migrate` e fa round-trip sulle route critiche.
- **[H] Autorizzazioni community non testate** (focus attivo, security-sensitive): solo gli helper puri sono coperti,
  non `requirePermission`/`getMemberContext`. → test end-to-end (403 senza permesso, ban/mute, owner bypass, escalation).
- **[H] 76/85 test "static" sono grep del sorgente, non comportamento:** nessun render React. → `@testing-library/react`
  + jsdom sui componenti core (widget, modali, gate Pro, form); mantenere lo stile static solo per invarianti reali.
- **Verifica:** una migrazione con errore di sintassi fa fallire la CI; un bug di permesso community rompe un test.

---

## FASE 5 — Roadmap innovazione (48 idee, selezione ad alto impatto)

Idee ancorate agli asset già presenti (candle warehouse M1, trade reali multi-broker, coach edge/discipline,
llmClient, news LLM, community/tornei/chat). Ordinate per rapporto impatto/effort. Da pianificare dopo le fasi 0–2.

### 5A — AI-native (il coach che pensa)
- **Pre-mortem AI all'ingresso** *(trasformativo/medio)* — l'avvocato del diavolo prima del click, sui tuoi pattern storici. *Sfrutta:* trade storici, coach, llmClient.
- **Tilt detection in tempo reale** *(trasformativo/medio)* — dai dati broker + mood, aggancio a riskGuard/push. *Sfrutta:* accountTrades, riskGuard, mood journal.
- **Coach conversazionale sul diario (RAG)** *(alto/grande)* — chat sui tuoi trade reali (pgvector riattivabile). *Sfrutta:* journal, llmClient, embeddings.
- **Screener semantico news per le TUE coppie/posizioni** *(alto/medio)* — rilevanza personalizzata. *Sfrutta:* newsHub LLM, posizioni aperte.
- **Journaling da screenshot con vision** *(medio/piccolo)* — auto-compilazione a zero attrito. *Sfrutta:* JournalEntryModal, vision.

### 5B — Quant & dati (l'edge misurato)
- **Monte Carlo bootstrap sull'equity reale** *(alto/piccolo)* — risk-of-ruin dai tuoi R veri, non parametri a mano. *Sfrutta:* rMultiple, scaffolding /tools/montecarlo.
- **Edge decay: expectancy rolling** *(alto/piccolo)* — quando un setup smette di funzionare, con sparkline. *Sfrutta:* rMultiple, componente Sparkline watchlist.
- **Intervalli di confidenza sull'edge** *(alto/piccolo)* — "il tuo edge è statisticamente reale?" (Wilson/bootstrap). *Sfrutta:* tradeAnalytics, JournalOverview.
- **Kelly / optimal-f dal proprio edge** *(alto/piccolo)* — sizing suggerito vs attuale. *Sfrutta:* edge overall, maxDailyLoss, riskGuard.
- **Matrice di correlazione del portafoglio aperto** *(trasformativo/medio)* — concentration risk (long EURUSD+GBPUSD = doppio short USD). *Sfrutta:* warehouse D1, posizioni aperte.
- **Regime detection trend/range × edge** *(alto/medio)* — "+0.4R in trend, −0.2R in range". *Sfrutta:* warehouse D1, breakdown coach.
- **MAE/MFE per trade** *(alto/grande)* — stop troppo stretti / profitti lasciati sul tavolo, da candele M1. *Sfrutta:* warehouse M1, tradeDiscipline.
- **Slippage & qualità esecuzione multi-broker** *(trasformativo/grande)* — "broker X ti costa 0.15R a trade". *Sfrutta:* warehouse M1, fill reali multi-broker.

### 5C — Psicologia & community (la disciplina come prodotto)
- **Circuit-breaker sociale (salvagente)** *(trasformativo/medio)* — un buddy viene avvisato quando vai in tilt. *Sfrutta:* riskGuard, chat, friends.
- **Lega di Disciplina** *(trasformativo/medio)* — classifica sul comportamento, non sul profitto. *Sfrutta:* tradeDiscipline, tornei.
- **Modalità Recupero: detox dopo le perdite** *(trasformativo/medio)* — guardrail rinforzati + rituali. *Sfrutta:* riskGuard, zen, checkins.
- **Compagno di Disciplina (accountability matching)** *(alto/grande)* — matching per profilo complementare. *Sfrutta:* community, profili.
- **Rituale d'ingresso** *(alto/medio)* — check-in + respiro + checklist in un unico gate. *Sfrutta:* checkins, checklist, zen.

### 5D — Gap competitivo (parità col mercato)
- **Track record pubblico verificato** *(trasformativo/medio)* — badge "Verificato" dai trade broker reali. *Sfrutta:* accountTrades, publicStats.
- **Report performance PDF via email** *(alto/medio)* — settimanale/mensile. *Sfrutta:* edgeReport, email lifecycle (4.1).
- **Import universale CSV / statement** *(alto/medio)* — MT4/MT5/cTrader/XLSX per chi non sincronizza. *Sfrutta:* parseTradeContent, account schema.
- **Equity curve / drawdown / distribuzione R canoniche lato server** *(alto/piccolo)* — endpoint riusabili. *Sfrutta:* tradeAnalytics.
- **Card/replay annotato condivisibile** *(alto/medio)* — link pubblico. *Sfrutta:* ChartReplay, chartAnalysis.
- **Widget embeddabili + API pubblica read-only** *(medio–alto)* — badge track record/equity, chiavi API. *Sfrutta:* publicStats, contratto.

---

## Sequenza consigliata & gate

1. **Sprint sicurezza (Fase 0):** in ordine 0.1 → 0.11. Ogni item con test di regression; `pnpm verify` verde
   prima del commit; `git push` a fine item (regola del progetto). Alla fine: security review sul branch.
2. **Sprint correttezza (Fase 1):** 1.1–1.6, con test numerici (i finding coach/billing/backtest sono tutti verificabili con fixture).
3. **Fase 2** (robustezza) e **Fase 3** (UX/i18n/mobile/a11y) sono parallelizzabili tra più agenti/persone (aree disgiunte).
4. **Fase 4** (growth/testing) — la 4.4 (testing DB+community) andrebbe anticipata perché rende sicure tutte le altre.
5. **Fase 5** — pianificare come feature a sé (brainstorming → writing-plans) una volta stabilizzate 0–2.

> **Nota sui test i18n (gate del progetto):** ogni nuova copy va aggiunta in tutte e 5 le lingue (vedi
> `i18n-enforced-new-ui`); evitare i caratteri vietati dal test mojibake. La riparazione del gate (3.1) va fatta
> **prima** della grande passata di traduzione, così le nuove chiavi restano coperte.
