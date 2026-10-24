# PROTOCOLLO LIMEN — Post-Breach Credential Rotation & Infrastructure Hardening

> **Stato**: Attivo & Obbligatorio per Produzione  
> **Contesto**: Messa in sicurezza a seguito della compromissione dell'infrastruttura Railway.  
> **Principio**: Zero-Trust. Tutte le credenziali configurate precedentemente su Railway devono essere considerate compromesse e rinnovate.

---

## 1. Matrice di Rotazione Credenziali (Checklist Operativa)

| Servizio | Variabile d'Ambiente | Procedura di Rotazione | Gravità |
| :--- | :--- | :--- | :--- |
| **PostgreSQL Database** | `DATABASE_URL` | 1. Rigenerare password utente DB o ricreare il database su host isolato (es. Neon/Supabase).<br>2. Impostare `sslmode=require`.<br>3. Restringere l'accesso IP alle sole istanze applicative. | **CRITICA** |
| **Clerk Authentication** | `CLERK_SECRET_KEY`<br>`CLERK_PUBLISHABLE_KEY`<br>`VITE_CLERK_PUBLISHABLE_KEY` | 1. Accedere alla dashboard Clerk → API Keys.<br>2. Creare nuove chiavi API e revocare quelle vecchie.<br>3. Rigenerare il webhook signing secret se configurato. | **CRITICA** |
| **Stripe Payments** | `STRIPE_SECRET_KEY`<br>`STRIPE_WEBHOOK_SECRET`<br>`VITE_STRIPE_PUBLISHABLE_KEY` | 1. Accedere a Stripe Dashboard → Sviluppatori → Chiavi API.<br>2. Emettere nuova Restricted/Secret key con revoca programmata.<br>3. Rigenerare la chiave segreta dell'endpoint webhook. | **CRITICA** |
| **Broker Vault Key** | `BROKER_VAULT_KEY` | Generare una nuova chiave crittografica a 256-bit (64 caratteri esadecimali):<br>`node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"` | **CRITICA** |
| **Resend Email** | `RESEND_API_KEY` | Accedere a Resend → API Keys → Create API Key, cancellare la chiave precedente. | **ALTA** |
| **OpenAI Engine** | `OPENAI_API_KEY` | Accedere a OpenAI Platform → API Keys → Revoke & Create new key. | **ALTA** |
| **WebPush VAPID** | `VAPID_PUBLIC_KEY`<br>`VAPID_PRIVATE_KEY` | Rigenerare le chiavi con `pnpm run push:vapid`. | **MEDIA** |
| **Sentry Monitoring** | `SENTRY_AUTH_TOKEN` | Generare un nuovo User Auth Token con permessi `project:releases`. | **MEDIA** |

---

## 2. Hardening Applicativo Implementato

L'applicazione include protezioni native a livello di codice:

1. **Helmet & Strict Content Security Policy (CSP)**:
   - Whitelist rigida per Stripe, Clerk, TradingView e Cloudflare Turnstile.
   - Nessun caricamento di script non verificati.
2. **Restrizione CORS (Cross-Origin Resource Sharing)**:
   - Origini validate esplicitamente da `API_CORS_ORIGINS`.
   - Nessun wildcard `*` ammesso quando le richieste includono credenziali/cookie.
3. **Rate Limiting Distribuito & In-Memory**:
   - `express-rate-limit` con protezione anti-bruteforce su rotte sensibili (autenticazione, sottomissione candidature, caricamento media, query complesse).
4. **Protezione SQL Injection**:
   - Query parametrizzate tramite Drizzle ORM su tutte le chiamate database.
   - Zero interpolazione di stringhe utente nei comandi SQL.
5. **Sanitizzazione Input & Validazione Schemi Zod**:
   - Validazione a livello di rotta con Zod su ogni payload in ingresso.
6. **Protezione Server-Side Request Forgery (SSRF)**:
   - Validazione e isolamento dei download di feed RSS e webhook esterni.

---

## 3. Disaccoppiamento Infrastrutturale (Cloud-Agnostic)

L'applicazione non dipende in modo rigido da Railway:
- Può essere eseguita localmente (`pnpm start:local`).
- Può essere deployata come container Docker standard su **Render**, **Fly.io**, **AWS Fargate** (`Dockerfile.aws`) o **Oracle Cloud** (`Dockerfile.oracle`).
- Per il database PostgreSQL, è raccomandato un servizio gestito dedicato (es. Neon con pooler `ep-*-pooler` o Supabase) con connessioni SSL obbligatorie (`sslmode=require`).
