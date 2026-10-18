# Raccolta ed export quantitativi

Eseguire dalla radice del repository, con le dipendenze pnpm installate e
`DATABASE_URL` dell'ambiente scelto in `.env.local`. La migrazione 0036 deve
essere già applicata. Questi comandi non operano sul diario o sui dati personali.

Il collector API si avvia soltanto con `MACRO_INTELLIGENCE_COLLECTOR=1`. Acquisisce
prezzi Dukascopy bid, salva snapshot orari con tempi reali, risolve soltanto finestre
complete e registra una revisione della qualità ogni settimana. Le richieste
ricalcolano comunque i controlli: una verifica fallita nasconde le percentuali.
Calendario e modelli richiedono gli hash indicati in `.env.example`.

Import storico esplicito, con ricevute di acquisizione attuali:

```sh
pnpm --filter ./scripts exec tsx market-intelligence/backfill.ts \
  --from=2021-01-01T00:00:00Z --to=2026-01-01T00:00:00Z \
  --pairs=EURUSD,GBPUSD,USDJPY,USDCHF,AUDUSD,USDCAD,NZDUSD,XAUUSD
```

L'import può richiedere molto tempo. I blocchi di sette giorni sono ripetibili:
le stesse barre non riscrivono la prima acquisizione. Un errore interrompe il
comando; non si sostituisce il provider e non si completa artificialmente la serie.
Lo storico importato è ricerca, non prova prospettica.

Export in transazione PostgreSQL di sola lettura, senza sovrascrivere file:

```sh
pnpm --filter ./scripts exec tsx market-intelligence/export.ts \
  --mode=observations --output=/tmp/directional-m1.jsonl
pnpm --filter ./scripts exec tsx market-intelligence/export.ts \
  --mode=forecasts --output=/tmp/directional-prospective.jsonl
pnpm --filter ./scripts exec tsx market-intelligence/export.ts \
  --mode=macro --output=/tmp/directional-macro-pit.jsonl
```

`observations` esporta la prima versione acquisita di ogni minuto, mantenendo
`availableAt`. `forecasts` esporta solo esiti risolti della coorte UTC non
sovrapposta 00/04/08/12/16/20, con snapshot e tempi originali. `macro` richiede
copertura documentata delle fonti ufficiali per tutta la finestra, acquisizioni
entro il cutoff, intervalli fra raccolte non superiori a 15 minuti e dati numerici
documentati. Consenso assente non diventa sorpresa zero. Una raccolta vuota ma
completa può produrre zero eventi; una raccolta incompleta non produce una riga.

I file si passano alla [CLI Python](../../tools/directional-model/README.md).
Importare prezzi non ricostruisce le notizie conosciute nel passato. Nessun
comando addestra durante richieste HTTP, installa un modello approvato o dimostra
profittabilità.
