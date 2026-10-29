---
title: "FRONTEND SYSTEM — Regole Inviolabili di Design & UI/UX"
type: frontend-rules
vault: aureus-os
tags:
  - aureus/frontend
  - aureus/design-system
  - aureus/tailwind
  - aureus/react19
version: 1.0.0
last_updated: 2026-10-25
---

# 🎨 FRONTEND SYSTEM — Regole Inviolabili di Design & UI/UX

> [!IMPORTANT]
> **REGOLA D'ORO**: Il frontend di AUREUS è un cockpit decisionale e monastico. Ogni elemento visivo deve trasmettere autorevolezza, rigore matematico e perfezione estetica. Qualsiasi difetto di layout o gerarchia visiva è considerato una violazione del protocollo.

Torna a: [[00-ATLAS]] | Precedente: [[02-BRAND-AND-LORE]] | Prosegui a: [[04-BACKEND-CONTRACTS]]

---

## 1. Palette Cromatica AUREUS (Nero Ossidiana & Oro Imperiale)

L'applicazione utilizza esclusivamente la palette ufficiale nobile:

```css
/* Palette Fondamentale AUREUS */
--limen-bg-obsidian:    #07080b; /* Sfondo sovrano più profondo */
--limen-bg-panel:       #0d0f14; /* Pannelli primari e cockpit */
--limen-bg-subpanel:    #11131c; /* Contenitori interni e card */

--limen-gold-base:      #C5A059; /* Oro aureo imperiale */
--limen-gold-glow:      #E8C56A; /* Oro illuminato per testi e badge */
--limen-gold-hover:     #F3D88C; /* Oro di interazione attiva */
--limen-gold-border:    rgba(197, 160, 89, 0.22); /* Bordi nobili */

--limen-emerald:        #10b981; /* Smeraldo dell'Integrità (P&L +, vittoria, conformità) */
--limen-crimson:        #ef4444; /* Rubino della Disciplina (Drawdown, violazione stop, DQ) */
--limen-slate-subtle:   #94a3b8; /* Testi secondari e metadati neutri */
```

> [!CAUTION]
> **Divieto di Gradienti Arlecchino o Colori Fluorescenti da Casinò**: non usare mai viola neon, ciano acceso o gradiente arcobaleno.

---

## 2. Le 7 Regole Inviolabili di Layout & Interfaccia

### Regola 1: Zero Spazi Morti Ingiustificati
- È vietato lasciare ampie aree morte o mezze schermate vuote.
- Quando una vista o una card ha spazio libero laterale o orizzontale, deve essere saturato con telemetria operativa pertinente: micro-metriche, filtri rapidi, orari di mercato, statistiche di integrità.
- **Colonne Bilanciate (`flex-stretch`)**: Due card o colonne affiancate devono avere altezza armonizzata tramite `flex-1`, `h-full` o griglie allineate. Vietati gradini visivi asimmetrici.

### Regola 2: Zero Muri di Testo (No Dense Walls of Text)
- AUREUS è un cockpit per professionisti: ogni elemento testuale deve essere compreso in **meno di 2 secondi**.
- **Nessun paragrafo informativo o di istruzione deve superare 1–2 righe**.
- Usare sempre:
  - Liste puntate con icone semantiche (Lucide Icons: `ShieldCheck`, `Crosshair`, `Flame`, `Trophy`, `Zap`).
  - Struttura `Etichetta: Valore` in formato compatto.
  - Badge di stato con bordo e colore semantico.

### Regola 3: Divieto Assoluto di Separare Unità e Numeri (`whitespace-nowrap`)
Qualsiasi dato numerico, percentuale, valuta o unità temporale deve viaggiare unito con la classe `whitespace-nowrap`:
- ❌ `Drawdown Massimo \n 10%`  ➡️  ✅ `<span className="whitespace-nowrap">Drawdown Massimo 10%</span>`
- ❌ `Campione Minimo 5 \n Trade`  ➡️  ✅ `<span className="whitespace-nowrap">5 Trade</span>`
- ❌ `+ \n $1,450.00`  ➡️  ✅ `<span className="whitespace-nowrap">+$1,450.00</span>`
- ❌ `15 \n min`  ➡️  ✅ `<span className="whitespace-nowrap">15 min</span>`

### Regola 4: Divieto Assoluto di Troncamenti Prematuri (`..`)
- È severamente vietato applicare `truncate` a caso provocando stringhe mozzate come `GARIKFX VS MA..`.
- I contenitori flessibili per titoli di duello, sfidanti o asset devono garantire:
  - `min-w-0` sul genitore flessibile.
  - Dimensione font proporzionata (`text-[11px]` o `text-xs`).
  - Larghezza minima garantita (`min-w-[120px]`) affinché i nomi di due sfidanti siano sempre leggibili per intero.
- **Zero Parole Orfane**: Nessun titolo di card deve avere una singola parola lasciata isolata su una nuova riga per difetto di pochi pixel.

### Regola 5: Viewport Fitting & Header Sempre Visibile
- La testata operativa (es. `BANCO DI FORGIATURA`, barra KPI, controlli globali) **non deve mai** essere spinta fuori dalla parte superiore della vista o tagliata dal margine superiore.
- **Scroll Interno Controllato**: Lo scroll principale deve risiedere all'interno del contenitore (`overflow-y-auto`) con scrollbar dorata discreta (`scrollbar-thin scrollbar-thumb-[#C5A059]/30`).
- **Vietati i doppi scroll annidati**.

### Regola 6: Divieto Assoluto di Tag Brutti, Tecnici o di Debug
- È tassativamente vietato renderizzare badge con nomi di tabelle, database o stringhe tecniche grezze (es. `"DB"`, `"ORVAL"`, `"SCHEMA"`, `"MOCK"`, `"LOCAL"`, `"TEST"`).
- **Formato Ufficiale dei Tag / Status Chips**:
  - Font: `font-mono text-[9px] uppercase font-bold tracking-wider`.
  - Padding: `px-1.5 py-0.5 rounded`.
  - Bordo e sfondo coordinati (es. `bg-[#C5A059]/15 border border-[#C5A059]/35 text-[#E8C56A]`).

### Regola 7: Tipografia Finanziaria Monospace
Tutti i dati numerici finanziari devono essere renderizzati con font monospace:
- P&L in valuta (`+$1,250.00`)
- Percentuali (`+15.20%`, `-3.50%`)
- Pips (`+42.5 pips`)
- Rapporto R:R e Profit Factor (`PF 2.10`, `1.85 R`)
- Orari, date e codici identificativi (`FORGIA-9481`, `14:30:00`)
- Classi obbligatorie: `font-mono tracking-tight`.

---

## 3. Direttive Tecniche React 19 & Radix UI

1. **Stabilità dei Callback Ref (Radix UI `@radix-ui/react-slot@1.5.0`)**:
   Non generare mai funzioni ref anonime inline all'interno di componenti montati in `Presence` o cicli di commit: causa l'errore `Maximum update depth exceeded` in React 19. Usare ref stabili o `useComposedRefs`.
2. **Accessibilità dei Modali (`useDialogA11y`)**:
   Ogni modale custom o overlay deve implementare `useDialogA11y` per il focus trapping e la chiusura corretta con tasto `Escape`.
3. **Clearance Mobile Bottom Nav**:
   Su mobile, ogni layout a scorrimento deve includere il padding inferiore di sicurezza (`pb-20` o `pb-24`) per non finire coperto dalla barra di navigazione inferiore.
