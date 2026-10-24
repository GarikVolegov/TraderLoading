ALTER TABLE academy_lessons ADD COLUMN IF NOT EXISTS stream_video_id text;
ALTER TABLE academy_lessons ADD COLUMN IF NOT EXISTS access_level text NOT NULL DEFAULT 'protocol';
ALTER TABLE academy_lessons ADD COLUMN IF NOT EXISTS content_kind text NOT NULL DEFAULT 'lesson';
ALTER TABLE academy_lessons ADD COLUMN IF NOT EXISTS introduction_slot text;
ALTER TABLE academy_lessons DROP CONSTRAINT academy_published_video;
ALTER TABLE academy_lessons ADD CONSTRAINT academy_published_video CHECK (
 NOT published OR (content_kind = 'book' AND length(trim(body_markdown)) > 0)
 OR (content_kind = 'lesson' AND (stream_video_id IS NOT NULL OR (video_url IS NOT NULL AND length(trim(video_url)) > 0)))
);
ALTER TABLE academy_lessons ADD CONSTRAINT academy_access_level_check CHECK (access_level IN ('free', 'protocol'));
ALTER TABLE academy_lessons ADD CONSTRAINT academy_content_kind_check CHECK (content_kind IN ('book', 'lesson'));
CREATE UNIQUE INDEX academy_introduction_slot_unique ON academy_lessons (introduction_slot) WHERE introduction_slot IS NOT NULL;
ALTER TABLE candidate_applications ADD COLUMN IF NOT EXISTS request_key text UNIQUE;
CREATE TABLE launch_emails (
 key text PRIMARY KEY, user_id text, kind text NOT NULL, recipient text NOT NULL,
 subject text NOT NULL, body text NOT NULL, path text NOT NULL,
 status text NOT NULL DEFAULT 'pending', attempts integer NOT NULL DEFAULT 0,
 available_at timestamptz NOT NULL DEFAULT now(), created_at timestamptz NOT NULL DEFAULT now(), sent_at timestamptz
);
CREATE INDEX launch_emails_pending_idx ON launch_emails(status, available_at);
CREATE TABLE academy_videos (id text PRIMARY KEY, owner_id text NOT NULL, state text NOT NULL DEFAULT 'uploading', created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE school_requests (
 id serial PRIMARY KEY, request_key text NOT NULL UNIQUE, school text NOT NULL, name text NOT NULL, email text NOT NULL,
 current_students integer NOT NULL, monthly_entrants integer NOT NULL, needs text NOT NULL,
 status text NOT NULL DEFAULT 'new', notes text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now()
);
-- Existing lessons remain reserved, with their IDs, publication state and progress intact.
-- Slots are editorial drafts; only the owner can publish them and opt them into free access.
INSERT INTO academy_lessons (id, module_id, title, description, content_kind, introduction_slot, created_by, order_index)
VALUES
 ('aa000000-0000-4000-8000-000000000001', 'preparazione', 'Biblioteca LIMEN · Introduzione', 'Libro introduttivo da rivedere prima della pubblicazione.', 'book', 'book', 'migration', 0),
 ('aa000000-0000-4000-8000-000000000002', 'preparazione', 'Capitolo 0 · Il processo LIMEN', 'Video introduttivo del docente.', 'lesson', 'chapter0', 'migration', 1),
 ('aa000000-0000-4000-8000-000000000003', 'preparazione', 'Preparare una sessione in simulazione', 'Prima lezione guidata con esercizio.', 'lesson', 'lesson1', 'migration', 2),
 ('aa000000-0000-4000-8000-000000000004', 'preparazione', 'Documentare e rivedere una sessione', 'Seconda lezione guidata con esercizio.', 'lesson', 'lesson2', 'migration', 3)
ON CONFLICT DO NOTHING;

-- Preserve the existing authored books as unpublished editorial drafts, outside the public bundle.
INSERT INTO academy_lessons (id,module_id,title,description,content_kind,body_markdown,created_by,order_index) VALUES ('aa000000-0000-4000-8000-000000000005','preparazione','Biblioteca LIMEN · I tre orizzonti','Testo originale da rivedere e validare prima della pubblicazione.','book','La Ricognizione

Mappatura & Cartografia HTF (Daily · H4 · H1)

Sun Tzu & Scipione l''Africano

Cognitio ante Proelium

L''Arte della Guerra & Zama · 500 a.C. - 202 a.C.

«Il terreno detta la strategia. Chi non conosce la geografia del campo di battaglia e le leggi che muovono le truppe avversarie ha già perso prima di estrarre la spada.»

Sun Tzu & Scipione l''Africano — Trattato di Guerra & Dottrina di Zama

Dalla Cartografia Bellica alla Liquidità Istituzionale & Leggi di Wyckoff

La mappatura High Timeframe (Daily, H4, H1) è la ricognizione topografica del campo di battaglia prima di schierare l''esercito. Attraverso le 3 Leggi di Wyckoff (Domanda/Offerta, Causa/Effetto, Sforzo/Risultato), individuiamo dove i market maker hanno ammassato le riserve: i pool di liquidità Buy-Side e Sell-Side (BSL/SSL), i vuoti di volume (Fair Value Gap) e la soglia matematica dell''Equilibrium 50%. Nessun soldato scende in campo finché le alture non sono dominate.

DAILY → H4 → H1

Modulo 1: Mappatura & Liquidità HTF

TIMEFRAME DI RICOGNIZIONE

Daily / H4 / H1

TARGET DI LIQUIDITÀ

BSL & SSL Pool

SOGLIA MATEMATICA

50% Equilibrium

CONDIZIONE D''AZIONE

Attesa Test Estremo

Tracciamento Obbligatorio PDH / PDL

Fissare i massimi e minimi del giorno precedente (PDH/PDL) e della settimana (PWH/PWL) prima dell''apertura delle borse. Le zone centrali sono rumore.

Divieto di Acquisto in Zona Premium

Vietato comprare sopra la mediana del range o vendere in zona Discount. Gli ordini istituzionali si accumulano solo a prezzo fortemente scontato.

Isolamento di Order Block & FVG Vergini

Selezionare esclusivamente disequilibri non ancora mitigati. Una zona già toccata ha esaurito i suoi contratti e non costituisce difesa.

Fissazione del Livello Morto

Dichiarare per iscritto il livello di prezzo che annulla il bias prima di toccare qualsiasi tasto della piattaforma operativa.

La Falange e il Contropiede

Filtri di Inversione & Cambio di Carattere ITF (M15 · H1)

Leonida & Giulio Cesare

Murus Aeneus · Contra-Impetus

Le Termopili & Il Rubicone · 480 a.C. - 49 a.C.

«Finché la falange resta unita con scudi serrati e lance tese, nessun''onda nemica potrà spezzare il nostro fronte. Non precipitatevi incontro alla carica dell''avversario: lasciate che si sfoghi nel vuoto, che creda di aver sfondato, e nel momento esatto del suo sbilanciamento sferrate il contropiede letale.»

Leonida I & Giulio Cesare — Dottrina della Barriera e dell''Impeto

Dalla Barriera degli Scudi alla Trappola dello Sweep

Nei timeframe intermedi (M15 / H1), la pazienza è la nostra falange impenetrabile. L''operatore retail cade costantemente nella trappola dell''inducement: confonde una spinta emotiva con un breakout ed entra sui massimi. La nostra dottrina attende che il falso assalto sbatta contro il muro (Sweep di Liquidità) e che gli algoritmi interbancari rispondano con una candela di spostamento violenta (Displacement). Solo quando la struttura interna si infrange (Market Structure Shift) passiamo all''attacco.

M15 → H1

Modulo 2: Filtri di Inversione ITF

TIMEFRAME DI CONFERMA

M15 / H1

FINESTRA TEMPORALE

Kill-Zone London/NY

CONFERMA ENERGETICA

Displacement Candle

TRIGGER DI CARATTERE

MSS con FVG

Ingaggio Esclusivo in Kill-Zone

Nessuna operazione al di fuori delle finestre di massima efficienza interbancaria (London Open 08:00-10:30 UTC o NY Open 13:30-16:00 UTC).

Assorbimento Senza Chiusura Esterna

Se il prezzo chiude con corpo candela solido oltre l''estremo, lo sweep è INVALIDATO (si tratta di espansione reale). Attendere la presa secca.

Candela di Displacement Obbligatoria

Esigere un corpo di candela solido, privo di ombre d''indecisione, che generi un Fair Value Gap ITF. È l''impronta indiscutibile del grande capitale.

Rottura Strutturale Conclamata

Violazione netta dell''ultimo swing point interno. Senza un MSS conclamato su M15, è SEVERAMENTE VIETATO scendere sui grafici al minuto.

L''Assalto Chirurgico

Esecuzione LTF & Regola di Invalidazione (M1 · M5 Scalp)

Napoleone & Musashi

Ictus Unicus · Celeritas et Exactitudo

Austerlitz & Il Libro dei Cinque Anelli · 1645 - 1805

«La vittoria non risiede nella moltitudine disordinata dei colpi, ma nella concentrazione totale del fuoco nel punto più vulnerabile del fronte nemico, al minuto prestabilito. Nel duello decisivo non vi è spazio per l''esitazione né per la speranza: un solo affondo chirurgico, oppure il fodero si chiude e la ritirata è immediata.»

Napoleone Bonaparte & Miyamoto Musashi — La Lama e il Cannone

Dalla Balistica Militare al Trigger al Minuto

Sul grafico al minuto (M1 e M5), il trading abbandona la teoria e diventa balistica applicata. Quando Sun Tzu ha mappato il terreno e la falange di Cesare ha certificato l''inversione, l''esecutore piazza un ordine limite sul rintracciamento dell''Order Block o al 50% del Fair Value Gap al minuto. Lo Stop Loss non è un''opinione: è una barriera matematica di 2.5 - 4.5 pips oltre la manipolazione. Se il prezzo non esplode entro 3 candele, la posizione viene abortita all''istante senza speranza.

M1 → M5 SCALP

Modulo 3: Schematiche di Esecuzione LTF

TIMEFRAME ESECUTIVO

M1 / M5 Scalp

TIPOLOGIA ORDINE

Limit su Sweeptest

STOP LOSS MEDIO

2.5 - 4.5 Pips

RAPPORTO R:R TARGET

1:3.5 - 1:5.0+

Ingresso Chirurgico su Rintracciamento

Posizionamento esclusivo su ordini limite al test dell''estremo M1 o del Breaker Block. Vietato rincorrere il prezzo a mercato.

Posizionamento Oltre la Manipolazione

Lo Stop Loss risiede esattamente dove l''idea statistica cessa di esistere. Nessuno spostamento difensivo, nessun allargamento, nessuna mediazione.

Protezione al Primo Pool di Liquidità

Al raggiungimento di Target 1 (TP1), prelievo del 50% della posizione e trailing a Break-Even protetto (+1 pip per commissioni).

Regola Ferrea delle 3 Candele

Se l''impulso volumetrico atteso non si manifesta entro 3 barre M15 dall''innesco del trigger, uscire manualmente a mercato senza indugio.','migration',10) ON CONFLICT DO NOTHING;
INSERT INTO academy_lessons (id,module_id,title,description,content_kind,body_markdown,created_by,order_index) VALUES ('aa000000-0000-4000-8000-000000000006','preparazione','Biblioteca LIMEN · Libro I','Testo originale da rivedere e validare prima della pubblicazione.','book','I

La Legge della Domanda e dell''Offerta

Analisi dello Squilibrio Primario del Campo di Battaglia

Lex Postulandi et Praebendi

Il prezzo non si muove per caso: è governato dalla bilancia tra ordini di acquisto e vendita istituzionali.

Quando l''offerta supera la domanda, il prezzo è matematicamente costretto a scendere in cerca di liquidità a sconto. Quando la domanda prosciuga l''offerta flottante disponibile, l''espansione al rialzo diventa meccanicamente inevitabile. Il retail compra quando il prezzo sale (inseguendo l''impulso tardivo); i grandi condottieri dell''order flow comprano nel silenzio quando l''offerta si esaurisce nell''area di sconto.

Ispezione dell''Order Flow Imbalance su Daily/H4. Divieto assoluto di acquisto se il mercato si trova in zona Premium (sopra il 50% dell''Equilibrium). Ingresso solo dopo la saturazione dell''offerta.

SOGLIA MATEMATICA

Equilibrium 50.0%

STATO OFFERTA

Esaurimento / Float Secco

TIMEFRAME DOMINANTE

Daily → H4

II

La Legge della Causa e dell''Effetto

Studio delle Fasi di Accumulazione e Distribuzione (Mark Up / Mark Down)

Lex Causae et Effectus

Nessun movimento direzionale esplosivo avviene senza una prolungata fase preparatoria orizzontale.

La Causa è il tempo e il volume impiegati dalle mani forti per assorbire contratti (Accumulazione) o scaricarli sul retail (Distribuzione). L''Effetto è la corsa direzionale conseguente (Mark Up verso l''alto o Mark Down verso il basso). Maggiore è l''ampiezza orizzontale della causa, maggiore sarà l''estensione dell''effetto. Chi cerca breakout immediati senza una causa solida finisce regolarmente tritato nelle finte rotture.

Riconoscimento delle schematiche Wyckoff di Tipo 1 e 2. Mappatura della fase di accumulazione prima del Mark Up istituzionale. Proiezione dei target di arrivo sui pool di liquidità opposti.

DURATA DELLA CAUSA

Range Orizzontale H4/Daily

ESITO ATTESO

Mark Up / Mark Down Violento

RAPPORTO TEMPO/SPINTA

Proporzionale alla Base

III

La Legge dello Sforzo vs Risultato

Rilevamento delle Anomalie di Volume per Smascherare le Trappole Istituzionali

Lex Conatus et Eventus

Il volume rappresenta lo sforzo energetico speso; la candela di prezzo rappresenta il risultato ottenuto.

Se registriamo un volume titanico (enorme sforzo) ma il corpo della candela è compresso con lunghe ombre (scarso risultato), siamo in presenza di un assorbimento nascosto: gli istituzionali stanno bloccando il movimento contro gli ordini della folla. Al contrario, se un massimo viene violato con volume flebile, siamo davanti a una trappola priva di interesse reale (Upthrust / Fakeout) pronta a collassare.

Confronto costante tra delta volumetrico e ampiezza di chiusura della candela. Individuazione dello Spring su minimi e dell''Upthrust su massimi per posizionarsi contro la trappola del retail.

ANOMALIA PRINCIPALE

Volume Climax + Corpo Corto

SEGNALE OPERATIVO

Assorbimento / Spring Trap

CONFERMA OBBLIGATORIA

Displacement Successivo

01

Ispezione Confini Daily / H4

Mappatura millimetrica di PDH (Previous Day High), PDL (Previous Day Low), massimi e minimi settimanali (PWH/PWL). Le contrattazioni al centro del range sono scartate come rumore ingannevole.

02

Individuazione Liquidità Pulita (EQH / EQL)

Marcatura visiva degli Equal Highs ed Equal Lows lasciati scoperti. Dove il retail vede una ''resistenza invalicabile'', noi vediamo ordini pendenti e stop loss pronti a essere spazzati via.

03

Mappatura delle Inefficienze (FVG Vergini)

Catalogazione dei Fair Value Gap non mitigati su Daily e H4. Il mercato è un algoritmo che cerca sempre la riconciliazione del valore equo: queste aree agiscono come calamite inevitabili.

04

Dichiarazione del Bias & Livello Morto

Dichiarazione scritta dello scenario operativo prima dell''apertura della sessione, con fissazione del livello esatto che annulla istantaneamente il piano. Senza invalidazione dichiarata, non esiste trade.','migration',10) ON CONFLICT DO NOTHING;
INSERT INTO academy_lessons (id,module_id,title,description,content_kind,body_markdown,created_by,order_index) VALUES ('aa000000-0000-4000-8000-000000000007','preparazione','Biblioteca LIMEN · Libro II','Testo originale da rivedere e validare prima della pubblicazione.','book','STAGE-01

I

L''Arresto e il Climax

Assorbimento Iniziale e Panico della Massa Retail

Obsessio Primaria et Climax Venditionis

PS (Preliminary Support) & SC (Selling Climax)

Il primo sbarramento della falange: l''ondata di vendita retail capitola contro il muro di ordini limite istituzionali.

Durante il Selling Climax (SC), la folla vende nel panico più totale, convinta che il prezzo precipiti all''infinito. I grandi condottieri dell''order flow aprono i cancelli della fortezza e assorbono l''intero volume a prezzi scontati. La violenza dell''assorbimento provoca un rimbalzo tecnico immediato, l''Automatic Rally (AR), definendo il tetto superiore del box, seguito dal Secondary Test (ST) che collauda la solidità del fondo.

Tracciamento immediato dell''Ice Line sul minimo di SC e del Creek Line sul massimo di AR. Divieto categorico di intervenire: il range è appena nato e necessita di maturazione.

PUNTO CHIAVE MINIMO

SC (Supporto Base)

PUNTO CHIAVE MASSIMO

AR (Resistenza Creek)

DELTA VOLUMETRICO

Picco Estremo (Climax)

STAGE-02

II

La Trappola della Valle

La Pulizia Chirurgica della Liquidità sui Minimi del Box

Insidiae Vallis et Purgatio Liquoris

Spring / ST(b) (Secondary Test in Phase B/C)

La falsa rottura ribassista: attirare i venditori allo scoperto per intrappolarli nelle fauci della falange.

Nelle Termopili di Wyckoff, la falange arretra apparentemente oltre l''Ice Line per simulare una disfatta. Il retail shorta il ''breakout'', mentre i possessori di posizioni long vedono scattare i loro Stop Loss. Questa manipolazione genera un massiccio afflusso di liquidità che viene divorato in pochi istanti. Il prezzo rientra a razzo all''interno del box con chiusura netta: la trappola è scattata e i venditori rimangono intrappolati senza via di fuga.

Verifica della chiusura candela M15: se chiude all''interno del box con ombra lunga verso il basso, lo Spring è validato. Se il corpo candela consolida fuori, il setup è INVALIDATO.

TARGET PREDA

Sell-Side Liquidity (SSL)

DURATA MANIPOLAZIONE

1 - 3 Candele M15

SEGNALE DI TRAPPOLA

Re-Entry Veloce nel Box

STAGE-03

III

Il Segnale di Forza e il Salto

Rottura dei Livelli Chiave di Conferma e Ripartenza del Trend

Signum Fortitudinis et Transitus Amnis

SOS (Sign of Strength) & JTC (Jump across The Creek)

L''uscita trionfale dalla fortezza: rottura conclamata della resistenza (The Creek) e avanzata nel Mark Up.

Una volta ripuliti i minimi, l''offerta è totalmente esaurita. Gli algoritmi scatenano l''assalto con una sequenza di candele a corpo solido (Displacement) che frantuma la Creek Line (resistenza AR). È il Sign of Strength (SOS). Il salto oltre il torrente (Jump across The Creek - JTC) certifica il cambio di carattere strutturale. Il mercato esegue un rintracciamento gentile sul vecchio tetto trasformato in supporto (LPS - Last Point of Support) prima di galoppare verso i massimi HTF.

Conferma formale di ''long conf'' con rottura conclamata del Creek. Posizionamento dell''ordine limite sull''LPS o sul Fair Value Gap generato dal salto.

TRIGGER DI CONFERMA

Rottura Creek Line (SOS)

ZONA DI INGRESSO

Retest LPS / FVG di Salto

ESPANSIONE ATTESA

Mark Up Direzionale HTF

Tracciamento Perimetro della Fortezza

Identificare e fissare con linee orizzontali rigide il Selling Climax (minimo assoluto iniziale) e l''Automatic Rally (massimo del primo rimbalzo) su timeframe M15/H1.

Divieto di Anticipazione nella Terra di Mezzo

Qualsiasi fluttuazione centrale compresa tra SC e AR è terra di nessuno. È vietato aprire operazioni speculative fino a quando il prezzo non testa gli estremi del perimetro.

Attesa della Presa di Liquidità sui Minimi

Attendere che il prezzo violi l''Ice Line dello SC. Pretendere un riassorbimento istantaneo entro 1-3 candele con corpo rientrato e picco di volume d''assorbimento.

Esecuzione Esclusiva al Salto del Creek

Attendere che la candela di Displacement superi la Creek Line confermando il Market Structure Shift (MSS). Ingresso solo al retest dell''LPS con Stop Loss sotto lo swing protetto.','migration',10) ON CONFLICT DO NOTHING;

CREATE TABLE academy_weekly_submissions (
 user_id text NOT NULL, week_start date NOT NULL, lesson_id text NOT NULL,
 PRIMARY KEY (user_id, week_start)
);
-- Preserve the already-submitted week when upgrading existing accounts.
INSERT INTO academy_weekly_submissions (user_id, week_start, lesson_id)
 SELECT DISTINCT ON (user_id, date_trunc('week', submitted_at AT TIME ZONE 'Europe/Rome')::date)
 user_id, date_trunc('week', submitted_at AT TIME ZONE 'Europe/Rome')::date, lesson_id
 FROM academy_progress WHERE submitted_at IS NOT NULL ORDER BY user_id, date_trunc('week', submitted_at AT TIME ZONE 'Europe/Rome')::date, submitted_at
 ON CONFLICT DO NOTHING;
