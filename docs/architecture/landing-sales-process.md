# Landing: dagli errori ripetuti a un processo verificabile

Ristrutturazione locale del piano marketing approvato, 10 ottobre 2026.
La working tree contiene anche altri interventi preesistenti. Nessun deploy.

## Percorso commerciale

La pagina parla al trader che ha una strategia ma fatica a seguirla con continuità.
La sequenza è promessa, missione e fiducia, problemi riconoscibili, giornata
desiderata, dimostrazione, ragioni per scegliere, prove disponibili, confronto,
Free/Pro, obiezioni e invito finale. Il messaggio centrale è:
«Il prossimo trade non cancellerà gli errori che ripeti».

Tutte le CTA commerciali aprono `/sign-up` per creare un account Free. L'acquisto
Pro resta nell'app autenticata. Il pulsante della colonna Pro dichiara questo
passaggio, senza promettere un checkout immediato o una prova Pro gratuita.

## Implementazione

`LandingPage.tsx` compone le sezioni in `components/landing/`. Il CSS della landing
usa colori e tipografia propri, senza modificare il tema degli spazi autenticati.
Barlow Condensed e Manrope sono font locali WOFF2, con le relative licenze OFL;
Manrope usa un file variabile per ciascun sottoinsieme Latin/Latin extended.
La navbar misura la propria altezza per lasciare spazio anche nelle lingue con
etichette lunghe. Le ancore `features`, `how`, `pricing`, `faq` restano disponibili.

La dimostrazione è manuale: Preparazione, Test, Piano, Revisione. I tab funzionano
con frecce, Home ed End e mantengono il focus. Nessun timer di avanzamento.
I dati sono dichiarati simulati, includono perdite e deviazioni annotate e non
sono presentati come risultati reali. Saltare direttamente all'ultimo passaggio
non completa la dimostrazione; la completano soltanto tutti e quattro i passaggi
visitati. La prima scena è visibile anche prima dell'interazione.

Gli endpoint pubblici esistenti forniscono solo statistiche e recensioni:
nessuna nuova API, migrazione o modifica degli entitlement. Conteggi assenti,
non validi o nulli sono nascosti; il numero dei profili è chiamato «trader iscritti».
Le recensioni provengono esclusivamente dall'endpoint delle recensioni pubblicate.
Se sono disponibili solo conteggi, la sezione si intitola «La piattaforma in numeri».
La dimostrazione e il resto della pagina non dipendono dalle API.

Le cinque lingue hanno copy aggiornato. Anche le pagine pubbliche Prezzi,
Chi siamo e Diario correggono le descrizioni di sincronizzazione e piani.
Free include diario manuale, notizie, rischio, calendario, piano e routine;
Pro aggiunge backtest, sync broker, archivio personale e classifiche.
L'analisi Edge non viene venduta come esclusiva Pro.

La landing inglese `/` viene mostrata anche durante l'inizializzazione di Clerk,
senza alterare l'accesso al workspace dopo l'autenticazione. Il validator SEO
respinge i messaggi di indisponibilità/configurazione dell'autenticazione invece
di accettarli come pagine pubbliche solo perché contengono un `h1`.

## Confronti, prezzo e misurazione

Le fonti consultate il 10 ottobre 2026 sono
[TraderSync](https://tradersync.com/pricing/) e
[Edgewonk](https://edgewonk.com/pricing). Prezzi nella valuta originale, mensile
separato dall'annuale, note su IVA e promozioni, nessun risparmio aggregato o
confronto di funzionalità che attribuisca ai concorrenti soltanto un singolo tool.
I riferimenti vanno ricontrollati prima della pubblicazione e quando cambiano.

Verifica Stripe in sola lettura: prezzo attivo, EUR 700 centesimi, ricorrenza
mensile con intervallo 1, modalità live. Corrisponde ai 7 €/mese pubblicizzati.
`tax_behavior` è `unspecified`: prima di pubblicare resta da verificare il
trattamento fiscale e il totale nel checkout configurato. Nessuna sessione di
pagamento creata e nessun pagamento effettuato durante questa verifica.

Gli eventi `landing_cta_click` includono posizione, lingua e destinazione
`free_signup`; `landing_demo_start` e `landing_demo_complete` vengono emessi una
sola volta per montaggio. Sono distinti dalla conversione reale `sign_up` esistente.
Gli eventi richiedono analytics configurato e consenso attuale, anche dopo
un'eventuale revoca. Non è stata certificata la ricezione degli eventi in GA live.

## Verifiche

Controlli browser tramite un'anteprima temporanea con iframe della stessa origine:
375, 768 e 1440 CSS px; cinque lingue a 375 px; nessun overflow o testo sotto 14 px;
font caricati, canonical e FAQ presenti. Provati selettori lingua, dimostrazione,
frecce da tastiera, completamento, FAQ e ingresso nella registrazione. Nessun account
creato. L'anteprima temporanea è stata rimossa dal sorgente e dal build output.
Non è una verifica su telefoni fisici o una certificazione completa con screen reader.

Verifica numerica di 15 coppie testo/superficie: contrasto minimo 7,62:1.
Il movimento ridotto disattiva le transizioni della landing; non ci sono animazioni
automatiche. La preferenza su un dispositivo fisico non è stata esercitata.

Il renderer mostra la route in elaborazione e gli errori per pagina, con timeout
del protocollo di 30 secondi. I file vengono salvati solo dopo tutte le catture
riuscite: riscrivere `index.html` durante il ciclo lasciava a sirv un Content-Length
obsoleto e troncava le risposte successive prima del contenitore React.
La verifica finale riparte da una build fresca, senza snapshot precedenti.

Esito finale: TypeScript frontend/backend passato; build frontend fresca e prerender
**45/45** passati; cinque snapshot della landing con copy e metadati verificati;
lint dei file della landing e del renderer senza errori.

Ultimo `pnpm verify`: **421/425** test passati, quattro fallimenti nel backend
modificato contemporaneamente nel workspace: `accountDeletion.coverage.static`,
`newsHub/intelligence`, `newsHub/newsHubRuntime`, `newsHub/socketServer`.
Il gate generale quindi non è verde. Le verifiche della landing passano.
Nel classifier NewsHub è stata corretta solo la guardia TypeScript che esclude
`uncertain`, mantenendo la stessa logica del controllo sul Set.
Nessuna correzione delle nuove regole NewsHub o della cancellazione account.

## Aggiornamento visivo, 11 ottobre 2026

Su richiesta, la landing usa ora un allineamento centrato per testi, titoli, CTA,
controlli, offerte e footer. Hero, missione e FAQ seguono un asse centrale; i quattro
passaggi si dispongono orizzontalmente su desktop e si adattano al mobile.
Pulsanti e selettore lingua sono a pillola; pannelli, offerte, tab e FAQ hanno
angoli arrotondati da 18 a 32 px.

Verificati in browser 375, 768 e 1440 CSS px: nessuno scorrimento orizzontale,
titoli centrati con scostamento nullo dall'asse della pagina e font caricati.
Controllate visivamente demo, offerte e apertura FAQ. Test statici di navigazione,
contenuti/traduzioni e FAQ passati; formattazione CSS valida; nuova build e
prerender **45/45** riusciti. L'anteprima tecnica temporanea è stata rimossa.
Il gate generale backend documentato sopra non è stato rieseguito per questa
modifica di stile. Nessuna pubblicazione.

## Revisione di processo e numeri, 11 ottobre 2026

I quattro passaggi del processo diventano card autonome con icona, nome, scopo
e stato selezionato ad alto contrasto. Le didascalie sono tradotte nelle cinque
lingue. Il pannello dimostrativo comprende una schermata del prodotto e quattro
card distinte per problema, azione, informazione e decisione. Restano la
navigazione manuale, i ruoli tab/tabpanel e la logica di completamento.

La sezione numeri usa una fascia unica arrotondata, con icone, cifre ampie e
descrizioni semantiche `dt`/`dd`. Il titolo ha una scala più contenuta e i dati
continuano a provenire dagli endpoint pubblici. Recensioni assenti o conteggi
non validi rimangono nascosti. Corretto anche il nome della classe delle
introduzioni di sezione, affinché usino la tipografia prevista.

Verificati in browser 375, 768 e 1440 CSS px senza overflow e con font caricati;
controllate visivamente le nuove card su desktop/mobile, il pannello demo e
la fascia numeri desktop. Provata la selezione del passaggio Test. TypeScript,
lint dei componenti, controlli di navigazione/contenuti, transizioni del tour,
copy di produzione e parità delle traduzioni passati. Build e prerender
**45/45** riusciti. L'anteprima tecnica temporanea è stata rimossa.

## Revisione del confronto prezzi, 11 ottobre 2026

Il confronto usa tre card con prezzo, periodicità, pagamento, scopo e tre
gruppi di funzioni. TraderLoading Pro è al centro su desktop e per primo su
tablet/mobile. Il messaggio diventa «Un unico processo. 7 € al mese».
La CTA dichiara «Inizia Free, poi scegli Pro» e registra la posizione
`comparison` tramite gli analytics esistenti. Nuova ancora pubblica `compare`.

Ricontrollate le pagine ufficiali TraderSync ed Edgewonk l'11 ottobre 2026:
TraderSync Pro 29,95 USD/mese oppure 269,52 USD/anno; Edgewonk 197 USD ogni
12 mesi, IVA al checkout. La pagina Edgewonk riporta anche 169 USD in
contenuti promozionali: questo è indicato nelle condizioni apribili, senza
attribuire alla promozione una disponibilità certa. Originali valute e
periodicità rimangono visibili; nessuna conversione o percentuale di risparmio.
Per TraderLoading, 84 € indica dodici pagamenti mensili da 7 €, senza vendere
un nuovo abbonamento annuale.

Verificato in browser il layout a 375, 768 e 1440 CSS px: nessun overflow, font
caricati, testi almeno 14 px e CTA con destinazione `/sign-up`. Provata
l'apertura delle condizioni del confronto. TypeScript, lint del componente,
controlli di contenuto e navigazione, copy di produzione, parità delle cinque
lingue e formattazione passati. Nuova build e prerender **45/45** riusciti.
L'anteprima tecnica temporanea è stata rimossa; nessuna pubblicazione.

## Footer e movimento, 11 ottobre 2026

Il footer separa Prodotto, Risorse e Azienda in tre gruppi arrotondati con icone
e collegamenti centrati. A 640 px e sotto, i gruppi diventano disclosure native
chiuse inizialmente, apribili anche da tastiera. Supporto e Accedi hanno accessi
dedicati; Privacy e Termini restano fuori dai gruppi, sempre disponibili.
Il collegamento Torna in alto e l'etichetta della navigazione sono tradotti nelle
cinque lingue. Il cambio di breakpoint riporta il focus al titolo del gruppo
prima di chiuderlo, se il focus era su uno dei suoi collegamenti.

Hero, sezioni e gruppi di card entrano con una breve dissolvenza e uno spostamento
verticale, una sola volta. Il controller osserva anche prove caricate dal backend
e pannelli della dimostrazione sostituiti manualmente. Pulsanti, icone, link,
progressione della demo e contenuti apribili hanno microinterazioni coerenti.
La preferenza di movimento ridotto disattiva animazioni e transizioni. Il focus
su un controllo conclude subito la sua animazione. La pagina rimane visibile
senza API di animazione e nelle schede in background, il cui timeline può essere
sospeso da Safari; il cambio di visibilità annulla il movimento in corso.

Controllato visivamente il footer in Safari a 375, 768 e 1440 CSS px, senza
overflow e con font caricati; provata l'apertura del gruppo Prodotto su mobile.
I test del controller coprono API assenti, preferenze, contenuti dinamici, focus,
visibilità e cleanup. TypeScript, lint e formattazione dei file modificati
passati. Build frontend e prerender **45/45** riusciti, con footer e metadati
pubblici presenti nelle cinque lingue. Rimossa l'anteprima tecnica temporanea.

`pnpm verify` completo passato: **435 test, 0 errori**, compilazione delle librerie
e degli artefatti, build e prerender. La prima esecuzione si era fermata alla
build perché la chiave pubblica Clerk non era nell'ambiente del comando;
la seconda usa la configurazione già presente in `.env.local`, senza stampare
credenziali. Nessuna pubblicazione.

## Navigazione compatta e posizionamento, 11 ottobre 2026

La navigazione è estratta in `LandingNavigation.tsx`: una barra flottante
arrotondata su una sola riga, alta 58 px su mobile e 66 px su tablet/desktop.
Sotto 961 px i collegamenti, la lingua e Accedi passano in un menu modale
Radix Dialog, con focus iniziale, gestione di Escape e chiusura quando si sceglie
una sezione o si cambia lingua. Il ritorno al layout desktop chiude il menu.
La CTA Free resta visibile, con testo breve su mobile e nome accessibile completo.
Le ancore mantengono un margine sotto il bordo inferiore effettivo della barra.

Il posizionamento diventa «Il sistema operativo del tuo metodo di trading» per
il trader indipendente che ha già una strategia e fatica a seguirla. Il percorso
prende il nome Ciclo TL; la frase associata al marchio è «Dalla strategia alla
disciplina». Categoria, destinatario e meccanismo sono applicati a hero, missione,
footer e SEO nelle cinque lingue. La scelta commerciale, il confronto con le
comunicazioni ufficiali dei concorrenti e i criteri di validazione sono descritti
in [traderloading-positioning.md](../marketing/traderloading-positioning.md).

Verificati in Safari 375, 768 e 1440 CSS px, più 961 e 320 px con etichette
tedesche: nessun overflow, comandi contenuti nella barra e font caricati. Provati
apertura del menu, Escape, collegamento al processo e cambio lingua da desktop
e da mobile. L'ancora del processo su mobile si posiziona a 92 px, con bordo
inferiore della barra a 68 px. Aggiornati i controlli di navigazione e traduzioni
per il componente estratto. Lint e formattazione passati. `pnpm verify` passato:
**435 test, 0 errori**, compilazione, build e prerender **45/45**. Controllati gli
snapshot pubblici nelle cinque lingue. Rimossa l'anteprima tecnica temporanea;
nessuna pubblicazione.
