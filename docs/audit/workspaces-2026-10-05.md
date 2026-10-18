# Regressioni della riorganizzazione — 5 ottobre 2026

Il diario e la navigazione sono cambiati durante l'audit. Le misure e prove browser precedenti restano riferite alla loro build; questo rapporto verifica separatamente le nuove viste, senza ripristinare la vecchia interfaccia.

API produzione 3002, build locale, Clerk Development reale, account sintetico Pro; nessun login o scrittura personale. Desktop 1440×1000, mobile 390×844. I provider mercato sono resi esplicitamente indisponibili mediante fixture: questi scenari non certificano i loro dati.

Runner `scripts/verify-real-runtime/full/browser-workspaces.mjs`; evidenze in `artifacts.local/full-audit/20261002T103216Z/browser-workspaces-{baseline,after}/`.

| ID | Gravità / tipo | Riproduzione e atteso/osservato | Intervento e prova |
| --- | --- | --- | --- |
| WSP-ACCESS-01 | Media / bug accessibilità | Aprire Agenda e cercare per nome i sei controlli. Titolo, tipo, priorità, inizio, fine e note non avevano label associati; atteso nome disponibile a tecnologie assistive | Aggiunti nomi accessibili tradotti nelle cinque lingue. Baseline: controllo “Titolo” assente per nome. After verifica tutti e sei |
| WSP-BUILD-01 | Alta / bug avvio/build | Typecheck del backend fallisce sul ramo di cache traduzioni: `pairsStr` non definito e `NewsResponse` incompatibile con titolo/sintesi | Il ramo ora restituisce la traduzione memoizzata. Nessuna modifica al punteggio. TypeScript, test e build riverificati |
| WSP-LAYOUT-01 | Bassa / miglioramento manutenzione | Sidebar impostata a 208px separatamente dall'offset CSS di 13rem | Unificato con `--app-inset-left`, preservando la dimensione attuale; regressione di clearance passata |

**7/7 scenari passati** dopo la correzione dei nomi accessibili; baseline 6/7. Le prove comprendono destinazioni globali costanti, pannelli Piano/Revisione/Idee e obiettivi popolati, sei alias legacy che conservano il pair, orario di fine invalido senza scrittura, creazione agenda con reload, eliminazione, quota locale simulata con bozza conservata e retry, tab Oggi attivata da tastiera su mobile senza overflow.

L'agenda personale è **locale al dispositivo**, nel namespace del singolo account: questa prova legge effettivamente la chiave e non descrive una persistenza backend inesistente. Non certifica sincronizzazione fra dispositivi, importazione di agenda legacy o cambio account durante una modifica.

La suite precedente falliva anche su aspettative della vecchia navigazione e su fixture delle news che riusavano lo stesso URL per storie diverse o richiedevano analisi generate senza contenuto fonte. Sono stati conservati URL distinti e test espliciti: analisi presente solo con evidenza full-text, analisi mancante resta assente. Nessuna soglia o nuova formula del punteggio introdotta da queste correzioni.

Il primo tentativo mobile del runner cercava “Routine”, mentre la UI mostra “Routine e benessere”: selettore corretto, non bug di prodotto. Il tentativo delle news con chiave snapshot v9 sulla nuova API v10 è stato scartato dal controllo di provenienza e ripetuto correttamente; non viene presentato come errore del feed.

Gate completo: `pnpm verify` tramite wrapper con sola chiave pubblica Clerk, **408/408 file di test**, TypeScript/build e prerender45/45. Lint: zero errori e35 warning, entro la soglia39. L'audit generale resta aperto: questo gate non equivale a tutte le funzioni esercitate in browser.
