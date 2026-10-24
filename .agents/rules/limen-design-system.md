---
description: Linee guida inviolabili di design, layout, spazi, tipografia, assenza di muri di testo e brand narrative per LIMEN
trigger: always_on
---

# LIMEN PROTOCOL (TL: Trans-Limen) — Regole Inviolabili di Design, Spazi e Narrazione

> **REGOLA GENERALE PER QUALSIASI AGENTE O SVILUPPATORE**:
> Ogni volta che si aggiunge, modifica o rifattorizza un componente, una vista, un testo o uno strumento nell'applicazione, questo documento costituisce il **contratto inviolabile** da rispettare. Nessuna feature può essere rilasciata in violazione di queste regole.

---

## 1. Identità del Brand & Narrazione Solenne (Ethos LIMEN)

LIMEN non è una piattaforma di scommesse retail, né un videogioco arcade con punti XP. È un **Ordine Operativo e Spirituale** basato sul *Codice della Presenza e dell'Eredità*: rigore matematico, disciplina monastica, architettura sovrana ed esecuzione priva di esitazione.

### A. Tono di Voce & Lessico Ufficiale
- **Tono**: Solenne, stoico, chirurgico, nobile, austero, architettonico.
- **Tabella di Corrispondenza Termini (Inviolabile)**:

| Termine Vietato (Retail / Gaming / Generico) | Termine Obbligatorio LIMEN |
| :--- | :--- |
| Backtest / Simulatore generico | **La Forgia del Passato** / **Banco di Forgiatura** |
| Tornei / Match / Gare / Partite | **Le Prove del Fuoco** / **Arene della Disciplina** |
| Trading Journal / Diario di trading | **Il Libro della Verità** |
| Checklist Pre-Trade / Filtro entrate | **Il Custode della Soglia** |
| Routine giornaliera / Daily task | **L'Ordine Giornaliero** |
| Classifica / Leaderboard / Punti XP | **La Gerarchia dell'Integrità** / **Indice di Integrità** |
| Profilo utente / Account settings | **Dossier dell'Operatore** |
| Chat / Social / Community | **La Fratellanza (Agorà dell'Ordine)** |
| Formazione / Video academy | **La Dottrina del Tempo** |
| Livelli di gioco (Lvl 1, Lvl 2...) | **I 5 Gradi di Ascesa** (Novizio, Custode, Sovrano...) |
| Utente / Player / Scommettitore | **L'Operatore** / **L'Iniziato** / **L'Architetto** |
| Perdita emotiva / Gioco d'azzardo | **La Deriva** |
| Transizione al controllo conscio | **Il Varco** |

---

## 2. Palette Cromatica & Finishes Architettonici

L'applicazione utilizza un tema **Nero Ossidiana & Oro Imperiale (Aureus)** arricchito da accenti semantici di rigore:

```css
/* Palette Fondamentale LIMEN */
--limen-bg-obsidian:    #07080b; /* Sfondo sovrano più profondo */
--limen-bg-panel:       #0d0f14; /* Pannelli primari */
--limen-bg-subpanel:    #11131c; /* Contenitori interni e card */

--limen-gold-base:      #C5A059; /* Oro aureo imperiale */
--limen-gold-glow:      #E8C56A; /* Oro chiaro illuminato per testi e badge */
--limen-gold-hover:     #F3D88C; /* Oro di interazione attiva */
--limen-gold-border:    rgba(197, 160, 89, 0.22); /* Bordi nobili */

--limen-emerald:        #10b981; /* Smeraldo dell'Integrità (P&L positivo, vittoria, conformità) */
--limen-crimson:        #ef4444; /* Rubino della Disciplina (Drawdown, violazione stop, squalifica) */
--limen-slate-subtle:   #94a3b8; /* Testi secondari e metadati neutri */
```

- **Divieto di Gradienti Arlecchino o Colori Fluorescenti da Casinò**: non usare mai viola neon, ciano acceso o gradiente arcobaleno.
- **Superfici**: Bordi sottili (`1px solid rgba(197, 160, 89, 0.2)`), leggero bagliore dorato su hover (`box-shadow: 0 0 15px rgba(197, 160, 89, 0.12)`).

---

## 3. Spazi Vuoti, Saturazione Intelligente & Bilanciamento del Layout

1. **Nessun Vuoto Ingiustificato**:
   - È vietato lasciare ampie aree morte o mezze schermate vuote.
   - Lo spazio libero orizzontale o laterale deve essere valorizzato con strumenti pertinenti:
     - Micro-telemetria in tempo reale (conteggio partecipanti, profit factor medio, timer o orari di mercato).
     - Selettori rapidi o campi di ricerca / inserimento codice (es. Quick Join stanza della Forgia).
     - Guardrail e regole d'onore della sessione.
2. **Bilanciamento delle Colonne (Flex-Stretch)**:
   - Se due card o due colonne sono affiancate (es. Banco di Forgiatura a sinistra e Stanze/Albo a destra), devono avere **altezze armonizzate**.
   - È vietato creare gradini asimmetrici dove una colonna finisce a metà e lascia sotto un vuoto visivo disordinato. Usare `flex-1`, `h-full` o griglie allineate.

---

## 4. Divieto di "Muri di Testo" (No Dense Walls of Text)

1. **Sintesi Chirurgica**:
   - LIMEN è un cockpit decisionale per professionisti: ogni elemento testuale deve essere fruibile in **meno di 2 secondi**.
   - Nessun paragrafo informativo o di istruzione deve superare **1–2 righe**.
2. **Gerarchia Visiva a Scansione Rapida**:
   - Preferire sempre:
     - Liste puntate con icone semantiche (Lucide Icons: `ShieldCheck`, `Crosshair`, `Flame`, `Trophy`, `Zap`).
     - Struttura `Etichetta: Valore` in formato compatto.
     - Badge di stato con bordo e colore semantico.
   - Non spiegare con lunghi discorsi quello che una metrica o un'icona rende evidente.

---

## 5. Regole Inviolabili contro Troncamenti e Andare a Capo Anti-Estetici

1. **Divieto di Separare Unità e Numeri (`whitespace-nowrap`)**:
   - Qualsiasi dato numerico, percentuale, valuta o unità temporale deve viaggiare unito con la classe `whitespace-nowrap`:
     - ❌ `Drawdown Massimo \n 10%`  ➡️  ✅ `<span className="whitespace-nowrap">Drawdown Massimo 10%</span>`
     - ❌ `Campione Minimo 5 \n Trade`  ➡️  ✅ `<span className="whitespace-nowrap">5 Trade</span>`
     - ❌ `+ \n $1,450.00`  ➡️  ✅ `<span className="whitespace-nowrap">+$1,450.00</span>`
     - ❌ `15 \n min`  ➡️  ✅ `<span className="whitespace-nowrap">15 min</span>`
2. **Divieto di Troncamenti Prematuri (`..`)**:
   - È severamente vietato applicare `truncate` a caso causando diciture sfigurate come `GARIKFX VS MA..`.
   - I contenitori flessibili per titoli di duello, nomi o asset devono prevedere:
     - `min-w-0` sul genitore flessibile.
     - Spazio adeguato e dimensione font proporzionata (`text-[11px]` o `text-xs`).
     - Larghezza minima garantita (`min-w-[120px]`) affinché i nomi di due sfidanti siano sempre leggibili per intero.
3. **Divieto di Parole Orfane**:
   - Nessun titolo di sezione o intestazione di card deve avere una singola parola lasciata sola su una nuova riga per mancanza di pochi pixel di larghezza.

---

## 6. Viewport Fitting & Visibilità della Testata

1. **Nessun Taglio di Header**:
   - La testata operativa (es. `BANCO DI FORGIATURA`, barra KPI, controlli globali) **non deve mai** essere spinta fuori dalla parte superiore della vista o tagliata.
   - Lasciare sempre il dovuto margine superiore (`pt-3` o `mt-2`) e verificare la visibilità a risoluzioni laptop (1280x800 e 1440x900).
2. **Scroll Interno Controllato**:
   - Quando una vista o un cockpit contiene molti dati, il contenitore principale deve gestire lo scroll con `overflow-y-auto` interno e rifinito con scrollbar sottile a tema dorato (`scrollbar-thin scrollbar-thumb-[#C5A059]/30`).
   - Evitare doppi scroll annidati (evitare un `overflow-y-scroll` dentro un altro `overflow-y-scroll`).

---

## 7. Divieto Assoluto di Tag Brutti, Tecnici o di Debug

1. **Banditi i Residui di Sviluppo**:
   - È tassativamente vietato renderizzare badge con nomi di tabelle, database o stringhe tecniche grezze (es. `"DB"`, `"ORVAL"`, `"SCHEMA"`, `"MOCK"`, `"LOCAL"`, `"TEST"`).
   - È vietato usare pillole grigie anonime prive di padding o con stili non curati.
2. **Formato Ufficiale dei Tag / Status Chips**:
   Ogni chip o badge deve rispettare lo standard aristocrazia LIMEN:
   - Font: `font-mono text-[9px] uppercase font-bold tracking-wider`.
   - Padding: `px-1.5 py-0.5 rounded`.
   - Bordo e sfondo coordinati (es. `bg-[#C5A059]/15 border border-[#C5A059]/35 text-[#E8C56A]`).

---

## 8. Tipografia & Numeri Finanziari (Monospace)

- **Tutti i dati numerici finanziari devono essere renderizzati in font monospace**:
  - P&L in valuta (`+$1,250.00`)
  - Percentuali (`+15.20%`, `-3.50%`)
  - Pips (`+42.5 pips`)
  - Rapporto R:R e Profit Factor (`PF 2.10`, `1.85 R`)
  - Orari, date e codici stanza (`FORGIA-9481`, `14:30:00`)
  - Usare le classi: `font-mono tracking-tight`.

---

## 9. Checklist Operativa Pre-Rilascio (Da verificare SEMPRE)

Prima di dichiarare completata qualsiasi modifica o aggiunta all'interfaccia:

- [ ] **1. Spazi & Vuoti**: C'è spazio morto o asimmetria tra le colonne affiancate? (Risolto con flex o saturazione operativa).
- [ ] **2. Muri di Testo**: Ci sono paragrafi più lunghi di 2 righe? (Risolto sintetizzando in bullet/metriche).
- [ ] **3. Troncamenti**: C'è qualche `..` antiestetico su nomi, titoli o sfide? (Risolto con layout flessibile ed elastico).
- [ ] **4. Line-Wrap**: Qualche numero è finito a capo separato dalla sua unità (`%`, `$`, `Trade`)? (Risolto con `whitespace-nowrap`).
- [ ] **5. Viewport & Header**: Il titolo e la barra superiore sono completamente visibili senza clipping?
- [ ] **6. Tag & Badges**: Sono spariti tutti i tag di debug e le chip hanno lo stile imperiale LIMEN?
- [ ] **7. Lessico di Brand**: I termini usati rispettano la tabella LIMEN (nessun gergo gambling o gaming arcade)?
