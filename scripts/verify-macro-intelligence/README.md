# Verifica macro isolata

```sh
pnpm --filter ./scripts exec tsx verify-macro-intelligence/verify.ts
pnpm lint
pnpm --filter ./scripts exec tsx verify-macro-intelligence/runtime.ts
tools/directional-model/.venv/bin/python tools/directional-model/test_directional.py
```

Il primo runner passa al gate `pnpm verify` soltanto la chiave pubblica Clerk
necessaria alla build. Le integrazioni private di `.env.local` restano scaricate.
Il runner runtime legge la configurazione PostgreSQL, accetta soltanto un host
locale, crea un database temporaneo, applica lì la migrazione 0036 e lo elimina
alla fine. Non applica migrazioni al database personale.

Le richieste esercitano i veri handler, proprietà e persistenza; l'identità del
runner è sintetica e non certifica Clerk. Documenti, prezzi e decisioni sono
fixture: non costituiscono evidenza predittiva. Il test di parità TS della suite
confronta le probabilità con vettori scikit-learn per i profili prezzo e macro
entro 1e−12; gli artefatti sintetici vengono respinti dal loader di produzione.

La prova mobile usa componenti reali e API intercettate a 375×500 e 1100×760.
Report locale `/tmp/trader-macro-ui-audit-report.json`; non verifica un telefono
fisico o provider reali. Architettura e condizioni per il rilascio delle percentuali:
[macro-intelligence.md](../../docs/architecture/macro-intelligence.md).
