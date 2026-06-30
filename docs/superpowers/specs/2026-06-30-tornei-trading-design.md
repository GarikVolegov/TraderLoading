# Tornei di trading — gara disciplinata globale

**Data:** 2026-06-30
**Stato:** design approvato
**Branch:** `feat/community-management` (branch multi-feature condiviso — vedi nota coordinamento in §12)
**Sorgente design:** Claude Design — progetto "TraderLoading Design System", template `templates/tornei/`
(`Tornei.dc.html`, `data.js`, `support.js`).

## 1. Cosa stiamo costruendo

Una nuova sezione **Tornei**: una gara *disciplinata* globale tra i trader della
piattaforma. Stagioni trimestrali che ripartono il **7 di ogni mese** ("ciclo del 7"),
classifica **live su R cumulato** (con metrica alternativa **Disciplina = R × Indice
Disciplina**), **divisioni/leghe** (Bronzo/Argento/Oro/Diamante), guardrail con
squalifica, **due viste lobby** (Arena = classifica, Percorso = il tuo cammino), e
premi a fine stagione: **XP + mesi Pro + certificato NFT** coniato on-chain, più
**Albo d'oro** delle stagioni concluse.

Il requisito esplicito dell'utente: *"assicurati che sia tutto funzionale ed
efficiente"* → backend reale (non UI statica), classifica **materializzata** (no
calcolo per-request), premi assegnati automaticamente, conio NFT **realmente
on-chain quando l'infrastruttura è configurata**.

### Decisioni di scope (confermate dall'utente)

| Tema | Decisione |
|---|---|
| Certificato NFT | **On-chain reale (ERC-721)** dietro astrazione `MintProvider`; degrada a `claimable` in DB se infra non configurata |
| Assegnazione premi | **Automatica** incl. Pro (Pro via entitlement interno, **no** addebito Stripe) |
| Scope iterazione 1 | **Core funzionale completo** (Arena + Percorso + divisioni + guardrail/DQ + premi + Albo d'oro + cron rollover) |
| Idoneità/privacy | **Opt-in** con consenso, **richiede conto reale sincronizzato**, board **pseudonima** (solo nickname/avatar pubblico) |
| Chain | **Base** (L2 EVM, gas bassi) |
| Wallet | Indirizzo **fornito dall'utente**; conio differito (claim) se assente |

## 2. Riuso dell'esistente (niente reinvenzione)

| Serve | Esiste già |
|---|---|
| R-multiple per trade | `services/tradeAnalytics.ts` → `rMultiple(trade)` su `accountTradesTable` |
| Indice Disciplina / leak comportamentali | `services/tradeDiscipline.ts` |
| Guardrail / circuit breaker | `services/riskGuard.ts` (daily-R, drawdown, streak) |
| XP / livelli / streak | `profileTable` (`xp`,`level`,`streak`) + `computeLevel`/`getLevelName` (`routes/profile.ts`) |
| Certificati (pattern DB) | `levelCertificatesTable` + `awardLevelCertificate` (`routes/milestones.ts`) |
| Entitlement Pro (no Stripe) | `adminUserSubscriptionsTable` (`source`,`manualOverride`,`currentPeriodEnd`); `lib/billing.ts` con `BillingFeature` che **include già `"leaderboard"`** |
| Cron pattern | `cotScheduler` (node-cron) in `routes/tools.ts` |
| Conto reale sincronizzato | BrokerHub / FX Blue → `accountTradesTable` |

I servizi `tradeAnalytics`/`tradeDiscipline`/`riskGuard` sono usati come **funzioni
pure** che producono i numeri; i Tornei non li modificano.

## 3. Architettura

Nuovo dominio **isolato** `tornei`, parallelo a `community` (non intrecciato):

```
artifacts/api-server/src/
  routes/tornei.ts                 REST on-contract + azioni
  services/tornei/
    seasons.ts                     lifecycle stagioni + rollover (puro + IO)
    standings.ts                   calcolo classifica + guardrail/DQ + divisioni (puro)
    enrollment.ts                  iscrizione/consenso/idoneità
    prizes.ts                      qualificazione tier + assegnazione (XP/Pro/cert)
    mint/
      provider.ts                  interfaccia MintProvider + factory (config-gated)
      onchain.ts                   impl ethers su Base (attiva solo con env TORNEI_MINT_*)
      fake.ts                      impl in-memory per i test
  cron/torneiScheduler.ts          refresh standings + rollover "ciclo del 7"
```

```
artifacts/trader-dashboard/src/
  pages/Tornei.tsx                 route /tornei
  components/tornei/
    ArenaView.tsx  PercorsoView.tsx
    SeasonBanner.tsx  Podium.tsx  Leaderboard.tsx  DqList.tsx
    Prizes.tsx  Rules.tsx  HallOfFame.tsx  NftCertificate.tsx  CertModal.tsx
```

Le standings sono **materializzate**: gli endpoint di lettura leggono righe
pre-calcolate, non aggregano `accountTradesTable` a runtime.

## 4. Modello dati (nuova migration hand-authored `0017_tornei.sql`)

> Le migration sono hand-authored dal 0003+; **non** lanciare `db:generate`. Schema
> Drizzle in `lib/db/src/schema/tornei.ts`, esportato da `schema/index.ts`.
> L'ultima migration in questo tree è `0016`; il `0017` "account_trades idx" vive su
> un worktree separato (`feat/scalability-hardening`) non ancora mergiato — **ri-verificare
> il numero libero al momento dell'implementazione** ed eventualmente rinumerare per
> evitare collisioni (vedi §12).

- **`tournament_seasons`** — `id`, `slug` (es. `2025-q3`), `label` ("Q3 2025"),
  `startsAt`, `endsAt`, `status` (`upcoming|live|ended`), `settledAt` (null finché
  non liquidata).
- **`tournament_enrollments`** — `seasonId`, `userId`, `accountId` (conto reale
  sync), `enrolledAt` (**inizio conteggio R**), `consentAt`. Unique `(seasonId,userId)`.
- **`tournament_standings`** (materializzata) — `seasonId`, `userId`, `displayName`,
  `avatarUrl`, `rCum`, `discIndex` (0-100), `score`, `division`
  (`bronzo|argento|oro|diamante`), `rank`, `prevRank`, `trades`, `streak`,
  `dq` (bool), `dqReason`, `updatedAt`. **Indice `(seasonId, score desc)`** +
  `(seasonId, userId)` unique.
- **`tournament_prizes`** — `seasonId`, `userId`, `tier`
  (`champ|podium|top10|disc|finish`), `xpAwarded`, `proMonths`, `certificateId`,
  `status` (`granted|partial|failed`), `grantedAt`. Unique `(seasonId,userId,tier)`
  (idempotenza).
- **`tournament_certificates`** — riusa lo stile di `levelCertificatesTable`:
  `seasonId`, `seasonLabel`, `userId`, `userName`, `avatarUrl`, `tier`, `edition`
  (es. "Ed. 1 / 1"), `rarity`, `mintStatus` (`claimable|pending|minted|failed`),
  `walletAddress`, `chain`, `contractAddress`, `tokenId`, `txHash`, `mintedAt`,
  `lastError`.

Indirizzo wallet utente: campo `walletAddress` su `profileTable` (riusa il profilo,
niente tabella nuova) + validazione formato EVM (`0x` + 40 hex).

## 5. Classifica efficiente (il cuore "efficiente")

Nessun calcolo aggregato per-request. La materializzazione avviene in `standings.ts`:

1. **Sorgente:** per la stagione `live`, per ogni iscritto, i `accountTradesTable`
   del suo `accountId` **chiusi** con `closeTime >= enrolledAt` e `< season.endsAt`.
2. **Filtri guardrail (gara disciplinata):**
   - trade con **rischio > 2%** del conto → **non conteggiato**;
   - solo trade **registrati a Diario con checklist completa** contano (flag
     esistente sul trade/diario);
   - **−10R cumulati** nella stagione → utente `dq=true`, `dqReason` = "Drawdown −10R superato".
3. **Metriche:** `rCum = Σ rMultiple` (dei trade validi); `discIndex` da
   `tradeDiscipline`; `score` = `rCum` se ordinamento "R", `rCum × discIndex/100`
   se "Disciplina".
4. **Divisione:** per fasce di `score` (Bronzo ≥0, Argento ≥18, Oro ≥30,
   Diamante ≥45 — soglie dal `data.js` del design, centralizzate in una costante).
5. **Rank/prevRank:** ordinati per `score desc`; `prevRank` dal valore precedente in
   tabella (per le frecce su/giù di movimento).
6. **Upsert** in `tournament_standings`.

**Trigger del refresh:**
- cron ogni **~3–5 min** sulla stagione `live`;
- on-demand (debounced) dopo un **sync conto** di un iscritto (hook nel flusso
  BrokerHub esistente), così la propria riga è fresca senza ricalcolare tutti.

**Letture:** `GET /tornei/standings` ritorna top N + la riga "TU" + alcuni vicini,
da un singolo indice. Scala a migliaia di iscritti.

## 6. Stagioni & rollover ("ciclo del 7")

Cron **giornaliero** in `torneiScheduler.ts`, idempotente (guardia su `settledAt` e
su `status`):

- se esiste una stagione `live` con `endsAt <= now` → `status = ended`, **congela**
  le standings, esegue `prizes.settleSeason()` (§7), imposta `settledAt`;
- promuove la stagione `upcoming` la cui finestra è iniziata → `live`;
- se non esiste una `upcoming` per il prossimo ciclo → la **crea** (slug/label/finestra
  calcolati dal "ciclo del 7": trimestre che parte il 7 del mese d'avvio).

Stati UI dal design: **In arrivo** (niente classifica, CTA "Prenota il posto"),
**In corso** (board live + countdown), **Concluso** (board congelata + "Conclusa il …").

## 7. Premi — assegnazione automatica a fine stagione

`prizes.settleSeason(seasonId)` (idempotente, dentro transazione, loggato in
`admin_audit_logs`):

Tier e ricompense (dal `data.js` del design):

| Tier | Qualificazione | XP | Pro | Certificato |
|---|---|---|---|---|
| `champ` | 1° in classifica | — | 12 mesi | Champion (Ed. 1/1) |
| `podium` | 2°–3° | — | 6 mesi | Podio (Ed. 1/2) |
| `top10` | Top 10 | 2.500 | 3 mesi | — |
| `disc` | Indice Disciplina ≥ 80 tutta la stagione (max 50 trader per discIndex) | 1.000 | 1 mese | — |
| `finish` | Disciplina ≥ 60, 0 guardrail superati | 500 | — | Finisher (Open Edition) |

> I valori XP/mesi sono centralizzati in una costante `TORNEI_PRIZE_TIERS` (tunabili
> senza toccare la logica). Un trader può qualificarsi a più tier (es. `champ` +
> `top10` + `disc`): i premi si **cumulano**, ognuno con la sua riga idempotente.

- **XP:** incrementa `profileTable.xp` (riusa il sistema esistente, ricalcola livello).
- **Pro:** **estende l'entitlement interno** — upsert `adminUserSubscriptionsTable`
  con `plan="pro"`, `source="tornei"`, `manualOverride=true`,
  `currentPeriodEnd = max(now, currentPeriodEnd) + N mesi`,
  `reason="Torneo <label> – <tier>"`. **Nessun** checkout/charge Stripe.
- **Certificato:** crea `tournament_certificates` con `mintStatus`:
  `pending` se wallet presente **e** `MintProvider` configurato (conio accodato),
  altrimenti `claimable`.

Tutto registrato in `tournament_prizes` (unique `(season,user,tier)` ⇒ ri-esecuzione
sicura). Pannello **admin di sola lettura** (`/admin` esistente) per ispezionare gli
esiti e i mint falliti.

## 8. Certificato NFT — integrazione on-chain

- **Astrazione `MintProvider`** (`mint/provider.ts`):
  `mint({ certificate, toAddress }) → { txHash, tokenId } | throws`.
  Factory sceglie l'impl in base a env:
  - `onchain.ts` (ethers su **Base**) attiva **solo** se sono presenti
    `TORNEI_MINT_RPC_URL`, `TORNEI_MINT_CONTRACT`, `TORNEI_MINT_SIGNER_KEY`
    (chain id `TORNEI_MINT_CHAIN_ID`, default Base 8453);
  - altrimenti **niente provider** → certificati restano `claimable` (degradazione
    elegante, stesso pattern di LLM/Stripe non configurati).
- **Contratto:** ERC-721 con ruolo *minter* (il signer della piattaforma).
  `tier/edition/rarity/seasonLabel` nel **tokenURI** (JSON + immagine generata dalla
  grafica del template). Lo smart contract è fuori da questo repo (deploy a parte);
  qui si integra solo il **client di conio** e l'indirizzo via env.
- **Flusso claim/mint:** l'utente aggiunge `walletAddress` (Impostazioni). Quando
  presente + provider configurato, un worker concia (`mintStatus pending→minted`,
  salva `tokenId`/`txHash`/`contractAddress`); su errore `failed` + `lastError`,
  con **retry idempotente** (no doppio conio: guardia su `txHash`/`mintStatus`).
  Endpoint `POST /tornei/certificates/:id/claim` per (ri)avviare il conio.
- **Sicurezza:** `TORNEI_MINT_SIGNER_KEY` **solo** come secret (mai committata);
  rate-limit sull'endpoint claim; idempotenza per evitare gas sprecato. Documentare
  in `.env.railway.example` (placeholder, senza valori).

> Nota di onestà tecnica: il conio reale richiede infra esterna che l'utente deve
> fornire (RPC, contratto deployato, wallet finanziato). Tutto il resto della feature
> è **pienamente funzionale e testato senza** questa infra; il leg on-chain si attiva
> collegando le env.

## 9. Contract (openapi) & i18n

Endpoint **on-contract** (hand-authored `openapi.yaml` → `pnpm codegen` → hook React
Query; mai editare i generati):

- `GET /tornei/current` — stagione attiva + stato + countdown + progress.
- `GET /tornei/standings?metric=r|ts` — board (top N + riga utente + vicini) + DQ.
- `GET /tornei/me` — vista Percorso (la mia riga, divisione, prossimo traguardo, premi).
- `GET /tornei/hall` — Albo d'oro (stagioni concluse + champion).
- `GET /tornei/certificates` — i miei certificati + `mintStatus`.
- `POST /tornei/enroll` — iscrizione (richiede conto reale + consenso).
- `POST /tornei/certificates/:id/claim` — (ri)avvia il conio sul wallet salvato.

`$ref` nullable con `oneOf: [$ref, {type:"null"}]`; nuovi query hook con
`queryKey: getGet<Op>QueryKey()` esplicito.

**i18n obbligatoria** (test `production-copy.static.test.ts` e
`i18n.parity.static.test.ts`): tutta la copy via `t()`, chiavi su **5 lingue**, nessun
literal a prop `title`, nessun carattere mojibake (Ã/â/Â/ð) nei DICT.

## 10. Frontend (porting 1:1 del design)

`/tornei` → `Tornei.tsx`. Toggle **Arena/Percorso** (segmented), banner stagione +
countdown + progress, podio, classifica con toggle metrica R/Disciplina, riga "TU"
evidenziata, frecce movimento, sezione squalificati, griglia premi + certificati NFT
(grafica olografica/QR/sheen dal template), regole, Albo d'oro, modale certificato.
Stati In arrivo/In corso/Concluso guidati da `GET /tornei/current`. Voce **"Tornei"**
(icona trofeo) in `CommandPalette.tsx` + `TopNav`/`BottomNav`. Pro-gating coerente con
`BillingFeature="leaderboard"` (la sezione è visibile; l'iscrizione/partecipazione è la
funzione gated, come da modello esistente).

## 11. Test & verifica

- **TDD servizi puri:** `standings` (R/Disciplina/guardrail/DQ/divisioni/rank),
  `seasons` (calcolo finestre "ciclo del 7" + rollover idempotente), `prizes`
  (qualificazione tier + idempotenza + estensione entitlement), `enrollment`
  (idoneità/consenso).
- **Route test:** auth/userId-scoping, opt-in, formati risposta.
- **Mint:** `fake.ts` nei test (zero chiamate on-chain); test idempotenza/retry.
- **Gate finale:** `pnpm verify` (install → codegen → typecheck → test → build) verde
  prima di dichiarare fatto. Poi `git push` del branch (regola utente).

## 12. Note di coordinamento / rischi

- `feat/community-management` è un **branch multi-feature condiviso** con commit
  concorrenti di più agenti: **non** mergiare su `main` né toccare working tree
  altrui senza coordinamento. Migration con numero successivo libero (verificare
  l'ultimo realmente presente prima di numerare `0018`).
- L'auto-grant Pro tocca l'entitlement (reversibile via admin) ma **non** il billing
  Stripe: nessun addebito automatico.
- Il conio on-chain spende gas reale: resta **disattivo** finché le env non sono
  configurate; idempotenza per non sprecare gas.
- La board è pseudonima: esporre solo nickname/avatar pubblici, mai dati conto.

## 13. Esplicitamente fuori scope (per ora)

- Deploy/audit dello smart contract ERC-721 (fuori repo).
- Tornei privati/su invito, multi-divisione con bracket, scommesse/quote d'ingresso.
- Marketplace/trasferimento dei certificati.
