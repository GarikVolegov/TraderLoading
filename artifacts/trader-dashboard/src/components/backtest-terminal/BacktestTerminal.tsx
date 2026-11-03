import { useAuth, useUser } from "@clerk/react";
import { useMediaQuery } from "@/hooks/use-media-query";
import { LimenResponsiveDrawer } from "@/components/ui/LimenResponsiveDrawer";
import { FavoriteToolsBar } from "./FavoriteToolsBar";
// ─── Backtest replay terminal shell ──────────────────────────────────────────
// Full-screen grid per the Claude Design mockup: 46px header / main (46px tool
// rail · chart column · 340px right panel) / 54px transport bar. Orchestrates
// the engine hook and the chart; the order ticket, account and journal panels
// land in the trading phase, drawings in the final phase.
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import {
  X,
  BookOpen,
  Eye,
  Layers,
  Wallet,
  Play,
  Pause,
  ChevronRight,
  Minimize2,
  ListFilter,
  Newspaper,
  SlidersHorizontal,
  Globe,
  Bot,
} from "lucide-react";
import { uiText, useLanguage } from "@/contexts/LanguageContext";
import { useAutoLandscapeCinema } from "@/hooks/useAutoLandscapeCinema";
import { formatBlindReplayDisplay } from "./dateTime";
import type { ClosedTrade } from "@/lib/replay/types";
import { BacktestVictoryModal } from "../backtest-tournament/BacktestVictoryModal";
import { ArenaSpectatorShareModal } from "../backtest-tournament/ArenaSpectatorShareModal";
import { useBattleRoom } from "../backtest-tournament/useBattleRoom";
import { useSmartWatchHeartRate } from "@/hooks/useSmartWatchHeartRate";
import { LiveBattleTelemetryHUD } from "../backtest-tournament/LiveBattleTelemetryHUD";
import { completeBacktestTournament, type TournamentRunSummary } from "@/lib/backtestTournamentsApi";
import { AccountPanel } from "./AccountPanel";
import { formatPrice, terminalLocale } from "./format";
import { HotkeysHelp } from "./HotkeysHelp";
import { IndicatorStrip } from "./IndicatorStrip";
import { JournalPanel } from "./JournalPanel";
import { OrderTicket, type OrderTicketDraft } from "./OrderTicket";
import { ReplayChart, type ReplayChartApi } from "./ReplayChart";
import { TerminalHeader } from "./TerminalHeader";
import { TerminalSettingsDialog } from "./TerminalSettingsDialog";
import { ToolKnowledgeDrawer } from "./ToolKnowledgeDrawer";
import { type DrawingToolId } from "./toolRailModel";
import { ToolRail } from "./ToolRail";
import { TransportBar } from "./TransportBar";
import { OfflineStorageModal } from "./OfflineStorageModal";
import { QuickOrderDrawer } from "./QuickOrderDrawer";
import { ReplayBiometricVignetteOverlay } from "./ReplayBiometricVignetteOverlay";
import { computeReplayTelemetry } from "./ReplayBioTelemetryHUD";
import { useReplayEngine } from "./useReplayEngine";
import { useReplayAlerts } from "./useReplayAlerts";
import { useReplayHotkeys } from "./useReplayHotkeys";
import { BacktestAiSentinelPanel } from "./BacktestAiSentinelPanel";
import { EaForgeStudioPanel } from "./EaForgeStudioPanel";
import { useVarcoVisionSentinel } from "@/hooks/useVarcoVisionSentinel";
import { useToast } from "@/hooks/use-toast";
import { TalkToJournalModal } from "./TalkToJournalModal";
import { ReplayWatchlistPanel } from "./ReplayWatchlistPanel";
import { ReplayNewsPanel } from "./ReplayNewsPanel";
import { ChartObjectTreeModal } from "../chart/ChartObjectTreeModal";
import { loadSessionNotes } from "@/lib/replay/sessionNotes";
import type { VarcoSetupPlan } from "@workspace/api-client-react";
import {
  loadOperativeMemory,
  saveOperativeMemory,
  resetOperativeMemory,
  recordOperativeTradeOutcome,
  recordStep4CareEvent,
  type LimenOperativeMemoryState,
} from "@/lib/replay/limenOperativeMemory";
import {
  getStoredForgeSentinelAutoScan,
  setStoredForgeSentinelAutoScan,
  getStoredForgeSentinelAutoExecute,
  setStoredForgeSentinelAutoExecute,
  getStoredForgeSentinelOverlay,
  setStoredForgeSentinelOverlay,
} from "@/lib/sentinelPersistence";
import { positionPips } from "@/lib/replay/tradeEngine";
import { synestheticClick, synestheticSealOfAction, synestheticTrophy, synestheticAlert } from "@/lib/soundFx";
import "./terminal.css";

export interface BacktestTerminalProps {
  sessionKey: string;
  sessionName: string;
  symbol: string;
  initialInterval: string;
  onExit: () => void;
  /** Called whenever a trade closes (the page persists them to the API). */
  onTradeClosed?: (trade: ClosedTrade) => void;
  persistenceStatus?: ReactNode;
  tournamentId?: number;
  onSelectSymbol?: (symbol: string) => void;
}

export function BacktestTerminal(props: BacktestTerminalProps) {
  const { userId } = useAuth();
  return <BacktestTerminalSession key={`${userId ?? "guest"}:${props.sessionKey}`} {...props} />;
}

function BacktestTerminalSession({
  sessionKey,
  sessionName,
  symbol,
  initialInterval,
  onExit,
  onTradeClosed,
  persistenceStatus,
  tournamentId,
  onSelectSymbol,
}: BacktestTerminalProps) {
  const [, navigate] = useLocation();
  const isBattle = Boolean(tournamentId || sessionName.startsWith("[Battle]"));
  const effectiveTournamentId = tournamentId ?? 1;
  const [victoryModalOpen, setVictoryModalOpen] = useState(false);
  const [victorySummary, setVictorySummary] = useState<TournamentRunSummary | null>(null);
  const [telemetryOpen, setTelemetryOpen] = useState(false);
  const [spectatorShareOpen, setSpectatorShareOpen] = useState(false);
  const [offlineStorageOpen, setOfflineStorageOpen] = useState(false);

  const { user } = useUser();
  const operatorName = user?.fullName || user?.firstName || user?.username || "Operatore";
  const operatorId = user?.id || "operator_me";
  const [autoDisciplineEnabled, setAutoDisciplineEnabled] = useState(false);
  const watch = useSmartWatchHeartRate();

  const roomId = `room_tournament_${effectiveTournamentId}`;
  const battleRoom = useBattleRoom({
    roomId,
    tournamentId: effectiveTournamentId,
    user: {
      userId: operatorId,
      displayName: operatorName,
      avatarUrl: user?.imageUrl,
      country: "IT",
      gradeTitle: "Custode della Regola",
    },
    enabled: isBattle,
  });

  const handleFinishBattle = async () => {
    const initialBal = 10000;
    const netPnl = engine.stats.totalProfit + engine.openProfit;
    const finalBal = initialBal + netPnl;
    const profitPct = initialBal > 0 ? (netPnl / initialBal) * 100 : 0;
    const winTrades = engine.stats.wins;
    const loseTrades = engine.stats.losses;
    const totalTrades = engine.trades.length;
    const winRate = engine.stats.winRate;
    const maxDrawdown = engine.account.maxDrawdownPct;
    const avgTradeProfit = totalTrades > 0 ? netPnl / totalTrades : 0;

    const summary: TournamentRunSummary = {
      initialBalance: initialBal,
      finalBalance: finalBal,
      totalProfit: netPnl,
      profitPct,
      winRate,
      winTrades,
      loseTrades,
      totalTrades,
      maxDrawdown,
      avgTradeProfit,
      maxAllowedDrawdown: 10,
      asset: engine.symbol,
    };

    try {
      await completeBacktestTournament(effectiveTournamentId, summary);
    } catch {
      // Local fallback
    }

    setVictorySummary(summary);
    setVictoryModalOpen(true);
  };

  const { language } = useLanguage();
  const compact = useMediaQuery("(max-width: 1023px)");
  const [quickOrderDrawerOpen, setQuickOrderDrawerOpen] = useState(false);
  const {
    isLandscape,
    manualCinema,
    isCinemaActive,
    toggleManualCinema,
    exitCinema,
  } = useAutoLandscapeCinema({
    onCinemaChange: (isActive) => {
      if (!isActive) {
        setQuickOrderDrawerOpen(false);
      }
    },
  });
  const [toolsOpen, setToolsOpen] = useState(false);
  const [ticketDraft, setTicketDraft] = useState<OrderTicketDraft>({ pendingMode: false, orderPrice: "", profileName: "" });
  const [currentSymbol, setCurrentSymbol] = useState(symbol);
  const [talkToJournalOpen, setTalkToJournalOpen] = useState(false);
  const [showOrderFlow, setShowOrderFlow] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("aureus_replay_show_orderflow") === "true";
  });
  const [showNewsOverlay, setShowNewsOverlay] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.localStorage.getItem("aureus_replay_show_news") !== "false";
  });
  const [notesCount, setNotesCount] = useState(() => loadSessionNotes(sessionKey).length);
  const [objectTreeModalOpen, setObjectTreeModalOpen] = useState(false);

  useEffect(() => {
    const refresh = () => setNotesCount(loadSessionNotes(sessionKey).length);
    refresh();
    window.addEventListener("aureus-session-notes-updated", refresh);
    return () => window.removeEventListener("aureus-session-notes-updated", refresh);
  }, [sessionKey]);

  const toggleOrderFlow = () => {
    synestheticClick();
    setShowOrderFlow((prev) => {
      const next = !prev;
      try { window.localStorage.setItem("aureus_replay_show_orderflow", String(next)); } catch {}
      return next;
    });
  };

  const toggleNewsOverlay = () => {
    synestheticClick();
    setShowNewsOverlay((prev) => {
      const next = !prev;
      try { window.localStorage.setItem("aureus_replay_show_news", String(next)); } catch {}
      return next;
    });
  };

  const handleSelectSymbol = (newSym: string) => {
    synestheticClick();
    setCurrentSymbol(newSym);
    onSelectSymbol?.(newSym);
  };

  const engine = useReplayEngine({ sessionKey, symbol: currentSymbol, initialInterval });
  const alertsApi = useReplayAlerts({ engine, sessionKey });
  const chartApiRef = useRef<ReplayChartApi | null>(null);
  const [panelOpen, setPanelOpen] = useState(() => typeof window === "undefined" || window.innerWidth >= 1100);
  const [helpOpen, setHelpOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [limitedDismissed, setLimitedDismissed] = useState(false);
  const [settingsIndicatorId, setSettingsIndicatorId] = useState<string | undefined>();
  const [settingsTab, setSettingsTab] = useState<"chart" | "indicators" | "tools" | "templates">("chart");
  const [activeTool, setActiveTool] = useState<DrawingToolId>("cursor");
  const [knowledgeToolId, setKnowledgeToolId] = useState<DrawingToolId | null>(null);

  // ── Tab Navigation per il Pannello Destro AUREUS ──
  type TerminalRightPanelTab = "sentinel" | "automa" | "ticket" | "account" | "journal" | "watchlist" | "news";
  const [activePanelTab, setActivePanelTab] = useState<TerminalRightPanelTab>(() => {
    try {
      const saved = localStorage.getItem("aureus_forge_panel_tab");
      if (
        saved === "sentinel" ||
        saved === "automa" ||
        saved === "ticket" ||
        saved === "account" ||
        saved === "journal" ||
        saved === "watchlist" ||
        saved === "news"
      ) {
        return saved;
      }
    } catch {}
    return "sentinel";
  });

  const handleSelectPanelTab = useCallback((tab: TerminalRightPanelTab) => {
    setActivePanelTab(tab);
    try {
      localStorage.setItem("aureus_forge_panel_tab", tab);
    } catch {}
  }, []);

  // ── Sentinella Visiva IA per la Forgia (Limen Vision Sentinel) ──
  const { toast } = useToast();
  const {
    isScanning: isAiScanning,
    analysis: aiAnalysis,
    setup: aiSetup,
    scan: scanVarcoAi,
    updateSetup: updateAiSetup,
  } = useVarcoVisionSentinel();

  const [continuousAutoScan, setContinuousAutoScanState] = useState<boolean>(() =>
    getStoredForgeSentinelAutoScan(false),
  );
  const [autoExecuteAi, setAutoExecuteAiState] = useState<boolean>(() =>
    getStoredForgeSentinelAutoExecute(false),
  );
  const [showAiOverlay, setShowAiOverlayState] = useState<boolean>(() =>
    getStoredForgeSentinelOverlay(true),
  );

  const setContinuousAutoScan = useCallback((updater: boolean | ((prev: boolean) => boolean)) => {
    setContinuousAutoScanState((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      setStoredForgeSentinelAutoScan(next);
      return next;
    });
  }, []);

  const setAutoExecuteAi = useCallback((updater: boolean | ((prev: boolean) => boolean)) => {
    setAutoExecuteAiState((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      setStoredForgeSentinelAutoExecute(next);
      return next;
    });
  }, []);

  const setShowAiOverlay = useCallback((updater: boolean | ((prev: boolean) => boolean)) => {
    setShowAiOverlayState((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      setStoredForgeSentinelOverlay(next);
      return next;
    });
  }, []);
  const [missedMoveNotice, setMissedMoveNotice] = useState<string | null>(null);
  const [operativeMemory, setOperativeMemory] = useState<LimenOperativeMemoryState>(() =>
    loadOperativeMemory(engine.symbol),
  );

  useEffect(() => {
    setOperativeMemory(loadOperativeMemory(engine.symbol));
  }, [engine.symbol]);

  // ── Audio-Telemetria Sinestetica su Eventi di Esecuzione (Fill / TP / SL) ──
  const lastNoticeIdRef = useRef<number | null>(null);
  useEffect(() => {
    if (!engine.notice || engine.notice.id === lastNoticeIdRef.current) return;
    lastNoticeIdRef.current = engine.notice.id;
    if (engine.notice.kind === "fill") {
      synestheticSealOfAction();
    } else if (engine.notice.kind === "tp") {
      synestheticTrophy();
    } else if (engine.notice.kind === "sl") {
      synestheticAlert();
    }
  }, [engine.notice]);

  const activeSetupRef = useRef<VarcoSetupPlan | null>(null);
  activeSetupRef.current = aiSetup;
  const autoExecuteAiRef = useRef(autoExecuteAi);
  autoExecuteAiRef.current = autoExecuteAi;
  const operativeMemoryRef = useRef<LimenOperativeMemoryState>(operativeMemory);
  operativeMemoryRef.current = operativeMemory;

  const lastExecutedSetupKeyRef = useRef<string | null>(null);
  const lastExecutedSetupMetaRef = useRef<VarcoSetupPlan | null>(null);
  const setupStabilityRef = useRef<{ signature: string; count: number }>({ signature: "", count: 0 });
  const pendingBarsWaitingRef = useRef<number>(0);
  const openPosBarsHeldRef = useRef<number>(0);
  const lastExitOverrideReasonRef = useRef<"invalidation" | "congestion" | null>(null);

  const handleResetOperativeMemory = useCallback(() => {
    const fresh = resetOperativeMemory(engine.symbol);
    setOperativeMemory(fresh);
    toast({
      title: "Memoria Operativa Resettata",
      description: `I filtri del Piano Operativo e la Regola del Flip per ${engine.symbol} sono tornati ai valori di partenza.`,
    });
  }, [engine.symbol, toast]);

  const handleExecuteReplaySetup = useCallback(
    (setup: VarcoSetupPlan) => {
      const currentBar = engine.currentBar;
      if (!currentBar) return;

      const direction = setup.direction === "long" ? "buy" : "sell";
      const isLimit = setup.orderType === "limit";

      lastExecutedSetupMetaRef.current = setup;
      pendingBarsWaitingRef.current = 0;
      openPosBarsHeldRef.current = 0;
      lastExitOverrideReasonRef.current = null;

      // Impostiamo il TP finale sul Pool di Liquidità Opposto (takeProfit2Price);
      // a 1:3.0 R:R (takeProfit1Price) il motore di Cura Attiva Step 04 incasserà il 50% parziale (mgmt_tp1)
      const outerTpPrice = setup.takeProfit2Price || setup.takeProfit1Price;

      engine.executeDrawingOrder({
        direction,
        orderType: setup.orderType,
        entry: { price: setup.entryPrice, time: currentBar.time },
        slPrice: setup.stopLossPrice,
        tpPrice: outerTpPrice,
      });

      toast({
        title: isLimit
          ? `Ordine ${direction.toUpperCase()} LIMIT [${setup.triggerType || "LIMIT"}] nei Pendenti`
          : `Ordine a Mercato ${direction.toUpperCase()} [${setup.triggerType || "MKT"}] Eseguito`,
        description: isLimit
          ? `Attesa re-test a ${setup.entryPrice}. SL: ${setup.stopLossPrice} · BE: ${setup.breakEvenPrice} (1:1.5R) · TP1 50%: ${setup.takeProfit1Price} (1:3R)`
          : `Entry: ${setup.entryPrice} · SL: ${setup.stopLossPrice} · BE: ${setup.breakEvenPrice} · TP1 50%: ${setup.takeProfit1Price}`,
      });
    },
    [engine, toast],
  );

  const isScanningInFlightRef = useRef<boolean>(false);

  const handleScanReplayAi = useCallback(
    async (silent = false) => {
      if (isScanningInFlightRef.current) return;
      isScanningInFlightRef.current = true;
      try {
        const revealed = engine.revealed;
        if (!revealed || revealed.length === 0) return;

        // Se siamo in scansione automatica silente e c'è già una posizione aperta o un ordine Limit pendente,
        // l'IA resta focalizzata al 100% sulla Fase 04 (Cura Attiva del Trade) senza sovrascrivere il setup in corso.
        const hasOpenOrder = engine.pendingOrders.length > 0 || engine.positions.length > 0;
        if (silent && hasOpenOrder) {
          return;
        }

        // Ottimizzazione performance: NON catturare canvas a 60fps/ogni barra in replay continuo
        // per evitare freeze del thread JS principale. Screenshot solo su scansione manuale esplicita.
        let chartImage: string | undefined = undefined;
        if (!silent) {
          const screenshotUrl = chartApiRef.current?.takeScreenshot();
          if (screenshotUrl) {
            chartImage = screenshotUrl;
          }
        }

        // Passiamo fino a 240 candele per costruire l'intera Gerarchia Frattale (HTF -> ITF -> LTF)
        const recentCandles = revealed.slice(-240).map((c) => ({
          time: c.time,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
          volume: c.volume,
        }));

        const mem = operativeMemoryRef.current;
        const res = await scanVarcoAi({
          symbol: engine.symbol,
          interval: engine.interval,
          candles: recentCandles,
          chartImage,
          chartCanvas: null,
          currentPhase: 3,
          accountCapital: engine.account.balance,
          riskPercent: 1.0,
          silent,
          activeSetup: activeSetupRef.current,
          enforceSessionWindows: true,
          operativeMemory: {
            flipActive: mem.flipActive,
            flipDirection: mem.flipDirection,
            minImbalancePercent: mem.minImbalancePercent,
            preferPocOnReversal: mem.preferPocOnReversal,
            reaccumRiskMultiplier: mem.reaccumRiskMultiplier,
            quarantinedCombos: mem.quarantinedCombos,
          },
        });

        // Esecuzione Automatica del Setup: se la Sentinella ha validato tutte le 4 Domande
        // ed emesso verdetto SETUP_READY, esegue immediatamente l'ordine (Limit su ritracciamento o Market se già in zona)
        // senza richiedere conferme duplicate che rischiano di far perdere il trade durante il replay.
        if (res && res.verdict === "SETUP_READY" && res.setup) {
          if (autoExecuteAiRef.current && !hasOpenOrder) {
            const setupKey = `${res.setup.direction}-${res.setup.entryPrice}-${res.setup.stopLossPrice}-${res.setup.takeProfit1Price}`;
            if (lastExecutedSetupKeyRef.current !== setupKey) {
              lastExecutedSetupKeyRef.current = setupKey;
              handleExecuteReplaySetup(res.setup);
            }
          }
        }
      } finally {
        isScanningInFlightRef.current = false;
      }
    },
    [
      engine.revealed,
      engine.symbol,
      engine.interval,
      engine.account.balance,
      engine.pendingOrders.length,
      engine.positions.length,
      scanVarcoAi,
      handleExecuteReplaySetup,
    ],
  );

  // ── STEP 04: CURA ATTIVA DEL TRADE & GESTIONE PENDENTI (Piano Operativo LIMEN) ──
  // 1. Congestione a ridosso della zona su pendenti -> Cancella pendente
  // 2. mgmt_be: Stop a Pareggio solo ad almeno 1:1.5 R:R su presa di liquidità
  // 3. mgmt_tp1: Primo parziale 50% tassativamente a 1:3.0 R:R, resto al Pool di Liquidità Opposto
  // 4. mgmt_invalidation & Congestione Post-M1 -> Uscita anticipata e attivazione Regola del Flip
  const lastManagedBarTimeRef = useRef<number | null>(null);
  useEffect(() => {
    const bar = engine.currentBar;
    if (!autoDisciplineEnabled || !bar || lastManagedBarTimeRef.current === bar.time) return;
    lastManagedBarTimeRef.current = bar.time;

    const maxCongestion = operativeMemoryRef.current.maxCongestionBars ?? 10;

    // A. Gestione Ordini Limit Pendenti in Congestione prolungata
    if (engine.pendingOrders.length > 0) {
      pendingBarsWaitingRef.current += 1;
      if (pendingBarsWaitingRef.current > maxCongestion + 4) {
        engine.cancelAllOrders();
        pendingBarsWaitingRef.current = 0;
        const updatedMem = recordStep4CareEvent(operativeMemoryRef.current, "pending_congestion_cancelled");
        operativeMemoryRef.current = updatedMem;
        setOperativeMemory(updatedMem);
        saveOperativeMemory(engine.symbol, updatedMem);
        setMissedMoveNotice(
          `Congestione a ridosso della zona (> ${maxCongestion + 4} barre senza attivazione): ordine Limit pendente rimosso come da Piano Operativo (Step 04).`,
        );
      }
    } else {
      pendingBarsWaitingRef.current = 0;
    }

    // B. Cura Attiva della Posizione Aperta (mgmt_be, mgmt_tp1, mgmt_invalidation, Congestione)
    if (engine.positions.length > 0) {
      openPosBarsHeldRef.current += 1;
      const pos = engine.positions[0];
      const currentPips = positionPips(pos, bar.close, engine.symbol);
      const bestPips = Math.max(pos.bestPips ?? 0, currentPips);
      const initialSl = pos.initialSlPips ?? pos.slPips;
      const currentR = initialSl > 0 ? currentPips / initialSl : 0;
      const bestR = initialSl > 0 ? bestPips / initialSl : 0;
      const setupMeta = lastExecutedSetupMetaRef.current ?? activeSetupRef.current;

      // 1. Regola mgmt_tp1: Primo parziale 50% tassativamente a 1:3.0 R:R (e BE automatico sul resto)
      if (bestR >= 3.0 && (pos.partialCount ?? 0) === 0 && pos.lots >= 0.02) {
        engine.partialClose(pos.id ?? "", 0.5, true);
        const updatedMem = recordStep4CareEvent(operativeMemoryRef.current, "tp1_partial");
        operativeMemoryRef.current = updatedMem;
        setOperativeMemory(updatedMem);
        saveOperativeMemory(engine.symbol, updatedMem);
        toast({
          title: "Step 04 (mgmt_tp1): Parziale 50% Incassato a 1:3.0 R:R",
          description: "Metà posizione monetizzata a 1:3 R:R. Il restante 50% corre a Pareggio verso il Pool di Liquidità Opposto.",
        });
        return;
      }

      // 2. Regola mgmt_be: Spostamento a Pareggio solo ad almeno 1:1.5 R:R su presa di liquidità
      if (bestR >= 1.5 && !pos.breakevenApplied) {
        engine.moveToBreakeven(pos.id ?? "");
        const updatedMem = recordStep4CareEvent(operativeMemoryRef.current, "be_moved");
        operativeMemoryRef.current = updatedMem;
        setOperativeMemory(updatedMem);
        saveOperativeMemory(engine.symbol, updatedMem);
        toast({
          title: "Step 04 (mgmt_be): Stop a Pareggio (1:1.5 R:R)",
          description: "Presa di liquidità intermedia a 1:1.5 R:R confermata: Stop Loss spostato a Pareggio.",
        });
        return;
      }

      // 3. Regola mgmt_invalidation: Chiusura candela oltre lo swing di invalidazione prima dello SL pieno
      if (setupMeta?.invalidationSwingPrice != null && currentR < -0.25) {
        const invSwing = setupMeta.invalidationSwingPrice;
        const swingViolated =
          (pos.direction === "buy" && bar.close < invSwing) ||
          (pos.direction === "sell" && bar.close > invSwing);
        if (swingViolated) {
          lastExitOverrideReasonRef.current = "invalidation";
          engine.closePositionById(pos.id ?? "", bar.close);
          toast({
            title: "Step 04 (mgmt_invalidation): Uscita Anticipata & Regola del Flip",
            description: `Chiusura candela oltre lo swing della schematica (${invSwing}). Rischio risparmiato e attivazione Regola del Flip.`,
          });
          return;
        }
      }

      // 4. Reattività Immediata Post-M1: Congestione prolungata a ridosso dell'ingresso
      if (
        openPosBarsHeldRef.current >= maxCongestion + 2 &&
        bestR < 0.85 &&
        currentR >= -0.45 &&
        currentR <= 0.35
      ) {
        lastExitOverrideReasonRef.current = "congestion";
        engine.closePositionById(pos.id ?? "", bar.close);
        toast({
          title: "Step 04: Uscita per Congestione Post-Ingresso",
          description: "Mancata reattività immediata: il tempo di congestione prolungata ha indebolito la zona.",
        });
      }
    } else {
      openPosBarsHeldRef.current = 0;
    }
  }, [engine.currentBar, engine.pendingOrders.length, engine.positions, engine.symbol, engine.cancelAllOrders, engine.partialClose, engine.moveToBreakeven, engine.closePositionById, toast]);

  // Monitoraggio continuo affidabile durante il replay: scansione con cadenza adattiva anti-freeze
  const lastScannedBarTimeRef = useRef<number | null>(null);
  const scanScheduledRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const barsSinceLastScanRef = useRef<number>(0);
  const lastScanTimestampRef = useRef<number>(0);

  useEffect(() => {
    if (!continuousAutoScan || !engine.currentBar) {
      if (scanScheduledRef.current) {
        clearTimeout(scanScheduledRef.current);
        scanScheduledRef.current = null;
      }
      return;
    }

    const barTime = engine.currentBar.time;
    if (lastScannedBarTimeRef.current === barTime) return;
    lastScannedBarTimeRef.current = barTime;
    barsSinceLastScanRef.current += 1;

    // Se è già attiva un'operazione di inferenza, non accodiamo richieste concorrenti
    if (isScanningInFlightRef.current || isAiScanning) return;

    const isPlaying = engine.playing;
    const speed = engine.speed;
    const now = Date.now();
    const timeSinceLastScan = now - lastScanTimestampRef.current;

    let minBarInterval = 1;
    let minTimeIntervalMs = 250;

    if (isPlaying) {
      if (speed >= 5) {
        minBarInterval = 8;
        minTimeIntervalMs = 3500;
      } else if (speed >= 2) {
        minBarInterval = 4;
        minTimeIntervalMs = 2000;
      } else {
        minBarInterval = 2;
        minTimeIntervalMs = 1200;
      }
    }

    if (barsSinceLastScanRef.current < minBarInterval || timeSinceLastScan < minTimeIntervalMs) {
      return;
    }

    if (!scanScheduledRef.current) {
      scanScheduledRef.current = setTimeout(() => {
        scanScheduledRef.current = null;
        if (!continuousAutoScan || isScanningInFlightRef.current) return;
        barsSinceLastScanRef.current = 0;
        lastScanTimestampRef.current = Date.now();
        void handleScanReplayAi(true);
      }, isPlaying ? 120 : 60);
    }

    return () => {
      if (scanScheduledRef.current) {
        clearTimeout(scanScheduledRef.current);
        scanScheduledRef.current = null;
      }
    };
  }, [continuousAutoScan, engine.currentBar, engine.playing, engine.speed, handleScanReplayAi, isAiScanning]);

  // Gestione reattiva degli ordini Limit cancellati (Target raggiunto prima del retest)
  useEffect(() => {
    if (!engine.notice) return;
    if (engine.notice.kind === "cancel_tp") {
      setMissedMoveNotice(
        `L'espansione ha raggiunto il Target a ${formatPrice(engine.notice.price, engine.symbol)} senza ritracciare. L'ordine pendente è stato rimosso per evitare trap. L'IA sta ri-analizzando la nuova struttura.`
      );
      void handleScanReplayAi(true);
    } else if (engine.notice.kind === "cancel_sl") {
      setMissedMoveNotice(
        `Struttura invalidata oltre ${formatPrice(engine.notice.price, engine.symbol)}. Ordine Limit rimosso per disciplina. L'IA sta ri-analizzando.`
      );
      void handleScanReplayAi(true);
    }
  }, [engine.notice, engine.symbol, handleScanReplayAi]);

  // Notify the page of newly closed trades (it persists them, deduped) + Revisione Autonoma Antifragile
  const notifiedIdsRef = useRef<Set<number>>(new Set());
  const learnedIdsRef = useRef<Set<number>>(new Set(engine.trades.map((t) => t.id)));
  useEffect(() => {
    for (const trade of engine.trades) {
      if (!learnedIdsRef.current.has(trade.id)) {
        learnedIdsRef.current.add(trade.id);
        const meta = lastExecutedSetupMetaRef.current ?? activeSetupRef.current;
        const overrideExit = lastExitOverrideReasonRef.current;
        lastExitOverrideReasonRef.current = null;

        const updatedMemory = recordOperativeTradeOutcome(operativeMemoryRef.current, {
          direction: trade.direction === "buy" ? "long" : "short",
          result: trade.result,
          exitReason: overrideExit ?? trade.exitReason,
          mfeR: trade.mfeR ?? null,
          maeR: trade.maeR ?? null,
          cycle: meta?.cycle,
          context: meta?.liquidityContext,
          scenario: meta?.zoneScenario,
          trigger: meta?.triggerType,
          area: meta?.areaType,
          sessionName: meta?.sessionName,
          wasReversal: meta?.wasReversal,
          barsHeld: openPosBarsHeldRef.current,
        });
        operativeMemoryRef.current = updatedMemory;
        setOperativeMemory(updatedMemory);
        saveOperativeMemory(engine.symbol, updatedMemory);
      }

      if (onTradeClosed && !notifiedIdsRef.current.has(trade.id)) {
        notifiedIdsRef.current.add(trade.id);
        onTradeClosed(trade);
      }
    }
  }, [engine.trades, engine.symbol, onTradeClosed]);

  // Synchronize telemetry with the Battle Room
  useEffect(() => {
    if (!isBattle) return;
    const initialBal = 10000;
    const netPnl = engine.stats.totalProfit + engine.openProfit;
    const profitPct = initialBal > 0 ? (netPnl / initialBal) * 100 : 0;
    const bio = computeReplayTelemetry(
      engine.positions,
      engine.currentPrice,
      engine.symbol,
      engine.openProfit,
    );
    battleRoom.sendTelemetry({
      profitPct,
      drawdownPct: engine.account.maxDrawdownPct,
      tradesCount: engine.trades.length,
      biometricBpm: watch.isLive ? watch.bpm : undefined,
      biometricShareConsent: watch.isLive,
    });
  }, [
    engine.trades.length,
    engine.openProfit,
    engine.account.maxDrawdownPct,
    engine.positions,
    engine.currentPrice,
    engine.symbol,
    isBattle,
    watch.isLive,
    watch.bpm,
  ]);

  // Broadcast closed trades to opponents in the Battle Room
  const lastBroadcastTradeIdRef = useRef<number | null>(null);
  useEffect(() => {
    if (!isBattle) return;
    const latest = engine.trades[0];
    if (latest && latest.id !== lastBroadcastTradeIdRef.current) {
      lastBroadcastTradeIdRef.current = latest.id;
      battleRoom.sendTrade({
        userId: operatorId,
        displayName: operatorName,
        type: latest.direction === "buy" ? "BUY" : "SELL",
        price: latest.exitPrice ?? latest.entryPrice,
        pnl: latest.profit,
        isClose: true,
        timestamp: Date.now(),
      });
    }
  }, [engine.trades, isBattle, operatorId, operatorName]);

  useReplayHotkeys(engine, {
    enabled: !helpOpen && !settingsOpen && !(compact && panelOpen),
    zoomIn: () => chartApiRef.current?.zoomIn(),
    zoomOut: () => chartApiRef.current?.zoomOut(),
  });

  // ── Edge Swipe-in Gesture per Quick Order Drawer (Mobile & Cinema Mode) ──
  const edgeTouchStartXRef = useRef<number | null>(null);
  const edgeTouchStartYRef = useRef<number | null>(null);

  const handleTerminalTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    const clientX = touch.clientX;
    const windowWidth = typeof window !== "undefined" ? window.innerWidth : 400;

    // Detect touch originating from right edge (within 36px)
    if (clientX >= windowWidth - 36) {
      edgeTouchStartXRef.current = clientX;
      edgeTouchStartYRef.current = touch.clientY;
    }
  }, []);

  const handleTerminalTouchEnd = useCallback((e: React.TouchEvent) => {
    if (edgeTouchStartXRef.current === null || edgeTouchStartYRef.current === null) return;
    if (e.changedTouches.length !== 1) {
      edgeTouchStartXRef.current = null;
      edgeTouchStartYRef.current = null;
      return;
    }

    const startX = edgeTouchStartXRef.current;
    const startY = edgeTouchStartYRef.current;
    edgeTouchStartXRef.current = null;
    edgeTouchStartYRef.current = null;

    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const dx = endX - startX;
    const dy = endY - startY;

    // Swiped left from right edge -> open Quick Order Drawer
    if (dx < -36 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      synestheticClick();
      setQuickOrderDrawerOpen(true);
    }
  }, []);

  const limitedHistory = engine.meta != null && engine.meta.warehouse == null;

  return (
    <div
      className="btm-root"
      data-testid="backtest-terminal"
      data-cinema-mode={isCinemaActive ? "true" : undefined}
      onTouchStart={handleTerminalTouchStart}
      onTouchEnd={handleTerminalTouchEnd}
    >
      {/* ── CINEMA HUD: LEFT THUMB (Asset, Barra e Telemetria) ── */}
      {isCinemaActive && (
        <aside
          aria-label="Telemetria Replay Sinistra"
          style={{
            top: "max(10px, env(safe-area-inset-top))",
            left: "max(12px, env(safe-area-inset-left))",
          }}
          className="fixed z-50 flex items-center gap-1.5 rounded-xl border border-[#C5A059]/40 bg-[#07080b]/95 backdrop-blur-xl p-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.85)] font-mono select-none pointer-events-auto"
        >
          {/* Asset & TF Badge */}
          <span className="px-2 py-0.5 rounded bg-[#C5A059]/15 border border-[#C5A059]/35 text-[10px] font-bold text-[#E8C56A] uppercase tracking-wider whitespace-nowrap">
            {engine.symbol} · {engine.interval}
          </span>

          {/* Current Bar Time */}
          <span className="px-1.5 py-0.5 rounded bg-black/60 border border-white/10 text-[9.5px] font-mono text-slate-300 whitespace-nowrap">
            {(engine.replayTime ?? engine.startTime) != null
              ? formatBlindReplayDisplay((engine.replayTime ?? engine.startTime) as number, !engine.blindMasked, terminalLocale(language))
              : "—"}
          </span>

          {/* Positions badge if open */}
          {engine.positions.length > 0 && (
            <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-[9.5px] font-mono font-bold text-emerald-300 whitespace-nowrap">
              {engine.positions.length} POS
            </span>
          )}
        </aside>
      )}

      {/* ── CINEMA HUD: RIGHT THUMB (Playback, Velocità, Ticket ed Uscita) ── */}
      {isCinemaActive && (
        <aside
          aria-label="Controlli Replay Destra"
          style={{
            top: "max(10px, env(safe-area-inset-top))",
            right: "max(12px, env(safe-area-inset-right))",
          }}
          className="fixed z-50 flex items-center gap-1.5 rounded-xl border border-[#C5A059]/40 bg-[#07080b]/95 backdrop-blur-xl p-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.85)] font-mono select-none pointer-events-auto"
        >
          {/* Play / Pause button */}
          <button
            type="button"
            onClick={engine.togglePlay}
            disabled={engine.loading || engine.noData}
            title={engine.playing ? "Pausa Replay" : "Avvia Replay"}
            className={`flex h-7 px-2.5 items-center gap-1.5 rounded-lg border font-mono text-[10px] font-bold tracking-wider transition-all cursor-pointer whitespace-nowrap ${
              engine.playing
                ? "border-[#C5A059] bg-[#C5A059]/30 text-[#E8C56A] shadow-[0_0_12px_rgba(197,160,89,0.4)]"
                : "border-white/10 bg-white/5 text-slate-300 hover:text-white"
            }`}
          >
            {engine.playing ? <Pause size={12} /> : <Play size={12} />}
            <span>{engine.playing ? "Pausa" : "Play"}</span>
          </button>

          {/* Step Forward button */}
          <button
            type="button"
            onClick={engine.stepForward}
            disabled={engine.loading || engine.executing || engine.noData}
            title="Avanza 1 Barra"
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <ChevronRight size={14} />
          </button>

          {/* Quick Speed Switcher */}
          <div className="flex items-center gap-0.5">
            {[1, 2, 5, 10].map((spd) => (
              <button
                key={spd}
                type="button"
                onClick={() => engine.changeSpeed(spd)}
                className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold transition-colors whitespace-nowrap border ${
                  engine.speed === spd
                    ? "border-[#C5A059] bg-[#C5A059]/25 text-[#E8C56A]"
                    : "border-white/10 bg-white/5 text-slate-400 hover:text-white"
                }`}
              >
                {spd}×
              </button>
            ))}
          </div>

          <div className="h-4 w-px bg-[#C5A059]/25" />

          {/* Quick Order Drawer Lateral Button */}
          <button
            type="button"
            onClick={() => setQuickOrderDrawerOpen((prev) => !prev)}
            title="Apri Forgia Rapida Ordini"
            aria-expanded={quickOrderDrawerOpen}
            className={`flex h-7 px-2.5 items-center gap-1.5 rounded-lg border font-mono text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${
              quickOrderDrawerOpen
                ? "border-emerald-500 bg-emerald-500/30 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.35)]"
                : "border-emerald-500/40 bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25"
            }`}
          >
            <Layers size={11} />
            <span>Ticket</span>
            {engine.positions.length > 0 && (
              <span className="ml-0.5 px-1 rounded bg-black/60 text-[9px] text-emerald-300 border border-emerald-500/30">
                {engine.positions.length}
              </span>
            )}
          </button>

          {/* Exit Cinema Mode */}
          <button
            type="button"
            onClick={exitCinema}
            title="Esci da Schermo Intero / Ripristina Vista"
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#C5A059]/40 bg-[#C5A059]/15 text-[#E8C56A] hover:bg-[#C5A059]/25 transition-colors cursor-pointer"
          >
            <Minimize2 size={13} />
          </button>
        </aside>
      )}

      <div className="btm-desktop-shell">
      <TerminalHeader
        engine={engine}
        sessionName={sessionName}
        onExit={onExit}
        panelOpen={panelOpen}
        onTogglePanel={() => setPanelOpen((open) => !open)}
        toolsOpen={toolsOpen}
        onToggleTools={() => setToolsOpen(open => !open)}
        onToggleHelp={() => setHelpOpen((open) => !open)}
        isCinemaActive={isCinemaActive}
        onToggleCinema={toggleManualCinema}
        isBattle={isBattle}
        onFinishBattle={handleFinishBattle}
        connectedCount={isBattle ? battleRoom.participants.length : undefined}
        onToggleTelemetry={isBattle ? () => setTelemetryOpen(o => !o) : undefined}
        telemetryOpen={telemetryOpen}
        spectatorCount={isBattle ? battleRoom.spectatorCount : undefined}
        onOpenSpectatorShare={isBattle ? () => setSpectatorShareOpen(true) : undefined}
        matchSecondsRemaining={isBattle ? battleRoom.matchSecondsRemaining : undefined}
        onScanAi={handleScanReplayAi}
        isAiScanning={isAiScanning}
        hasAiSetup={Boolean(aiSetup)}
        aiScore={aiAnalysis?.confidenceScore}
        activeAlertsCount={alertsApi.activeCount}
        onOpenAlerts={() => {
          toast({
            title: `Allerte di Prezzo (${alertsApi.alerts.length})`,
            description: alertsApi.alerts.length === 0
              ? "Nessuna allerta impostata. Clicca col tasto destro sul grafico o clicca sul pulsante '+' sull'asse prezzi per impostarne una."
              : `${alertsApi.activeCount} attive su ${alertsApi.alerts.length} totali. Trascina le linee dorate o clicca sui comandi rapidi per modificarle.`,
          });
        }}
        onScreenshot={() => {
          const dataUrl = chartApiRef.current?.takeScreenshot();
          if (!dataUrl) return;
          const anchor = document.createElement("a");
          anchor.href = dataUrl;
          anchor.download = `replay-${engine.symbol}-${engine.interval}.png`;
          anchor.click();
        }}
        onOpenSettings={() => {
          setSettingsTab("chart");
          setSettingsIndicatorId(undefined);
          setSettingsOpen(true);
        }}
        onOpenOfflineStorage={() => setOfflineStorageOpen(true)}
        showOrderFlow={showOrderFlow}
        onToggleOrderFlow={toggleOrderFlow}
        onOpenTalkToJournal={() => setTalkToJournalOpen(true)}
        notesCount={notesCount}
      />

      <div className="btm-main" data-tools-open={toolsOpen}>
        <ToolRail
          engine={engine}
          activeTool={activeTool}
          onToolChange={(tool) => { setActiveTool(tool); if (compact) setToolsOpen(false); }}
          onOpenKnowledge={setKnowledgeToolId}
          onOpenSettings={() => {
            setSettingsTab("tools");
            setSettingsIndicatorId(undefined);
            setSettingsOpen(true);
          }}
        />

        <div className="btm-chartcol">
          <IndicatorStrip engine={engine} onOpenSettings={(indicatorId) => {
            setSettingsTab("indicators");
            setSettingsIndicatorId(indicatorId);
            setSettingsOpen(true);
          }} />
          <div className="btm-chartwrap">
            {!["saved", "local"].includes(engine.chartPreferences.status) && (
              <button type="button" className="btm-chart-sync-indicator" data-status={engine.chartPreferences.status}
                onClick={() => { setSettingsTab("chart"); setSettingsOpen(true); }}>
                <span role="status">{{ loading: "Caricamento preferenze…", pending: "Preferenze in attesa", saving: "Salvataggio preferenze…", offline: "Preferenze offline", error: "Verifica salvataggio preferenze", conflict: "Conflitto preferenze · scegli versione", saved: "", local: "" }[engine.chartPreferences.status]}</span>
              </button>
            )}
            <FavoriteToolsBar engine={engine} activeTool={activeTool} onToolChange={(tool) => { setActiveTool(tool); if (compact) setToolsOpen(false); }} />
            {limitedHistory && !engine.loading && !engine.error && !limitedDismissed && (
              <div className="btm-notice">
                {uiText("backtest_terminal.limited_history")}
                <button
                  type="button"
                  className="btm-notice-dismiss"
                  onClick={() => setLimitedDismissed(true)}
                  aria-label={uiText("backtest_terminal.close")}
                >
                  <X size={12} />
                </button>
              </div>
            )}
            <ReplayChart
              key={sessionKey}
              engine={engine}
              alertsApi={alertsApi}
              apiRef={chartApiRef}
              activeTool={activeTool}
              onToolDone={() => setActiveTool("cursor")}
              onOpenKnowledge={setKnowledgeToolId}
              onOpenChartSettings={() => {
                setSettingsTab("chart");
                setSettingsIndicatorId(undefined);
                setSettingsOpen(true);
              }}
              aiSetup={aiSetup}
              showAiOverlay={showAiOverlay}
              onUpdateAiSetup={updateAiSetup}
              onAdoptAiSetup={() => aiSetup && handleExecuteReplaySetup(aiSetup)}
              onToggleAiOverlay={() => setShowAiOverlay((prev) => !prev)}
              showOrderFlow={showOrderFlow}
              showNewsOverlay={showNewsOverlay}
            />
            <ReplayBiometricVignetteOverlay engine={engine} />
            <ToolKnowledgeDrawer
              toolId={knowledgeToolId}
              favoriteTools={engine.chartPreferences.preferences.favoriteTools}
              onToggleFavorite={(tool) =>
                engine.chartPreferences.update((prev) => ({
                  ...prev,
                  favoriteTools: prev.favoriteTools.includes(tool)
                    ? prev.favoriteTools.filter((t) => t !== tool)
                    : [...prev.favoriteTools, tool],
                }))
              }
              onSelectTool={(tool) => setActiveTool(tool)}
              onClose={() => setKnowledgeToolId(null)}
            />
            {engine.loading && (
              <div className="btm-center">
                <div className="btm-spin" aria-hidden="true" />
                <span>{uiText("backtest_terminal.loading")}</span>
              </div>
            )}
            {engine.error && !engine.loading && (
              <div className="btm-center">
                <span>{engine.error}</span>
                <button type="button" className="btm-primary-btn" onClick={engine.retryHistory}>{uiText("backtest_terminal.retry_history")}</button>
              </div>
            )}
            {engine.noData && !engine.loading && !engine.error && (
              <div className="btm-center">
                <span>{uiText("backtest_terminal.no_data")}</span>
                <button type="button" className="btm-primary-btn" onClick={engine.retryHistory}>{uiText("backtest_terminal.retry_history")}</button>
              </div>
            )}
            {engine.notice && (
              <button
                type="button"
                className="btm-eventbanner"
                data-kind={engine.notice.kind}
                onClick={engine.dismissNotice}
              >
                {uiText(`backtest_terminal.notice_${engine.notice.kind}`, {
                  price: formatPrice(engine.notice.price, engine.symbol),
                })}
              </button>
            )}
            {helpOpen && <HotkeysHelp onClose={() => setHelpOpen(false)} />}
            {settingsOpen && (
              <TerminalSettingsDialog
                engine={engine}
                initialTab={settingsTab}
                initialIndicatorId={settingsIndicatorId}
                onOpenKnowledge={setKnowledgeToolId}
                onClose={() => setSettingsOpen(false)}
              />
            )}

            {/* Mobile Portrait Floating Action Dock per Accesso Immediato al Cockpit / Ticket */}
            {compact && !isCinemaActive && !panelOpen && (
              <aside
                aria-label="Controlli Rapidi Cockpit Mobile"
                className="absolute right-3 bottom-3 z-30 flex items-center gap-2 pointer-events-auto"
              >
                <button
                  type="button"
                  onClick={() => {
                    synestheticClick();
                    setActivePanelTab("ticket");
                    setPanelOpen(true);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-full border text-xs font-mono font-bold tracking-wider shadow-lg backdrop-blur-md transition-transform active:scale-95 ${
                    engine.positions.length > 0
                      ? "border-emerald-500/60 bg-emerald-950/80 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                      : "border-[#C5A059]/40 bg-[#0d0f14]/90 text-[#E8C56A] shadow-[0_0_15px_rgba(197,160,89,0.2)]"
                  }`}
                  aria-label="Apri Cockpit Operativo"
                >
                  <Layers size={13} className={engine.positions.length > 0 ? "text-emerald-400" : "text-[#C5A059]"} />
                  <span className="whitespace-nowrap font-serif text-[11px] uppercase tracking-wider">Cockpit</span>
                  {engine.positions.length > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-[10px] text-emerald-300 font-mono whitespace-nowrap">
                      {engine.positions.length}
                    </span>
                  )}
                  {aiSetup && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#E8C56A] shadow-[0_0_6px_#E8C56A] ml-0.5 animate-pulse" />
                  )}
                </button>
              </aside>
            )}
          </div>
        </div>

        {compact ? (
          <LimenResponsiveDrawer
            open={panelOpen}
            onOpenChange={setPanelOpen}
            title={
              <div className="flex items-center gap-2">
                <span className="font-serif tracking-wider text-[#C5A059] uppercase text-sm font-bold">Cockpit Operativo</span>
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[#C5A059]/15 border border-[#C5A059]/30 text-[#E8C56A] uppercase font-bold tracking-wider whitespace-nowrap">
                  {engine.symbol} · {engine.interval}
                </span>
              </div>
            }
            subtitle="Sentinella, Ticket, Watchlist, Notizie, Diario & Dossier"
            mobileClassName="max-h-[85vh] bg-[#07080b]/98 border-t border-[#C5A059]/30 backdrop-blur-2xl p-0 flex flex-col overflow-hidden"
          >
            <div className="flex flex-col h-full min-h-0 overflow-hidden btm-root-colors">
              <div className="btm-panel-tabs border-b border-[#C5A059]/15 shrink-0 overflow-x-auto scrollbar-none" role="tablist" aria-label="Sezioni del Cockpit Operativo">
                <button
                  type="button"
                  role="tab"
                  aria-selected={activePanelTab === "ticket"}
                  className={`btm-panel-tab ${activePanelTab === "ticket" ? "btm-panel-tab-active" : ""}`}
                  onClick={() => handleSelectPanelTab("ticket")}
                >
                  <Layers size={13} />
                  <span>Ticket</span>
                  {(engine.positions.length > 0 || engine.pendingOrders.length > 0) && (
                    <span className="btm-panel-tab-badge font-mono whitespace-nowrap">
                      {engine.positions.length + engine.pendingOrders.length}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activePanelTab === "watchlist"}
                  className={`btm-panel-tab ${activePanelTab === "watchlist" ? "btm-panel-tab-active" : ""}`}
                  onClick={() => handleSelectPanelTab("watchlist")}
                >
                  <ListFilter size={13} />
                  <span>Watchlist</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activePanelTab === "news"}
                  className={`btm-panel-tab ${activePanelTab === "news" ? "btm-panel-tab-active" : ""}`}
                  onClick={() => handleSelectPanelTab("news")}
                >
                  <Newspaper size={13} />
                  <span>Notizie</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activePanelTab === "sentinel"}
                  className={`btm-panel-tab ${activePanelTab === "sentinel" ? "btm-panel-tab-active" : ""}`}
                  onClick={() => handleSelectPanelTab("sentinel")}
                >
                  <Eye size={13} />
                  <span>Sentinella</span>
                  {aiSetup && <span className="btm-panel-tab-dot" />}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activePanelTab === "automa"}
                  className={`btm-panel-tab ${activePanelTab === "automa" ? "btm-panel-tab-active" : ""}`}
                  onClick={() => handleSelectPanelTab("automa")}
                >
                  <Bot size={13} />
                  <span>Automa EA</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activePanelTab === "journal"}
                  className={`btm-panel-tab ${activePanelTab === "journal" ? "btm-panel-tab-active" : ""}`}
                  onClick={() => handleSelectPanelTab("journal")}
                >
                  <BookOpen size={13} />
                  <span>Diario</span>
                  {engine.trades.length > 0 && (
                    <span className="btm-panel-tab-badge font-mono whitespace-nowrap">{engine.trades.length}</span>
                  )}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activePanelTab === "account"}
                  className={`btm-panel-tab ${activePanelTab === "account" ? "btm-panel-tab-active" : ""}`}
                  onClick={() => handleSelectPanelTab("account")}
                >
                  <Wallet size={13} />
                  <span>Dossier</span>
                </button>
              </div>
              <div className="btm-panel-content flex-1 min-h-0 overflow-y-auto">
                {activePanelTab === "ticket" && (
                  <OrderTicket engine={engine} draft={ticketDraft} onDraftChange={patch => setTicketDraft(previous => ({ ...previous, ...patch }))} />
                )}
                {activePanelTab === "watchlist" && (
                  <ReplayWatchlistPanel currentSymbol={engine.symbol} onSelectSymbol={handleSelectSymbol} />
                )}
                {activePanelTab === "news" && (
                  <ReplayNewsPanel
                    symbol={engine.symbol}
                    replayTime={engine.replayTime}
                    showNewsOnChart={showNewsOverlay}
                    onToggleNewsOnChart={toggleNewsOverlay}
                  />
                )}
                {activePanelTab === "sentinel" && (
                  <BacktestAiSentinelPanel
                    isScanning={isAiScanning}
                    analysis={aiAnalysis}
                    onScan={() => handleScanReplayAi(false)}
                    onExecuteSetup={handleExecuteReplaySetup}
                    showOverlay={showAiOverlay}
                    onToggleOverlay={() => setShowAiOverlay((prev) => !prev)}
                    autoAuditOnStep={continuousAutoScan}
                    onToggleAutoAudit={() => setContinuousAutoScan((prev) => !prev)}
                    autoExecuteAi={autoExecuteAi}
                    onToggleAutoExecute={() => setAutoExecuteAi((prev) => !prev)}
                    missedMoveNotice={missedMoveNotice}
                    onDismissMissedNotice={() => setMissedMoveNotice(null)}
                    operativeMemory={operativeMemory}
                    onResetMemory={handleResetOperativeMemory}
                    symbol={engine.symbol}
                    interval={engine.interval}
                  />
                )}
                {activePanelTab === "automa" && (
                  <EaForgeStudioPanel
                    symbol={engine.symbol}
                    interval={engine.interval}
                    candles={engine.candles}
                    compact
                    onInspectCaseStudy={(study) => {
                      const idx = engine.candles.findIndex((c) => c.time >= study.trade.entryTime);
                      if (idx >= 0) {
                        engine.seekFraction(idx / Math.max(1, engine.candles.length - 1));
                      }
                      toast({
                        title: `Caso Studio: ${study.title}`,
                        description: `${study.trade.direction.toUpperCase()} @ ${study.trade.entryPrice} · SL ${study.trade.slPips}p · TP ${study.trade.tpPips}p`,
                      });
                    }}
                  />
                )}
                {activePanelTab === "account" && (
                  <AccountPanel engine={engine} />
                )}
                {activePanelTab === "journal" && (
                  <JournalPanel
                    engine={engine}
                    sessionKey={sessionKey}
                    onOpenTalkToJournal={() => setTalkToJournalOpen(true)}
                  />
                )}
              </div>
            </div>
          </LimenResponsiveDrawer>
        ) : panelOpen && (
          <aside className="btm-panel" aria-label={uiText("backtest_terminal.panel")}>
            <div className="btm-panel-tabs overflow-x-auto scrollbar-none" role="tablist" aria-label="Sezioni del Cockpit Operativo">
              <button
                type="button"
                role="tab"
                aria-selected={activePanelTab === "ticket"}
                className={`btm-panel-tab ${activePanelTab === "ticket" ? "btm-panel-tab-active" : ""}`}
                onClick={() => handleSelectPanelTab("ticket")}
              >
                <Layers size={13} />
                <span>Ticket</span>
                {(engine.positions.length > 0 || engine.pendingOrders.length > 0) && (
                  <span className="btm-panel-tab-badge font-mono">
                    {engine.positions.length + engine.pendingOrders.length}
                  </span>
                )}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activePanelTab === "watchlist"}
                className={`btm-panel-tab ${activePanelTab === "watchlist" ? "btm-panel-tab-active" : ""}`}
                onClick={() => handleSelectPanelTab("watchlist")}
              >
                <ListFilter size={13} />
                <span>Watchlist</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activePanelTab === "news"}
                className={`btm-panel-tab ${activePanelTab === "news" ? "btm-panel-tab-active" : ""}`}
                onClick={() => handleSelectPanelTab("news")}
              >
                <Newspaper size={13} />
                <span>Notizie</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activePanelTab === "sentinel"}
                className={`btm-panel-tab ${activePanelTab === "sentinel" ? "btm-panel-tab-active" : ""}`}
                onClick={() => handleSelectPanelTab("sentinel")}
              >
                <Eye size={13} />
                <span>Sentinella</span>
                {aiSetup && <span className="btm-panel-tab-dot" />}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activePanelTab === "automa"}
                className={`btm-panel-tab ${activePanelTab === "automa" ? "btm-panel-tab-active" : ""}`}
                onClick={() => handleSelectPanelTab("automa")}
              >
                <Bot size={13} />
                <span>Automa EA</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activePanelTab === "journal"}
                className={`btm-panel-tab ${activePanelTab === "journal" ? "btm-panel-tab-active" : ""}`}
                onClick={() => handleSelectPanelTab("journal")}
              >
                <BookOpen size={13} />
                <span>Diario</span>
                {engine.trades.length > 0 && (
                  <span className="btm-panel-tab-badge font-mono">{engine.trades.length}</span>
                )}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activePanelTab === "account"}
                className={`btm-panel-tab ${activePanelTab === "account" ? "btm-panel-tab-active" : ""}`}
                onClick={() => handleSelectPanelTab("account")}
              >
                <Wallet size={13} />
                <span>Dossier</span>
              </button>
            </div>
            <div className="btm-panel-content">
              {activePanelTab === "ticket" && (
                <OrderTicket engine={engine} draft={ticketDraft} onDraftChange={patch => setTicketDraft(previous => ({ ...previous, ...patch }))} />
              )}
              {activePanelTab === "watchlist" && (
                <ReplayWatchlistPanel currentSymbol={engine.symbol} onSelectSymbol={handleSelectSymbol} />
              )}
              {activePanelTab === "news" && (
                <ReplayNewsPanel
                  symbol={engine.symbol}
                  replayTime={engine.replayTime}
                  showNewsOnChart={showNewsOverlay}
                  onToggleNewsOnChart={toggleNewsOverlay}
                />
              )}
              {activePanelTab === "sentinel" && (
                <BacktestAiSentinelPanel
                  isScanning={isAiScanning}
                  analysis={aiAnalysis}
                  onScan={() => handleScanReplayAi(false)}
                  onExecuteSetup={handleExecuteReplaySetup}
                  showOverlay={showAiOverlay}
                  onToggleOverlay={() => setShowAiOverlay((prev) => !prev)}
                  autoAuditOnStep={continuousAutoScan}
                  onToggleAutoAudit={() => setContinuousAutoScan((prev) => !prev)}
                  autoExecuteAi={autoExecuteAi}
                  onToggleAutoExecute={() => setAutoExecuteAi((prev) => !prev)}
                  missedMoveNotice={missedMoveNotice}
                  onDismissMissedNotice={() => setMissedMoveNotice(null)}
                  operativeMemory={operativeMemory}
                  onResetMemory={handleResetOperativeMemory}
                  symbol={engine.symbol}
                  interval={engine.interval}
                />
              )}
              {activePanelTab === "automa" && (
                <EaForgeStudioPanel
                  symbol={engine.symbol}
                  interval={engine.interval}
                  candles={engine.candles}
                  compact
                  onInspectCaseStudy={(study) => {
                    const idx = engine.candles.findIndex((c) => c.time >= study.trade.entryTime);
                    if (idx >= 0) {
                      engine.seekFraction(idx / Math.max(1, engine.candles.length - 1));
                    }
                    toast({
                      title: `Caso Studio: ${study.title}`,
                      description: `${study.trade.direction.toUpperCase()} @ ${study.trade.entryPrice} · SL ${study.trade.slPips}p · TP ${study.trade.tpPips}p`,
                    });
                  }}
                />
              )}
              {activePanelTab === "account" && (
                <AccountPanel engine={engine} />
              )}
              {activePanelTab === "journal" && (
                <JournalPanel
                  engine={engine}
                  sessionKey={sessionKey}
                  onOpenTalkToJournal={() => setTalkToJournalOpen(true)}
                />
              )}
            </div>
          </aside>
        )}

        {/* ── Barra Strumenti Verticale Destra (FX Replay Workspace Dock) ── */}
        <aside
          className="btm-right-dock hidden md:flex flex-col items-center gap-1 py-2 px-1 border-l border-[#C5A059]/20 bg-[#0d0f14] z-20 shrink-0"
          aria-label="Barra Icone Rapide Destra"
        >
          <button
            type="button"
            onClick={() => {
              synestheticClick();
              if (panelOpen && activePanelTab === "ticket") setPanelOpen(false);
              else { setActivePanelTab("ticket"); setPanelOpen(true); }
            }}
            className={`flex flex-col items-center justify-center w-10 h-11 rounded-lg border text-[8.5px] font-mono font-bold tracking-tight transition-all cursor-pointer ${
              panelOpen && activePanelTab === "ticket"
                ? "border-emerald-500 bg-emerald-500/20 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                : "border-white/10 bg-[#07080b] text-slate-300 hover:border-[#C5A059]/50 hover:text-white"
            }`}
            title="Ticket Ordini (+ Ordine)"
          >
            <Layers size={13} className={engine.positions.length > 0 ? "text-emerald-400" : "text-[#C5A059]"} />
            <span className="mt-0.5">+Ordine</span>
          </button>

          <button
            type="button"
            onClick={() => {
              synestheticClick();
              setObjectTreeModalOpen(true);
            }}
            className="flex flex-col items-center justify-center w-10 h-11 rounded-lg border border-white/10 bg-[#07080b] text-slate-300 hover:border-[#C5A059]/50 hover:text-white text-[8.5px] font-mono font-bold tracking-tight transition-all cursor-pointer"
            title="Albero Oggetti (Disegni & Indicatori)"
          >
            <SlidersHorizontal size={13} className="text-[#C5A059]" />
            <span className="mt-0.5">Oggetti</span>
          </button>

          <button
            type="button"
            onClick={() => {
              synestheticClick();
              if (panelOpen && activePanelTab === "watchlist") setPanelOpen(false);
              else { setActivePanelTab("watchlist"); setPanelOpen(true); }
            }}
            className={`flex flex-col items-center justify-center w-10 h-11 rounded-lg border text-[8.5px] font-mono font-bold tracking-tight transition-all cursor-pointer ${
              panelOpen && activePanelTab === "watchlist"
                ? "border-[#C5A059] bg-[#C5A059]/20 text-[#E8C56A] shadow-[0_0_10px_rgba(197,160,89,0.3)]"
                : "border-white/10 bg-[#07080b] text-slate-300 hover:border-[#C5A059]/50 hover:text-white"
            }`}
            title="Watchlist Strumenti"
          >
            <ListFilter size={13} className="text-[#C5A059]" />
            <span className="mt-0.5">Watch</span>
          </button>

          <button
            type="button"
            onClick={() => {
              synestheticClick();
              if (panelOpen && activePanelTab === "sentinel") setPanelOpen(false);
              else { setActivePanelTab("sentinel"); setPanelOpen(true); }
            }}
            className={`flex flex-col items-center justify-center w-10 h-11 rounded-lg border text-[8.5px] font-mono font-bold tracking-tight transition-all cursor-pointer ${
              panelOpen && activePanelTab === "sentinel"
                ? "border-[#C5A059] bg-[#C5A059]/20 text-[#E8C56A] shadow-[0_0_10px_rgba(197,160,89,0.3)]"
                : "border-white/10 bg-[#07080b] text-slate-300 hover:border-[#C5A059]/50 hover:text-white"
            }`}
            title="Sentinella Wyckoff AI"
          >
            <Eye size={13} className="text-[#E8C56A]" />
            <span className="mt-0.5">Varco</span>
          </button>

          <button
            type="button"
            onClick={() => {
              synestheticClick();
              if (panelOpen && activePanelTab === "automa") setPanelOpen(false);
              else { setActivePanelTab("automa"); setPanelOpen(true); }
            }}
            className={`flex flex-col items-center justify-center w-10 h-11 rounded-lg border text-[8.5px] font-mono font-bold tracking-tight transition-all cursor-pointer ${
              panelOpen && activePanelTab === "automa"
                ? "border-[#C5A059] bg-[#C5A059]/20 text-[#E8C56A] shadow-[0_0_10px_rgba(197,160,89,0.3)]"
                : "border-white/10 bg-[#07080b] text-slate-300 hover:border-[#C5A059]/50 hover:text-white"
            }`}
            title="L'Automa della Forgia · Crea EA & Casi Studio (Piano 150€)"
          >
            <Bot size={13} className="text-[#E8C56A]" />
            <span className="mt-0.5">Automa</span>
          </button>

          <button
            type="button"
            onClick={() => {
              synestheticClick();
              if (panelOpen && activePanelTab === "journal") setPanelOpen(false);
              else { setActivePanelTab("journal"); setPanelOpen(true); }
            }}
            className={`flex flex-col items-center justify-center w-10 h-11 rounded-lg border text-[8.5px] font-mono font-bold tracking-tight transition-all cursor-pointer ${
              panelOpen && activePanelTab === "journal"
                ? "border-[#C5A059] bg-[#C5A059]/20 text-[#E8C56A] shadow-[0_0_10px_rgba(197,160,89,0.3)]"
                : "border-white/10 bg-[#07080b] text-slate-300 hover:border-[#C5A059]/50 hover:text-white"
            }`}
            title="Il Libro della Verità (Journal & Note Vocali)"
          >
            <BookOpen size={13} className="text-[#C5A059]" />
            <span className="mt-0.5">Diario</span>
          </button>

          <button
            type="button"
            onClick={() => {
              synestheticClick();
              if (panelOpen && activePanelTab === "news") setPanelOpen(false);
              else { setActivePanelTab("news"); setPanelOpen(true); }
            }}
            className={`flex flex-col items-center justify-center w-10 h-11 rounded-lg border text-[8.5px] font-mono font-bold tracking-tight transition-all cursor-pointer ${
              panelOpen && activePanelTab === "news"
                ? "border-[#C5A059] bg-[#C5A059]/20 text-[#E8C56A] shadow-[0_0_10px_rgba(197,160,89,0.3)]"
                : "border-white/10 bg-[#07080b] text-slate-300 hover:border-[#C5A059]/50 hover:text-white"
            }`}
            title="Notizie Macroeconomiche & Calendario"
          >
            <Newspaper size={13} className="text-[#C5A059]" />
            <span className="mt-0.5">News</span>
          </button>
        </aside>
      </div>

      {persistenceStatus}
      <TransportBar engine={engine} />
      </div>

      {isBattle && (
        <LiveBattleTelemetryHUD
          isOpen={telemetryOpen}
          onClose={() => setTelemetryOpen(false)}
          participants={battleRoom.participants}
          recentTrades={battleRoom.recentTrades}
          recentSentences={battleRoom.recentSentences}
          userDrawdownPct={engine.account.maxDrawdownPct}
          maxAllowedDrawdownPct={10}
          onSendSentence={battleRoom.sendStoicSentence}
          matchSecondsRemaining={battleRoom.matchSecondsRemaining}
          isMatchExpired={battleRoom.isMatchExpired}
          connectionHealth={battleRoom.connectionHealth}
          latencyMs={battleRoom.latencyMs}
          pendingActionsCount={battleRoom.pendingActionsCount}
          onReconnect={battleRoom.reconnectNow}
          spectatorCount={battleRoom.spectatorCount}
          onOpenSpectatorShare={() => setSpectatorShareOpen(true)}
        />
      )}

      {isBattle && (
        <ArenaSpectatorShareModal
          isOpen={spectatorShareOpen}
          onClose={() => setSpectatorShareOpen(false)}
          roomId={roomId}
          combatantNames={battleRoom.participants.map((p) => p.displayName)}
        />
      )}

      {victorySummary && (
        <BacktestVictoryModal
          summary={victorySummary}
          isOpen={victoryModalOpen}
          onClose={() => setVictoryModalOpen(false)}
          onViewLeaderboard={() => {
            setVictoryModalOpen(false);
            navigate(`/tornei?sub=backtest&tournamentId=${effectiveTournamentId}&podium=true`);
          }}
          onRematch={() => {
            setVictoryModalOpen(false);
            engine.restart();
          }}
        />
      )}

      <OfflineStorageModal
        isOpen={offlineStorageOpen}
        onClose={() => setOfflineStorageOpen(false)}
        engine={engine}
      />

      {/* Talk to Journal AI Audio Modal (FX Replay Style) */}
      <TalkToJournalModal
        isOpen={talkToJournalOpen}
        onClose={() => setTalkToJournalOpen(false)}
        engine={engine}
        sessionKey={sessionKey}
      />

      {/* Albero Oggetti (Disegni & Indicatori - Object Tree) */}
      <ChartObjectTreeModal
        isOpen={objectTreeModalOpen}
        onClose={() => setObjectTreeModalOpen(false)}
        symbol={engine.symbol}
        interval={engine.interval}
        drawings={engine.drawings}
        onUpdateDrawing={(d) =>
          engine.setDrawings((prev) => prev.map((item) => (item.id === d.id ? d : item)))
        }
        onDeleteDrawing={(id) =>
          engine.setDrawings((prev) => prev.filter((item) => item.id !== id))
        }
        onClearAllDrawings={() => engine.setDrawings([])}
        indicators={engine.indicators}
        onToggleIndicator={(id) =>
          engine.setIndicators((prev) =>
            prev.map((ind) => (ind.id === id ? { ...ind, on: !ind.on } : ind)),
          )
        }
      />

      {/* Right Edge Slip-in Indicator (Mobile / Tablet / Landscape) */}
      {!quickOrderDrawerOpen && (
        <div
          aria-hidden="true"
          className="fixed right-0 top-1/2 -translate-y-1/2 w-1.5 h-16 rounded-l-md bg-gradient-to-l from-emerald-500/60 to-transparent pointer-events-none z-40 opacity-70 animate-pulse md:hidden"
          title="Trascina dal bordo destro per aprire il Ticket"
        />
      )}

      {/* Quick Order Drawer Laterale (Landscape & Mobile HUD) */}
      <QuickOrderDrawer
        engine={engine}
        isOpen={quickOrderDrawerOpen}
        onClose={() => setQuickOrderDrawerOpen(false)}
      />
    </div>
  );
}
