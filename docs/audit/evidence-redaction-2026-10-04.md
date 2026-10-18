# Redazione delle evidenze — 4 ottobre 2026

**Ambito:** protezione degli archivi ZIP Playwright conservati nell'audit. Le prove usano esclusivamente token, sessioni e chiavi inventati; non aprono archivi esistenti, database, log o account. La nuova regressione è **6/6 superata**. Questo risultato verifica i casi sintetici descritti, non certifica che ogni evidenza dell'audit sia priva di segreti.

## Difetti riprodotti e correzione

| Rilievo | Riproduzione e risultato precedente | Intervento ed esito |
|---|---|---|
| EVD-01 — JSON su più righe | Inserire una chiave EC privata in una risorsa ZIP senza estensione, serializzata con `indent=2`. Il campo `d` resta leggibile. Anche `privateKeyJwk` e segreti in JSON annidato non vengono mascherati quando il documento esterno è formattato su più righe. | Analisi del membro JSON completo prima del percorso JSONL. Campi privati e stringhe contenenti altro JSON sono redatti; coordinate pubbliche conservate. Riverificata. |
| EVD-02 — Parametri RSA incompleti | Inserire un JWK RSA compatto con `p`, `q`, `dp`, `dq`, `qi` e `oth`. Il vecchio codice maschera soltanto `d`. | Mascherati tutti i parametri privati RSA, incluso l'array dei primi aggiuntivi. Inclusi `d` per EC/OKP e `k` per JWK simmetrici `oct`. Modulo e altri parametri pubblici conservati. Riverificata. |
| EVD-03 — Permessi dell'archivio | Redigere uno ZIP sintetico con permessi `0600`. Il file sostitutivo assume `0644` con l'umask del test. | Temporaneo univoco creato privato; sostituzione conserva i permessi originali. Verificati `0600`, cleanup del temporaneo e mancata sostituzione di uno ZIP invalido. Riverificata. |

Sono bug del processo di gestione delle evidenze. La presenza di materiale sintetico non dimostra esposizione pubblica o compromissione di credenziali reali. La gravità potenziale di EVD-01/02 è alta se vengono conservate chiavi o sessioni reali; EVD-03 dipende dai permessi della directory contenitore e degli account locali.

La baseline aveva **4 prove fallite su 5**: JSON multilinea, parametri RSA, JSON annidato e permessi; il caso JSONL con JWT/sessione/credenziali passava già. Dopo la correzione le cinque prove passano, insieme alla nuova prova di ZIP invalido. Sono verificati anche conservazione dei byte binari, testo innocuo e idempotenza della redazione.

## Prova ripetibile ed evidenza

Implementazione: [redact-traces.py](../../scripts/verify-real-runtime/full/redact-traces.py). Regressione autonoma con libreria standard Python: [redact-traces.test.py](../../scripts/verify-real-runtime/full/redact-traces.test.py).

```sh
python3 scripts/verify-real-runtime/full/redact-traces.test.py
```

Esito della nuova esecuzione: [redaction-regression-after.json](../../artifacts.local/full-audit/20261002T103216Z/redaction-regression-after.json), con comando, identificativo di esecuzione, data, codice di uscita e output del test. Gli ZIP sintetici temporanei vengono eliminati alla fine di ciascuna prova.

Per rielaborare gli ZIP del run, dalla radice del repository, **dopo le misure SPA**:

```sh
rg --files artifacts.local/full-audit/20261002T103216Z -g '*.zip' -0 | xargs -0 python3 scripts/verify-real-runtime/full/redact-traces.py
```

Il comando sostituisce ciascuno ZIP conservandone i permessi. Dopo la misura SPA, i **36 ZIP presenti nel run sono stati rielaborati** con la nuova versione. Il log del comando resta locale; questo esito non amplia i limiti descritti sotto.

Aggiornamento del 10 ottobre: **69 ZIP rielaborati**, inclusi nuovi scenari vocali/workspace e tentativi falliti conservati; `.local-logs/redaction-final-2026-10-10.log`. Regressione sintetica ripetuta: **6/6** in `.local-logs/redaction-regression-2026-10-10.log`. Il numero è quello degli archivi presenti nel run al momento della scansione; non include log/dump esterni e non amplia i limiti sui contenuti binari.

Dopo il replay: **74 ZIP rielaborati**, comprese le cinque nuove tracce (`.local-logs/redaction-replay-complete.log`). I tentativi di baseline e quelli con difetti del runner sono conservati e distinti dalla prova completa riuscita. Restano i limiti di sanificazione descritti sotto.

## Limiti

- Il redattore analizza membri UTF-8 e JSON/JSONL validi, con riconoscimento testuale di JWT, credenziali `sk_test`/`sk_live`/`whsec` e sessioni esadecimali di 64 caratteri. Non riconosce automaticamente ogni formato possibile di segreto; testo non strutturato, chiavi con nomi diversi, codifiche o contenuti compressi richiedono una verifica separata. Anche hash innocui di 64 caratteri sono rimossi per cautela.
- Immagini, video e altri dati binari non vengono sanificati. Una schermata può mostrare dati personali o segreti: va controllata visivamente prima della condivisione.
- Dump del database, esportazioni, backup, patch e log locali fuori dagli ZIP non sono elaborati da questo comando. I dump sintetici possono contenere backup di chiavi; i vecchi log degli errori possono includere parametri delle query. Restano materiale locale riservato, da esaminare o oscurare separatamente.
- Preservare i permessi non restringe quelli già troppo aperti. La directory dell'audit e i file sensibili devono conservare le protezioni locali previste; la redazione non sostituisce il controllo degli accessi.
- Passare questi test non costituisce autorizzazione a pubblicare automaticamente gli artefatti. La condivisione richiede verifica del contenuto effettivo, della provenienza e dell'ambito dei dati.
