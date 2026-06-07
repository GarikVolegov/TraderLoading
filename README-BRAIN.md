# TraderLoadings + Brain AI - locale

Questa nota raccoglie i comandi consigliati per avviare e verificare l'app in
locale.

## Prerequisiti

1. Node.js 20+
2. pnpm installato globalmente: `npm install -g pnpm`
3. Docker Desktop avviato, necessario per PostgreSQL locale
4. File `.env.local` presente con le variabili richieste

## Comandi consigliati

Installa o aggiorna le dipendenze:

```bash
pnpm install
```

Esegui il gate principale prima di considerare una modifica pronta:

```bash
pnpm run verify
```

Il gate esegue install, codegen OpenAPI, typecheck delle librerie/app, test e
build di produzione.

Esegui solo i test:

```bash
pnpm run test
```

Avvia tutto in locale:

```bash
pnpm run start:local
```

In alternativa, usa i wrapper sottili:

```bash
bash start-local.sh
```

oppure su Windows:

```bat
start-local.bat
```

Controlla il runtime dopo l'avvio:

```bash
pnpm run verify:runtime
```

Se vuoi una verifica runtime bounded, senza lasciare il frontend avviato, usa:

```bash
pnpm run smoke:runtime
```

Questo comando rigenera i client API, avvia temporaneamente i servizi mancanti,
controlla API, frontend, proxy `/api`, scansiona i nuovi `RUNTIME_ERROR` nei log
e poi termina i processi che ha avviato.

Dopo modifiche alle API o al contratto OpenAPI, rigenera i client/spec:

```bash
pnpm run codegen
```

## Porte locali

- PostgreSQL Docker: `localhost:5432`
- PostgreSQL gestito di fallback: `localhost:55432` quando `5432` e' gia'
  occupata da un altro Postgres locale
- Backend API: `http://localhost:3001`
- Frontend Vite: `http://localhost:5173`

Se una porta e' occupata, chiudi il processo che la sta usando o libera il
container/servizio prima di rilanciare `pnpm run start:local`.

## Database di produzione: Neon

Per pubblicare l'app usa Neon Postgres come database gestito. Il codice usa gia'
PostgreSQL tramite Drizzle e legge la variabile `DATABASE_URL`, quindi in
produzione basta impostare `DATABASE_URL` con la connection string Neon.

Consigli:

- usa la connection string pooled di Neon quando il backend gira su piattaforme
  serverless o con molte istanze;
- per Node/pg preferisci `sslmode=verify-full&channel_binding=require`;
- tieni un database/branch Neon separato per staging e produzione;
- dopo aver impostato `DATABASE_URL`, esegui `pnpm --filter @workspace/db run push`
  per applicare lo schema al database Neon;
- non committare `.env.local` o file `.env` con credenziali reali.

## Debug rapido

- Verifica che Docker Desktop sia aperto e che la porta `5432` non sia gia'
  usata da un altro PostgreSQL.
- Se il database non parte, controlla il container locale e rilancia
  `pnpm run start:local`.
- Se il backend non risponde su `3001`, controlla le variabili in `.env.local`
  e riesegui `pnpm run verify`.
- Se il frontend non si apre su `5173`, verifica che Vite non sia gia' attivo
  in un altro terminale.
- Se `verify:runtime` fallisce per il frontend spento, usa
  `pnpm run smoke:runtime` per una prova autonoma.
- Se `smoke:runtime` fallisce su `Runtime error`, controlla i file
  `.local-logs/runtime-smoke-*.log` e `.local-logs/runtime-session.json`.
- Se hai cambiato API, route generate o schema condiviso, esegui
  `pnpm run codegen` e poi `pnpm run verify`.
