import React, { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import {
  Zap,
  ShieldCheck,
  Building2,
  TrendingUp,
  Layers,
  Sparkles,
  Clock,
  Landmark,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Scale,
  Percent,
  Trophy,
  Filter,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  DollarSign,
  ChevronDown,
  ChevronUp,
  ArrowRight,
} from "lucide-react";
import {
  TOP_5_PROP_FIRMS,
  TOP_5_BROKERS,
  calculatePropFunnelSimulation,
  calculateHybridLimenAllocation,
  calculatePropFirmCompatibility,
  calculateBrokerMonthlyFrictionEuro,
  type PropFirmProfile,
  type UserTradingPreferences,
  type BrokerProfile,
  type TradedAssetCategory,
} from "../../../../../contracts/financialArchitecture";

interface PropFirmCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTradingCapital?: number;
  onOpenTaxDoctrine?: (tab?: "regimes" | "assets" | "prop" | "deadlines") => void;
}

export const PropFirmCalculatorModal: React.FC<PropFirmCalculatorModalProps> = ({
  isOpen,
  onClose,
  initialTradingCapital = 7600,
  onOpenTaxDoctrine,
}) => {
  const [activeTab, setActiveTab] = useState<"asymmetry" | "funnel" | "propEvaluation" | "brokersAndHybrid">("asymmetry");

  // Stato Parametri Simulazione
  const [selectedPropId, setSelectedPropId] = useState<string>("ftmo");
  const [accountSizeEuro, setAccountSizeEuro] = useState<number>(100000);
  const [customFeeEuro, setCustomFeeEuro] = useState<number>(540);
  const [riskPerTradePct, setRiskPerTradePct] = useState<number>(0.5); // 0.5% Half-Kelly
  const [winRatePct, setWinRatePct] = useState<number>(54); // 54% standard
  const [riskRewardRatio, setRiskRewardRatio] = useState<number>(1.85); // 1.85 R
  const [monthlyReturnPct, setMonthlyReturnPct] = useState<number>(3.0); // 3% mensile sul funded
  const [payoutSplitPct, setPayoutSplitPct] = useState<number>(80);

  // Asset selezionato per calcolo attrito broker (EUR/USD, Oro, Nasdaq)
  const [selectedBrokerAsset, setSelectedBrokerAsset] = useState<TradedAssetCategory>("EURUSD");

  // Stato Valutatore Diretto & Preferenze Utente
  const [userPrefs, setUserPrefs] = useState<UserTradingPreferences>({
    tradesNews: true,
    holdsOverWeekend: false,
    usesEaOrBot: false,
    prefersZeroMinDays: true,
    preferredPlatform: "any",
    maxFeeBudgetEuro: 600,
  });

  // Stato Dettaglio Espanso Prop Firm
  const [expandedPropId, setExpandedPropId] = useState<string | null>("ftmo");

  // Stato Volume Broker per Calcolatore di Attrito (Lotti/Mese)
  const [monthlyBrokerLots, setMonthlyBrokerLots] = useState<number>(20);

  // Prop selezionata
  const activeProp = useMemo(() => {
    return TOP_5_PROP_FIRMS.find((p) => p.id === selectedPropId) ?? TOP_5_PROP_FIRMS[0];
  }, [selectedPropId]);

  // Aggiorna fee al variare di accountSize e prop
  const handleSelectAccountTier = (prop: PropFirmProfile, size: number) => {
    setSelectedPropId(prop.id);
    setAccountSizeEuro(size);
    const tier = prop.tiers.find((t) => t.sizeEuro === size);
    if (tier) {
      setCustomFeeEuro(tier.feeEuro);
    }
  };

  // Calcolo Simulazione Funnel Completa
  const sim = useMemo(() => {
    return calculatePropFunnelSimulation({
      accountSizeEuro,
      challengeFeeEuro: customFeeEuro,
      winRatePct,
      riskRewardRatio,
      riskPerTradePct,
      expectedMonthlyReturnPct: monthlyReturnPct,
      payoutSplitPct,
      feeRefundPct: activeProp.feeRefundPct,
    });
  }, [
    accountSizeEuro,
    customFeeEuro,
    winRatePct,
    riskRewardRatio,
    riskPerTradePct,
    monthlyReturnPct,
    payoutSplitPct,
    activeProp.feeRefundPct,
  ]);

  // Pipeline Ibrida LIMEN
  const hybrid = useMemo(() => {
    return calculateHybridLimenAllocation(initialTradingCapital, sim.monthlyNetPayoutEuro);
  }, [initialTradingCapital, sim.monthlyNetPayoutEuro]);

  // Calcolo Compatibilità Personalizzata per tutte le 5 Prop
  const compatibilityMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof calculatePropFirmCompatibility>>();
    for (const prop of TOP_5_PROP_FIRMS) {
      map.set(prop.id, calculatePropFirmCompatibility(prop, userPrefs));
    }
    return map;
  }, [userPrefs]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto bg-[#07080b] border border-[#C5A059]/40 text-foreground p-4 sm:p-6 shadow-2xl scrollbar-thin scrollbar-thumb-[#C5A059]/30">
        <DialogHeader className="pb-3 border-b border-border/60">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-[#C5A059]/15 border border-[#C5A059]/40 text-[#E8C56A]">
                <Zap className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="font-mono text-base sm:text-lg font-bold tracking-tight text-[#E8C56A] uppercase flex items-center gap-2">
                  <span>Valutatore Prop Firm & Broker Sovrani</span>
                  <Badge variant="outline" className="text-[9.5px] border-emerald-500/40 text-emerald-300 font-bold uppercase whitespace-nowrap">
                    Leva Asimmetrica {sim.initialCapitalRoiMultiplier}x
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground font-mono">
                  Valutazione Regole, Analisi Recensioni della Community, Broker FP Markets, XM, Tickmill
                </DialogDescription>
              </div>
            </div>
          </div>

          {/* Navigatore 4 Tab */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-3 font-mono text-[10.5px]">
            <button
              type="button"
              onClick={() => setActiveTab("asymmetry")}
              className={`px-2 py-1.5 rounded-lg border font-bold uppercase transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${
                activeTab === "asymmetry"
                  ? "bg-[#C5A059]/20 border-[#C5A059] text-[#E8C56A] shadow-[0_0_10px_rgba(197,160,89,0.25)]"
                  : "bg-[#0d0f14] border-border/60 text-muted-foreground hover:text-foreground"
              }`}
            >
              <TrendingUp className="h-3.5 w-3.5 shrink-0" />
              <span>1. Asimmetria ROIC</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("funnel")}
              className={`px-2 py-1.5 rounded-lg border font-bold uppercase transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${
                activeTab === "funnel"
                  ? "bg-[#C5A059]/20 border-[#C5A059] text-[#E8C56A] shadow-[0_0_10px_rgba(197,160,89,0.25)]"
                  : "bg-[#0d0f14] border-border/60 text-muted-foreground hover:text-foreground"
              }`}
            >
              <Layers className="h-3.5 w-3.5 shrink-0" />
              <span>2. Funnel 2 Fasi</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("propEvaluation")}
              className={`px-2 py-1.5 rounded-lg border font-bold uppercase transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${
                activeTab === "propEvaluation"
                  ? "bg-[#C5A059]/20 border-[#C5A059] text-[#E8C56A] shadow-[0_0_10px_rgba(197,160,89,0.25)]"
                  : "bg-[#0d0f14] border-border/60 text-muted-foreground hover:text-foreground"
              }`}
            >
              <Filter className="h-3.5 w-3.5 shrink-0" />
              <span>3. Valutatore Prop</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("brokersAndHybrid")}
              className={`px-2 py-1.5 rounded-lg border font-bold uppercase transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${
                activeTab === "brokersAndHybrid"
                  ? "bg-[#C5A059]/20 border-[#C5A059] text-[#E8C56A] shadow-[0_0_10px_rgba(197,160,89,0.25)]"
                  : "bg-[#0d0f14] border-border/60 text-muted-foreground hover:text-foreground"
              }`}
            >
              <Landmark className="h-3.5 w-3.5 shrink-0" />
              <span>4. Broker Sovrani</span>
            </button>
          </div>
        </DialogHeader>

        {/* ═══════════════════════════════════════════════════════════════════════
            TAB 1: ASIMMETRIA DI CAPITALE & RENDIMENTO INIZIALE (ROIC)
           ═══════════════════════════════════════════════════════════════════════ */}
        {activeTab === "asymmetry" && (
          <div className="space-y-4 font-mono pt-1">
            {/* Selettore Rapido Size & Prop */}
            <div className="rounded-xl border border-border/60 bg-[#0d0f14] p-3 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[10.5px] uppercase font-bold text-muted-foreground">
                  Seleziona Scaglione Conto Prop:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {([25000, 50000, 100000, 200000] as const).map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => handleSelectAccountTier(activeProp, size)}
                      className={`px-2 py-0.5 rounded text-[10.5px] font-bold transition-all whitespace-nowrap ${
                        accountSizeEuro === size
                          ? "bg-[#C5A059] text-black shadow-sm"
                          : "bg-[#11131c] text-slate-300 border border-border/60 hover:border-[#C5A059]/50"
                      }`}
                    >
                      €{(size / 1000).toFixed(0)}k
                    </button>
                  ))}
                </div>
              </div>

              {/* Selettore Prop Firm Attiva */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/40">
                <span className="text-[10.5px] uppercase font-bold text-muted-foreground">
                  Prop Firm Benchmark:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {TOP_5_PROP_FIRMS.map((prop) => (
                    <button
                      key={prop.id}
                      type="button"
                      onClick={() => handleSelectAccountTier(prop, accountSizeEuro)}
                      className={`px-2 py-0.5 rounded text-[10.5px] font-bold transition-all whitespace-nowrap ${
                        selectedPropId === prop.id
                          ? "bg-[#C5A059]/20 border border-[#C5A059] text-[#E8C56A]"
                          : "bg-[#11131c] text-slate-400 border border-border/50 hover:text-slate-200"
                      }`}
                    >
                      {prop.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* I 4 Riquadri di Telemetria Asimmetrica */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              <div className="rounded-xl border border-red-500/35 bg-red-950/20 p-2.5 space-y-1">
                <span className="text-[9px] uppercase font-bold text-red-300/80 block whitespace-nowrap">
                  Capitale Reale a Rischio
                </span>
                <div className="text-base sm:text-lg font-bold text-red-400 whitespace-nowrap">
                  {customFeeEuro.toLocaleString("it-IT")} €
                </div>
                <span className="text-[9.5px] text-muted-foreground block whitespace-nowrap">
                  Costo Challenge (Zero Patrimonio)
                </span>
              </div>

              <div className="rounded-xl border border-emerald-500/35 bg-emerald-950/20 p-2.5 space-y-1">
                <span className="text-[9px] uppercase font-bold text-emerald-300/80 block whitespace-nowrap">
                  Payout Netto Mensile
                </span>
                <div className="text-base sm:text-lg font-bold text-emerald-400 whitespace-nowrap">
                  +{sim.monthlyNetPayoutEuro.toLocaleString("it-IT")} €/m
                </div>
                <span className="text-[9.5px] text-muted-foreground block whitespace-nowrap">
                  Split {payoutSplitPct}% su {monthlyReturnPct}% di rendimento
                </span>
              </div>

              <div className="rounded-xl border border-[#C5A059]/40 bg-[#C5A059]/15 p-2.5 space-y-1">
                <span className="text-[9px] uppercase font-bold text-[#E8C56A] block whitespace-nowrap">
                  Moltiplicatore ROIC
                </span>
                <div className="text-base sm:text-lg font-bold text-[#F3D88C] whitespace-nowrap">
                  {sim.initialCapitalRoiMultiplier}x
                </div>
                <span className="text-[9.5px] text-muted-foreground block whitespace-nowrap">
                  vs {sim.directBrokerMonthlyProfitEuro.toFixed(1)} €/m conto personale
                </span>
              </div>

              <div className="rounded-xl border border-emerald-500/40 bg-[#0d0f14] p-2.5 space-y-1">
                <span className="text-[9px] uppercase font-bold text-emerald-400 block whitespace-nowrap">
                  1° Payout + Rimborso
                </span>
                <div className="text-base sm:text-lg font-bold text-foreground whitespace-nowrap">
                  +{sim.firstPayoutWithRefundEuro.toLocaleString("it-IT")} €
                </div>
                <span className="text-[9.5px] text-emerald-300/80 block whitespace-nowrap">
                  Include +{customFeeEuro} € Fee rimborsata
                </span>
              </div>
            </div>

            {/* Regolatori Quantitativi */}
            <div className="rounded-xl border border-border/70 bg-[#0d0f14] p-3.5 space-y-3">
              <div className="flex items-center justify-between pb-1.5 border-b border-border/40">
                <span className="text-[11px] font-bold text-[#E8C56A] uppercase flex items-center gap-1.5">
                  <Scale className="h-3.5 w-3.5 text-[#C5A059]" />
                  <span>Parametri Operativi di Rischio & Rendimento</span>
                </span>
                <Badge variant="outline" className="text-[9.5px] border-[#C5A059]/40 text-[#E8C56A] font-bold">
                  Half-Kelly Standard: 0.50%
                </Badge>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Rischio per Singolo Trade:</span>
                    <strong className="text-foreground whitespace-nowrap">
                      {riskPerTradePct.toFixed(2)}% ({sim.riskPerTradeEuro.toLocaleString("it-IT")} €)
                    </strong>
                  </div>
                  <Slider
                    value={[riskPerTradePct]}
                    min={0.25}
                    max={1.5}
                    step={0.05}
                    onValueChange={([val]) => setRiskPerTradePct(val ?? 0.5)}
                    className="cursor-pointer"
                  />
                  <div className="flex justify-between text-[9.5px] text-muted-foreground">
                    <span className="text-emerald-400">0.25% (40 Stop Loss)</span>
                    <span className="text-[#E8C56A]">0.50% (AUREUS Half-Kelly)</span>
                    <span className="text-red-400">1.00% (10 Stop Loss)</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Rendimento Mensile sul Funded:</span>
                    <strong className="text-emerald-400 whitespace-nowrap">
                      {monthlyReturnPct.toFixed(1)}%/mese (+{sim.monthlyGrossProfitEuro.toLocaleString("it-IT")} €)
                    </strong>
                  </div>
                  <Slider
                    value={[monthlyReturnPct]}
                    min={1.0}
                    max={8.0}
                    step={0.5}
                    onValueChange={([val]) => setMonthlyReturnPct(val ?? 3.0)}
                    className="cursor-pointer"
                  />
                  <div className="flex justify-between text-[9.5px] text-muted-foreground">
                    <span>1.5% (Prudente)</span>
                    <span className="text-[#E8C56A]">3.0% (Benchmark AUREUS)</span>
                    <span>6.0%+ (Aggressivo)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════
            TAB 2: SIMULATORE FUNNEL 2 FASI (10% + 5% & PROBABILITÀ)
           ═══════════════════════════════════════════════════════════════════════ */}
        {activeTab === "funnel" && (
          <div className="space-y-4 font-mono pt-1">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Step 1 */}
              <div className="rounded-xl border border-[#C5A059]/40 bg-[#0d0f14] p-3.5 space-y-2 relative overflow-hidden">
                <div className="absolute top-0 right-0 px-2 py-0.5 bg-[#C5A059]/20 text-[#E8C56A] text-[9px] font-bold rounded-bl uppercase">
                  Step 1
                </div>
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#E8C56A] uppercase">
                  <Flame className="h-4 w-4 text-[#C5A059]" />
                  <span>Fase 1: Prova del Fuoco</span>
                </div>

                <div className="space-y-1.5 text-[11px] pt-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Target Profit:</span>
                    <strong className="text-emerald-400 whitespace-nowrap">+{sim.phase1TargetPct}% (+{sim.phase1TargetEuro.toLocaleString("it-IT")} €)</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Max Daily Drawdown:</span>
                    <strong className="text-red-400 whitespace-nowrap">5% (-{(accountSizeEuro * 0.05).toLocaleString("it-IT")} €)</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Max Total Drawdown:</span>
                    <strong className="text-red-400 whitespace-nowrap">10% (-{(accountSizeEuro * 0.10).toLocaleString("it-IT")} €)</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Trade Vincenti Netti:</span>
                    <strong className="text-foreground whitespace-nowrap">~{sim.tradesNeededPhase1} Trade</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tempo Stimato:</span>
                    <strong className="text-slate-300 whitespace-nowrap">~{sim.daysEstimatedPhase1} Giorni</strong>
                  </div>
                </div>

                <div className="pt-2 border-t border-border/40 flex items-center justify-between text-[10px]">
                  <span className="text-muted-foreground">Probabilità di Passaggio:</span>
                  <Badge variant="outline" className="border-emerald-500/40 text-emerald-300 font-bold">
                    {sim.passProbabilityPhase1Pct}%
                  </Badge>
                </div>
              </div>

              {/* Step 2 */}
              <div className="rounded-xl border border-emerald-500/40 bg-[#0d0f14] p-3.5 space-y-2 relative overflow-hidden">
                <div className="absolute top-0 right-0 px-2 py-0.5 bg-emerald-500/20 text-emerald-300 text-[9px] font-bold rounded-bl uppercase">
                  Step 2
                </div>
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 uppercase">
                  <ShieldCheck className="h-4 w-4 text-emerald-400" />
                  <span>Fase 2: Verifica Disciplina</span>
                </div>

                <div className="space-y-1.5 text-[11px] pt-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Target Profit:</span>
                    <strong className="text-emerald-400 whitespace-nowrap">+{sim.phase2TargetPct}% (+{sim.phase2TargetEuro.toLocaleString("it-IT")} €)</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Max Daily Drawdown:</span>
                    <strong className="text-red-400 whitespace-nowrap">5% (-{(accountSizeEuro * 0.05).toLocaleString("it-IT")} €)</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Max Total Drawdown:</span>
                    <strong className="text-red-400 whitespace-nowrap">10% (-{(accountSizeEuro * 0.10).toLocaleString("it-IT")} €)</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Trade Vincenti Netti:</span>
                    <strong className="text-foreground whitespace-nowrap">~{sim.tradesNeededPhase2} Trade</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tempo Stimato:</span>
                    <strong className="text-slate-300 whitespace-nowrap">~{sim.daysEstimatedPhase2} Giorni</strong>
                  </div>
                </div>

                <div className="pt-2 border-t border-border/40 flex items-center justify-between text-[10px]">
                  <span className="text-muted-foreground">Probabilità di Passaggio:</span>
                  <Badge variant="outline" className="border-emerald-500/40 text-emerald-300 font-bold">
                    {sim.passProbabilityPhase2Pct}% (Più Facile)
                  </Badge>
                </div>
              </div>

              {/* Step 3 */}
              <div className="rounded-xl border border-[#C5A059]/60 bg-[#C5A059]/10 p-3.5 space-y-2 relative overflow-hidden">
                <div className="absolute top-0 right-0 px-2 py-0.5 bg-[#C5A059]/30 text-[#F3D88C] text-[9px] font-bold rounded-bl uppercase">
                  Traguardo
                </div>
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#E8C56A] uppercase">
                  <Trophy className="h-4 w-4 text-[#E8C56A]" />
                  <span>Conto Finanziato Master</span>
                </div>

                <div className="space-y-1.5 text-[11px] pt-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Target Profit Richiesto:</span>
                    <strong className="text-emerald-400 whitespace-nowrap">ZERO (Prelevi Tutto)</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Profit Split Accreditato:</span>
                    <strong className="text-[#E8C56A] whitespace-nowrap">{payoutSplitPct}% - {activeProp.payoutSplitMaxPct}%</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Rimborso Fee Challenge:</span>
                    <strong className="text-emerald-400 font-bold whitespace-nowrap">+{customFeeEuro} € (100% Refund)</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Payout Medio Mensile:</span>
                    <strong className="text-foreground whitespace-nowrap">+{sim.monthlyNetPayoutEuro.toLocaleString("it-IT")} €/mese</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Frequenza Pagamenti:</span>
                    <strong className="text-slate-300 whitespace-nowrap">{activeProp.payoutFrequency}</strong>
                  </div>
                </div>

                <div className="pt-2 border-t border-border/40 flex items-center justify-between text-[10px]">
                  <span className="text-muted-foreground">Probabilità Cumulata:</span>
                  <Badge variant="outline" className="border-[#C5A059]/60 text-[#F3D88C] font-bold">
                    {sim.passProbabilityTotalPct}% per ciclo
                  </Badge>
                </div>
              </div>
            </div>

            {/* Spiegazione Stop Loss Assorbibili */}
            <div className="rounded-xl border border-border/70 bg-[#0d0f14] p-3.5 space-y-2">
              <div className="flex items-center justify-between pb-1 border-b border-border/40">
                <span className="text-xs font-bold text-[#E8C56A] uppercase flex items-center gap-1.5">
                  <Zap className="h-4 w-4 text-[#C5A059]" />
                  <span>La Matematica degli Stop Loss Assorbibili (Buffer: {sim.consecutiveLossTolerance} SL)</span>
                </span>
                <span className="text-[9.5px] px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 font-bold whitespace-nowrap">
                  Valore Atteso: +{sim.expectedValueCycleEuro.toLocaleString("it-IT")} €
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed font-sans">
                Con un Max Drawdown del 10% ({ (accountSizeEuro * 0.10).toLocaleString("it-IT") } €), rischiando lo 0.50% ({sim.riskPerTradeEuro} €) puoi assorbire fino a <strong className="text-emerald-400">20 stop loss consecutivi</strong>. Rischiare l'1% dimezza il margine a 10 trade, aumentando del 400% il rischio di fallimento statistico dovuto alla casualità di mercato.
              </p>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════
            TAB 3: VALUTATORE DIRETTO PROP FIRM (REGOLE, COMPATIBILITÀ & RECENSIONI)
           ═══════════════════════════════════════════════════════════════════════ */}
        {activeTab === "propEvaluation" && (
          <div className="space-y-4 font-mono pt-1">
            {/* Box Questionario Preferenze Operative Utente */}
            <div className="rounded-xl border border-[#C5A059]/40 bg-[#0d0f14] p-3.5 space-y-3">
              <div className="flex items-center justify-between pb-1.5 border-b border-border/40">
                <span className="text-xs font-bold text-[#E8C56A] uppercase flex items-center gap-1.5">
                  <Filter className="h-4 w-4 text-[#C5A059]" />
                  <span>Il Tuo Stile di Trading (Configura per Calcolare il Match)</span>
                </span>
                <span className="text-[9.5px] text-muted-foreground font-semibold">
                  Il motore ricalcola la compatibilità istantaneamente
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-[10.5px]">
                {/* Toggle News */}
                <button
                  type="button"
                  onClick={() => setUserPrefs((prev) => ({ ...prev, tradesNews: !prev.tradesNews }))}
                  className={`p-2 rounded border text-left transition-all ${
                    userPrefs.tradesNews
                      ? "bg-[#C5A059]/15 border-[#C5A059] text-foreground"
                      : "bg-[#07080b] border-border/50 text-muted-foreground"
                  }`}
                >
                  <span className="block text-[9px] uppercase font-bold text-[#E8C56A]">Trading delle News:</span>
                  <span className="font-semibold block mt-0.5">
                    {userPrefs.tradesNews ? "✓ Opero sulle News Macro" : "✗ Evito le Notizie"}
                  </span>
                </button>

                {/* Toggle Weekend Holding */}
                <button
                  type="button"
                  onClick={() => setUserPrefs((prev) => ({ ...prev, holdsOverWeekend: !prev.holdsOverWeekend }))}
                  className={`p-2 rounded border text-left transition-all ${
                    userPrefs.holdsOverWeekend
                      ? "bg-[#C5A059]/15 border-[#C5A059] text-foreground"
                      : "bg-[#07080b] border-border/50 text-muted-foreground"
                  }`}
                >
                  <span className="block text-[9px] uppercase font-bold text-[#E8C56A]">Mantenimento Weekend:</span>
                  <span className="font-semibold block mt-0.5">
                    {userPrefs.holdsOverWeekend ? "✓ Tengo Over-Weekend" : "✗ Chiudo il Venerdì"}
                  </span>
                </button>

                {/* Toggle EA / Bot */}
                <button
                  type="button"
                  onClick={() => setUserPrefs((prev) => ({ ...prev, usesEaOrBot: !prev.usesEaOrBot }))}
                  className={`p-2 rounded border text-left transition-all ${
                    userPrefs.usesEaOrBot
                      ? "bg-[#C5A059]/15 border-[#C5A059] text-foreground"
                      : "bg-[#07080b] border-border/50 text-muted-foreground"
                  }`}
                >
                  <span className="block text-[9px] uppercase font-bold text-[#E8C56A]">Expert Advisor / Bot:</span>
                  <span className="font-semibold block mt-0.5">
                    {userPrefs.usesEaOrBot ? "✓ Uso Algo & Bot" : "✗ Solo Discrezionale"}
                  </span>
                </button>

                {/* Toggle Zero Min Days */}
                <button
                  type="button"
                  onClick={() => setUserPrefs((prev) => ({ ...prev, prefersZeroMinDays: !prev.prefersZeroMinDays }))}
                  className={`p-2 rounded border text-left transition-all ${
                    userPrefs.prefersZeroMinDays
                      ? "bg-[#C5A059]/15 border-[#C5A059] text-foreground"
                      : "bg-[#07080b] border-border/50 text-muted-foreground"
                  }`}
                >
                  <span className="block text-[9px] uppercase font-bold text-[#E8C56A]">Velocità di Passaggio:</span>
                  <span className="font-semibold block mt-0.5">
                    {userPrefs.prefersZeroMinDays ? "✓ Zero Giorni Minimi" : "✗ Va bene con calma"}
                  </span>
                </button>
              </div>

              {/* Selettore Piattaforma Preferita */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/40 text-[10.5px]">
                <span className="text-muted-foreground font-semibold">Piattaforma Esecutiva Preferita:</span>
                <div className="flex flex-wrap gap-1">
                  {(["any", "cTrader", "TradingView", "MT5", "MT4"] as const).map((plat) => (
                    <button
                      key={plat}
                      type="button"
                      onClick={() => setUserPrefs((prev) => ({ ...prev, preferredPlatform: plat }))}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase transition-all ${
                        userPrefs.preferredPlatform === plat
                          ? "bg-[#C5A059] text-black"
                          : "bg-[#07080b] text-slate-300 border border-border/50 hover:border-[#C5A059]"
                      }`}
                    >
                      {plat === "any" ? "Qualsiasi" : plat}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Lista delle 5 Prop con Valutatore Diretto di Compatibilità & Recensioni */}
            <div className="space-y-3">
              {TOP_5_PROP_FIRMS.map((prop) => {
                const compat = compatibilityMap.get(prop.id);
                const isExpanded = expandedPropId === prop.id;

                const matchTone =
                  (compat?.matchScorePct ?? 0) >= 90
                    ? "text-emerald-400 border-emerald-500/40 bg-emerald-950/40"
                    : (compat?.matchScorePct ?? 0) >= 75
                    ? "text-[#E8C56A] border-[#C5A059]/40 bg-[#C5A059]/20"
                    : "text-amber-400 border-amber-500/40 bg-amber-950/40";

                return (
                  <div
                    key={prop.id}
                    className={`rounded-xl border transition-all overflow-hidden ${
                      selectedPropId === prop.id
                        ? "border-[#C5A059] bg-[#0d0f14]"
                        : "border-border/60 bg-[#07080b]"
                    }`}
                  >
                    {/* Header Card */}
                    <div className="p-3.5 flex flex-wrap items-center justify-between gap-2 border-b border-border/40">
                      <div className="flex items-center gap-2">
                        <strong className="text-sm font-bold text-foreground">{prop.name}</strong>
                        <span className="text-[10px] text-muted-foreground">({prop.country})</span>
                        <Badge variant="outline" className={`font-mono text-[9px] font-bold uppercase ${matchTone}`}>
                          {compat?.matchScorePct}% Match: {compat?.verdict}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[10.5px] font-bold text-emerald-400 flex items-center gap-1">
                          ★ {prop.reviews.trustpilotScore}
                          <span className="text-muted-foreground text-[9.5px]">({prop.reviews.reviewCount})</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setExpandedPropId(isExpanded ? null : prop.id)}
                          className="px-2 py-0.5 rounded bg-[#11131c] border border-border/60 text-[10px] text-slate-300 hover:text-foreground flex items-center gap-1"
                        >
                          <span>{isExpanded ? "Comprimi" : "Dettagli Regole & Recensioni"}</span>
                          {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        </button>
                      </div>
                    </div>

                    {/* Sintesi Match e Punti Salienti */}
                    <div className="p-3.5 space-y-2 text-xs">
                      <p className="text-[11px] text-slate-300 font-sans leading-snug">
                        {prop.headline}
                      </p>

                      {/* Pillole di Cautela o Vantaggi */}
                      {compat && (compat.pros.length > 0 || compat.cautions.length > 0) && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 font-mono text-[10px]">
                          {compat.pros.length > 0 && (
                            <div className="p-2 rounded bg-emerald-950/20 border border-emerald-500/30 text-emerald-300 space-y-0.5">
                              <span className="font-bold flex items-center gap-1 uppercase text-[9px]">
                                <ThumbsUp className="h-2.5 w-2.5 text-emerald-400" />
                                <span>Punti a Favore del Tuo Stile:</span>
                              </span>
                              <ul className="space-y-0.5 font-sans">
                                {compat.pros.map((p, i) => (
                                  <li key={i}>• {p}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {compat.cautions.length > 0 && (
                            <div className="p-2 rounded bg-amber-950/20 border border-amber-500/30 text-amber-300 space-y-0.5">
                              <span className="font-bold flex items-center gap-1 uppercase text-[9px]">
                                <AlertTriangle className="h-2.5 w-2.5 text-amber-400" />
                                <span>Punti di Cautela per Te:</span>
                              </span>
                              <ul className="space-y-0.5 font-sans">
                                {compat.cautions.map((c, i) => (
                                  <li key={i}>• {c}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Sezione Espansa: Analisi Operativa Approfondita delle Regole & Recensioni */}
                      {isExpanded && (
                        <div className="mt-3 pt-3 border-t border-border/50 space-y-3 font-mono">
                          {/* 1. Quadro Regole Operative Inviolabili */}
                          <div className="rounded-lg bg-[#07080b] p-3 border border-border/50 space-y-2">
                            <span className="text-[10px] uppercase font-bold text-[#E8C56A] block">
                              Regolamento Operativo Dettagliato:
                            </span>

                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-[10px]">
                              <div>
                                <span className="text-muted-foreground block text-[9px] uppercase">News Trading:</span>
                                <span className="text-foreground font-semibold block">{prop.rules.newsTrading.details}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground block text-[9px] uppercase">Weekend Holding:</span>
                                <span className="text-foreground font-semibold block">{prop.rules.weekendHolding.details}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground block text-[9px] uppercase">Calcolo Drawdown:</span>
                                <span className="text-emerald-400 font-semibold block">{prop.rules.drawdownRule.explanation}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground block text-[9px] uppercase">Giorni Minimi:</span>
                                <span className="text-foreground font-semibold block">{prop.rules.minTradingDays} Giorni Operativi</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground block text-[9px] uppercase">Expert Advisors:</span>
                                <span className="text-foreground font-semibold block">{prop.rules.eaAndAlgos.details}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground block text-[9px] uppercase">Inattività Max:</span>
                                <span className="text-foreground font-semibold block">{prop.rules.inactivityDaysLimit} giorni di stop</span>
                              </div>
                            </div>
                          </div>

                          {/* 2. Analisi Chirurgica Recensioni Utenti (Cosa Amano vs Cosa Lamentano) */}
                          <div className="rounded-lg bg-[#07080b] p-3 border border-border/50 space-y-2">
                            <div className="flex items-center justify-between pb-1 border-b border-border/40">
                              <span className="text-[10px] uppercase font-bold text-[#E8C56A] flex items-center gap-1.5">
                                <MessageSquare className="h-3 w-3 text-[#C5A059]" />
                                <span>Analisi Recensioni Reali della Community ({prop.reviews.reviewCount})</span>
                              </span>
                              <div className="flex items-center gap-2 text-[9.5px]">
                                <span className="text-emerald-400 font-bold">{prop.reviews.positiveReviewsPct}% Positive</span>
                                <span className="text-red-400 font-bold">{prop.reviews.negativeReviewsPct}% Negative</span>
                                <span className="text-slate-300">Payout in ~{prop.reviews.averagePayoutTimeHours}h</span>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10.5px]">
                              {/* Elogi */}
                              <div className="space-y-1">
                                <span className="text-[9px] uppercase font-bold text-emerald-400 flex items-center gap-1">
                                  <ThumbsUp className="h-2.5 w-2.5" />
                                  <span>Cosa Amano i Trader (Top Praises):</span>
                                </span>
                                <ul className="space-y-0.5 text-slate-300 font-sans text-[10px]">
                                  {prop.reviews.topPraises.map((praise, idx) => (
                                    <li key={idx} className="flex items-start gap-1">
                                      <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0 mt-0.5" />
                                      <span>{praise}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>

                              {/* Lamentele */}
                              <div className="space-y-1">
                                <span className="text-[9px] uppercase font-bold text-red-400 flex items-center gap-1">
                                  <ThumbsDown className="h-2.5 w-2.5" />
                                  <span>Lamentele Ricorrenti (Top Complaints):</span>
                                </span>
                                <ul className="space-y-0.5 text-slate-300 font-sans text-[10px]">
                                  {prop.reviews.topComplaints.map((complaint, idx) => (
                                    <li key={idx} className="flex items-start gap-1">
                                      <AlertTriangle className="h-3 w-3 text-amber-400 shrink-0 mt-0.5" />
                                      <span>{complaint}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </div>

                            <div className="p-2 rounded bg-[#11131c] text-[10px] text-slate-300 border-t border-border/40">
                              <span className="text-muted-foreground font-semibold">Sentimento Operativo: </span>
                              <span className="font-sans text-slate-200">{prop.reviews.communitySentiment}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════
            TAB 4: I MIGLIORI BROKER (FP MARKETS, XM, TICKMILL) & ATTRITO COSTI
           ═══════════════════════════════════════════════════════════════════════ */}
        {activeTab === "brokersAndHybrid" && (
          <div className="space-y-4 font-mono pt-1">
            {/* Calcolatore Interattivo di Attrito di Costo Broker (Spread + Commissioni) */}
            <div className="rounded-xl border border-[#C5A059]/40 bg-[#0d0f14] p-3.5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 border-b border-border/40">
                <span className="text-xs font-bold text-[#E8C56A] uppercase flex items-center gap-1.5">
                  <DollarSign className="h-4 w-4 text-[#C5A059]" />
                  <span>Calcolatore di Attrito di Costo: FP Markets vs XM vs Tickmill</span>
                </span>
                <span className="text-[9.5px] text-muted-foreground font-semibold">
                  Imposta asset e lotti per misurare la spesa reale
                </span>
              </div>

              {/* Selettore Strumento Finanziario per Attrito */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-[10.5px]">
                <span className="text-muted-foreground font-semibold">Strumento Operativo:</span>
                <div className="flex flex-wrap gap-1">
                  {(
                    [
                      { id: "EURUSD", label: "EUR/USD (Forex)" },
                      { id: "GOLD", label: "XAU/USD (Oro Spot)" },
                      { id: "US100", label: "US100 (Nasdaq)" },
                    ] as const
                  ).map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => setSelectedBrokerAsset(a.id)}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                        selectedBrokerAsset === a.id
                          ? "bg-[#C5A059] text-black"
                          : "bg-[#07080b] text-slate-300 border border-border/50 hover:border-[#C5A059]"
                      }`}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Slider Volume Mensile in Lotti */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Volume di Trading Mensile:</span>
                  <strong className="text-foreground whitespace-nowrap">
                    {monthlyBrokerLots} Lotti Pieni / Mese ({ (monthlyBrokerLots * 100000).toLocaleString("it-IT") } € di nozionale)
                  </strong>
                </div>
                <Slider
                  value={[monthlyBrokerLots]}
                  min={5}
                  max={100}
                  step={5}
                  onValueChange={([val]) => setMonthlyBrokerLots(val ?? 20)}
                  className="cursor-pointer"
                />
                <div className="flex justify-between text-[9.5px] text-muted-foreground">
                  <span>5 Lotti (Part-time)</span>
                  <span className="text-[#E8C56A]">20 Lotti (Standard)</span>
                  <span>50+ Lotti (Full-time / Algo)</span>
                </div>
              </div>

              {/* Tabella di Confronto Attrito Spesa Reale */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-center pt-1">
                {TOP_5_BROKERS.slice(0, 3).map((b) => {
                  const friction = calculateBrokerMonthlyFrictionEuro(b, monthlyBrokerLots, selectedBrokerAsset);

                  return (
                    <div
                      key={b.id}
                      className="rounded-lg bg-[#07080b] p-3 border border-border/60 space-y-1.5 relative overflow-hidden"
                    >
                      <div className="text-xs font-bold text-foreground">{b.brandTitle}</div>
                      <span className="text-[9.5px] uppercase font-bold text-muted-foreground block">
                        Spesa Totale Mensile:
                      </span>
                      <div className="text-base sm:text-lg font-bold text-emerald-400 whitespace-nowrap">
                        {friction.totalCostEuro} € / mese
                      </div>
                      <div className="text-[9.5px] text-slate-300 space-y-0.5 border-t border-border/40 pt-1">
                        <div>Spread: {friction.spreadCostEuro} € • Comm: {friction.commissionCostEuro} €</div>
                        <div className="text-[#E8C56A] font-semibold">
                          Risparmi +{friction.savingsVsBenchmarkEuro} € vs retail
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Schede Dettagliate dei 3 Broker Richiesti (FP Markets, XM, Tickmill) + Altri */}
            <div className="space-y-2.5">
              <span className="text-xs font-bold text-[#E8C56A] uppercase block">
                I Broker Sovrani d'Eccellenza per la Costruzione Patrimoniale:
              </span>

              <div className="grid grid-cols-1 gap-2.5">
                {TOP_5_BROKERS.map((broker) => (
                  <div
                    key={broker.id}
                    className="rounded-xl border border-border/70 bg-[#0d0f14] p-3.5 space-y-2.5 hover:border-[#C5A059]/40 transition-all"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 border-b border-border/40">
                      <div className="flex items-center gap-2">
                        <strong className="text-sm font-bold text-foreground">{broker.brandTitle}</strong>
                        <span className="text-[10px] text-muted-foreground">({broker.headquarters} • Dal {broker.foundedYear})</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-[#C5A059]/15 border border-[#C5A059]/30 text-[#E8C56A] font-bold whitespace-nowrap">
                          {broker.custodyRating}
                        </span>
                        <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300 font-bold whitespace-nowrap">
                          {broker.executionModel.replace("_", " ")}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10.5px]">
                      <div>
                        <span className="text-[9px] uppercase text-muted-foreground block">Regolamentazione:</span>
                        <span className="text-slate-200 font-bold truncate block">{broker.regulations.join(", ")}</span>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase text-muted-foreground block">Spread EUR/USD:</span>
                        <strong className="text-emerald-400 block whitespace-nowrap">{broker.friction.eurUsdSpreadPips} pip</strong>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase text-muted-foreground block">Commissione Round Turn:</span>
                        <strong className="text-foreground block whitespace-nowrap">{broker.friction.commissionRoundTurnEuroPerLot} € / lotto</strong>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase text-muted-foreground block">Piattaforme:</span>
                        <span className="text-slate-300 truncate block">{broker.platforms.join(", ")}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-border/30 text-[10.5px]">
                      <div className="space-y-0.5">
                        <span className="text-[9px] uppercase text-muted-foreground block font-bold">Punti di Forza:</span>
                        <ul className="space-y-0.5 text-slate-300 font-sans text-[10px]">
                          {broker.strengths.slice(0, 2).map((s, idx) => (
                            <li key={idx}>• {s}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-[9px] uppercase text-muted-foreground block font-bold">Ruolo Consigliato nel Protocollo:</span>
                        <p className="text-[#E8C56A] text-[10.5px] leading-snug">
                          {broker.roleInPortfolio}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Protocollo Ibrido "Prop-to-Wealth" Pipeline */}
            <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/20 p-3.5 space-y-2">
              <div className="flex items-center justify-between pb-1 border-b border-emerald-500/30">
                <span className="text-xs font-bold text-emerald-300 uppercase flex items-center gap-1.5">
                  <Landmark className="h-4 w-4 text-emerald-400" />
                  <span>La Pipeline Ibrida AUREUS (Prop-to-Wealth)</span>
                </span>
                <Badge variant="outline" className="border-emerald-500/40 text-emerald-300 font-bold text-[9.5px]">
                  Zero Rischio Patrimoniale
                </Badge>
              </div>

              <p className="text-xs text-slate-200 leading-relaxed font-sans">
                {hybrid.narrativeSummary}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-center pt-1 font-mono">
                <div className="rounded-lg bg-[#07080b] p-2 border border-[#C5A059]/40 space-y-0.5">
                  <span className="text-[9px] uppercase text-[#E8C56A] block font-bold">50% Broker Sovrano</span>
                  <div className="text-xs sm:text-sm font-bold text-foreground">
                    +{hybrid.payoutDistribution.toSovereignBrokerEuro.toLocaleString("it-IT")} €/m
                  </div>
                  <span className="text-[8.5px] text-muted-foreground block">FP Markets / Tickmill / XM</span>
                </div>

                <div className="rounded-lg bg-[#07080b] p-2 border border-emerald-500/40 space-y-0.5">
                  <span className="text-[9px] uppercase text-emerald-400 block font-bold">30% PAC ETF Azionario</span>
                  <div className="text-xs sm:text-sm font-bold text-emerald-400">
                    +{hybrid.payoutDistribution.toWealthPacEtfEuro.toLocaleString("it-IT")} €/m
                  </div>
                  <span className="text-[8.5px] text-muted-foreground block">Patrimonio Perpetuo ad Accumulo</span>
                </div>

                <div className="rounded-lg bg-[#07080b] p-2 border border-red-500/40 space-y-0.5">
                  <span className="text-[9px] uppercase text-red-300 block font-bold">20% Tasse F24 & Riserva</span>
                  <div className="text-xs sm:text-sm font-bold text-foreground">
                    +{hybrid.payoutDistribution.toTaxAndRiskShieldEuro.toLocaleString("it-IT")} €/m
                  </div>
                  <span className="text-[8.5px] text-muted-foreground block">Scudo Erariale & Buffer</span>
                </div>
              </div>

              {onOpenTaxDoctrine && (
                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenTaxDoctrine("prop");
                    }}
                    className="inline-flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase px-2.5 py-1 rounded bg-[#C5A059]/20 border border-[#C5A059]/40 text-[#E8C56A] hover:bg-[#C5A059]/35 hover:text-[#F3D88C] transition-all cursor-pointer whitespace-nowrap shadow-sm"
                  >
                    <span>Consulta Inquadramento Fiscale Payout (P.IVA Forfettario / Quadro RW)</span>
                    <ArrowRight className="h-3 w-3 text-[#E8C56A]" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
