# GEMINI.md — Contesto Operativo & Regole Inviolabili AUREUS

> Questo file è caricato all'avvio di ogni sessione e definisce il quadro operativo e di design di **AUREUS** (Protocollo Aureus / AUREUS PROTOCOL).
>
> 🏛️ **MEMORIA OPERATIVA SOVRANA (Obsidian Vault)**:
> La fonte unica e definitiva di memoria, regole fisse, architettura backend, design system frontend, sicurezza e ottimizzazione risiede in:
> 👉 [`BRAIN.md`](BRAIN.md) e nel vault modulare [`docs/brain/00-ATLAS.md`](docs/brain/00-ATLAS.md).

---

## 1. Regola Maestra: Design System & Lore Inviolabile

Ogni modifica all'interfaccia utente, aggiunta di componenti, modali, testi o sezioni deve conformarsi rigorosamente a:
👉 [`.agents/rules/limen-design-system.md`](.agents/rules/limen-design-system.md)

### Principi Cardine Inviolabili:
1. **Zero Vuoti Ingiustificati**: Saturare lo spazio libero con strumenti e telemetrie operative; mantenere colonne bilanciate in altezza (`flex-stretch`).
2. **Zero Muri di Testo**: Nessuna descrizione prolissa; sintesi chirurgica a colpo d'occhio, elenchi a badge e indicatori semantici.
3. **No Andare a Capo Antiestetici & No Troncamenti Impropri**:
   - `whitespace-nowrap` obbligatorio su valori + unità (`10%`, `$1,450.00`, `5 Trade`, `15 min`).
   - Mai troncare nomi di sfidanti o titoli con `..` quando c'è spazio orizzontale.
4. **Viewport Fitting & Visibilità Testata**:
   - Mai nascondere o tagliare l'header (`BANCO DI FORGIATURA` e barra KPI sempre visibili).
   - Scroll interni controllati con `overflow-y-auto` e scrollbar dorata sottile.
5. **Divieto Assoluto di Tag Brutti o Tecnici**:
   - Vietati tag di debug come `"DB"`, `"ORVAL"`, `"TEST"`, `"MOCK"`, `"SCHEMA"`.
   - Solo status chip raffinate nei toni oro, smeraldo, rubino e ardesia.
6. **Brand AUREUS & Lessico Solenne**:
   - Linguaggio stoico, monastico, architettonico.
   - Usare sempre: *La Forgia del Passato*, *Le Prove del Fuoco (Arene)*, *Il Libro della Verità*, *Il Custode della Soglia*, *L'Ordine Giornaliero*, *La Gerarchia dell'Integrità*, *Dossier dell'Operatore*, *L'Iniziato / L'Operatore / L'Architetto*.
   - Nessun termine da gambling o gaming retail.

---

## 2. Architettura & Stack Tecnologico

- **Monorepo**: pnpm workspaces
  - `artifacts/trader-dashboard`: Frontend React 19 + Vite 7 + Wouter + Tailwind CSS
  - `artifacts/api-server`: Backend Express 5 + TypeScript + WebSockets
  - `lib/db`: Drizzle ORM + PostgreSQL
  - `lib/api-spec`: Contratto OpenAPI sorgente di verità (`openapi.yaml`)
  - `contracts/`: Definizioni di lore e gradi (`limenLexicon.ts`, `limenGrades.ts`)
- **Comandi di convalida**:
  - `pnpm typecheck` — Convalida TypeScript strict
  - `pnpm --filter @workspace/trader-dashboard build` — Compilazione frontend Vite
  - `pnpm verify` — Gate completo di rilascio

---

## 3. Protocollo di Autonomia Agentica & Compattazione Memoria (Regola 98/2)

Ogni azione, interazione e ciclo operativo deve conformarsi rigorosamente a:
👉 [`.agents/rules/sovereign-agentic-protocol.md`](.agents/rules/sovereign-agentic-protocol.md)

### Principi Operativi Inviolabili:
1. **Compattazione Chirurgica dei Dati (Token & Context Distillation)**:
   - Eliminare l'entropia verbosa, i log di terminale elefantiaci, i preamboli e i dubbi intermedi.
   - Conservare sempre i 5 Pilastri di Stato: *Perimetro & Obiettivo*, *Vincoli & Contratti*, *Matrice di Impatto*, *Telemetria di Verifica*, *Grafo di Avanzamento (DAG)*.
2. **Calcolo Autonomo del Protocollo Step-by-Step**:
   - L'agente non chiede mai all'Utente come strutturare il lavoro o quali passaggi compiere.
   - All'ingresso di un mandato, l'agente calcola autonomamente la sequenza operativa (Fase 0: Ricognizione → Fase 1: Contratti/Schema → Fase 2: Forgiatura Codice → Fase 3: Self-Healing & Gate → Fase 4: Distillazione Memoria & Consegna).
3. **Zero-Friction Autonomy (Chiedere Conferma Meno Costantemente)**:
   - **Livello Verde (98% dei casi)**: Scrittura codice, refactoring, fix bug, unit test, compilazione, typecheck, styling UI, documentazione interna. **ZERO conferme richieste. Esecuzione diretta ed autonoma.**
   - **Livello Giallo (1.5% dei casi)**: Aggiunta dipendenze leggere o schemi additivi: esecuzione autonoma con notifica sintetica nel debrief.
   - **Livello Rosso (0.5% dei casi)**: Solo operazioni irreversibili e distruttive (drop DB persistiti, wipe file core, rottura di contratti esterni critici) richiedono stop preventivo con il **5% Decision Memo** (< 60s di lettura).

---

## 4. Regola Inviolabile di Chiusura Lavoro: Proattività Architetturale

> [!IMPORTANT]
> **A LAVORO FINITO, PROPORRE SEMPRE NUOVE IDEE E SOLUZIONI**:
> Al termine di ogni implementazione, refactoring o risoluzione di bug, l'agente ha l'obbligo vincolante di **non fermarsi alla mera esecuzione passiva**.
> Deve sempre proporre all'utente:
> 1. **Nuove Idee e Miglioramenti Strategici**: Ottimizzazioni UX, feature d'eccellenza, telemetrie avanzate o raffinamenti architetturali coerenti con l'Ethos AUREUS.
> 2. **Piano d'Azione Passo-Passo Ordinato**: Una sequenza logica, ordinata e progressiva dei prossimi passi consigliati per far avanzare l'ecosistema in modo solido e privo di regressioni.
