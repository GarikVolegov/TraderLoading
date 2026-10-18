# TraderLoadings Academy — piano operativo

Versione: 18 ottobre 2026. Responsabile delle lezioni: il titolare del metodo, che registra personalmente grafici, spiegazioni e revisioni.

L'offerta è un abbonamento formativo da **150 € al mese**, distinto da TraderLoadings Pro, con un programma di affiliazione diretta gratuito che riconosce il **20% dei pagamenti Academy effettivamente incassati e attribuiti**. Un pagamento mensile intero di 150 € genera 30 € di commissione lorda. Il valore venduto è la formazione: video originali, esercizi sul grafico e feedback sul processo.

Questo documento definisce prodotto e procedure. Non certifica la conformità legale o fiscale del modello e non sostituisce i contratti. Il programma didattico in `contracts/academy.ts` contiene **24 scalette**, non 24 video già registrati. Le definizioni originali dei trigger devono essere fornite dal docente.

## 1. Cosa acquista l'allievo

| Voce | Specifica dell'offerta da rendere effettiva prima della vendita |
| --- | --- |
| Prezzo | 150 € al mese come prezzo finale al consumatore, con rinnovo mensile comunicato chiaramente. Impostazione IVA da verificare con il commercialista. |
| Accesso | Lezioni effettivamente pubblicate, materiali ed esercizi per il periodo pagato. Catalogo e disponibilità visibili prima dell'acquisto. |
| Percorso iniziale | Otto moduli, tre lezioni ciascuno; percorso consigliato di quattro settimane, ripetibile in simulazione. |
| Supporto iniziale | Una consegna strutturata a settimana per allievo, con feedback del docente entro cinque giorni lavorativi. Obiettivo da confermare in base alla capacità effettiva. |
| Continuità | Dopo il corso base: quattro nuovi casi commentati al mese, alternando scalp e swing, e revisione delle consegne. Comunicare in anticipo il calendario realmente sostenibile. |
| Disdetta | Interrompe i rinnovi futuri; mostrare la data di fine accesso già pagato. Recesso e rimborsi seguono le condizioni applicabili, distinte dalla disdetta. |
| Pro | Piano separato: nessun acquisto Pro necessario per aderire all'affiliazione. Prima del lancio, verificare che le esercitazioni incluse siano accessibili senza costi Pro impliciti; fornire grafici e schede alternativi se necessario. |

La promessa formativa è imparare a documentare preparazione, contesto, conferme, attesa e revisione secondo il metodo del docente. Non si promettono rendimenti, recupero della quota attraverso il trading o guadagni dall'affiliazione. Il completamento del corso non attribuisce qualifiche professionali.

Per il primo gruppo, pianificare **25 allievi** come limite operativo provvisorio. Venticinque revisioni da 8–10 minuti richiedono circa 3,5–4,5 ore settimanali, cui aggiungere produzione, assistenza e amministrazione. Aumentare i posti solo dopo aver misurato i tempi reali. Non pubblicizzare posti limitati se il limite non viene effettivamente applicato.

## 2. Formato di ogni video

Durata obiettivo: 10–18 minuti per un concetto; 20–30 minuti per un caso completo. Il docente usa un grafico originale o autorizzato, leggibile anche a schermo piccolo, con mercato, data, fuso orario, timeframe e fonte indicati.

1. **Concetto** — obiettivo della lezione e definizione del docente; distinguere regola osservabile e interpretazione.
2. **Esempio** — avanzare il replay senza mostrare prima il futuro; indicare ciò che è già noto e ciò che manca.
3. **Controesempio** — caso simile che non soddisfa la definizione, oppure una perdita/attesa che chiarisca il limite della regola.
4. **Esercizio** — fermare un secondo grafico, chiedere una decisione motivata e una condizione di invalidazione; pubblicare la soluzione separatamente.
5. **Revisione** — confrontare processo ed esito, segnalare costi e dati mancanti, indicare un solo punto da migliorare.

Ogni lezione comprende titolo, descrizione, video, sintesi scritta, consegna ed eventuale soluzione. Per ogni caso conservare schermata iniziale, annotazioni e riferimento ai dati. Etichettare sempre simulazione, replay o operazione reale. Coprire anche perdite e giornate senza operazioni: il risultato successivo non prova che la decisione iniziale fosse corretta.

Il cockpit contiene controlli dichiarati dall'utilizzatore, non un riconoscitore automatico dei segnali. Non inventare le definizioni di TEST, POC, JTC, BTI, chiusura del ciclo, schematica o sbilanciamento. Il docente deve scriverle e validarle con esempi prima della registrazione. Il profilo di rischio personale nel vault è ancora da compilare: il corso non deriva soglie universali da quel modello.

## 3. Otto moduli e ventiquattro scalette

I titoli e gli identificativi seguono `contracts/academy.ts`; i vincoli di scenario seguono `contracts/cockpit.ts`. Le tabelle precisano il materiale da registrare, senza presentarlo come già disponibile.

### Modulo 1 — Preparazione e attesa

| ID e titolo | Concetto → esempio → controesempio | Esercizio da consegnare |
| --- | --- | --- |
| `preparazione-1` · Preparare la sessione | Preparazione di mercato, grafico e finestra oraria → sessione annotata → grafico pronto ma finestra incompatibile. | Scheda di preparazione in simulazione, con fonte e orario. |
| `preparazione-2` · Calendario e condizioni di attesa | Verifica delle news → controllo aggiornato e rivalutazione dopo evento → calendario non verificato o precedente alla giornata. | Fonti consultate, decisione di operare/attendere e nuova verifica necessaria. |
| `preparazione-3` · Protezione personale e checklist | Limiti personali da dichiarare → checklist compilata → piano con limiti ancora indefiniti. | Checklist e campi mancanti, senza ricopiare percentuali come regole universali. |

### Modulo 2 — Dove: ciclo e liquidità

| ID e titolo | Concetto → esempio → controesempio | Esercizio da consegnare |
| --- | --- | --- |
| `contesto-1` · Il ciclo grande | Definizione delle fasi del docente → annotazione HTF → contesto ambiguo. | Ciclo osservato e punti ancora incerti sul grafico fermato. |
| `contesto-2` · Liquidità e sweep | Definizione di sweep → caso conforme → movimento visivamente simile che non soddisfa la definizione. | Confronto con differenze osservabili e riferimenti alle regole. |
| `contesto-3` · Compressione: documentare l'attesa | Liquidità sopra e sotto → compressione documentata → tentativo prematuro di forzare una direzione. | Scheda di attesa e condizione che richiederebbe una rivalutazione. |

### Modulo 3 — Sinistra: zone e scenari

| ID e titolo | Concetto → esempio → controesempio | Esercizio da consegnare |
| --- | --- | --- |
| `sinistra-1` · Zona valida e mitigata | Definizione della zona HTF → zona e conferma necessaria → zona senza conferma sufficiente. | Separare osservazioni presenti e conferme ancora attese. |
| `sinistra-2` · Sola liquidità | Scenario senza zona valida → caso in cui il cockpit ammette JTC/BTI → tentativo di selezionare TEST/POC. | Classificazione motivata e trigger ammessi, senza presumere che siano già confermati. |
| `sinistra-3` · Box intermedi | Estremo non raggiunto e re-accumuli → contesto coerente con JTC → trigger incompatibile col box. | Box annotato, scenario e motivazione dell'attesa o del passaggio successivo. |

### Modulo 4 — Come: schematiche e trigger

| ID e titolo | Concetto → esempio → controesempio | Esercizio da consegnare |
| --- | --- | --- |
| `esecuzione-1` · Conferme ITF e LTF | Chiusura del ciclo e schematica secondo il docente → conferme in sequenza → anticipazione prima della conferma. | Schermate prima/dopo e spiegazione di ciò che cambia. |
| `esecuzione-2` · TEST e POC | Definizioni originali da completare → esempio distinto per ogni trigger → falso riconoscimento. | Confronto basato sulle sole regole esplicitate nella lezione. |
| `esecuzione-3` · JTC e BTI | Definizioni originali e compatibilità di scenario → caso valido → caso incompatibile o incompleto. | Trigger consentito, evidenza presente e conferma mancante. |

### Modulo 5 — Target e invalidazione

| ID e titolo | Concetto → esempio → controesempio | Esercizio da consegnare |
| --- | --- | --- |
| `target-1` · Pool di liquidità opposto | Identificazione e conferma dell'obiettivo → pool motivato → target scelto soltanto per il risultato desiderato. | Target sul grafico e motivazione osservabile. |
| `target-2` · Storico e area vergine | Distinzione delle aree e controllo manuale dello sbilanciamento → controllo esplicito → area vergine non verificata. | Classificazione dell'area e controllo ancora necessario. |
| `target-3` · Aspettativa e invalidazione | Aspettativa verificabile → evoluzione prevista → cambiamento che invalida il piano. | Aspettativa, invalidazione e risposta prevista prima di vedere il seguito. |

### Modulo 6 — Laboratorio scalp

| ID e titolo | Concetto → esempio → controesempio | Esercizio da consegnare |
| --- | --- | --- |
| `scalp-1` · Scalp: contesto H1 | Zone H1 e liquidità → costruzione del contesto → lettura ricostruita a posteriori. | Contesto e scenario con la parte futura del grafico nascosta. |
| `scalp-2` · Scalp: da M15 a M1 | Sequenza dei timeframe → conferme del caso scelto → discesa a M1 prima delle condizioni necessarie. | Sequenza annotata e punto in cui attendere. |
| `scalp-3` · Scalp: sessione completa | Preparazione, piano, simulazione e consuntivo → replay completo → errore o caso sfavorevole documentato. | Scheda della sessione, costi disponibili e revisione del processo. |

### Modulo 7 — Laboratorio swing

| ID e titolo | Concetto → esempio → controesempio | Esercizio da consegnare |
| --- | --- | --- |
| `swing-1` · Swing: Daily e H4 | Ciclo Daily e zona H4 → contesto originale → zona che non giustifica ancora un'azione. | Contesto, zona e condizioni di attesa. |
| `swing-2` · Swing: H1/M15 e M5/M1 | Passaggio ai timeframe inferiori → sequenza delle conferme → invalidazione ignorata durante la discesa. | Sequenza e invalidazioni, distinguendo M5/M1 scelto e conferme effettive. |
| `swing-3` · Swing: caso completo | Preparazione ed evoluzione su più sessioni → caso documentato → revisione necessaria al cambio del contesto. | Simulazione motivata, piano originale, modifiche ed esito. |

### Modulo 8 — Diario e revisione

| ID e titolo | Concetto → esempio → controesempio | Esercizio da consegnare |
| --- | --- | --- |
| `revisione-1` · Registrare evidenze | Fonte, ambiente, aderenza e risultato dopo i costi → evidenza tracciabile → risultato senza provenienza o costi. | Evidenza con dati disponibili e dati mancanti dichiarati. |
| `revisione-2` · Rivedere anche perdite e attese | Separare processo ed esito → due casi diversi → selezione dei soli successi. | Confronto di un caso favorevole e uno sfavorevole o senza operazioni. |
| `revisione-3` · Una correzione verificabile | Un errore osservabile e una risposta → modifica singola verificata → lista vaga di buoni propositi. | Una correzione, criterio di verifica e data della revisione successiva. |

## 4. Calendario praticabile

### Preparazione prima dell'apertura commerciale

Riservare quattro settimane di produzione, circa **12–18 ore alla settimana** tra ricerca dei casi, scalette, registrazione, montaggio e controllo. È una stima di lavoro da misurare con il primo video, non una durata garantita.

| Settimana | Produzione | Condizione per procedere |
| --- | --- | --- |
| P1 | Sei video: moduli 1 e 2; modello comune per grafici e schede. | Il docente valida definizioni e leggibilità del primo video pilota. |
| P2 | Sei video: moduli 3 e 4; glossario originale dei trigger. | Nessun trigger resta descritto solo tramite un acronimo. |
| P3 | Sei video: moduli 5 e 6; materiali scalp e soluzioni. | Il replay consente di distinguere informazioni note ed esito successivo. |
| P4 | Sei video: moduli 7 e 8; verifica completa del percorso e caricamento. | Video riproducibili, consegne funzionanti, termini e pagamenti pronti. |

Aprire le vendite del corso completo quando il catalogo promesso è effettivamente pronto. Se si sceglie una pubblicazione progressiva, riscrivere prima l'offerta con contenuti disponibili, date e condizioni esatte; non vendere le scalette come lezioni fruibili.

### Primo mese dell'allievo

| Settimana | Percorso | Consegna principale |
| --- | --- | --- |
| 1 | Moduli 1–2: preparazione, ciclo, liquidità e attesa. | Una preparazione completa e un caso in cui attendere. |
| 2 | Moduli 3–4: scenari, schematiche, trigger. | Due grafici confrontati con conferme e incompatibilità. |
| 3 | Moduli 5–6: target, invalidazione e scalp. | Una simulazione scalp completa con revisione. |
| 4 | Moduli 7–8: swing, evidenze e miglioramento. | Una simulazione swing e una correzione verificabile. |

Cadenza proposta: due lezioni lunedì, due mercoledì, due venerdì; consegna entro domenica; feedback entro cinque giorni lavorativi. Il catalogo può restare tutto consultabile: questa è una guida di studio, non un vincolo tecnico di sblocco. Tempo indicativo allievo: 1–2 ore di video e 2–3 ore di esercizi alla settimana.

Dal secondo mese: un caso nuovo alla settimana, una consegna e relativa revisione. Stimare 10–14 ore settimanali del docente per un gruppo di 25 persone, includendo contenuti, feedback e amministrazione. Prima di aggiungere sessioni dal vivo, inserirne tempi, capienza e registrazioni nell'offerta; non considerarle già incluse.

## 5. Affiliazione diretta: regole operative

| Regola | Comportamento richiesto |
| --- | --- |
| Accesso gratuito | L'affiliato può aderire senza comprare Academy, Pro o materiali e senza mantenere un proprio abbonamento. Nessuna quota d'ingresso. |
| Un solo livello | Compenso sul cliente direttamente attribuito. Nessun compenso per reclutare altri affiliati o per vendite dei loro invitati. |
| Base di calcolo | 20% del pagamento Academy attribuito, effettivamente incassato, comprensivo dell'IVA inclusa nel prezzo. Importi rimborsati o contestati generano rettifiche. |
| Esempio | Incasso 150 € → commissione lorda 30 €. Incasso ridotto a 120 € → 24 €. Rimborso totale → commissione residua zero. Un periodo gratuito non produce commissioni. |
| Ricorrenza | Ogni successivo pagamento valido dello stesso abbonamento attribuito può generare la commissione. Una fattura non pagata non produce credito spendibile. |
| Attribuzione | Associazione tracciata tra cliente e referente; vietati auto-inviti e attribuzioni multiple. La regola di attribuzione e la sua eventuale durata devono essere dichiarate nei termini e coincidere con il sito. |
| Maturazione | Attesa di 30 giorni dall'incasso prima dell'ammissibilità al pagamento. I 30 giorni non eliminano il rischio di rimborsi o contestazioni successivi. |
| Liquidazione | Ciclo mensile, dopo riconciliazione e raccolta dei documenti fiscali necessari. Non chiamare il saldo «pagato» prima che il trasferimento sia stato eseguito e riscontrato. |
| Rettifiche | Rimborso parziale: ricalcolo proporzionale; rimborso totale: azzeramento. Contestazione: sospensione/rettifica secondo esito. Se già liquidata, registrare il debito e il recupero/compensazione previsto dal contratto, mantenendo la traccia. |
| Comunicazione | L'affiliato dichiara chiaramente il compenso quando promuove il corso. Vietare promesse di trading profittevole, reddito certo e pressione a comprare per guadagnare. |

La commissione è un corrispettivo commerciale lordo, non un rendimento di investimento né un netto fiscale garantito. L'uso colloquiale di «royalty» non stabilisce la qualificazione fiscale: commercialista e contratto devono definirla. Specificare se gli importi sono comprensivi di eventuale IVA dell'affiliato, le ritenute applicabili e gli adempimenti delle parti, senza aggiungere costi automaticamente non modellati.

Per ogni liquidazione conservare riferimenti a pagamento e fattura, base commissionabile, aliquota, maturazione, rettifiche, documento dell'affiliato, importo trasferito e riferimento del bonifico/trasferimento. Il calendario operativo proposto è: chiusura del rendiconto nei primi cinque giorni lavorativi del mese e pagamento entro il giorno 15 delle commissioni già mature e documentate; inserirlo nei termini solo dopo aver verificato di poterlo rispettare.

La struttura esclude quote per ottenere il diritto di guadagnare, livelli, downline, bonus reclutamento e rendimenti finanziati dall'arrivo di nuovi partecipanti. L'AGCM individua come elemento delle vendite piramidali il contributo versato per ottenere compensi derivanti principalmente dall'ingresso di altri consumatori anziché dalla vendita o dal consumo del prodotto. La presenza di un corso, da sola, non risolve il problema: contano funzionamento e promozione effettivi. [Fonte AGCM](https://agcm.it/media/comunicati-stampa/2014/3/alias-6815).

## 6. Economia dell'abbonamento

Scenario puramente illustrativo: prezzo finale 150 €, IVA ipotizzata al 22%, tutti gli allievi attribuiti a un affiliato, commissione 20% sul lordo, costi di incasso 5 € per pagamento e costi variabili di servizio 5 € per allievo/mese. **Il 22% non è una classificazione fiscale del corso; 5 € non è una tariffa Stripe verificata.** Sostituire queste ipotesi con trattamento fiscale e costi contrattuali reali. La fiscalità delle commissioni può modificare ulteriormente il risultato.

| Voce per un rinnovo intero | Calcolo | Importo |
| --- | --- | ---: |
| Incasso cliente | Prezzo finale | 150,00 € |
| IVA inclusa, ipotesi 22% | 150 − 150 / 1,22 | 27,05 € |
| Ricavo al netto dell'IVA ipotizzata | 150 / 1,22 | 122,95 € |
| Commissione affiliato | 150 × 20% | −30,00 € |
| Costi di pagamento ipotizzati | Da sostituire con tariffe effettive | −5,00 € |
| Costi variabili ipotizzati | Hosting/supporto per allievo | −5,00 € |
| Contributo ai costi fissi | Prima di costi fissi, imposte e imprevisti | **82,95 €** |

Con costi fissi mensili ipotizzati di 2.000 €, comprensivi di un budget per il lavoro del docente, il punto di copertura aritmetico sarebbe circa 25 rinnovi interi. È valido soltanto alle ipotesi indicate, senza rimborsi, insoluti o ulteriori costi. Usare valori non arrotondati nei calcoli, arrotondare solo la presentazione.

| Rinnovi pagati/mese | Incasso lordo | Commissioni lorde | Contributo dopo i costi variabili ipotizzati | Residuo dopo 2.000 € di costi fissi |
| ---: | ---: | ---: | ---: | ---: |
| 25 | 3.750,00 € | 750,00 € | 2.073,77 € | 73,77 € |
| 50 | 7.500,00 € | 1.500,00 € | 4.147,54 € | 2.147,54 € |
| 100 | 15.000,00 € | 3.000,00 € | 8.295,08 € | 6.295,08 € |

Il residuo non è utile netto, reddito disponibile o previsione di vendita. Mancano, secondo il caso, imposte dirette, contributi, effetti fiscali delle fatture degli affiliati, acquisizione clienti, contestazioni, consulenze aggiuntive e maggiori ore di assistenza. A 50 o 100 allievi non si presume che il servizio costi quanto a 25: ricalcolare il lavoro necessario prima di vendere nuovi posti.

**Continuità senza nuovi iscritti:** ogni rinnovo deve finanziare quel mese di servizio e la relativa commissione. Una base esistente sufficiente può sostenere l'attività anche con zero nuovi clienti; se gli allievi disdicono, ricavi e commissioni diminuiscono. Ad esempio, una base di 50 che cala a 45, poi 40, poi 36 produce ricavi decrescenti anche senza nuove spese di acquisizione. Non assumere crescita perpetua né promettere che la continuità sia garantita.

Separare la cassa destinata a IVA, commissioni maturande/mature, rimborsi e spese di servizio. Il periodo di attesa non rende il denaro libero da obbligazioni. Preparare ogni mese un prospetto di cassa a 90 giorni con scenario zero nuovi ingressi e rinnovi in calo; se il servizio non è sostenibile, intervenire su costi e offerta rispettando gli impegni già venduti.

## 7. Informazioni e verifiche prima del lancio

La scheda ESMA sui finfluencer pubblicata nel gennaio 2026 richiama trasparenza dei compensi, distinzione tra fatti e opinioni e correttezza dei messaggi. Anche contenuti qualificati come educativi possono, in determinati contesti, costituire raccomandazioni o consulenza; un disclaimer non cambia da solo la natura dell'attività. Il docente deve far verificare esempi, promozioni, eventuali sessioni interattive e conflitti di interesse; evitare raccomandazioni personalizzate prive dei necessari presupposti. [Scheda ESMA, versione italiana](https://www.esma.europa.eu/sites/default/files/2026-01/IT_Italy_it_-_Finfluencers_factsheet.pdf).

Per la vendita online, presentare prima del pagamento identità e contatti del venditore, contenuti, prezzo complessivo, ricorrenza, durata, disdetta, recesso e gestione reclami; fornire una conferma contrattuale conservabile. Il pulsante deve rendere chiaro l'obbligo di pagamento. [Your Europe: commercio elettronico B2C](https://europa.eu/youreurope/business/selling-in-eu/selling-goods-services/ecommerce-distance-selling/index_it.htm).

Il recesso è normalmente di 14 giorni per gli acquisti a distanza, con regole ed eccezioni specifiche. L'accesso a contenuti digitali e l'erogazione continuativa di servizi richiedono una classificazione corretta: non applicare automaticamente una rinuncia generale perché l'allievo ha aperto un video. Per i contenuti digitali, la perdita del diritto richiede i presupposti previsti, inclusi consenso e riconoscimento espressi; far predisporre il percorso corretto per questa offerta mista. [Your Europe: restituzioni e recesso](https://europa.eu/youreurope/citizens/consumers/shopping/returns/index_it.htm).

| Responsabile | Prerequisito esterno | Evidenza per l'apertura |
| --- | --- | --- |
| Docente | Registrare e validare le lezioni; completare le definizioni originali; autorizzazioni sui grafici/materiali. | Catalogo pubblicato coerente con ciò che si vende, esercizi e soluzioni verificati. |
| Titolare + commercialista | Inquadramento attività, prezzo finale, IVA, fatturazione, vendite estere e commissioni. | Istruzioni contabili e documenti richiesti agli affiliati. |
| Titolare + consulente legale | Termini Academy, affiliazione, privacy, recesso, disdetta e promozioni. | Testi applicabili approvati dal titolare e percorso di accettazione coerente. |
| Titolare + amministratore pagamenti | Account Stripe idoneo, prodotto/prezzo mensile, ambiente live, webhook e portale cliente. | Configurazione effettiva e verifiche di pagamento/rinnovo/disdetta/rimborso. |
| Titolare + amministratore video | Hosting, accessi, privacy e disponibilità dei video. | Riproduzione verificata con account allievo; valutazione dei limiti di condivisione dei link. |
| Titolare + amministratore sito | Migrazioni database e configurazione del docente nell'ambiente scelto. | Account docente e allievo verificati, permessi corretti e contenuti protetti. |
| Titolare + amministrazione | Procedura di liquidazione e riconciliazione. | Rendiconto di prova con commissione matura, rimborso e rettifica; mezzo di pagamento realmente configurato. |

Il software può registrare lezioni, accessi e commissioni; non registra al posto del docente i contenuti originali, non apre autonomamente un'attività fiscale e non rende veri trasferimenti di denaro non eseguiti. Le funzioni tecniche consegnate vanno distinte dai servizi esterni ancora da attivare nel resoconto di rilascio.

## 8. Controllo mensile del servizio

Misurare allievi paganti e rinnovi, disdette, pagamenti falliti, rimborsi, utilizzo dei contenuti, consegne, tempi di feedback e ore del docente. Per l'affiliazione: incassi attribuiti, commissioni in attesa, mature, rettificate e pagate, con riconciliazione al registro dei pagamenti. Per l'economia: ricavi al netto delle imposte indirette applicabili, costi reali, cassa vincolata e copertura dei prossimi tre mesi.

Il criterio di successo iniziale è erogare il programma promesso, ottenere consegne verificabili e sostenere il servizio attraverso i rinnovi dei clienti soddisfatti. Correggere una causa concreta di difficoltà didattica o di abbandono per mese, senza trasformare i risultati di pochi allievi in una promessa universale.
