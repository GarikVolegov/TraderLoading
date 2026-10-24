# GEMINI.md — Contesto Operativo & Regole Inviolabili AUREUS

> Questo file è caricato all'avvio di ogni sessione e definisce il quadro operativo e di design di **AUREUS** (Protocollo Aureus / AUREUS PROTOCOL).

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
