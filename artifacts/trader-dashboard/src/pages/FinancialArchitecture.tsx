import { useState, useEffect, useMemo, useCallback, useDeferredValue } from "react";
import { useLocation } from "wouter";
import { useFreeTrial } from "@/lib/useFreeTrial";
import {
  Shield,
  ShieldCheck,
  AlertTriangle,
  TrendingUp,
  Coins,
  Sparkles,
  CheckCircle,
  HelpCircle,
  Save,
  PieChart,
  BarChart2,
  LineChart as LineChartIcon,
  RefreshCw,
  Target,
  Wallet,
  ArrowUpRight,
  Clock,
  Zap,
  Scale,
  Landmark,
} from "lucide-react";
import { PageLayout } from "@/components/PageLayout";
import { useLimenEntitlements } from "@/hooks/useLimenEntitlements";
import { LimenServiceLockGate } from "@/components/candidacy/LimenServiceLockGate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import {
  calculateVitalLiquidity,
  checkReserveConstraint,
  calculatePsychologicalPressure,
  evaluateExpectation,
  calculateOptimalLimenAllocation,
  calculatePillarsPercentages,
  validateFinancialProfile,
  calculateOptimalWealthSubAllocations,
  calculateWealthProjections,
  simulateMonteCarloEquity,
  applyStrategyPreset,
  calculateEquityBasketTiming,
  calculateDividendBasketTiming,
  calculateCryptoBasketTiming,
  calculateGoldMarketTiming,
  calculateTradingKellyPositioning,
  calculateCrossAssetAllocationMatrix,
  TOP_50_EQUITIES_AND_ETFS,
  TOP_50_DIVIDENDS_BASKET,
  TOP_50_CRYPTO_BASKET,
  CURRENT_GOLD_BENCHMARK,
  DEFAULT_FINANCIAL_PROFILE,
  DEFAULT_WEALTH_SUB_ALLOCATIONS,
  type FinancialProfile,
  type FinancialProfileInput,
  type PillarsAllocation,
  type WealthSubAllocations,
  type StrategyPreset,
} from "../../../../contracts/financialArchitecture";
import {
  useFinancialProfile,
  useUpdateFinancialProfile,
} from "@/lib/financialProfileApi";
import { PillarsDonutChart } from "@/components/financial/PillarsDonutChart";
import { PillarsAllocationBar } from "@/components/financial/PillarsAllocationBar";
import { MonteCarloSimulationCard } from "@/components/financial/MonteCarloSimulationCard";
import { ToolInfoTrigger } from "@/components/financial/ToolInfoTrigger";
import { InstrumentDossierModal } from "@/components/financial/InstrumentDossierModal";
import { WealthAssetCard } from "@/components/financial/WealthAssetCard";
import { WealthProjectionChart } from "@/components/financial/WealthProjectionChart";
import { AdvisorVerdictCard } from "@/components/financial/AdvisorVerdictCard";
import { TaxDoctrineModal } from "@/components/financial/TaxDoctrineModal";
import { PropFirmCalculatorModal } from "@/components/financial/PropFirmCalculatorModal";

/**
 * Sintesi chirurgica dei regimi di timing per l'interfaccia a 3 colonne (Zero sovrapposizioni)
 */
function formatCompactRegime(signal?: string): string {
  if (!signal) return "";
  if (signal.includes("Accumulo Costante") || signal.includes("DCA")) return "Accumulo Disciplinato";
  if (signal.includes("Sottovalutazione") || signal.includes("Forte Accumulo")) return "Sottovalutato";
  if (signal.includes("Valutazioni Tirate")) return "Valutazioni Estese";
  if (signal.includes("Timing Eccellente") || signal.includes("Rendimento Elevato") || signal.includes("Timing Favorevole")) return "Timing Favorevole";
  if (signal.includes("Fase Espansiva")) return "Espansione Ciclica";
  if (signal.includes("Scudo")) return "Scudo Antifragile";
  if (signal.includes("Half-Kelly") || signal.includes("Sostenibile") || signal.includes("Operativo")) return "Setup Solido";
  return signal;
}

export default function FinancialArchitecture() {
  const [, setLocation] = useLocation();
  const { entitlements } = useLimenEntitlements();

  const { isFreeTrial, remainingTime } = useFreeTrial();
  const { data: remoteProfile, isLoading: _isLoading } = useFinancialProfile();
  const updateMutation = useUpdateFinancialProfile();

  // Local state for interactive editing
  const [profile, setProfile] = useState<FinancialProfile>(
    remoteProfile ?? DEFAULT_FINANCIAL_PROFILE,
  );

  // Sub-allocations for long-term investments: Azioni & ETF, Dividendi, Crypto, Copertura
  const [subAllocations, setSubAllocations] = useState<WealthSubAllocations>(() => {
    if (remoteProfile?.wealthSubAllocations) {
      return remoteProfile.wealthSubAllocations;
    }
    const inv = remoteProfile?.investmentsAllocation ?? DEFAULT_FINANCIAL_PROFILE.investmentsAllocation;
    return calculateOptimalWealthSubAllocations(inv);
  });

  // Capacità di risparmio mensile (PAC / DCA in €/mese)
  const [monthlyPAC, setMonthlyPAC] = useState<number>(() => {
    const inc = remoteProfile?.externalStableIncome ?? DEFAULT_FINANCIAL_PROFILE.externalStableIncome;
    const exp = remoteProfile?.monthlyExpenses ?? DEFAULT_FINANCIAL_PROFILE.monthlyExpenses;
    const netSavings = inc - exp;
    return netSavings > 0 ? netSavings : 500;
  });

  // Target di Indipendenza Finanziaria ("Freedom Number" in €)
  const [targetNetWorth, setTargetNetWorth] = useState<number>(() => {
    const exp = remoteProfile?.monthlyExpenses ?? DEFAULT_FINANCIAL_PROFILE.monthlyExpenses;
    const fire25x = exp * 12 * 25;
    return fire25x > 0 ? fire25x : 500000;
  });

  // Preset strategico attivo
  const [activeStrategyPreset, setActiveStrategyPreset] = useState<StrategyPreset>("BALANCED_LIMEN");

  // Time Horizon for multi-axis calculation (1, 3, 5, 10, 20 Anni)
  const [selectedHorizon, setSelectedHorizon] = useState<number>(5);

  // Vista unificata Step 3: Proiezione Net Worth / Motore Monte Carlo (1.000 Traiettorie) / 5 Pilastri
  const [activeVisualView, setActiveVisualView] = useState<"projection" | "monte_carlo" | "pillars">("projection");

  // Modal Dossier Trigger State [• ℹ]
  const [activeDossierToolId, setActiveDossierToolId] = useState<string | null>(null);

  // Modal Dottrina Fiscale (Italia)
  const [isTaxModalOpen, setIsTaxModalOpen] = useState<boolean>(false);
  const [taxInitialTab, setTaxInitialTab] = useState<"regimes" | "assets" | "prop" | "deadlines">("regimes");

  // Modal Motore Prop Firm, Funnel 2 Fasi & Broker Sovrani
  const [isPropCalculatorOpen, setIsPropCalculatorOpen] = useState<boolean>(false);

  // Auto-calculation reactive mode flag
  const [isAutoAllocation, setIsAutoAllocation] = useState<boolean>(true);
  const [mobileStep, setMobileStep] = useState<1 | 2 | 3>(1);

  // Sync from remote profile once loaded
  useEffect(() => {
    if (remoteProfile) {
      setProfile(remoteProfile);
      if (remoteProfile.monthlyPac !== undefined) {
        setMonthlyPAC(remoteProfile.monthlyPac);
      }
      if (remoteProfile.targetNetWorth !== undefined) {
        setTargetNetWorth(remoteProfile.targetNetWorth);
      }
      if (remoteProfile.wealthSubAllocations) {
        setSubAllocations(remoteProfile.wealthSubAllocations);
      } else {
        setSubAllocations(calculateOptimalWealthSubAllocations(remoteProfile.investmentsAllocation));
      }
    }
  }, [remoteProfile]);

  // Derived calculations
  const vitalLiquidity = useMemo(
    () =>
      calculateVitalLiquidity({
        totalNetWorth: profile.totalNetWorth,
        monthlyExpenses: profile.monthlyExpenses,
        liquidityMonthsCovered: profile.liquidityMonthsCovered,
      }),
    [profile.totalNetWorth, profile.monthlyExpenses, profile.liquidityMonthsCovered],
  );

  const reserveConstraint = useMemo(
    () =>
      checkReserveConstraint({
        totalNetWorth: profile.totalNetWorth,
        liquidityAllocation: profile.liquidityAllocation,
        reserveAllocation: profile.reserveAllocation,
        tradingAllocation: profile.tradingAllocation,
        investmentsAllocation: profile.investmentsAllocation,
        futureProjectsAllocation: profile.futureProjectsAllocation,
      }),
    [
      profile.totalNetWorth,
      profile.liquidityAllocation,
      profile.reserveAllocation,
      profile.tradingAllocation,
      profile.investmentsAllocation,
      profile.futureProjectsAllocation,
    ],
  );

  const psychologicalPressure = useMemo(
    () =>
      calculatePsychologicalPressure({
        totalNetWorth: profile.totalNetWorth,
        reserveAllocation: profile.reserveAllocation,
        tradingAllocation: profile.tradingAllocation,
        externalStableIncome: profile.externalStableIncome,
        monthlyExpenses: profile.monthlyExpenses,
        simulatedDrawdownPct: profile.simulatedDrawdownPct,
      }),
    [
      profile.totalNetWorth,
      profile.reserveAllocation,
      profile.tradingAllocation,
      profile.externalStableIncome,
      profile.monthlyExpenses,
      profile.simulatedDrawdownPct,
    ],
  );

  const deferredTradingAllocation = useDeferredValue(profile.tradingAllocation);
  const deferredReserveAllocation = useDeferredValue(profile.reserveAllocation);
  const deferredExpectedMonthlyReturnPct = useDeferredValue(profile.expectedMonthlyReturnPct);
  const deferredSimulatedDrawdownPct = useDeferredValue(profile.simulatedDrawdownPct);

  // Motore stocastico Monte Carlo (1.000 traiettorie) calcolato automagicamente in tempo reale
  const tradingMonteCarlo = useMemo(() => {
    return simulateMonteCarloEquity({
      initialCapital: Math.max(0, deferredTradingAllocation),
      expectedMonthlyReturnPct: Math.max(0.5, deferredExpectedMonthlyReturnPct || 3),
      simulatedDrawdownPct: Math.max(3, deferredSimulatedDrawdownPct || 10),
      horizonMonths: Math.max(12, selectedHorizon * 12),
      accountObjective: profile.accountObjective,
      tradingStyle: "DAY_TRADING",
      winRatePct: 54.0,
      riskRewardRatio: 1.85,
      tradesPerMonth: 20,
      riskPerTradePct: 0.81,
      iterations: 1000,
      seed: 20261018,
    });
  }, [
    deferredTradingAllocation,
    deferredExpectedMonthlyReturnPct,
    deferredSimulatedDrawdownPct,
    selectedHorizon,
    profile.accountObjective,
  ]);

  const expectationEvaluation = useMemo(
    () =>
      evaluateExpectation({
        expectedMonthlyReturnPct: profile.expectedMonthlyReturnPct,
        tradingAllocation: profile.tradingAllocation,
      }),
    [profile.expectedMonthlyReturnPct, profile.tradingAllocation],
  );

  const percentages = useMemo(
    () =>
      calculatePillarsPercentages(
        {
          liquidityAllocation: profile.liquidityAllocation,
          reserveAllocation: profile.reserveAllocation,
          tradingAllocation: profile.tradingAllocation,
          investmentsAllocation: profile.investmentsAllocation,
          futureProjectsAllocation: profile.futureProjectsAllocation,
        },
        profile.totalNetWorth,
      ),
    [
      profile.liquidityAllocation,
      profile.reserveAllocation,
      profile.tradingAllocation,
      profile.investmentsAllocation,
      profile.futureProjectsAllocation,
      profile.totalNetWorth,
    ],
  );

  const validation = useMemo(() => validateFinancialProfile(profile), [profile]);

  // Calcolo Benchmark Istituzionali & Timing Dinamico Multi-Fattore
  const equityTiming = useMemo(() => calculateEquityBasketTiming(TOP_50_EQUITIES_AND_ETFS), []);
  const dividendTiming = useMemo(() => calculateDividendBasketTiming(TOP_50_DIVIDENDS_BASKET), []);
  const cryptoTiming = useMemo(() => calculateCryptoBasketTiming(TOP_50_CRYPTO_BASKET), []);
  const goldTiming = useMemo(() => calculateGoldMarketTiming(CURRENT_GOLD_BENCHMARK), []);
  const tradingPositioning = useMemo(
    () => calculateTradingKellyPositioning(profile.tradingAllocation, profile.totalNetWorth),
    [profile.tradingAllocation, profile.totalNetWorth]
  );
  const crossAssetMatrix = useMemo(
    () =>
      calculateCrossAssetAllocationMatrix(
        equityTiming,
        dividendTiming,
        cryptoTiming,
        goldTiming,
        tradingPositioning
      ),
    [equityTiming, dividendTiming, cryptoTiming, goldTiming, tradingPositioning]
  );

  // Calcolo PAC mensile proporzionale per singola asset class a lungo termine
  const totalSubAllocated =
    subAllocations.equityAllocation +
    subAllocations.dividendsAllocation +
    subAllocations.cryptoAllocation +
    subAllocations.hedgingAllocation;

  const pacEquity = totalSubAllocated > 0 ? Math.round(monthlyPAC * (subAllocations.equityAllocation / totalSubAllocated)) : 0;
  const pacDividends = totalSubAllocated > 0 ? Math.round(monthlyPAC * (subAllocations.dividendsAllocation / totalSubAllocated)) : 0;
  const pacCrypto = totalSubAllocated > 0 ? Math.round(monthlyPAC * (subAllocations.cryptoAllocation / totalSubAllocated)) : 0;
  const pacHedging = totalSubAllocated > 0 ? Math.max(0, monthlyPAC - (pacEquity + pacDividends + pacCrypto)) : 0;

  // Stima della rendita passiva da staking crypto (~5.6% annuo sulla quota crypto in staking)
  const cryptoStakingMonthlyCashflow = Math.round(
    ((subAllocations.cryptoAllocation * ((subAllocations.cryptoStakingPct ?? 50) / 100)) *
      ((cryptoTiming.weightedStakingApyPct ?? 5.6) / 100)) /
      12,
  );

  // Calcolo Surplus Mensile Netto Disponibile (Free Cash Flow)
  const netSurplusMonthly = Math.max(0, profile.externalStableIncome - profile.monthlyExpenses);

  // Calcolo proiezioni unificate (Monte Carlo + Crescita Composta + Staking) con tassi quantitativi dinamici
  const wealthProjections = useMemo(() => {
    return calculateWealthProjections({
      liquidityAllocation: profile.liquidityAllocation,
      reserveAllocation: profile.reserveAllocation,
      tradingAllocation: profile.tradingAllocation,
      subAllocations,
      params: {
        timeHorizonYears: selectedHorizon,
        equityReturnRatePct: equityTiming.expectedAnnualReturnPct,
        dividendsYieldRatePct: dividendTiming.expectedAnnualReturnPct,
        cryptoReturnRatePct: cryptoTiming.expectedAnnualReturnPct,
        hedgingReturnRatePct: goldTiming.expectedAnnualReturnPct,
        tradingAnnualReturnRatePct: (profile.expectedMonthlyReturnPct ?? 3) * 12,
        monthlySavingsCapacity: monthlyPAC,
        targetNetWorth: targetNetWorth,
        monthlyLivingExpenses: profile.monthlyExpenses,
        taxCountry: profile.taxCountry || "IT",
        taxRegime: profile.taxRegime || "DICHIARATIVO",
        showNetOfTax: profile.showNetOfTax !== false,
      },
    });
  }, [
    profile.liquidityAllocation,
    profile.reserveAllocation,
    profile.tradingAllocation,
    profile.expectedMonthlyReturnPct,
    profile.monthlyExpenses,
    profile.taxCountry,
    profile.taxRegime,
    profile.showNetOfTax,
    subAllocations,
    selectedHorizon,
    monthlyPAC,
    targetNetWorth,
    equityTiming.expectedAnnualReturnPct,
    dividendTiming.expectedAnnualReturnPct,
    cryptoTiming.expectedAnnualReturnPct,
    goldTiming.expectedAnnualReturnPct,
  ]);

  // Central reactive updater: updates base params
  const updateBaseParam = useCallback(
    (patch: Partial<FinancialProfileInput>) => {
      setProfile((prev) => {
        const nextTotalNetWorth =
          patch.totalNetWorth !== undefined ? Math.max(0, patch.totalNetWorth) : prev.totalNetWorth;
        const nextMonthlyExpenses =
          patch.monthlyExpenses !== undefined ? Math.max(0, patch.monthlyExpenses) : prev.monthlyExpenses;
        const nextMonths =
          patch.liquidityMonthsCovered !== undefined
            ? Math.min(12, Math.max(3, patch.liquidityMonthsCovered))
            : prev.liquidityMonthsCovered;
        const nextIncome =
          patch.externalStableIncome !== undefined ? Math.max(0, patch.externalStableIncome) : prev.externalStableIncome;
        const nextDependents = patch.hasDependents !== undefined ? patch.hasDependents : prev.hasDependents;
        const nextTaxCountry = patch.taxCountry !== undefined ? patch.taxCountry : prev.taxCountry || "IT";
        const nextTaxRegime = patch.taxRegime !== undefined ? patch.taxRegime : prev.taxRegime || "DICHIARATIVO";
        const nextShowNetOfTax = patch.showNetOfTax !== undefined ? patch.showNetOfTax : prev.showNetOfTax !== false;

        if (isAutoAllocation) {
          const optimal = calculateOptimalLimenAllocation({
            totalNetWorth: nextTotalNetWorth,
            monthlyExpenses: nextMonthlyExpenses,
            liquidityMonthsCovered: nextMonths,
            externalStableIncome: nextIncome,
            hasDependents: nextDependents,
          });

          // Aggiorna anche i sub-motori
          const nextSubs = calculateOptimalWealthSubAllocations(optimal.investmentsAllocation);
          setSubAllocations(nextSubs);

          return {
            ...prev,
            totalNetWorth: nextTotalNetWorth,
            monthlyExpenses: nextMonthlyExpenses,
            liquidityMonthsCovered: nextMonths,
            externalStableIncome: nextIncome,
            hasDependents: nextDependents,
            taxCountry: nextTaxCountry,
            taxRegime: nextTaxRegime,
            showNetOfTax: nextShowNetOfTax,
            ...optimal,
          };
        } else {
          const reqLiq = nextMonthlyExpenses * nextMonths;
          const newLiq = Math.min(nextTotalNetWorth, reqLiq);
          const liqDelta = newLiq - prev.liquidityAllocation;
          const netWorthDelta = nextTotalNetWorth - prev.totalNetWorth;
          const availableInvestable = Math.max(0, nextTotalNetWorth - newLiq);

          const newReserve = Math.min(availableInvestable, prev.reserveAllocation);
          const newTrading = Math.min(Math.max(0, availableInvestable - newReserve), prev.tradingAllocation);
          let newInvestments = Math.max(0, prev.investmentsAllocation);
          let newFuture = prev.futureProjectsAllocation + netWorthDelta - liqDelta;

          if (newFuture < 0) {
            newInvestments = Math.max(0, newInvestments + newFuture);
            newFuture = 0;
          }

          const currentSum = newLiq + newReserve + newTrading + newInvestments + newFuture;
          const diff = nextTotalNetWorth - currentSum;
          newFuture = Math.max(0, newFuture + diff);

          return {
            ...prev,
            totalNetWorth: nextTotalNetWorth,
            monthlyExpenses: nextMonthlyExpenses,
            liquidityMonthsCovered: nextMonths,
            externalStableIncome: nextIncome,
            hasDependents: nextDependents,
            taxCountry: nextTaxCountry,
            taxRegime: nextTaxRegime,
            showNetOfTax: nextShowNetOfTax,
            liquidityAllocation: newLiq,
            reserveAllocation: newReserve,
            tradingAllocation: newTrading,
            investmentsAllocation: newInvestments,
            futureProjectsAllocation: newFuture,
          };
        }
      });
    },
    [isAutoAllocation],
  );

  // Gestione modifica asset class del motore di investimenti (Azioni, Dividendi, Crypto, Copertura)
  const handleSubAssetChange = useCallback(
    (key: keyof WealthSubAllocations, rawVal: number) => {
      setIsAutoAllocation(false);
      const val = Math.max(0, Math.round(rawVal) || 0);

      setSubAllocations((prev: WealthSubAllocations) => {
        const next = { ...prev, [key]: val };
        const newTotalInvestments =
          next.equityAllocation + next.dividendsAllocation + next.cryptoAllocation + next.hedgingAllocation;

        // Sincronizza su profile.investmentsAllocation
        setProfile((p) => {
          const delta = newTotalInvestments - p.investmentsAllocation;
          let newFuture = p.futureProjectsAllocation - delta;
          if (newFuture < 0) newFuture = 0;

          const currentSum =
            p.liquidityAllocation +
            p.reserveAllocation +
            p.tradingAllocation +
            newTotalInvestments +
            newFuture;
          const diff = p.totalNetWorth - currentSum;
          newFuture = Math.max(0, newFuture + diff);

          return {
            ...p,
            investmentsAllocation: newTotalInvestments,
            futureProjectsAllocation: newFuture,
          };
        });

        return next;
      });
    },
    [],
  );

  // Gestione cambio pilastro principale
  const handlePillarChange = useCallback((pillarKey: keyof PillarsAllocation, rawVal: number) => {
    setIsAutoAllocation(false);
    const val = Math.max(0, Math.round(rawVal) || 0);

    setProfile((prev) => {
      const oldVal = prev[pillarKey];
      const delta = val - oldVal;
      const next = { ...prev, [pillarKey]: val };

      if (pillarKey === "futureProjectsAllocation") {
        next.investmentsAllocation = Math.max(0, prev.investmentsAllocation - delta);
      } else {
        let newFuture = prev.futureProjectsAllocation - delta;
        let newInvestments = prev.investmentsAllocation;

        if (newFuture < 0) {
          newInvestments = Math.max(0, newInvestments + newFuture);
          newFuture = 0;
        }
        next.futureProjectsAllocation = newFuture;
        next.investmentsAllocation = newInvestments;
      }

      const currentSum =
        next.liquidityAllocation +
        next.reserveAllocation +
        next.tradingAllocation +
        next.investmentsAllocation +
        next.futureProjectsAllocation;
      const diff = next.totalNetWorth - currentSum;
      next.futureProjectsAllocation = Math.max(0, next.futureProjectsAllocation + diff);

      return next;
    });
  }, []);

  // One-click helper: allinea riserva 1:1 con trading
  const handleAlignReserve = useCallback(() => {
    setProfile((prev) => {
      const targetReserve = prev.tradingAllocation;
      const delta = targetReserve - prev.reserveAllocation;

      let newFuture = prev.futureProjectsAllocation - delta;
      let newInvestments = prev.investmentsAllocation;

      if (newFuture < 0) {
        newInvestments = Math.max(0, newInvestments + newFuture);
        newFuture = 0;
      }

      const next = {
        ...prev,
        reserveAllocation: targetReserve,
        investmentsAllocation: newInvestments,
        futureProjectsAllocation: Math.max(0, newFuture),
      };

      const currentSum =
        next.liquidityAllocation +
        next.reserveAllocation +
        next.tradingAllocation +
        next.investmentsAllocation +
        next.futureProjectsAllocation;
      const diff = next.totalNetWorth - currentSum;
      next.futureProjectsAllocation = Math.max(0, next.futureProjectsAllocation + diff);

      return next;
    });

    toast({
      title: "Vincolo 1:1 Risolto",
      description: "Fondo di Riserva allineato al Capitale di Trading (1:1).",
    });
  }, []);

  // Preset strategico applicato con un clic
  const handleSelectPreset = (preset: StrategyPreset) => {
    setActiveStrategyPreset(preset);
    setIsAutoAllocation(false);
    const nextSubs = applyStrategyPreset(preset, profile.investmentsAllocation);
    setSubAllocations(nextSubs);
    toast({
      title: `Strategia ${
        preset === "DEFENSIVE"
          ? "Preservazione"
          : preset === "AGGRESSIVE_GROWTH"
          ? "Espansione"
          : preset === "HYBRID_PROP"
          ? "Ibrida Prop-to-Wealth"
          : "Equilibrio AUREUS"
      } Applicata`,
      description: "Asset class ribilanciate secondo la formula quantitativa istituzionale.",
    });
  };

  // Calcola Allocazione Ottimale AUREUS
  const handleApplyOptimalAllocation = useCallback(() => {
    setIsAutoAllocation(true);
    setActiveStrategyPreset("BALANCED_LIMEN");
    setProfile((prev) => {
      const optimal = calculateOptimalLimenAllocation({
        totalNetWorth: prev.totalNetWorth,
        monthlyExpenses: prev.monthlyExpenses,
        liquidityMonthsCovered: prev.liquidityMonthsCovered,
        externalStableIncome: prev.externalStableIncome,
        hasDependents: prev.hasDependents,
      });

      const nextSubs = calculateOptimalWealthSubAllocations(optimal.investmentsAllocation);
      setSubAllocations(nextSubs);

      return {
        ...prev,
        ...optimal,
      };
    });

    toast({
      title: "Allocazione Ottimale AUREUS Applicata",
      description: "Formula reattiva e bilanciamento dei 5 motori ripristinati.",
    });
  }, []);

  // Salvataggio persistente del protocollo patrimoniale
  const handleSaveAndActivate = async () => {
    const check = validateFinancialProfile(profile);
    if (!check.isValid) {
      toast({
        variant: "destructive",
        title: "Vincoli del Metodo non soddisfatti",
        description: check.errors[0] ?? "Verifica i vincoli di allocazione prima di procedere.",
      });
      return;
    }

    try {
      await updateMutation.mutateAsync({
        ...profile,
        monthlyPac: monthlyPAC,
        targetNetWorth,
        wealthSubAllocations: subAllocations,
        isCompleted: true,
      });

      toast({
        title: "Protocollo Patrimoniale Validato & Attivo",
        description: `Architettura Patrimoniale attivata. Capitale di riferimento: ${profile.tradingAllocation.toLocaleString("it-IT")} €.`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Errore durante il salvataggio.";
      toast({
        variant: "destructive",
        title: "Errore di Salvataggio",
        description: msg,
      });
    }
  };

  const sumPillars =
    profile.liquidityAllocation +
    profile.reserveAllocation +
    profile.tradingAllocation +
    profile.investmentsAllocation +
    profile.futureProjectsAllocation;

  const isExactSum = Math.abs(sumPillars - profile.totalNetWorth) <= 1;

  // Calcolo tasso di risparmio effettivo sul reddito
  const savingsRatePct =
    profile.externalStableIncome > 0
      ? Math.min(100, (monthlyPAC / profile.externalStableIncome) * 100)
      : 0;

  // Service lock gate for Limen Protocol
  if (!entitlements.financialArchitecture) {
    return (
      <PageLayout>
        <LimenServiceLockGate serviceId="financial_architecture" />
      </PageLayout>
    );
  }

  // Free trial gate screen
  if (isFreeTrial) {
    return (
      <PageLayout quiet>
        <div className="h-full flex flex-col items-center justify-center p-6 text-center max-w-2xl mx-auto space-y-6">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/40 bg-primary/15 text-primary shadow-[0_0_30px_rgba(197,160,89,0.2)]">
            <Shield className="h-8 w-8" />
          </div>
          <div className="space-y-2">
            <span className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-primary">
              MODULO RISERVATO AI MEMBRI EFFETTIVI
            </span>
            <h1 className="text-2xl sm:text-3xl font-display font-black text-foreground uppercase tracking-tight">
              Architettura Patrimoniale Oscurata
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Durante la <strong>prova gratuita di 1 giorno</strong>, la gestione dell'Architettura Patrimoniale e la Colonna Operativa sono oscurate per preservare i vincoli istituzionali dell'Ordine.
            </p>
          </div>

          <div className="rounded-xl border border-border/70 bg-card/60 p-4 font-mono text-xs text-muted-foreground text-left space-y-2 w-full">
            <div className="flex items-center justify-between text-foreground font-semibold border-b border-border/40 pb-2">
              <span>STATO ACCESSO:</span>
              <span className="text-success font-bold">PROVA GRATUITA 1 GIORNO</span>
            </div>
            <div className="flex items-center justify-between">
              <span>TEMPO RIMANENTE:</span>
              <span className="text-primary font-bold">{remainingTime}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>QUOTA SUCCESSIVA:</span>
              <span>150 € / mese</span>
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center gap-3 w-full justify-center">
            <Button
              size="lg"
              className="w-full sm:w-auto bg-primary text-primary-foreground font-bold hover:bg-primary/90 font-mono text-xs tracking-wider uppercase h-12 px-8"
              onClick={() => setLocation("/pro")}
            >
              ATTIVA ACCESSO COMPLETO (150 €/MESE)
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="w-full sm:w-auto font-mono text-xs h-12"
              onClick={() => setLocation("/")}
            >
              TORNA AL GRAFICO LIVE
            </Button>
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout quiet fullWidth className="lg:h-[100dvh] lg:overflow-hidden flex flex-col">
      {/* ─── MODALE DI APPROFONDIMENTO CHIRURGICO DEI SINGOLI STRUMENTI [• ℹ] ─── */}
      <InstrumentDossierModal
        toolId={activeDossierToolId}
        isOpen={activeDossierToolId !== null}
        onClose={() => setActiveDossierToolId(null)}
        onOpenPropCalculator={() => setIsPropCalculatorOpen(true)}
      />

      {/* ─── MODALE MOTORE PROP FIRM, FUNNEL 2 FASI & BROKER SOVRANI ─── */}
      <PropFirmCalculatorModal
        isOpen={isPropCalculatorOpen}
        onClose={() => setIsPropCalculatorOpen(false)}
        initialTradingCapital={profile.tradingAllocation}
        onOpenTaxDoctrine={(tab) => {
          setTaxInitialTab(tab ?? "prop");
          setIsTaxModalOpen(true);
        }}
      />

      {/* ─── MODALE COMPENDIO DOTTRINA FISCALE (ITALIA 🇮🇹) ─── */}
      <TaxDoctrineModal
        isOpen={isTaxModalOpen}
        onClose={() => setIsTaxModalOpen(false)}
        taxCountry={profile.taxCountry || "IT"}
        taxRegime={profile.taxRegime || "DICHIARATIVO"}
        initialTab={taxInitialTab}
        onSelectRegime={(regime) => updateBaseParam({ taxRegime: regime })}
      />

      {/* ─── MOBILE STEP SWITCHER (< 1024px) ─── */}
      <div className="flex lg:hidden items-center justify-between gap-2 px-2 pt-1 pb-2 border-b border-[#C5A059]/20 shrink-0 mobile-compact-bar">
        <div className="grid grid-cols-3 gap-1 rounded-lg border border-[#C5A059]/25 bg-[#07080b] p-0.5 text-[10px] font-mono flex-1">
          <button
            type="button"
            onClick={() => setMobileStep(1)}
            className={`py-1.5 px-1.5 rounded font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
              mobileStep === 1
                ? "bg-[#C5A059]/20 text-[#E8C56A] border border-[#C5A059]/45"
                : "text-slate-400 hover:text-foreground"
            }`}
          >
            01 · Fotografia
          </button>
          <button
            type="button"
            onClick={() => setMobileStep(2)}
            className={`py-1.5 px-1.5 rounded font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
              mobileStep === 2
                ? "bg-[#C5A059]/20 text-[#E8C56A] border border-[#C5A059]/45"
                : "text-slate-400 hover:text-foreground"
            }`}
          >
            02 · Motori (5)
          </button>
          <button
            type="button"
            onClick={() => setMobileStep(3)}
            className={`py-1.5 px-1.5 rounded font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
              mobileStep === 3
                ? "bg-[#C5A059]/20 text-[#E8C56A] border border-[#C5A059]/45"
                : "text-slate-400 hover:text-foreground"
            }`}
          >
            03 · Stress Test
          </button>
        </div>
      </div>

      {/* ─── COCKPIT AD ALTA DENSITÀ A 3 COLONNE (NESSUNA TESTATA, ZERO VUOTI, 100% UTILIZZO DELLO SPAZIO) ─── */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-2.5 p-2 sm:p-2.5 lg:overflow-hidden">
        {/* ═══════════════════════════════════════════════════════════════
            COLONNA 1: STEP 1: FOTOGRAFIA FINANZIARIA (3 CARD BILANCIATE) (3/12)
           ═══════════════════════════════════════════════════════════════ */}
        <div
          className={`lg:col-span-3 flex-col gap-2.5 lg:h-full lg:overflow-y-auto lg:overflow-x-hidden scrollbar-thin scrollbar-thumb-[#C5A059]/20 pr-0.5 min-w-0 ${
            mobileStep === 1 ? "flex" : "hidden lg:flex"
          }`}
        >
          {/* CARD 1A: Patrimonio Reale & Liquidità di Sopravvivenza */}
          <div className="flex-1 flex flex-col justify-between rounded-xl border border-border/70 bg-[#0d0f14]/90 p-3 sm:p-3.5 shadow-sm">
            {/* Header Step 1 */}
            <div className="flex items-center justify-between border-b border-border/60 pb-1.5 mb-1.5 gap-2 min-w-0">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="font-mono text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-[#C5A059]/20 border border-[#C5A059]/40 text-[#E8C56A] shrink-0">
                  01
                </span>
                <span className="font-mono text-[10.5px] sm:text-xs font-black uppercase tracking-wider text-[#E8C56A] whitespace-nowrap">
                  FOTOGRAFIA
                </span>
                <span className="sr-only">STEP 1: FOTOGRAFIA FINANZIARIA</span>
                <ToolInfoTrigger
                  toolId="totalNetWorth"
                  toolName="Base Patrimoniale"
                  onClick={setActiveDossierToolId}
                  size="xs"
                />
              </div>
              <span className="font-mono text-xs sm:text-[13px] font-bold text-foreground whitespace-nowrap shrink-0">
                {profile.totalNetWorth.toLocaleString("it-IT")} €
              </span>
            </div>

            {/* Input Patrimonio Totale Complessivo */}
            <div className="flex items-center justify-between gap-3 bg-[#07080b]/70 border border-border/80 rounded-lg p-2.5">
              <div className="flex flex-col min-w-0">
                <label className="font-bold text-foreground text-xs sm:text-[13px] whitespace-nowrap">
                  Patrimonio Complessivo
                </label>
                <span className="text-[10px] text-slate-400 font-mono whitespace-nowrap">
                  Base liquida + investita
                </span>
              </div>
              <div className="relative shrink-0">
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="1000"
                  value={profile.totalNetWorth || ""}
                  onChange={(e) => updateBaseParam({ totalNetWorth: Number(e.target.value) })}
                  placeholder="50000"
                  aria-label="Patrimonio Complessivo"
                  className="w-32 h-8 text-right font-mono font-bold text-sm sm:text-base pr-5 bg-[#0d0f14] border border-[#C5A059]/40 rounded px-2.5 text-[#E8C56A] focus:border-[#E8C56A] outline-none transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <span className="absolute right-1.5 top-1.5 font-mono text-[11px] text-[#C5A059] font-bold pointer-events-none">
                  €
                </span>
              </div>
            </div>

            {/* Slider Mesi di Spese in Liquidità Coperti */}
            <div className="space-y-1.5 bg-[#07080b]/50 border border-border/70 rounded-lg p-2.5">
              <div className="flex items-center justify-between text-xs gap-1.5 min-w-0">
                <div className="flex items-center gap-1 min-w-0">
                  <label className="font-bold text-foreground text-xs whitespace-nowrap">
                    Liquidità Vitale
                  </label>
                  <ToolInfoTrigger
                    toolId="liquidityAllocation"
                    toolName="Liquidità Vitale"
                    onClick={setActiveDossierToolId}
                    size="xs"
                  />
                </div>
                <span className="font-mono text-[11px] font-bold text-emerald-400 whitespace-nowrap shrink-0">
                  {profile.liquidityMonthsCovered}m ({profile.liquidityAllocation.toLocaleString("it-IT")} €)
                </span>
              </div>
              <Slider
                value={[profile.liquidityMonthsCovered]}
                min={3}
                max={12}
                step={1}
                onValueChange={([val]) => updateBaseParam({ liquidityMonthsCovered: val ?? 6 })}
                className="py-1 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] font-mono text-slate-400">
                <span>3m (Minimo)</span>
                <span className="text-[#E8C56A] font-semibold">6m (Consigliato)</span>
                <span>12m (Prudente)</span>
              </div>
            </div>

            {/* Switch Familiari a Carico */}
            <div className="flex items-center justify-between rounded-lg border border-border/70 px-2.5 py-1.5 bg-[#07080b]/60">
              <div className="flex flex-col">
                <span className="font-mono text-[10.5px] font-bold uppercase text-foreground">
                  Familiari a Carico
                </span>
                <span className="text-[9.5px] text-muted-foreground">
                  {profile.hasDependents ? "Sì (A carico)" : "No (Nessun carico)"}
                </span>
              </div>
              <Switch
                checked={profile.hasDependents}
                onCheckedChange={(checked) => updateBaseParam({ hasDependents: checked })}
                className="scale-75"
              />
            </div>

            {/* Box Residenza Erariale & Regime Fiscale (Italia 🇮🇹) */}
            <div className="rounded-lg border border-[#C5A059]/30 bg-[#07080b]/80 p-2 space-y-1.5 font-mono text-[10.5px]">
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <div className="flex items-center gap-1.5">
                  <Scale className="h-3.5 w-3.5 text-[#C5A059] shrink-0" />
                  <span className="font-bold text-foreground uppercase tracking-tight text-[11px] whitespace-nowrap">
                    Residenza Fiscale
                  </span>
                  <ToolInfoTrigger
                    toolId="taxRegime"
                    toolName="Regime Fiscale Italiano"
                    onClick={setActiveDossierToolId}
                    size="xs"
                  />
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Badge className="bg-[#C5A059]/15 border-[#C5A059]/40 text-[#E8C56A] text-[9.5px] px-1.5 py-0.5 shrink-0 whitespace-nowrap">
                    Italia 🇮🇹 (26%)
                  </Badge>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsTaxModalOpen(true)}
                    className="h-5 px-1.5 text-[9px] text-[#C5A059] hover:bg-[#C5A059]/15 hover:text-[#E8C56A] shrink-0 font-bold gap-1 underline decoration-[#C5A059]/40 underline-offset-2 whitespace-nowrap"
                    title="Consulta il Compendio di Dottrina Fiscale per l'Italia"
                  >
                    <Landmark className="h-2.5 w-2.5" />
                    <span>Dottrina</span>
                  </Button>
                </div>
              </div>

              {/* Selettore compatto Regime Dichiarativo vs Amministrato */}
              <div className="grid grid-cols-2 gap-1 p-0.5 bg-[#0d0f14] rounded border border-border/70 text-[9.5px]">
                <button
                  type="button"
                  onClick={() => updateBaseParam({ taxRegime: "DICHIARATIVO" })}
                  className={`py-1 px-1 rounded transition-all font-bold text-center tracking-wider whitespace-nowrap ${
                    (profile.taxRegime || "DICHIARATIVO") === "DICHIARATIVO"
                      ? "bg-[#C5A059] text-[#07080b] shadow-sm"
                      : "text-slate-400 hover:text-foreground"
                  }`}
                  title="Regime Dichiarativo: Broker esteri (IBKR, prop firm). Modello Redditi RT/RW/RM."
                >
                  DICHIARATIVO
                </button>
                <button
                  type="button"
                  onClick={() => updateBaseParam({ taxRegime: "AMMINISTRATO" })}
                  className={`py-1 px-1 rounded transition-all font-bold text-center tracking-wider whitespace-nowrap ${
                    profile.taxRegime === "AMMINISTRATO"
                      ? "bg-[#C5A059] text-[#07080b] shadow-sm"
                      : "text-slate-400 hover:text-foreground"
                  }`}
                  title="Regime Amministrato: Banche e broker italiani (Fineco, Directa). Sostituto d'imposta."
                >
                  AMMINISTRATO
                </button>
              </div>
            </div>
          </div>

          {/* CARD 1B: Flussi Mensili & Capacità di Risparmio (PAC) */}
          <div className="flex-1 flex flex-col justify-between rounded-xl border border-border/70 bg-[#0d0f14]/90 p-3 sm:p-3.5 shadow-sm">
            <div className="flex items-center justify-between border-b border-border/60 pb-2 mb-1.5">
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-[#C5A059]">
                FLUSSI DI CASSA & RISPARMIO
              </span>
              <span className="font-mono text-[10px] text-slate-400 font-medium px-2 py-0.5 rounded bg-secondary/60">
                Capacità Mensile
              </span>
            </div>

            {/* Micro-Griglia Spese Medie vs Entrate Esterne */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <label className="font-bold text-foreground text-xs block whitespace-nowrap">
                  Spese Medie
                </label>
                <div className="relative">
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="100"
                    value={profile.monthlyExpenses || ""}
                    onChange={(e) => updateBaseParam({ monthlyExpenses: Number(e.target.value) })}
                    placeholder="2000"
                    aria-label="Spese Medie Mensili"
                    className="w-full h-8 text-right font-mono text-xs sm:text-sm font-bold pr-8 bg-[#07080b] border border-border/80 rounded px-2.5 text-foreground focus:border-[#C5A059] outline-none transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <span className="absolute right-2 top-2 font-mono text-[10px] text-muted-foreground pointer-events-none">
                    €/m
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-foreground text-xs block whitespace-nowrap">
                  Entrate Esterne
                </label>
                <div className="relative">
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="100"
                    value={profile.externalStableIncome || ""}
                    onChange={(e) => updateBaseParam({ externalStableIncome: Number(e.target.value) })}
                    placeholder="2500"
                    aria-label="Entrate Esterne Mensili"
                    className="w-full h-8 text-right font-mono text-xs sm:text-sm font-bold pr-8 bg-[#07080b] border border-emerald-500/40 rounded px-2.5 text-emerald-400 focus:border-emerald-400 outline-none transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <span className="absolute right-2 top-2 font-mono text-[10px] text-emerald-500/80 pointer-events-none">
                    €/m
                  </span>
                </div>
              </div>
            </div>

            {/* Indicatore di Surplus Mensile Disponibile (Free Cash Flow) */}
            <div className="rounded border border-emerald-500/30 bg-emerald-950/20 px-2.5 py-1.5 flex items-center justify-between font-mono text-[11px]">
              <span className="text-slate-300 flex items-center gap-1.5 font-medium">
                <ArrowUpRight className="h-3.5 w-3.5 text-emerald-400" />
                <span>Surplus Mensile Netto:</span>
              </span>
              <span className="font-bold text-emerald-300 whitespace-nowrap">
                +{netSurplusMonthly.toLocaleString("it-IT")} €/m
              </span>
            </div>

            {/* Capacità di Risparmio & PAC Mensile */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-1.5 min-w-0">
                <div className="flex items-center gap-1 min-w-0">
                  <Wallet className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  <span className="font-mono text-[11px] font-bold uppercase text-foreground whitespace-nowrap">
                    PAC Mensile
                  </span>
                  <span className="sr-only">PAC Mensile Programmato</span>
                  <ToolInfoTrigger
                    toolId="monthlyPAC"
                    toolName="Piano di Accumulo Mensile"
                    onClick={setActiveDossierToolId}
                    tone="emerald"
                    size="xs"
                  />
                </div>
                <span className="font-mono text-[9.5px] font-bold text-emerald-400 px-1.5 py-0.5 rounded bg-emerald-950/40 border border-emerald-500/40 whitespace-nowrap shrink-0">
                  {savingsRatePct.toFixed(0)}% Savings
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <div className="relative flex-1 min-w-0">
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="50"
                    value={monthlyPAC || ""}
                    onChange={(e) => setMonthlyPAC(Math.max(0, Number(e.target.value) || 0))}
                    placeholder="500"
                    aria-label="PAC Mensile Programmato"
                    className="w-full h-8 text-right font-mono text-xs font-bold pr-7 bg-[#07080b] border border-border/80 rounded px-2 text-foreground focus:border-emerald-400 outline-none transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <span className="absolute right-2 top-2 font-mono text-[10px] text-muted-foreground pointer-events-none">
                    €/m
                  </span>
                </div>
                <div className="flex items-center gap-1 font-mono text-[9.5px] shrink-0">
                  {[200, 500, 1000].map((quick) => (
                    <button
                      key={quick}
                      type="button"
                      onClick={() => setMonthlyPAC(quick)}
                      className={`h-8 px-2 py-0.5 rounded border transition-all ${
                        monthlyPAC === quick
                          ? "bg-emerald-950/60 border-emerald-500/70 text-emerald-300 font-bold"
                          : "border-border/60 hover:border-emerald-500/30 text-slate-300"
                      }`}
                    >
                      {quick === 1000 ? "1k€" : `${quick}€`}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* CARD 1C: Traguardo Freedom & Regola Aurea 1:1 */}
          <div className="flex-1 flex flex-col justify-between rounded-xl border border-border/70 bg-[#0d0f14]/90 p-3 sm:p-3.5 shadow-sm">
            <div className="flex items-center justify-between border-b border-border/60 pb-2 mb-1.5">
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-[#C5A059]">
                TRAGUARDO & RISERVA AUREA
              </span>
              <span className="font-mono text-[10px] text-slate-400 font-medium px-2 py-0.5 rounded bg-secondary/60">
                Integrità
              </span>
            </div>

            {/* Target di Indipendenza Finanziaria (Freedom Number) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-1.5 min-w-0">
                <div className="flex items-center gap-1 min-w-0">
                  <Target className="h-3.5 w-3.5 text-[#C5A059] shrink-0" />
                  <span className="font-mono text-[11px] font-bold uppercase text-foreground whitespace-nowrap">
                    Target Freedom
                  </span>
                  <span className="sr-only">Target Indipendenza</span>
                  <ToolInfoTrigger
                    toolId="targetNetWorth"
                    toolName="Freedom Number Istituzionale"
                    onClick={setActiveDossierToolId}
                    tone="gold"
                    size="xs"
                  />
                </div>
                <span className="font-mono text-[10px] text-slate-400 whitespace-nowrap shrink-0">
                  25x: {(profile.monthlyExpenses * 12 * 25).toLocaleString("it-IT")} €
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <div className="relative flex-1 min-w-0">
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="10000"
                    value={targetNetWorth || ""}
                    onChange={(e) => setTargetNetWorth(Math.max(0, Number(e.target.value) || 0))}
                    placeholder="500000"
                    aria-label="Target Indipendenza"
                    className="w-full h-8 text-right font-mono text-xs font-bold pr-5 bg-[#07080b] border border-border/80 rounded px-2 text-[#E8C56A] focus:border-[#C5A059] outline-none transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <span className="absolute right-1.5 top-2 font-mono text-[10px] text-[#C5A059] font-bold pointer-events-none">
                    €
                  </span>
                </div>
                <div className="flex items-center gap-1 font-mono text-[9.5px] shrink-0">
                  {[300000, 500000, 1000000].map((quick) => (
                    <button
                      key={quick}
                      type="button"
                      onClick={() => setTargetNetWorth(quick)}
                      className={`h-8 px-2 py-0.5 rounded border transition-all ${
                        targetNetWorth === quick
                          ? "bg-[#C5A059]/20 border-[#C5A059]/70 text-[#E8C56A] font-bold"
                          : "border-border/60 hover:border-[#C5A059]/30 text-slate-300"
                      }`}
                    >
                      {quick >= 1000000 ? "1M€" : `${quick / 1000}k€`}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Telemetria: Capitale Investibile Residuo */}
            <div className="rounded border border-[#C5A059]/20 bg-[#C5A059]/5 px-2.5 py-1.5 font-mono text-[11px] flex items-center justify-between">
              <div className="flex flex-col min-w-0">
                <span className="text-slate-400 uppercase text-[10px] font-semibold truncate">
                  Investibile Netto (Post-Riserva):
                </span>
                <span className="text-[9px] text-slate-500 whitespace-nowrap">
                  Lordo: {vitalLiquidity.investableCapital.toLocaleString("it-IT")} € • Riserva: {profile.reserveAllocation.toLocaleString("it-IT")} €
                </span>
              </div>
              <span className="font-bold text-foreground text-xs sm:text-sm whitespace-nowrap ml-2">
                {Math.max(0, vitalLiquidity.investableCapital - profile.reserveAllocation).toLocaleString("it-IT")} €
              </span>
            </div>

            {/* Box Fondamentale: Regola Aurea 1:1 Riserva vs Trading */}
            <div
              className={`rounded-lg border p-2.5 transition-all ${
                reserveConstraint.isValid
                  ? "border-emerald-500/40 bg-emerald-950/20"
                  : "border-red-500/40 bg-red-950/20"
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  {reserveConstraint.isValid ? (
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertTriangle className="h-3.5 w-3.5 text-red-400 shrink-0" />
                  )}
                  {reserveConstraint.isValid ? (
                    <Badge
                      variant="outline"
                      className="font-mono text-[10px] font-bold border-emerald-500/40 bg-emerald-950/20 text-emerald-300 gap-1 px-2 py-0.5"
                    >
                      <span className="whitespace-nowrap">VINCOLO 1:1 RISPETTATO</span>
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="font-mono text-[10px] font-bold border-red-500/40 bg-red-950/20 text-red-300 gap-1 px-2 py-0.5 animate-pulse"
                    >
                      <span className="whitespace-nowrap">VIOLAZIONE REGOLA DI RISERVA</span>
                    </Badge>
                  )}
                </div>
                <ToolInfoTrigger
                  toolId="reserveAllocation"
                  toolName="Fondo di Riserva & Vincolo 1:1"
                  onClick={setActiveDossierToolId}
                  tone={reserveConstraint.isValid ? "emerald" : "crimson"}
                  size="xs"
                />
              </div>

              <div className="flex items-center justify-between text-[11px] font-mono">
                <span className="text-slate-300 whitespace-nowrap">Riserva: {profile.reserveAllocation.toLocaleString("it-IT")} €</span>
                <span className="text-slate-300 whitespace-nowrap">Trading: {profile.tradingAllocation.toLocaleString("it-IT")} €</span>
              </div>

              {!reserveConstraint.isValid && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleAlignReserve}
                  className="w-full mt-2 h-7 text-[10px] font-mono font-bold border-red-500/50 bg-red-900/40 text-red-100 hover:bg-red-800/60"
                >
                  Allinea Riserva 1:1 ({profile.tradingAllocation.toLocaleString("it-IT")} €)
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            COLONNA 2: STEP 2: CONFIGURAZIONE STRATEGICA · I 5 MOTORI (5/12)
           ═══════════════════════════════════════════════════════════════ */}
        <div
          className={`lg:col-span-5 flex-col justify-between rounded-xl border border-border/70 bg-[#0d0f14]/90 p-3 sm:p-3.5 shadow-sm lg:overflow-y-auto lg:overflow-x-hidden lg:h-full scrollbar-thin scrollbar-thumb-[#C5A059]/20 pr-1 min-w-0 ${
            mobileStep === 2 ? "flex" : "hidden lg:flex"
          }`}
        >
          {/* Header Colonna 2 & Presets Istituzionali */}
          <div className="border-b border-border/60 pb-2 mb-1.5 space-y-2 shrink-0">
            {/* Riga 1: Titolo Step 2 + Totale Allocato & Riconciliazione */}
            <div className="flex items-center justify-between gap-2 min-w-0">
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <span className="font-mono text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-[#C5A059]/20 border border-[#C5A059]/40 text-[#E8C56A] shrink-0">
                  02
                </span>
                <span className="font-mono text-[10.5px] sm:text-xs font-black uppercase tracking-wider text-[#E8C56A] whitespace-nowrap">
                  ASSET ALLOCATION
                </span>
                <span className="sr-only">STEP 2: CONFIGURAZIONE STRATEGICA · I 5 MOTORI</span>
              </div>
              <div className="flex items-center gap-2 font-mono text-[10.5px] px-2 py-0.5 rounded bg-[#07080b]/80 border border-border/70 shrink-0">
                <span className="text-slate-400 text-[9px] uppercase hidden sm:inline">5 Pilastri:</span>
                <span
                  className={`font-bold whitespace-nowrap ${
                    isExactSum ? "text-emerald-400" : "text-red-400"
                  }`}
                  title={`Liquidità: ${profile.liquidityAllocation.toLocaleString("it-IT")}€ | Riserva: ${profile.reserveAllocation.toLocaleString("it-IT")}€ | Investimenti: ${profile.investmentsAllocation.toLocaleString("it-IT")}€ | Trading: ${profile.tradingAllocation.toLocaleString("it-IT")}€ | Cuscinetto: ${profile.futureProjectsAllocation.toLocaleString("it-IT")}€`}
                >
                  {sumPillars.toLocaleString("it-IT")} / {profile.totalNetWorth.toLocaleString("it-IT")} €
                </span>
                <span className="text-slate-500">•</span>
                <span className="text-slate-400 text-[9px] uppercase">Mercato:</span>
                <span className="font-bold text-[#E8C56A] whitespace-nowrap">
                  {(subAllocations.equityAllocation + subAllocations.dividendsAllocation + subAllocations.cryptoAllocation + subAllocations.hedgingAllocation + profile.tradingAllocation).toLocaleString("it-IT")} €
                </span>
              </div>
            </div>

            {/* Micro-sintesi di riconciliazione dei 5 Pilastri Sovrani (Zero buchi contabili) */}
            <div className="flex items-center justify-between text-[9px] font-mono px-2 py-1 rounded bg-[#07080b]/60 border border-border/50 text-slate-400 gap-1 overflow-x-auto scrollbar-none whitespace-nowrap">
              <span>💧 Liq: <strong className="text-slate-200">{profile.liquidityAllocation.toLocaleString("it-IT")} €</strong></span>
              <span className="text-slate-600">|</span>
              <span>🛡️ Riserva: <strong className="text-emerald-400">{profile.reserveAllocation.toLocaleString("it-IT")} €</strong></span>
              <span className="text-slate-600">|</span>
              <span>📈 Inv: <strong className="text-[#E8C56A]">{profile.investmentsAllocation.toLocaleString("it-IT")} €</strong></span>
              <span className="text-slate-600">|</span>
              <span>⚡ Trading: <strong className="text-[#E8C56A]">{profile.tradingAllocation.toLocaleString("it-IT")} €</strong></span>
              {profile.futureProjectsAllocation > 0 && (
                <>
                  <span className="text-slate-600">|</span>
                  <span>🧱 Cuscinetto: <strong className="text-slate-300">{profile.futureProjectsAllocation.toLocaleString("it-IT")} €</strong></span>
                </>
              )}
            </div>

            {/* Riga 2: Selettore Presets a Piena Larghezza + Chip Top Opportunity */}
            <div className="flex items-center justify-between gap-2">
              <div className="grid grid-cols-5 gap-1 p-0.5 bg-[#07080b] rounded border border-border/70 font-mono text-[9px] flex-1">
                <button
                  type="button"
                  onClick={() => handleSelectPreset("DEFENSIVE")}
                  className={`py-1 px-1 rounded transition-all font-bold text-center tracking-wider whitespace-nowrap ${
                    activeStrategyPreset === "DEFENSIVE"
                      ? "bg-slate-800 text-slate-100 border border-slate-500/50 shadow-sm"
                      : "text-slate-400 hover:text-foreground"
                  }`}
                  title="Strategia Difensiva: 30% Azioni, 35% Dividendi, 25% Oro, 10% Crypto"
                >
                  DIFESA
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectPreset("BALANCED_LIMEN")}
                  className={`py-1 px-1 rounded transition-all font-bold text-center tracking-wider whitespace-nowrap ${
                    activeStrategyPreset === "BALANCED_LIMEN"
                      ? "bg-[#C5A059] text-[#07080b] shadow-[0_0_8px_rgba(197,160,89,0.35)]"
                      : "text-slate-400 hover:text-foreground"
                  }`}
                  title="Equilibrio Aureo AUREUS: 50% Azioni, 25% Dividendi, 15% Oro, 10% Crypto"
                >
                  EQUILIBRIO
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectPreset("AGGRESSIVE_GROWTH")}
                  className={`py-1 px-1 rounded transition-all font-bold text-center tracking-wider whitespace-nowrap ${
                    activeStrategyPreset === "AGGRESSIVE_GROWTH"
                      ? "bg-emerald-950/80 text-emerald-300 border border-emerald-500/50 shadow-sm"
                      : "text-slate-400 hover:text-foreground"
                  }`}
                  title="Espansione Composta: 60% Azioni, 18% Dividendi, 14% Crypto, 8% Oro"
                >
                  CRESCITA
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectPreset("HYBRID_PROP")}
                  className={`py-1 px-1 rounded transition-all font-bold text-center tracking-wider whitespace-nowrap ${
                    activeStrategyPreset === "HYBRID_PROP"
                      ? "bg-amber-950/80 text-amber-300 border border-amber-500/50 shadow-sm"
                      : "text-slate-400 hover:text-foreground"
                  }`}
                  title="Pipeline Ibrida Prop-to-Wealth: 50% Azioni, 30% Dividendi, 12% Oro, 8% Crypto"
                >
                  IBRIDO
                </button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleApplyOptimalAllocation}
                  aria-label="Calcola Allocazione Ottimale AUREUS"
                  title="Calcola Allocazione Ottimale AUREUS"
                  className="h-full py-1 px-1 font-mono text-[9px] text-[#E8C56A] hover:bg-[#C5A059]/15 hover:text-[#F3D88C]"
                >
                  <Sparkles className="h-2.5 w-2.5 mr-0.5 text-[#C5A059]" />
                  <span className="whitespace-nowrap font-bold tracking-wider">FORMULA</span>
                </Button>
              </div>

              <button
                type="button"
                onClick={() =>
                  setActiveDossierToolId(
                    crossAssetMatrix.topOpportunity.assetId === "equity"
                      ? "equityAllocation"
                      : crossAssetMatrix.topOpportunity.assetId === "dividends"
                      ? "dividendsAllocation"
                      : crossAssetMatrix.topOpportunity.assetId === "crypto"
                      ? "cryptoAllocation"
                      : crossAssetMatrix.topOpportunity.assetId === "gold"
                      ? "hedgingAllocation"
                      : "tradingAllocation"
                  )
                }
                className="inline-flex items-center gap-1 font-mono text-[9px] font-bold uppercase px-2 py-1 rounded border border-emerald-500/40 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/60 transition-all cursor-pointer whitespace-nowrap shrink-0"
                title="Clicca per aprire la matrice di rotazione quantitativa cross-asset"
              >
                <span>
                  ⚡ Top: {crossAssetMatrix.topOpportunity.title.split(" ")[0]} ({crossAssetMatrix.topOpportunity.score})
                </span>
              </button>
            </div>
          </div>

          {/* Lista delle 5 Asset Class Operative */}
          <div className="space-y-2 flex-1 flex flex-col justify-between overflow-y-auto scrollbar-thin scrollbar-thumb-[#C5A059]/20 pr-0.5">
            {/* 1. Azioni & ETF (Core) */}
            <WealthAssetCard
              toolId="equityAllocation"
              label="Azioni & ETF (Core)"
              subtitle="Crescita indicizzata a lungo termine"
              valueEuro={subAllocations.equityAllocation}
              pct={profile.totalNetWorth > 0 ? (subAllocations.equityAllocation / profile.totalNetWorth) * 100 : 0}
              subPct={profile.investmentsAllocation > 0 ? (subAllocations.equityAllocation / profile.investmentsAllocation) * 100 : 0}
              subPctLabel="Inv"
              totalNetWorth={profile.totalNetWorth}
              pacMonthlyEuro={pacEquity}
              color="#10b981"
              tone="emerald"
              badgeTag="CRESCITA (COMPOUNDING) • 26%"
              timingSignal={formatCompactRegime(equityTiming.regimeLabel)}
              timingScore={equityTiming.score}
              derivedMetricLabel="CAGR Atteso"
              derivedMetricValue={`~${equityTiming.expectedAnnualReturnPct}% a.a.`}
              secondaryMetric={`P/E ${equityTiming.keyMetrics["P/E Ponderato"]} • Breadth ${equityTiming.keyMetrics["Market Breadth Top 50"] || "60%"}`}
              onChangeEuro={(val) => handleSubAssetChange("equityAllocation", val)}
              onOpenDossier={setActiveDossierToolId}
              max={profile.totalNetWorth}
            />

            {/* 2. Dividendi (Cash Flow) */}
            <WealthAssetCard
              toolId="dividendsAllocation"
              label="Dividendi (Cash Flow)"
              subtitle="Rendita passiva periodica"
              valueEuro={subAllocations.dividendsAllocation}
              pct={profile.totalNetWorth > 0 ? (subAllocations.dividendsAllocation / profile.totalNetWorth) * 100 : 0}
              subPct={profile.investmentsAllocation > 0 ? (subAllocations.dividendsAllocation / profile.investmentsAllocation) * 100 : 0}
              subPctLabel="Inv"
              totalNetWorth={profile.totalNetWorth}
              pacMonthlyEuro={pacDividends}
              color="#C5A059"
              tone="gold"
              badgeTag="RENDITA (CASHFLOW) • 26%"
              timingSignal={formatCompactRegime(dividendTiming.regimeLabel)}
              timingScore={dividendTiming.score}
              derivedMetricLabel="Rendimento Totale"
              derivedMetricValue={`~${dividendTiming.expectedAnnualReturnPct}% a.a.`}
              secondaryMetric={`Flusso Cedolare: +${Math.round((subAllocations.dividendsAllocation * ((dividendTiming.dividendYieldPct ?? 0) / 100)) / 12).toLocaleString("it-IT")} €/m (Yield Netto: +${(dividendTiming.dividendYieldPct ?? 0).toFixed(2)}%)`}
              onChangeEuro={(val) => handleSubAssetChange("dividendsAllocation", val)}
              onOpenDossier={setActiveDossierToolId}
              max={profile.totalNetWorth}
            />

            {/* 3. Riserva Crittografica & Staking Sovrano */}
            <WealthAssetCard
              toolId="cryptoAllocation"
              label="Crypto (BTC & Staking)"
              subtitle="Alpha asimmetrico sovrano con staking"
              valueEuro={subAllocations.cryptoAllocation}
              pct={profile.totalNetWorth > 0 ? (subAllocations.cryptoAllocation / profile.totalNetWorth) * 100 : 0}
              subPct={profile.investmentsAllocation > 0 ? (subAllocations.cryptoAllocation / profile.investmentsAllocation) * 100 : 0}
              subPctLabel="Inv"
              totalNetWorth={profile.totalNetWorth}
              pacMonthlyEuro={pacCrypto}
              color="#f59e0b"
              tone="gold"
              badgeTag="26% + 0.20% IVAFE"
              timingSignal={formatCompactRegime(cryptoTiming.regimeLabel)}
              timingScore={cryptoTiming.score}
              derivedMetricLabel="CAGR Ciclico Atteso"
              derivedMetricValue={`~${cryptoTiming.expectedAnnualReturnPct}% a.a.`}
              secondaryMetric={
                cryptoStakingMonthlyCashflow > 0
                  ? `Staking APY PoS: ~${cryptoTiming.weightedStakingApyPct}% a.a. (+${cryptoStakingMonthlyCashflow} €/m) • Finestra Post-Halving`
                  : `Staking APY PoS: ~${cryptoTiming.weightedStakingApyPct}% a.a. • Finestra Post-Halving`
              }
              onChangeEuro={(val) => handleSubAssetChange("cryptoAllocation", val)}
              onOpenDossier={setActiveDossierToolId}
              max={profile.totalNetWorth}
            />

            {/* 4. Copertura & Metalli (Oro) */}
            <WealthAssetCard
              toolId="hedgingAllocation"
              label="Copertura (Oro & BTP)"
              subtitle="Oro fisico e asset decorrelati"
              valueEuro={subAllocations.hedgingAllocation}
              pct={profile.totalNetWorth > 0 ? (subAllocations.hedgingAllocation / profile.totalNetWorth) * 100 : 0}
              subPct={profile.investmentsAllocation > 0 ? (subAllocations.hedgingAllocation / profile.investmentsAllocation) * 100 : 0}
              subPctLabel="Inv"
              totalNetWorth={profile.totalNetWorth}
              pacMonthlyEuro={pacHedging}
              color="#64748b"
              tone="slate"
              badgeTag="12.5% STATO / 26% ORO"
              timingSignal={formatCompactRegime(goldTiming.regimeLabel)}
              timingScore={goldTiming.score}
              derivedMetricLabel="Apprezzamento Atteso"
              derivedMetricValue={`~${goldTiming.expectedAnnualReturnPct}% a.a.`}
              secondaryMetric={`Spot XAU $${CURRENT_GOLD_BENCHMARK.spotPriceUsd.toFixed(0)} (${CURRENT_GOLD_BENCHMARK.distanceFromSma200Pct > 0 ? "+" : ""}${CURRENT_GOLD_BENCHMARK.distanceFromSma200Pct}% SMA200) • Trend Banche Centrali`}
              onChangeEuro={(val) => handleSubAssetChange("hedgingAllocation", val)}
              onOpenDossier={setActiveDossierToolId}
              max={profile.totalNetWorth}
            />

            {/* 5. Conto Trading (Trans-Aureus) */}
            <WealthAssetCard
              toolId="tradingAllocation"
              label="Trading (Trans-Aureus)"
              subtitle="Motore operativo con vincolo 1:1"
              valueEuro={profile.tradingAllocation}
              pct={percentages.tradingPct}
              subPct={percentages.tradingPct}
              subPctLabel="NetWorth"
              totalNetWorth={profile.totalNetWorth}
              pacMonthlyEuro={0}
              color="#E8C56A"
              tone="gold"
              badgeTag="26% REDDITI DIVERSI"
              timingSignal={formatCompactRegime(tradingPositioning.regimeLabel)}
              timingScore={tradingPositioning.timingScore}
              derivedMetricLabel="Target"
              derivedMetricValue={`${profile.expectedMonthlyReturnPct.toFixed(1)}%/m (~${((profile.expectedMonthlyReturnPct ?? 3) * 12).toFixed(0)}% a.a.)`}
              secondaryMetric={`Rischio/Trade: €${tradingPositioning.riskPerTradeEuro} (${tradingPositioning.halfKellyRiskPct}%) • Impatto Net Worth: ${tradingPositioning.netWorthRiskPct}%`}
              onChangeEuro={(val) => handlePillarChange("tradingAllocation", val)}
              onOpenDossier={setActiveDossierToolId}
              onOpenPropCalculator={() => setIsPropCalculatorOpen(true)}
              max={profile.totalNetWorth}
            />
          </div>

          {/* Termometro Rapido Aspettativa di Rendimento Conto */}
          <div className="pt-2 border-t border-border/60 mt-1 flex items-center justify-between text-xs font-mono shrink-0 gap-2 min-w-0">
            <span className="text-slate-300 flex items-center gap-1.5 min-w-0 flex-1">
              <span className="shrink-0 text-slate-400">Termometro del Rischio:</span>
              <strong className="text-foreground font-bold whitespace-nowrap overflow-hidden text-ellipsis">
                {expectationEvaluation.headline.replace(" / Conservativo", " · Solido").replace(" / Moderato", " · Moderato").replace(" / Aggressivo", " · Aggressivo")}
              </strong>
            </span>
            <span className="text-slate-300 whitespace-nowrap shrink-0 ml-1">
              Target: <strong className="text-[#E8C56A]">{profile.expectedMonthlyReturnPct.toFixed(1)}%/m</strong> (
              {expectationEvaluation.expectedMonthlyProfitEuro.toLocaleString("it-IT", {
                maximumFractionDigits: 0,
              })}{" "}
              €/m)
            </span>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            COLONNA 3: STEP 3: ANALISI VISIVA, PROIEZIONI & VALIDAZIONE (4/12)
           ═══════════════════════════════════════════════════════════════ */}
        <div
          className={`lg:col-span-4 flex-col gap-2.5 lg:h-full lg:overflow-y-auto lg:overflow-x-hidden scrollbar-thin scrollbar-thumb-[#C5A059]/20 pr-0.5 min-w-0 ${
            mobileStep === 3 ? "flex" : "hidden lg:flex"
          }`}
        >
          {/* BLOCCO SUPERIORE: Selettore Orizzonte + Visualizzatore Unificato Proiezioni / Monte Carlo / Pilastri */}
          <div className="flex-1 flex flex-col rounded-xl border border-border/70 bg-[#0d0f14]/90 p-3 sm:p-3.5 shadow-sm overflow-hidden min-h-0">
            <div className="space-y-1.5 flex-1 flex flex-col min-h-0">
              {/* Header Colonna 3: Titolo, Badge & Controlli Orizzonte */}
              <div className="border-b border-border/60 pb-2 mb-1.5 space-y-1.5 shrink-0">
                <div className="flex items-center justify-between gap-2 min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <span className="font-mono text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-[#C5A059]/20 border border-[#C5A059]/40 text-[#E8C56A] shrink-0">
                      03
                    </span>
                    <span className="font-mono text-[10.5px] sm:text-xs font-black uppercase tracking-wider text-[#E8C56A] whitespace-nowrap">
                      STRESS TEST & MONTE CARLO
                    </span>
                    <span className="sr-only">STEP 3: STRESS TEST & VALIDAZIONE FINALE</span>
                    <ToolInfoTrigger
                      toolId="timeHorizon"
                      toolName="Simulatore Multi-Asse"
                      onClick={setActiveDossierToolId}
                      size="xs"
                    />
                  </div>
                </div>

                {/* Selettore Viste: Proiezione NW / Monte Carlo 1.000T / Donut + Toggle Lordo/Netto & Orizzonti */}
                <div className="flex flex-wrap items-center justify-between gap-1.5 pt-0.5">
                  {/* Segmented View Switcher */}
                  <div className="flex items-center gap-0.5 bg-[#07080b] p-0.5 rounded border border-border/70 font-mono text-[9.5px]">
                    <button
                      type="button"
                      onClick={() => setActiveVisualView("projection")}
                      className={`px-2 py-0.5 rounded transition-all font-bold whitespace-nowrap flex items-center gap-1 ${
                        activeVisualView === "projection"
                          ? "bg-[#C5A059] text-[#07080b] shadow-[0_0_8px_rgba(197,160,89,0.5)]"
                          : "text-slate-400 hover:text-foreground"
                      }`}
                    >
                      <LineChartIcon className="h-2.5 w-2.5" />
                      <span>Proiezione</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveVisualView("monte_carlo")}
                      className={`px-2 py-0.5 rounded transition-all font-bold whitespace-nowrap flex items-center gap-1 ${
                        activeVisualView === "monte_carlo"
                          ? "bg-[#C5A059] text-[#07080b] shadow-[0_0_8px_rgba(197,160,89,0.5)]"
                          : "text-slate-400 hover:text-foreground"
                      }`}
                    >
                      <TrendingUp className="h-2.5 w-2.5" />
                      <span>Monte Carlo (1.000T)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveVisualView("pillars")}
                      className={`px-2 py-0.5 rounded transition-all font-bold whitespace-nowrap flex items-center gap-1 ${
                        activeVisualView === "pillars"
                          ? "bg-[#C5A059] text-[#07080b] shadow-[0_0_8px_rgba(197,160,89,0.5)]"
                          : "text-slate-400 hover:text-foreground"
                      }`}
                    >
                      <PieChart className="h-2.5 w-2.5" />
                      <span>Pilastri</span>
                    </button>
                  </div>

                  {/* Toggle LORDO vs NETTO & Pillole Orizzonte Temporale */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <div className="flex items-center gap-0.5 bg-[#07080b] p-0.5 rounded border border-border/70 font-mono text-[9px]">
                      <button
                        type="button"
                        onClick={() => updateBaseParam({ showNetOfTax: false })}
                        className={`px-1.5 py-0.5 rounded transition-all font-bold whitespace-nowrap ${
                          profile.showNetOfTax === false
                            ? "bg-slate-700 text-white shadow-sm"
                            : "text-slate-400 hover:text-foreground"
                        }`}
                        title="Calcolo Lordo Nominale (senza detrazione fiscale)"
                      >
                        LORDO
                      </button>
                      <button
                        type="button"
                        onClick={() => updateBaseParam({ showNetOfTax: true })}
                        className={`px-1.5 py-0.5 rounded transition-all font-bold whitespace-nowrap ${
                          profile.showNetOfTax !== false
                            ? "bg-emerald-950 text-emerald-300 border border-emerald-500/50 shadow-[0_0_6px_rgba(16,185,129,0.3)]"
                            : "text-slate-400 hover:text-foreground"
                        }`}
                        title="Calcolo Netto Post-Tax (al netto di imposta 26% e bollo/IVAFE 0.20%)"
                      >
                        NETTO 🇮🇹
                      </button>
                    </div>

                    <div className="flex items-center gap-0.5 bg-[#07080b] p-0.5 rounded border border-border/70 font-mono text-[10px] shrink-0">
                      {[1, 3, 5, 10, 20].map((yr) => (
                        <button
                          key={yr}
                          type="button"
                          onClick={() => setSelectedHorizon(yr)}
                          className={`px-1.5 py-0.5 rounded transition-all font-bold ${
                            selectedHorizon === yr
                              ? "bg-[#C5A059] text-[#07080b] shadow-[0_0_8px_rgba(197,160,89,0.5)]"
                              : "text-slate-400 hover:text-foreground"
                          }`}
                        >
                          {yr}A
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* CONTENUTO VISIVO PRINCIPALE: Proiezione Net Worth / Monte Carlo 1.000T / Donut Pilastri */}
              {activeVisualView === "projection" && (
                <div className="space-y-2 flex-1 flex flex-col justify-between overflow-y-auto scrollbar-thin scrollbar-thumb-[#C5A059]/25 pr-0.5">
                  <WealthProjectionChart
                    trajectory={wealthProjections.trajectory}
                    horizonYears={selectedHorizon}
                    targetNetWorth={targetNetWorth}
                    className="w-full shrink-0"
                  />

                  {/* 3 Micro-Card di Telemetria all'Orizzonte T con Valori Chiari e Ingranditi */}
                  <div className="grid grid-cols-3 gap-2 text-center shrink-0">
                    <div className="rounded-lg border border-[#C5A059]/35 bg-[#C5A059]/10 p-2 font-mono">
                      <span className="text-[10px] uppercase text-slate-400 font-bold block truncate">
                        {profile.showNetOfTax !== false ? "NetWorth Netto 🇮🇹" : "NetWorth Lordo"} +{selectedHorizon}A
                      </span>
                      <span className="text-sm sm:text-base font-black text-[#E8C56A] whitespace-nowrap block mt-0.5">
                        {wealthProjections.endProjectedNetWorth.toLocaleString("it-IT")} €
                      </span>
                      <span className="text-[10px] text-emerald-400 font-bold block whitespace-nowrap">
                        +{wealthProjections.totalGainPct.toFixed(1)}% {profile.showNetOfTax !== false ? "netto" : "lordo"}
                      </span>
                    </div>

                    <div className="rounded-lg border border-border/80 bg-[#07080b]/80 p-2 font-mono">
                      <span className="text-[10px] uppercase text-slate-400 font-bold block truncate">
                        {profile.showNetOfTax !== false ? "Rendita Netta" : "Rendita Lorda"}
                      </span>
                      <span className="text-sm sm:text-base font-black text-foreground whitespace-nowrap block mt-0.5">
                        +{wealthProjections.totalMonthlyPassiveCashflowEnd.toLocaleString("it-IT")} €/m
                      </span>
                      <span className="text-[9.5px] text-slate-400 block whitespace-nowrap">
                        {profile.showNetOfTax !== false ? "(Post-Tax 26%)" : "(Lordo)"}
                      </span>
                    </div>

                    <div className="rounded-lg border border-red-500/40 bg-red-950/20 p-2 font-mono">
                      <div className="flex items-center justify-center gap-1">
                        <span className="text-[10px] uppercase text-slate-400 font-bold truncate">
                          Stress Test
                        </span>
                        <ToolInfoTrigger
                          toolId="portfolioStressTest"
                          toolName="Stress Test di Crollo Globale"
                          onClick={setActiveDossierToolId}
                          tone="crimson"
                          size="xs"
                        />
                      </div>
                      <span className="text-sm sm:text-base font-black text-red-400 whitespace-nowrap block mt-0.5">
                        {wealthProjections.systemicStressTest.netWorthImpactPct.toFixed(1)}%
                      </span>
                      <span className="text-[9.5px] text-slate-300 block whitespace-nowrap">
                        Scudo {wealthProjections.systemicStressTest.survivalShieldScore}/100
                      </span>
                    </div>
                  </div>

                  {/* Micro-Card Telemetria Drag Fiscale Stimato */}
                  {wealthProjections.taxDragEuro > 0 && (
                    <div className="rounded-lg border border-[#C5A059]/30 bg-[#07080b]/80 px-2.5 py-1.5 flex items-center justify-between font-mono text-[9.5px] shrink-0">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Scale className="h-3 w-3 text-[#C5A059] shrink-0" />
                        <span className="text-slate-300 font-semibold truncate">
                          Drag Fiscale (+{selectedHorizon}A):
                        </span>
                        <ToolInfoTrigger
                          toolId="taxCompoundingDrag"
                          toolName="Drag Fiscale & Compounding"
                          onClick={setActiveDossierToolId}
                          size="xs"
                        />
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-bold text-red-400 whitespace-nowrap">
                          -{wealthProjections.taxDragEuro.toLocaleString("it-IT")} €
                        </span>
                        <span className="text-slate-400 text-[8.5px] hidden sm:inline whitespace-nowrap">
                          (Bollo 0.20%: ~{wealthProjections.estimatedStampDutyTotalEuro.toLocaleString("it-IT")} €)
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Scomposizione del Capitale Finale & Monitor Traguardo FIRE */}
                  {(() => {
                    const totalNWEnd = wealthProjections.endProjectedNetWorth || 1;
                    const investedEnd = wealthProjections.cumulativeInvestedEnd;
                    const gainEuro = Math.max(0, wealthProjections.totalGainEuro);
                    const investedPct = Math.min(100, Math.max(0, (investedEnd / totalNWEnd) * 100));
                    const compoundPct = Math.max(0, 100 - investedPct);

                    const targetVal = targetNetWorth || 500000;
                    const fireProgressPct = Math.min(100, (totalNWEnd / targetVal) * 100);
                    const fireGap = Math.max(0, targetVal - totalNWEnd);
                    const monthlyPassive = wealthProjections.totalMonthlyPassiveCashflowEnd;
                    const monthlyExp = profile.monthlyExpenses || 2000;
                    const expenseCoveragePct = Math.min(100, (monthlyPassive / monthlyExp) * 100);

                    return (
                      <div className="space-y-1 pt-1 border-t border-border/50 font-mono text-[9.5px] shrink-0">
                        {/* 1. Barra Proporzionale: Capitale Versato vs Interesse Composto */}
                        <div className="rounded-lg border border-border/70 bg-[#07080b]/70 p-1.5 space-y-1">
                          <div className="flex items-center justify-between text-[9px]">
                            <span className="text-slate-300 uppercase flex items-center gap-1 font-medium">
                              <Zap className="h-2.5 w-2.5 text-[#C5A059]" />
                              <span>Capitale Finale (+{selectedHorizon}A)</span>
                            </span>
                            <span className="text-[#E8C56A] font-bold">
                              Compounding: +{compoundPct.toFixed(1)}%
                            </span>
                          </div>

                          {/* Barra bicolore */}
                          <div className="h-1.5 w-full rounded-full bg-slate-900 overflow-hidden flex border border-border/50">
                            <div
                              style={{ width: `${investedPct}%` }}
                              title={`Versato dall'Operatore: ${investedEnd.toLocaleString("it-IT")} € (${investedPct.toFixed(1)}%)`}
                              className="h-full bg-slate-500 transition-all duration-300"
                            />
                            <div
                              style={{ width: `${compoundPct}%` }}
                              title={`Interesse Composto Generato: +${gainEuro.toLocaleString("it-IT")} € (${compoundPct.toFixed(1)}%)`}
                              className="h-full bg-gradient-to-r from-[#C5A059] to-[#E8C56A] shadow-[0_0_8px_rgba(232,197,106,0.6)] transition-all duration-300"
                            />
                          </div>

                          <div className="flex items-center justify-between text-[9px]">
                            <span className="text-slate-400">
                              Versato: <strong className="text-slate-200 whitespace-nowrap">{investedEnd.toLocaleString("it-IT")} €</strong>
                            </span>
                            <span className="text-[#E8C56A]">
                              Interesse Composto: <strong className="text-emerald-400">+{gainEuro.toLocaleString("it-IT")} €</strong>
                            </span>
                          </div>
                        </div>

                        {/* 2. Monitor Traguardo FIRE & Crossover Spese */}
                        <div className="rounded-lg border border-[#C5A059]/25 bg-[#C5A059]/5 p-1.5 space-y-1">
                          <div className="flex items-center justify-between text-[9px]">
                            <span className="text-foreground font-bold uppercase flex items-center gap-1">
                              <Target className="h-2.5 w-2.5 text-[#C5A059]" />
                              <span>Traguardo Indipendenza</span>
                            </span>
                            <span className="text-[#E8C56A] font-bold">
                              {fireProgressPct.toFixed(1)}% Completato
                            </span>
                          </div>

                          {/* Barra di avanzamento FIRE */}
                          <div className="h-1.5 w-full rounded-full bg-[#07080b] overflow-hidden border border-[#C5A059]/30">
                            <div
                              style={{ width: `${fireProgressPct}%` }}
                              className="h-full bg-gradient-to-r from-[#C5A059] to-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.5)] transition-all duration-300"
                            />
                          </div>

                          <div className="flex items-center justify-between text-[9px]">
                            <span className="text-slate-300">
                              {totalNWEnd >= targetVal ? (
                                <strong className="text-emerald-400 uppercase font-bold">
                                  🎯 Traguardo Raggiunto!
                                </strong>
                              ) : (
                                <>
                                  Gap: <strong className="text-foreground">-{fireGap.toLocaleString("it-IT")} €</strong>
                                </>
                              )}
                            </span>
                            <span className="text-slate-300">
                              Copertura:{" "}
                              <strong className={expenseCoveragePct >= 100 ? "text-emerald-400" : "text-[#E8C56A]"}>
                                {expenseCoveragePct.toFixed(1)}%
                              </strong>
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* VISTA 2: Motore Stocastico Monte Carlo (1.000 Traiettorie) con calcolo LIVE reattivo */}
              {activeVisualView === "monte_carlo" && (
                <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-[#C5A059]/30 pr-0.5">
                  <MonteCarloSimulationCard
                    tradingAllocation={deferredTradingAllocation}
                    reserveAllocation={deferredReserveAllocation}
                    expectedMonthlyReturnPct={deferredExpectedMonthlyReturnPct}
                    simulatedDrawdownPct={deferredSimulatedDrawdownPct}
                    accountObjective={profile.accountObjective}
                    initialWinRatePct={54}
                    initialRiskRewardRatio={1.85}
                    className="border border-[#C5A059]/20 bg-[#07080b]/90 shadow-none p-3 sm:p-3.5"
                  />
                </div>
              )}

              {/* VISTA 3: Donut Chart & Barre dei 5 Pilastri */}
              {activeVisualView === "pillars" && (
                <div className="space-y-1 py-1 flex-1 flex flex-col justify-center">
                  <div className="flex justify-center">
                    <PillarsDonutChart
                      pillars={{
                        liquidityAllocation: profile.liquidityAllocation,
                        reserveAllocation: profile.reserveAllocation,
                        tradingAllocation: profile.tradingAllocation,
                        investmentsAllocation: profile.investmentsAllocation,
                        futureProjectsAllocation: profile.futureProjectsAllocation,
                      }}
                      percentages={percentages}
                      totalNetWorth={profile.totalNetWorth}
                    />
                  </div>
                  <PillarsAllocationBar
                    pillars={{
                      liquidityAllocation: profile.liquidityAllocation,
                      reserveAllocation: profile.reserveAllocation,
                      tradingAllocation: profile.tradingAllocation,
                      investmentsAllocation: profile.investmentsAllocation,
                      futureProjectsAllocation: profile.futureProjectsAllocation,
                    }}
                    percentages={percentages}
                    totalNetWorth={profile.totalNetWorth}
                  />
                </div>
              )}
            </div>
          </div>

          {/* BLOCCO INFERIORE: Diagnosi Advisor + Resilienza Drawdown + Salva e Attiva Protocollo */}
          <div className="rounded-xl border border-border/70 bg-[#0d0f14]/90 p-3 sm:p-3.5 shadow-sm space-y-2.5 shrink-0">
            {/* CARD CENTRALE ADVISOR: DIAGNOSI DELL'ARCHITETTO FINANZIARIO */}
            <AdvisorVerdictCard
              evaluation={wealthProjections.advisorEvaluation}
              onOpenDossier={setActiveDossierToolId}
            />

            {/* Box: Simulazione Drawdown & Resilienza Psicologica Integrata con Telemetrie Live */}
            <div className="rounded-lg border border-border/70 bg-[#07080b]/70 p-2.5 space-y-1.5 font-mono text-[10.5px]">
              <div className="flex items-center justify-between text-muted-foreground uppercase pb-1 border-b border-border/50 gap-2 min-w-0">
                <span className="font-bold text-foreground truncate min-w-0">Simulazione Drawdown & Pressione</span>
                <span className="text-[9.5px] text-slate-400 whitespace-nowrap shrink-0" title="Profilo Mario vs Profilo Luigi">
                  Profilo Disciplinato vs Esposto
                </span>
              </div>

              {/* Griglia Metriche di Stress Test & Monte Carlo Aggiornate Automagicamente */}
              <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px] pt-0.5">
                <div className="flex items-center justify-between min-w-0">
                  <span className="text-slate-400 whitespace-nowrap">Perdita -{profile.simulatedDrawdownPct}%:</span>
                  <span className="font-bold text-red-400 whitespace-nowrap ml-1 shrink-0">
                    -{psychologicalPressure.simulatedDrawdownEuro.toLocaleString("it-IT")} €
                  </span>
                </div>
                <div className="flex items-center justify-between min-w-0">
                  <span className="text-slate-400 whitespace-nowrap">Impatto Net Worth:</span>
                  <span className="font-bold text-emerald-400 whitespace-nowrap ml-1 shrink-0">
                    -{psychologicalPressure.netWorthDrawdownImpactPct.toFixed(2)}%
                  </span>
                </div>
                <div className="flex items-center justify-between min-w-0">
                  <span className="text-slate-400 whitespace-nowrap">VaR 95% Mensile:</span>
                  <span className="font-bold text-amber-400 whitespace-nowrap ml-1 shrink-0">
                    -{tradingMonteCarlo.monthlyVaR95Pct}%
                  </span>
                </div>
                <div className="flex items-center justify-between min-w-0">
                  <span className="text-slate-400 whitespace-nowrap">Max DD P95 (1.000T):</span>
                  <span className="font-bold text-red-400 whitespace-nowrap ml-1 shrink-0">
                    -{tradingMonteCarlo.maxDrawdownP95Pct}%
                  </span>
                </div>
                <div className="flex items-center justify-between min-w-0">
                  <span className="text-slate-400 whitespace-nowrap">Scudo Riserva 1:1:</span>
                  <span className={`font-bold whitespace-nowrap ml-1 shrink-0 ${reserveConstraint.isValid ? "text-emerald-400" : "text-red-400"}`}>
                    {reserveConstraint.isValid ? "Copertura 100%" : "Non Rispettato"}
                  </span>
                </div>
                <div className="flex items-center justify-between min-w-0">
                  <span className="text-slate-400 whitespace-nowrap">Capitale Integro:</span>
                  <span className="font-bold text-[#E8C56A] whitespace-nowrap ml-1 shrink-0">
                    {tradingMonteCarlo.probCapitalPreservedPct}% prob.
                  </span>
                </div>
              </div>

              {/* Indice Tenuta Mentale */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between text-[#E8C56A] gap-0.5 pt-1 border-t border-border/40">
                <span className="text-slate-400 text-[10px] uppercase">Indice Tenuta Mentale:</span>
                <span className="font-bold uppercase text-right text-[#E8C56A] text-[10.5px]">
                  {psychologicalPressure.headline}
                </span>
              </div>
            </div>

            {/* PULSANTE FINALE: SALVA E ATTIVA PROTOCOLLO PATRIMONIALE */}
            <Button
              onClick={handleSaveAndActivate}
              disabled={updateMutation.isPending}
              aria-label="Salva e Attiva Protocollo Patrimoniale"
              title="Salva e Attiva Protocollo Patrimoniale"
              className={`w-full h-9 font-mono text-xs font-bold uppercase tracking-wider transition-all ${
                validation.isValid
                  ? "bg-[#C5A059] text-[#07080b] hover:bg-[#E8C56A] shadow-[0_0_15px_rgba(197,160,89,0.35)]"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              <Save className="h-4 w-4 mr-1.5" />
              <span>Salva e Attiva Protocollo Patrimoniale</span>
            </Button>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
