# Verifica isolata del centro operativo

Dalla radice del repository, con le dipendenze pnpm già installate:

```sh
node scripts/verify-operating-center/run.mjs
pnpm --filter ./scripts exec tsx verify-operating-center/probe-news.mjs
```

Il primo comando avvia Vite su `127.0.0.1:5178`, usa Playwright con il Chromium
installato da Puppeteer e chiude entrambi alla fine. La porta deve essere libera.
Non eseguirlo durante `pnpm verify`, `pnpm typecheck` o `codegen`: la rigenerazione del client API
rimuove temporaneamente moduli che Vite sta usando.

L'alias Clerk esiste soltanto nella configurazione del runner. Il test usa un nuovo
contesto browser, senza profilo personale, API intercettate e stato in memoria;
blocca le richieste a domini esterni e le connessioni WebSocket API. Non avvia il
backend, non legge credenziali private, non usa il database e non modifica lo schema.
La chiave pubblica Clerk del runner è fittizia. La configurazione di produzione
non importa `clerk-fixture.js`.

Copertura: avvio, pair supportati/non supportati/misti e simboli sconosciuti,
salvataggio e onboarding con errore/riprova, stati di mercato, checklist e avviso
di perdita giornaliera, registrazione e revisione del diario, navigazione delle
altre aree, dashboard/preferenze/diario mobile. Locale italiano, fuso Europe/Rome;
desktop 1440×1000 e mobile 390×844.

Le fixture simulano le risposte dei contratti: **non sono una prova del provider,
dell'autenticazione reale o della persistenza nel database**. Gli endpoint secondari
non implementati rispondono 503 e vengono elencati nel rapporto; per quelle aree
si verifica soltanto l'apertura senza eccezioni JavaScript. Il controllo del rischio
usa una risposta prestabilita, mentre i suoi calcoli reali sono coperti dai test del
repository.

Output locale ignorato da Git: `artifacts.local/verify-operating-center/report.json`,
`desktop.png`, `mobile.png`, `mobile-save-error.png`. Il processo fallisce se
un'asserzione non passa o se viene rilevata un'eccezione JavaScript non gestita.

`probe-news.mjs` esegue invece il classificatore reale su quattro titoli sintetici,
stampando separatamente rilevanza e direzione. Documenta DIR-01; non trasforma il
comportamento difettoso in un requisito di regressione.

Le prove dei widget aprono `/dashboard/widgets`; la home sintetica ha un runner dedicato in `scripts/verify-pair-context/run.mjs`.
