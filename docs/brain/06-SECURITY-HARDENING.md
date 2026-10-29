---
title: "SECURITY HARDENING — Fortezza Operativa, Privacy & GDPR"
type: security-standards
vault: aureus-os
tags:
  - aureus/security
  - aureus/auth
  - aureus/gdpr
  - aureus/clerk
version: 1.0.0
last_updated: 2026-10-25
---

# 🔒 SECURITY HARDENING — Fortezza Operativa, Privacy & GDPR

> [!IMPORTANT]
> **POSTURA DI SICUREZZA**: AUREUS adotta il principio del privilegio minimo (*Least Privilege*), della difesa in profondità e dell'integrità assoluta dei dati personali e finanziari dell'Operatore.

Torna a: [[00-ATLAS]] | Precedente: [[05-OPTIMIZATION-PERFORMANCE]]

---

## 1. Autenticazione & Gestione Sessioni (Clerk)

1. **Verifica Rigorosa dei Token**:
   Tutte le chiamate API autenticate transitano dal middleware Clerk per Express (`@clerk/express`). Il backend valida la firma crittografica del JWT prima di popolare `req.auth`.
2. **Separazione Netta Dev vs Production**:
   Le chiavi `pk_test`/`sk_test` appartengono rigorosamente all'ambiente di sviluppo locale. È vietato inserire chiavi live o di produzione nel file `.env.local` per aggirare errori di sviluppo.
3. **Nessun Proxy Inutile**:
   Clerk è configurato su custom-domain nativo. È vietato attivare proxy URL intermedi (`VITE_CLERK_PROXY_URL`) che potrebbero introdurre vettori Man-In-The-Middle o anomalie di reindirizzamento.

---

## 2. Controllo Accessi Basato sui Ruoli (RBAC)

1. **Proprietario Assoluto d'Ordine**:
   Le rotte di pubblicazione dottrinale e video dell'Academy richiedono la corrispondenza con `LIMEN_OWNER_USER_ID`. Il normale permesso `content.publish` di altri amministratori **non** autorizza la gestione della formazione sovrana.
2. **Access Control Lists (ACL) sui Canali Privati**:
   I file, i flussi audio e i messaggi dei canali privati o a pagamento (`community_channel_entitlements`) devono verificare l'accesso effettivo tramite choke point centralizzato `assertChannelAccess` prima di consentire download o ricezione socket.

---

## 3. Validazione degli Input (Zod Schemas)

Nessun dato fornito dall'utente (body, parametri rotta, query string) può essere processato prima di essere validato contro il relativo schema Zod:

```typescript
// Esempio validazione Zod pre-esecuzione
const parsedBody = createJournalEntrySchema.safeParse(req.body);
if (!parsedBody.success) {
  return res.status(400).json({ error: "INVALID_PAYLOAD", details: parsedBody.error.format() });
}
```

- **Prevenzione Injection**: Tutte le query a database utilizzano i costrutti tipati di Drizzle ORM con parametri vincolati (nessuna concatenazione SQL manuale).

---

## 4. Privacy & Conformità GDPR (Cascata di Cancellazione)

Il diritto all'oblio è pienamente garantito e automatizzato nel servizio `accountDeletion.ts`:

1. **Cancellazione a Cascata Atomica**:
   La cancellazione di un account rimuove integralmente da tutte le tabelle collegate:
   - Dati di profilo e preferenze.
   - Trade, note, recensioni e allegati personali.
   - Iscrizioni alle Arene (`backtest_tournament_entries`).
   - Candidature e richieste storiche.
2. **Sanitizzazione nei Log**:
   Nessun indirizzo email, codice fiscale, numero di telefono o dato identificativo deve permanere nei file di log grezzi dopo la dismissione dell'account.

---

## 5. Protezione Caricamenti File & Media Streaming

1. **Validazione dei Tipi MIME Reali**:
   Non fidarsi mai dell'estensione del file dichiarata dall'utente. Verificare i magic bytes per identificare il vero tipo MIME prima del salvataggio.
2. **URL Firmati e a Breve Scadenza**:
   - I video dell'Academy (Cloudflare Stream) e i file privati (S3/R2) sono accessibili **esclusivamente tramite URL firmati** generati dal server (`GET /api/academy/lessons/:id/playback`).
   - Durata massima dei token di riproduzione: **3 ore**.
   - Il browser carica i file multimediali pesanti tramite protocollo TUS direttamente verso lo storage protetto, senza che il token di amministrazione backend venga mai esposto al client.

---

## 6. Gestione Segreti & Feature Flags Dark-by-Default

- **Flag Spenti di Default**: Le funzionalità a pagamento o di invio email rimangono disattivate in locale a meno che non siano esplicitamente configurate (`EMAIL_LIFECYCLE_ENABLED=0`, `PAYOUT_CREDIT_CENTS` vuoto, etc.).
- **Zero Segreti nel Version Control**: Verificare costantemente con git pre-commit che nessuna chiave API (`sk_live_...`, `AIza...`, `CLOUDFLARE_...`) finisca tracciata nel repository.

---

## 7. Protezione DoS, Event Loop & Concorrenza Distribuita

1. **Slowloris & Request Timeout Hardening**:
   - `server.requestTimeout = 30_000` ms applicato al server HTTP per chiudere socket lenti o che mantengono connessioni appese con body infiniti a basso bitrate.
2. **Rate Limiting Dedicato su Rotte CPU-Heavy**:
   - Rotte di calcolo stocastico intensivo (es. Simulazione Monte Carlo in `routes/tools.ts`) protette da limitatori dedicati a finestra mobile (max 30 richieste/min per IP/utente).
   - Impedisce l'affaticamento dell'event loop di Node.js e garantisce responsività alle altre rotte critiche.
3. **Lock Distribuiti per Job Schedulati (Idempotenza Multi-Container)**:
   - Scheduler di ciclo di vita (`lifecycleScheduler.ts`) protetti da `tryAcquireLock` su Redis o Postgres per impedire l'esecuzione concorrente e duplicata di invio email o transazioni su nodi multipli.
