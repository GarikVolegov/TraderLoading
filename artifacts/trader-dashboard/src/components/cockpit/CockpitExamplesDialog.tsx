import { useState, useMemo } from "react";
import { Search, Sparkles } from "lucide-react";

export interface SetupExample {
  id: string;
  title: string;
  asset: string;
  mode: "scalp" | "swing" | "both";
  category: "swept" | "compression" | "continuation" | "reaccum";
  categoryLabel: string;
  trigger: "TEST" | "POC" | "JTC" | "BTI" | "WAIT";
  riskReward: string;
  dove: string;
  sinistra: string;
  come: string;
  target: string;
  lesson: string;
  structureFlow: string[];
}

export const PLAYBOOK_EXAMPLES: SetupExample[] = [
  {
    id: "ex-swept-gold",
    title: "Sweep Asian Low → Reversal M15 → Entry su TEST / POC",
    asset: "XAU/USD",
    mode: "both",
    category: "swept",
    categoryLabel: "Inversione HTF (Sweep)",
    trigger: "POC",
    riskReward: "1 : 3.8",
    dove: "Ciclo Daily chiaramente rialzista. Durante l'apertura di Londra, il prezzo affonda sotto il minimo asiatico (Asian Low) effettuando una caccia alla liquidità sell-side.",
    sinistra: "Mitigazione di una FVG H1 e un blocco d'ordine istituzionale non testato. Assorbimento immediato dei contratti di vendita.",
    come: "Schematica di accumulazione M15 completata (Spring + Sign of Strength). Rottura del massimo relativo e ingresso sul re-test del POC volumetrico a 5 candele.",
    target: "Pool di liquidità opposto sui massimi di sessione (Asian High a 2664.50).",
    lesson: "Non anticipare mai il punto di svolta prima che la liquidità dell'estremo sia stata effettivamente spazzata.",
    structureFlow: [
      "01 · Asian Low spazzato a Londra (-18 pt)",
      "02 · Mitigazione FVG H1 vergine",
      "03 · Schematica M15 con rottura struttura",
      "04 · Target: Asian High raggiunto",
    ],
  },
  {
    id: "ex-compression-eur",
    title: "Compressione di Liquidità (Inside Range) → Restare Fuori (NO TRADE)",
    asset: "EUR/USD",
    mode: "both",
    category: "compression",
    categoryLabel: "Compressione Attiva (Attesa)",
    trigger: "WAIT",
    riskReward: "N/A",
    dove: "Prezzo intrappolato all'interno del range della candela Daily precedente, con equal highs sopra e equal lows sotto.",
    sinistra: "Nessuna zona estrema raggiunta. Il mercato sta comprimendo e accumulando ordini retail da entrambi i lati.",
    come: "Falsi breakout su M15 e candele sovrapposte senza espansione direzionale. Mancanza di reazione istituzionale.",
    target: "Nessun ordine autorizzato. Si resta spettatori fino allo sweep di un estremo.",
    lesson: "In compressione la statistica è zero. La vera disciplina operativa consiste nel non forzare l'ingresso.",
    structureFlow: [
      "01 · Equal Highs & Lows intatti",
      "02 · Nessuna zona estrema toccata",
      "03 · Falsi breakout intermittenti",
      "04 · Disciplina: 0 trade inseriti",
    ],
  },
  {
    id: "ex-jtc-btc",
    title: "Join The Current (JTC) su Trend Forte & Rottura Strutturale",
    asset: "BTC/USD",
    mode: "scalp",
    category: "continuation",
    categoryLabel: "Continuazione JTC / BTI",
    trigger: "JTC",
    riskReward: "1 : 3.0",
    dove: "Forte spinta impulsiva H4 dopo la rottura di una resistenza chiave settimanale. Liquidità retail short spazzata via.",
    sinistra: "Nessun sweep recente di estremi opposti; continuazione fluida del momentum istituzionale.",
    come: "Ritracciamento controllato su M15 al livello di rottura (Join The Current). Rifiuto con candela ad ampio range e ingresso a mercato.",
    target: "Prossimo pool di liquidità non mitigato a monte (massimi mensili).",
    lesson: "Nel trend direzionale forte non cercare mai l'inversione: segui il flusso con JTC sul retest del livello.",
    structureFlow: [
      "01 · Trend H4 esplosivo confermato",
      "02 · Rottura pulita resistenza chiave",
      "03 · Ritracciamento ordinato M15 (JTC)",
      "04 · Target: Estensione 161.8%",
    ],
  },
  {
    id: "ex-reaccum-gold",
    title: "Re-accumulo su Box Intermedio (Rischio Dimezzato)",
    asset: "XAU/USD",
    mode: "swing",
    category: "reaccum",
    categoryLabel: "Re-accumulo Intermedio",
    trigger: "TEST",
    riskReward: "1 : 2.5",
    dove: "Estremo Daily non raggiunto; il prezzo consolida sopra il 50% dell'impulso precedente in fase di espansione.",
    sinistra: "Mitigazione di un box intermedio (area di continuazione non vergine).",
    come: "Schematica M15 con sbilanciamento volumetrico ≥ 10%. Ingresso sul re-test del bordo superiore del box con stop stretto.",
    target: "Test dei massimi settimanali precedenti.",
    lesson: "Nei box intermedi il margine di errore è inferiore: dimezza l'esposizione per preservare il drawdown.",
    structureFlow: [
      "01 · Consolidamento sopra il 50% HTF",
      "02 · Box intermedio mitigato",
      "03 · Sbilanciamento ≥ 10% verificato",
      "04 · Stop ridotto & Rischio 50%",
    ],
  },
  {
    id: "ex-spring-eur",
    title: "Caccia agli Stop (Liquidity Sweep) su Livello Psico M1/M5",
    asset: "EUR/USD",
    mode: "scalp",
    category: "swept",
    categoryLabel: "Inversione HTF (Sweep)",
    trigger: "TEST",
    riskReward: "1 : 4.2",
    dove: "Sweep dell'High della sessione asiatica subito prima del fix di Londra. Caccia alla Buy-Side Liquidity.",
    sinistra: "Presa di liquidità sopra il livello tondo psicologico 1.0900 con rigetto istantaneo in pinbar.",
    come: "Rottura della struttura interna (CHoCH) su M5. Test dell'ultimo blocco d'ordine ribassista M1 e trigger su assorbimento.",
    target: "Sell-Side Liquidity sotto i minimi della sessione (1.0850).",
    lesson: "Il breakout fallito dell'estremo di sessione è la configurazione a più alta probabilità del metodo.",
    structureFlow: [
      "01 · Sweep High asiatico su 1.0900",
      "02 · Pinbar di rigetto su blocco HTF",
      "03 · CHoCH M5 & Entry su test M1",
      "04 · Target: Sell-Side Liquidity",
    ],
  },
];

interface CockpitExamplesDialogProps {
  initialCategory?: string;
  currentMarket?: string;
}

export function CockpitExamplesDialog({ initialCategory, currentMarket }: CockpitExamplesDialogProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory ?? "ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [activeExampleId, setActiveExampleId] = useState<string>(PLAYBOOK_EXAMPLES[0].id);

  const filteredExamples = useMemo(() => {
    return PLAYBOOK_EXAMPLES.filter((ex) => {
      if (selectedCategory !== "ALL" && ex.category !== selectedCategory) return false;
      if (searchTerm) {
        const text = `${ex.title} ${ex.asset} ${ex.trigger} ${ex.dove} ${ex.lesson}`.toLowerCase();
        if (!text.includes(searchTerm.toLowerCase())) return false;
      }
      return true;
    });
  }, [selectedCategory, searchTerm]);

  const activeExample = PLAYBOOK_EXAMPLES.find((e) => e.id === activeExampleId) ?? filteredExamples[0] ?? PLAYBOOK_EXAMPLES[0];

  return (
    <div className="space-y-4 text-foreground">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-primary/20 bg-primary/5">
        <div>
          <span className="font-mono text-[10px] uppercase tracking-widest text-primary font-bold">
            Playbook dei Setup Istituzionali · Esempi Sotto Mano
          </span>
          <h3 className="text-sm font-semibold text-foreground mt-0.5">
            Archivio di Studio delle Schematice & Inversioni
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Consulta la sequenza ideale delle 4 domande prima di eseguire qualsiasi ordine a mercato.
          </p>
        </div>
        <div className="flex items-center gap-1.5 self-start sm:self-center">
          <span className="text-[11px] font-mono text-primary bg-primary/10 border border-primary/30 px-2.5 py-1 rounded-md">
            {PLAYBOOK_EXAMPLES.length} Setup Certificati
          </span>
        </div>
      </div>

      {/* Category Pills & Search */}
      <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center justify-between">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {[
            { id: "ALL", label: "Tutti (5)" },
            { id: "swept", label: "Inversione HTF (Sweep)" },
            { id: "compression", label: "Compressione (Wait)" },
            { id: "continuation", label: "Continuazione (JTC)" },
            { id: "reaccum", label: "Re-accumulo" },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              className={`px-2.5 py-1 text-xs rounded-md font-mono transition-colors shrink-0 ${
                selectedCategory === cat.id
                  ? "bg-primary text-primary-foreground font-bold"
                  : "bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-foreground"
              }`}
              onClick={() => setSelectedCategory(cat.id)}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="relative sm:w-64 shrink-0">
          <Search size={14} className="absolute left-3 top-2.5 text-muted-foreground pointer-events-none" />
          <input
            type="search"
            placeholder="Cerca setup o regola..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-8 rounded-md border border-white/10 bg-[#12131A] pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary/50"
          />
        </div>
      </div>

      {/* Main Split View: Left List + Right Detail */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 min-h-[380px]">
        {/* Left: Setup List */}
        <div className="md:col-span-5 space-y-2 max-h-[460px] overflow-y-auto pr-1">
          {filteredExamples.map((ex) => {
            const isSelected = ex.id === activeExample.id;
            return (
              <button
                key={ex.id}
                type="button"
                className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer ${
                  isSelected
                    ? "bg-primary/10 border-primary text-foreground shadow-[0_0_15px_rgba(212,175,55,0.12)]"
                    : "bg-[#12131A] border-white/5 text-muted-foreground hover:border-white/20 hover:text-foreground"
                }`}
                onClick={() => setActiveExampleId(ex.id)}
              >
                <div className="flex items-center justify-between gap-2 text-[10px] font-mono">
                  <span className="font-bold text-primary">{ex.asset}</span>
                  <span className="px-1.5 py-0.2 rounded bg-white/5 border border-white/10">
                    R:R {ex.riskReward}
                  </span>
                </div>
                <h4 className="text-xs font-semibold text-foreground mt-1 line-clamp-2">
                  {ex.title}
                </h4>
                <div className="flex items-center gap-2 mt-2 text-[10px] text-muted-foreground font-mono">
                  <span className="text-primary/90 font-semibold">{ex.trigger}</span>
                  <span>·</span>
                  <span className="truncate">{ex.categoryLabel}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Right: Detailed Breakdown */}
        <div className="md:col-span-7 rounded-xl border border-white/10 bg-[#0E0F14] p-4 flex flex-col justify-between max-h-[460px] overflow-y-auto">
          <div className="space-y-4">
            {/* Header info */}
            <div className="border-b border-white/10 pb-3">
              <div className="flex items-center justify-between gap-2 text-xs font-mono">
                <span className="px-2 py-0.5 rounded bg-primary/15 text-primary border border-primary/30 font-bold">
                  {activeExample.categoryLabel}
                </span>
                <span className="text-muted-foreground">
                  Trigger: <strong className="text-foreground">{activeExample.trigger}</strong> · Target: <strong className="text-foreground">{activeExample.riskReward}</strong>
                </span>
              </div>
              <h3 className="text-sm sm:text-base font-bold text-foreground mt-1.5">
                {activeExample.title}
              </h3>
            </div>

            {/* Structure Flow Pills */}
            <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
              {activeExample.structureFlow.map((step, idx) => (
                <div key={idx} className="p-2 rounded bg-white/[0.03] border border-white/5 text-muted-foreground">
                  {step}
                </div>
              ))}
            </div>

            {/* 4 Steps Breakdown */}
            <div className="space-y-2.5 text-xs">
              <div className="p-2.5 rounded-lg bg-black/40 border border-white/5 space-y-1">
                <span className="font-mono text-[10px] text-primary uppercase font-bold block">
                  01 / DOVE · Ciclo & Liquidità HTF
                </span>
                <p className="text-muted-foreground leading-relaxed">{activeExample.dove}</p>
              </div>

              <div className="p-2.5 rounded-lg bg-black/40 border border-white/5 space-y-1">
                <span className="font-mono text-[10px] text-primary uppercase font-bold block">
                  02 / SINISTRA · Reazione & Sweep
                </span>
                <p className="text-muted-foreground leading-relaxed">{activeExample.sinistra}</p>
              </div>

              <div className="p-2.5 rounded-lg bg-black/40 border border-white/5 space-y-1">
                <span className="font-mono text-[10px] text-primary uppercase font-bold block">
                  03 / COME · Schematica & Trigger LTF
                </span>
                <p className="text-muted-foreground leading-relaxed">{activeExample.come}</p>
              </div>

              <div className="p-2.5 rounded-lg bg-black/40 border border-white/5 space-y-1">
                <span className="font-mono text-[10px] text-primary uppercase font-bold block">
                  04 / ALLORA · Target & Liquidità Opposta
                </span>
                <p className="text-muted-foreground leading-relaxed">{activeExample.target}</p>
              </div>
            </div>
          </div>

          {/* Key Rule Footer */}
          <div className="mt-4 pt-3 border-t border-white/10 flex items-start gap-2 text-xs text-primary bg-primary/5 p-2.5 rounded-lg">
            <Sparkles size={16} className="shrink-0 text-amber-400 mt-0.5" />
            <p className="leading-snug">
              <strong>Lezione Inviolabile:</strong> {activeExample.lesson}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
