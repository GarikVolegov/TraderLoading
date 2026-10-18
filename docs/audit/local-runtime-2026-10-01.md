# Ripresa e verifica del funzionamento locale — 1 ottobre 2026

## Risultati riproducibili

Il modulo `/sign-in` locale carica Google, email e password senza eccezioni JS.
Nei log precedenti sono presenti ripetuti `failed_to_load_clerk_js`: una dipendenza
esterna non raggiungibile può impedire l'accesso a tutte le sezioni. Il problema
non si è riprodotto nella verifica odierna. Non è stato usato l'account personale.

Per superare i limiti dei precedenti test con fixture sono stati avviati una API
separata su 3002, un frontend su 5182 e un database temporaneo `tl_audit_*`,
contenente solo lo schema locale e dati sintetici. Autenticazione tramite l'identità
Clerk Development di test già esistente, senza bypass. Pro assegnato soltanto nel
database temporaneo per raggiungere le aree riservate. Nessuna credenziale broker,
pagamento o servizio email è stata trasferita all'API di test.

| Difetto | Gravità | Evidenza | Intervento |
| --- | --- | --- | --- |
| Creazione concorrente del profilo al primo accesso | Alta | Richieste iniziali profile/missions: collisione `profile_name_unique_authenticated` | Transazione, lock per identità, rilettura e gestione atomica della collisione del nickname; 48 richieste concorrenti producono un solo profilo per identità |
| Supporto locale privo di schema | Alta, configurazione | GET `/support/tickets` 500; `to_regclass` restituisce null per entrambe le tabelle | Validato lo script esistente `0013_support_tickets.sql` nella copia isolata, poi ripristinate soltanto le due tabelle e gli indici locali; nessuna nuova migrazione, nessun push-force o modifica a righe esistenti |
| Errore di lettura presentato come elenco vuoto | Media | Supporto e checklist non distinguono query fallita da assenza di dati | Stato di errore con Riprova; thread supporto distingue 404 da indisponibilità |
| Disciplina al 100% senza misurazioni | Media, informazione fuorviante | Diario vuoto mostra “Disciplina (piano rispettato) 100%” | Mostra — quando il calcolo manca; etichetta corretta “Perdite entro 1R”, poiché il dato misura solo le perdite con R calcolabile |
| Eliminazione criteri difficile su touch/tastiera | Media | Pulsante visibile solo con hover, senza nome accessibile | Visibile su mobile e al focus; etichetta localizzata |

La riparazione del supporto è un intervento esplicito separato dall'avvio. Il comando
`pnpm start:local` continua a non modificare lo schema. Diagnosi ripetibile:
`pnpm --filter ./scripts exec tsx local/repairSupport.mjs` (sola lettura).

## Prove con backend reale

Rapporto: `artifacts.local/verify-real-runtime/report.json`; screenshot nella stessa
cartella. Runner e istruzioni: `scripts/verify-real-runtime/README.md`.

- Aperte 17 pagine: dashboard, diario, checklist, routine, backtest, archivio,
  community, biblioteca, missioni, traguardi, tornei, broker, orologio,
  impostazioni, supporto, calendario, notizie.
- Sei verifiche di integrazione passate: unicità del profilo al primo accesso;
  sessione Clerk e preferenze persistenti; navigazione sidebar e inserimento trade;
  criteri checklist conservati dopo reload; ticket/riposta/rilettura;
  navigazione mobile e apertura modulo trade.
- Esito finale: zero eccezioni JavaScript e zero risposte API >=400 durante il giro.
  La prima prova con diario vuoto produceva un 422 atteso del simulatore di rischio,
  che richiede un campione minimo, e i 500 del supporto descritti sopra.
- Test diretto aggiuntivo: 48 chiamate concorrenti al vero `getOrCreateProfile`
  contro PostgreSQL isolato, con due identità e collisione sul nickname iniziale.

Queste prove non certificano ogni funzione interna delle 17 aree: sincronizzazione
broker, replay completo, pagamenti, chat fra due account e invii esterni restano
integrazioni da verificare separatamente. La sessione personale dell'utente e i suoi
permessi possono differire dall'account Development di test.

## Dati di mercato osservati

Il 1 ottobre COT restituisce dati ufficiali CFTC Legacy Futures Only, osservazione
22 settembre, recupero 1 ottobre, senza fallback statico. Al risveglio del processo
locale il contesto espone prima dati vecchi esclusi dal punteggio, poi prezzo Yahoo
GC=F (proxy futures dichiarato), retail Myfxbook e COT aggiornati. Le notizie si
aggiornano tramite RSS; il modello OpenRouter configurato restituisce 404 perché
la variante gratuita non è disponibile. Nessun modello a pagamento attivato.

Il punteggio rimane sperimentale, con copertura variabile e nessuna probabilità
predittiva certificata. La freschezza va letta per componente, non dedotta dall'ora
di apertura della dashboard. Metodo e fonti ulteriori: `pair-context-v2.md`.

## Gate finale

- `pnpm verify`: **390 file di test passati, 0 falliti**, generazione dei contratti,
  TypeScript e build completati. `SKIP_PRERENDER=1`: prerender marketing non verificato.
- `pnpm lint:ci`: 0 errori, 33 warning entro la soglia del repository.
- Browser con fixture: **18 controlli pair-context + 37 operating-center**, zero
  eccezioni JavaScript, desktop e mobile. Questi risultati restano distinti dalle
  sei verifiche di integrazione con backend reale descritte sopra.
- Dopo riavvio: frontend 5173, API 3001 e PostgreSQL 55432 disponibili; pagina
  iniziale, readiness tramite proxy Vite e avatar locale esistente restituiscono 200.
- `git diff --check` superato. I servizi di test sono stati fermati; il database
  temporaneo rimane disponibile per esaminare le evidenze.
