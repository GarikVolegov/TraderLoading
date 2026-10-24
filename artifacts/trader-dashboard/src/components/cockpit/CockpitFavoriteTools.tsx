import { useState, useMemo } from "react";
import {
  Calculator,
  Layers,
  Camera,
  RotateCcw,
  Sliders,
} from "lucide-react";

interface CockpitFavoriteToolsProps {
  market: string;
  onReloadChart: () => void;
  onOpenPlan?: () => void;
  onOpenJournal?: () => void;
}

export function CockpitFavoriteTools({
  market,
  onReloadChart,
  onOpenPlan,
  onOpenJournal,
}: CockpitFavoriteToolsProps) {
  const [activeTab, setActiveTab] = useState<"calc" | "levels" | "adr" | "snapshot">("calc");

  // Calculator State
  const [entryPrice, setEntryPrice] = useState<string>("");
  const [stopLoss, setStopLoss] = useState<string>("");
  const [takeProfit, setTakeProfit] = useState<string>("");
  const [riskAmount, setRiskAmount] = useState<string>("5"); // 5€ default risk

  const calcResults = useMemo(() => {
    const entry = parseFloat(entryPrice);
    const sl = parseFloat(stopLoss);
    const tp = parseFloat(takeProfit);
    const risk = parseFloat(riskAmount);

    if (isNaN(entry) || isNaN(sl) || sl === entry || isNaN(risk) || risk <= 0) {
      return null;
    }

    const isLong = entry > sl;
    const slDistance = Math.abs(entry - sl);
    const tpDistance = !isNaN(tp) ? Math.abs(tp - entry) : 0;
    const rrRatio = slDistance > 0 && tpDistance > 0 ? (tpDistance / slDistance).toFixed(2) : "—";

    // Standard Lot calculation approximation:
    // For Gold (XAUUSD): 1 lot = 100 oz. 1 point move ($1) with 1 lot = $100.
    // For Forex (EURUSD): 1 lot = 100,000 units. 1 pip (0.0001) = $10.
    // For Crypto (BTCUSD): 1 contract = 1 BTC.
    let lotSize = 0;
    const m = market.toUpperCase();
    if (m.includes("XAU") || m.includes("GOLD")) {
      lotSize = risk / (slDistance * 100);
    } else if (m.includes("BTC")) {
      lotSize = risk / slDistance;
    } else {
      // Forex 1 pip = 0.0001
      const pips = slDistance / 0.0001;
      lotSize = pips > 0 ? risk / (pips * 10) : 0;
    }

    const projectedProfit = !isNaN(tp) && tpDistance > 0 ? (risk * (tpDistance / slDistance)).toFixed(2) : null;

    return {
      isLong,
      slDistance: slDistance.toFixed(2),
      tpDistance: tpDistance > 0 ? tpDistance.toFixed(2) : "—",
      rrRatio,
      lotSize: lotSize > 0 ? Math.max(0.01, parseFloat(lotSize.toFixed(2))) : 0.01,
      projectedProfit,
    };
  }, [entryPrice, stopLoss, takeProfit, riskAmount, market]);

  return (
    <div className="space-y-4 text-foreground">
      {/* Header Banner */}
      <div className="flex items-center justify-between p-3 rounded-xl border border-primary/20 bg-primary/5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center text-primary font-bold">
            <Sliders size={16} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Strumenti Preferiti · {market}
            </h3>
            <p className="text-xs text-muted-foreground">
              Calcolatori di precisione e scorciatoie per l'operatività rapida sul grafico
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onReloadChart}
          className="text-xs px-2.5 py-1.5 rounded-md border border-white/10 hover:border-primary/40 bg-white/5 hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5"
          title="Ricarica il grafico in caso di problemi di rendering"
        >
          <RotateCcw size={13} />
          <span>Ricarica Grafico</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-white/10 pb-2">
        <button
          type="button"
          className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-colors ${
            activeTab === "calc"
              ? "bg-primary/20 text-primary border border-primary/30"
              : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
          }`}
          onClick={() => setActiveTab("calc")}
        >
          <span className="flex items-center gap-1.5">
            <Calculator size={13} />
            Calcolatore R:R & Lotti
          </span>
        </button>
        <button
          type="button"
          className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-colors ${
            activeTab === "levels"
              ? "bg-primary/20 text-primary border border-primary/30"
              : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
          }`}
          onClick={() => setActiveTab("levels")}
        >
          <span className="flex items-center gap-1.5">
            <Layers size={13} />
            Mappa Livelli Chiave
          </span>
        </button>
        <button
          type="button"
          className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-colors ${
            activeTab === "snapshot"
              ? "bg-primary/20 text-primary border border-primary/30"
              : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
          }`}
          onClick={() => setActiveTab("snapshot")}
        >
          <span className="flex items-center gap-1.5">
            <Camera size={13} />
            Snapshot Rapido
          </span>
        </button>
      </div>

      {/* Tab 1: Calcolatore R:R e Size Lotti */}
      {activeTab === "calc" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="text-[11px] font-mono text-muted-foreground block mb-1">
                Entry Price
              </label>
              <input
                type="number"
                step="any"
                placeholder="es. 2664.50"
                value={entryPrice}
                onChange={(e) => setEntryPrice(e.target.value)}
                className="w-full h-9 rounded-md border border-white/10 bg-black/40 px-3 text-xs font-mono text-foreground focus:border-primary/50"
              />
            </div>
            <div>
              <label className="text-[11px] font-mono text-muted-foreground block mb-1">
                Stop Loss (SL)
              </label>
              <input
                type="number"
                step="any"
                placeholder="es. 2661.00"
                value={stopLoss}
                onChange={(e) => setStopLoss(e.target.value)}
                className="w-full h-9 rounded-md border border-white/10 bg-black/40 px-3 text-xs font-mono text-foreground focus:border-primary/50"
              />
            </div>
            <div>
              <label className="text-[11px] font-mono text-muted-foreground block mb-1">
                Take Profit (TP)
              </label>
              <input
                type="number"
                step="any"
                placeholder="es. 2678.00"
                value={takeProfit}
                onChange={(e) => setTakeProfit(e.target.value)}
                className="w-full h-9 rounded-md border border-white/10 bg-black/40 px-3 text-xs font-mono text-foreground focus:border-primary/50"
              />
            </div>
            <div>
              <label className="text-[11px] font-mono text-muted-foreground block mb-1">
                Rischio Max (€)
              </label>
              <input
                type="number"
                step="any"
                value={riskAmount}
                onChange={(e) => setRiskAmount(e.target.value)}
                className="w-full h-9 rounded-md border border-white/10 bg-black/40 px-3 text-xs font-mono text-foreground focus:border-primary/50"
              />
            </div>
          </div>

          {/* Results Box */}
          {calcResults ? (
            <div className="p-3.5 rounded-xl border border-primary/30 bg-primary/5 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <span className="text-[10px] font-mono text-muted-foreground uppercase block">Direzione</span>
                <strong className={`text-xs font-mono font-bold ${calcResults.isLong ? "text-emerald-400" : "text-rose-400"}`}>
                  {calcResults.isLong ? "🟢 LONG / BUY" : "🔴 SHORT / SELL"}
                </strong>
              </div>
              <div>
                <span className="text-[10px] font-mono text-muted-foreground uppercase block">Size Consigliata</span>
                <strong className="text-sm font-mono font-bold text-primary">
                  {calcResults.lotSize} {market.includes("BTC") ? "BTC" : "Lotti"}
                </strong>
              </div>
              <div>
                <span className="text-[10px] font-mono text-muted-foreground uppercase block">Rapporto R:R</span>
                <strong className="text-sm font-mono font-bold text-foreground">
                  1 : {calcResults.rrRatio}
                </strong>
              </div>
              <div>
                <span className="text-[10px] font-mono text-muted-foreground uppercase block">Target Profit Atteso</span>
                <strong className="text-sm font-mono font-bold text-emerald-400">
                  {calcResults.projectedProfit ? `+${calcResults.projectedProfit}€` : "Definisci TP"}
                </strong>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl border border-dashed border-white/10 text-center text-xs text-muted-foreground font-mono">
              Inserisci Entry e Stop Loss per calcolare la size esatta dei lotti e il rapporto Rischio/Rendimento.
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Mappa Livelli Chiave HTF */}
      {activeTab === "levels" && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            I punti di liquidità istituzionale inviolabili da identificare prima di scendere sui timeframe di trigger (M1/M5):
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="p-3 rounded-lg border border-white/10 bg-white/[0.02]">
              <span className="font-mono text-[10px] text-amber-400 font-bold uppercase tracking-wider block">
                01 · Asian Session Extreme
              </span>
              <p className="text-xs text-foreground mt-0.5">
                Massimo e Minimo della sessione asiatica (00:00–08:00 CET). Lo sweep di uno dei due estremi a Londra è il trigger ad alta probabilità.
              </p>
            </div>
            <div className="p-3 rounded-lg border border-white/10 bg-white/[0.02]">
              <span className="font-mono text-[10px] text-amber-400 font-bold uppercase tracking-wider block">
                02 · FVG Vergine H1 / H4
              </span>
              <p className="text-xs text-foreground mt-0.5">
                Fair Value Gap non mitigato nella direzione del trend ciclico. Area di assorbimento contratti istituzionali.
              </p>
            </div>
            <div className="p-3 rounded-lg border border-white/10 bg-white/[0.02]">
              <span className="font-mono text-[10px] text-amber-400 font-bold uppercase tracking-wider block">
                03 · Previous Day High / Low
              </span>
              <p className="text-xs text-foreground mt-0.5">
                Massimo e Minimo della giornata precedente. Pool primario di stop loss dei trader intraday.
              </p>
            </div>
            <div className="p-3 rounded-lg border border-white/10 bg-white/[0.02]">
              <span className="font-mono text-[10px] text-amber-400 font-bold uppercase tracking-wider block">
                04 · POC Volumetrico (Point of Control)
              </span>
              <p className="text-xs text-foreground mt-0.5">
                Livello di prezzo con il maggior volume scambiato durante l'accumulazione. Punto magnete per il re-test.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Snapshot Rapido */}
      {activeTab === "snapshot" && (
        <div className="space-y-3 p-3.5 rounded-xl border border-white/10 bg-white/[0.02]">
          <h4 className="text-xs font-bold text-foreground flex items-center gap-2">
            <Camera size={14} className="text-primary" />
            Cattura & Allega Schermata
          </h4>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Per salvare l'analisi visiva direttamente nel tuo <strong>Piano Operativo</strong> o nel <strong>Libro della Verità</strong>:
          </p>
          <div className="space-y-1.5 text-xs text-foreground/90 font-mono">
            <div className="flex items-center gap-2">
              <span className="text-primary font-bold">1.</span>
              <span>Premi <kbd className="px-1.5 py-0.5 rounded bg-white/10 border border-white/10">Cmd + Shift + 4</kbd> (Mac) o <kbd className="px-1.5 py-0.5 rounded bg-white/10 border border-white/10">Win + Shift + S</kbd> (Windows)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-primary font-bold">2.</span>
              <span>Seleziona l'area del grafico con le tue annotazioni</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-primary font-bold">3.</span>
              <span>Apri il <strong>Piano Operativo</strong> o il <strong>Libro della Verità</strong> e premi <kbd className="px-1.5 py-0.5 rounded bg-white/10 border border-white/10">Cmd + V</kbd> per incollare l'immagine!</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
