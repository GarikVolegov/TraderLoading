# Verifica del processo guidato

Dalla radice:

```sh
pnpm --filter ./scripts exec tsx verify-trader-process/runtime.ts
PROCESS_AUDIT_BROWSER=1 pnpm --filter ./scripts exec tsx verify-trader-process/runtime.ts
pnpm verify
pnpm lint:ci
```

Il runner legge solo lo schema del PostgreSQL locale su `127.0.0.1:55432` e crea
un database `tl_process_<timestamp>`, eliminato alla chiusura. Le migrazioni
0037–0043 e tutte le fixture sono applicate soltanto lì; 0036 viene aggiunta se
manca. `PROCESS_AUDIT_DATABASE_URL` cambia la connessione locale;
`AUDIT_PG_BIN` cambia la cartella di `pg_dump`/`psql`. Non vengono copiati dati
personali né usati provider di trading reali.

Gli handler reali di processo, diario, backtest ed esportazione usano identità
sintetiche. Le prove coprono prerequisiti, ownership, Free/Pro, concorrenza,
idempotenza, bozze/revisioni, versioni immutabili, costi/P&L/R, riconciliazione,
no-trade, revisioni recuperabili, criteri immutabili, sospensione e apertura broker.
Il callback sintetico d’invio verifica che un rifiuto non raggiunga il provider.
I periodi vengono spostati solo tramite SQL delle fixture, mai da endpoint di
produzione. Una prova separata applica l’integrazione additiva su backup del
database sintetico e confronta le righe originali.

La modalità browser avvia Vite su `127.0.0.1:5189` e Chromium isolato. Clerk è un
alias locale; gli handler di processo/diario sono reali, le API accessorie sono
fixture e le richieste esterne sono bloccate. Il percorso percorre definizione,
protocollo, evidenza simulata, checklist, contesto, ritorno dal calendario,
scenario, ripresa su un secondo dispositivo, chiusura senza trade, diario,
giornata conclusa e revisione con sospensione. Visita tutti i 27 accessi del
catalogo dopo il caricamento e controlla ricerca, tastiera, audio manuale e layout
375/768/1440 px. I report non sono uno studio cronometrato con persone e non
misurano la redditività.

Report e screenshot: `artifacts.local/trader-process/`, escluso da Git. Nessuna
prova locale certifica Clerk live, sincronizzazione broker reale, pagamenti,
tastiera virtuale o telefoni fisici.

Per l’esplorazione interattiva isolata:

```sh
pnpm --filter ./scripts exec tsx verify-trader-process/experience.ts
```

Il server espone porte e nome del database temporaneo in
`artifacts.local/trader-experience/session.json`. Usare un browser nuovo con le
stesse fixture accessorie del runner. SIGINT/SIGTERM chiude i server ed elimina
il database temporaneo. Non usa l’account personale.

L’integrazione locale autorizzata è distinta dai test:
[`workspace-reorganization.md`](../../docs/architecture/workspace-reorganization.md).
Dopo backup/ripristino e migrazione esplicita, `pnpm release:local` esegue schema,
gate completi e runtime/browser, poi riavvia solo l’API locale di proprietà del
workspace. Mantiene frontend, porte e database; non migra e non salta i gate.
