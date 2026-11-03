import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  Bot,
  Code2,
  Sparkles,
  Play,
  Copy,
  Check,
  Download,
  Lock,
  Trophy,
  Zap,
  ShieldCheck,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Target,
  Crosshair,
  SlidersHorizontal,
  Layers,
  Clock,
  FileCode2,
} from "lucide-react";
import { useLimenEntitlements } from "@/hooks/useLimenEntitlements";
import { LimenCandidacyModal } from "@/components/candidacy/LimenCandidacyModal";
import { useToast } from "@/hooks/use-toast";
import { synestheticClick, synestheticSealOfAction, synestheticTrophy } from "@/lib/soundFx";
import { fetchReplayCandles, type ReplayCandleRaw } from "@/lib/replayCandlesApi";
import {
  EA_ARCHETYPES,
  compileConceptToStrategy,
  parseDslToStrategy,
  runEaHistoricalBacktest,
  type CompiledEaStrategy,
  type EaBacktestResult,
  type EaCaseStudy,
  type EaExecutedTrade,
  type EaSessionFilter,
} from "@/lib/replay/eaForgeEngine";

export interface EaForgeStudioPanelProps {
  symbol: string;
  interval: string;
  /** Optional candles already loaded in the replay engine */
  candles?: ReplayCandleRaw[];
  /** Compact layout for the 340px right sidebar inside BacktestTerminal */
  compact?: boolean;
  /** Called when the user clicks "Ispeziona sul Grafico" on a Case Study or trade */
  onInspectCaseStudy?: (study: EaCaseStudy) => void;
  /** Called when the user wants to inject the EA's trades into the current session */
  onApplyTradesToSession?: (trades: EaExecutedTrade[], strategyName: string) => void;
}

const PREVIEW_STORAGE_KEY = "aureus_ea_forge_150_preview_v1";

export function EaForgeStudioPanel({
  symbol,
  interval,
  candles,
  compact = false,
  onInspectCaseStudy,
  onApplyTradesToSession,
}: EaForgeStudioPanelProps) {
  const { toast } = useToast();
  const { entitlements, isAdmin, monthlyFeeCents } = useLimenEntitlements();

  // Sbloccato solo sul piano da 150 €/mese (complete_150 -> doctrineOfTime / eaForgeStudio) o Admin
  const has150Plan = Boolean(
    isAdmin ||
      entitlements.eaForgeStudio ||
      entitlements.doctrineOfTime ||
      monthlyFeeCents >= 15000,
  );

  const [previewUnlocked, setPreviewUnlocked] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(PREVIEW_STORAGE_KEY) === "1";
  });
  const [candidacyModalOpen, setCandidacyModalOpen] = useState(false);

  const isUnlocked = has150Plan || previewUnlocked;

  // State del costruttore EA
  const [selectedArchetypeId, setSelectedArchetypeId] = useState<string>(EA_ARCHETYPES[0].id);
  const [conceptInput, setConceptInput] = useState<string>(EA_ARCHETYPES[0].conceptPrompt);
  const [strategy, setStrategy] = useState<CompiledEaStrategy>(EA_ARCHETYPES[0].strategy);
  const [dslDraft, setDslDraft] = useState<string>("");
  const [codeTab, setCodeTab] = useState<"dsl" | "mql5" | "ctrader">("dsl");
  const [studioTab, setStudioTab] = useState<"concept" | "code" | "studies">("concept");
  const [copiedCode, setCopiedCode] = useState(false);
  const [fetchedCandles, setFetchedCandles] = useState<ReplayCandleRaw[] | null>(null);
  const [isLoadingCandles, setIsLoadingCandles] = useState(false);

  // Carica candele storiche reali se non passate dal chiamante
  useEffect(() => {
    if (candles && candles.length >= 80) {
      setFetchedCandles(candles);
      return;
    }
    let cancelled = false;
    setIsLoadingCandles(true);
    fetchReplayCandles({
      symbol,
      interval,
      mode: "replay",
      limit: 600,
    })
      .then((res) => {
        if (!cancelled && res.candles && res.candles.length >= 60) {
          setFetchedCandles(res.candles);
        }
      })
      .catch(() => {
        // Il motore userà il generatore storico deterministico se offline
      })
      .finally(() => {
        if (!cancelled) setIsLoadingCandles(false);
      });

    return () => {
      cancelled = true;
    };
  }, [symbol, interval, candles]);

  // Esegui il backtest automatico ogni volta che la strategia o le candele cambiano
  const backtestResult: EaBacktestResult = useMemo(() => {
    const activeCandles =
      candles && candles.length >= 80
        ? candles
        : fetchedCandles && fetchedCandles.length >= 80
          ? fetchedCandles
          : undefined;
    return runEaHistoricalBacktest({
      strategy,
      candles: activeCandles,
      symbol,
      interval,
      initialBalance: 100_000,
    });
  }, [strategy, candles, fetchedCandles, symbol, interval]);

  // Sincronizza il codice DSL quando la strategia cambia da concetto/archetipo
  useEffect(() => {
    setDslDraft(backtestResult.dslCode);
  }, [backtestResult.dslCode]);

  const handleSelectArchetype = useCallback((archId: string) => {
    synestheticClick();
    const found = EA_ARCHETYPES.find((a) => a.id === archId);
    if (!found) return;
    setSelectedArchetypeId(found.id);
    setConceptInput(found.conceptPrompt);
    setStrategy({ ...found.strategy });
  }, []);

  const handleCompileConcept = useCallback(() => {
    synestheticSealOfAction();
    const compiled = compileConceptToStrategy(conceptInput, selectedArchetypeId);
    setStrategy(compiled);
    toast({
      title: "Automa della Forgia · Bot Compilato e Testato",
      description: `${compiled.name}: ${backtestResult.totalTrades} trade analizzati · Winrate ${backtestResult.winRate}% · R:R 1:${compiled.riskRewardTarget}`,
    });
    if (compact) {
      setStudioTab("studies");
    }
  }, [conceptInput, selectedArchetypeId, backtestResult.totalTrades, backtestResult.winRate, compact, toast]);

  const handleApplyDslCode = useCallback(() => {
    synestheticSealOfAction();
    const parsed = parseDslToStrategy(dslDraft, strategy);
    setStrategy(parsed);
    toast({
      title: "Codice AUREUS Script Applicato",
      description: `Parametri EA aggiornati e ricalcolati su ${symbol} (${interval}).`,
    });
  }, [dslDraft, strategy, symbol, interval, toast]);

  const activeCodeText =
    codeTab === "dsl"
      ? dslDraft
      : codeTab === "mql5"
        ? backtestResult.mql5Code
        : backtestResult.cTraderCode;

  const handleCopyCode = useCallback(async () => {
    synestheticClick();
    try {
      await navigator.clipboard.writeText(activeCodeText);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
      toast({
        title: "Codice EA Copiato negli Appunti",
        description:
          codeTab === "mql5"
            ? "Pronto per MetaEditor 5 (MQL5 Expert Advisor)."
            : codeTab === "ctrader"
              ? "Pronto per cTrader Automate (cBot C#)."
              : "Script AUREUS copiato.",
      });
    } catch {
      toast({
        title: "Copia non riuscita",
        description: "Seleziona manualmente il testo dall'editor.",
        variant: "destructive",
      });
    }
  }, [activeCodeText, codeTab, toast]);

  const handleDownloadCode = useCallback(() => {
    synestheticTrophy();
    const ext = codeTab === "mql5" ? "mq5" : codeTab === "ctrader" ? "cs" : "aureus";
    const cleanSym = symbol.replace("/", "");
    const filename = `AUREUS_Automa_${strategy.entryTrigger}_${cleanSym}_${interval}.${ext}`;
    const blob = new Blob([activeCodeText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({
      title: `File ${filename} Scaricato`,
      description: "Importa il file nel tuo terminale per compilare l'Expert Advisor.",
    });
  }, [activeCodeText, codeTab, symbol, interval, strategy.entryTrigger, toast]);

  const handleUnlockPreview = useCallback(() => {
    synestheticSealOfAction();
    setPreviewUnlocked(true);
    try {
      window.localStorage.setItem(PREVIEW_STORAGE_KEY, "1");
    } catch {}
    toast({
      title: "Modalità Simulazione Piano 150€ Attivata",
      description: "L'Automa della Forgia è ora sbloccato in anteprima operativa.",
    });
  }, [toast]);

  // ─── MINI EQUITY CURVE SVG ─────────────────────────────────────────────────
  const equityPointsSvg = useMemo(() => {
    const pts = backtestResult.equityCurve;
    if (pts.length < 2) return "";
    const minB = Math.min(...pts.map((p) => p.balance));
    const maxB = Math.max(...pts.map((p) => p.balance));
    const range = Math.max(1, maxB - minB);
    const W = 400;
    const H = 64;
    return pts
      .map((p, idx) => {
        const x = (idx / (pts.length - 1)) * W;
        const y = H - ((p.balance - minB) / range) * (H - 12) - 6;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }, [backtestResult.equityCurve]);

  // ─── GATE ESCLUSIVO PIANO DA 150 €/MESE ────────────────────────────────────
  if (!isUnlocked) {
    return (
      <div className="rounded-xl border border-[#C5A059]/40 bg-[#0d0f14] p-4 sm:p-6 shadow-[0_20px_60px_rgba(0,0,0,0.85)] text-foreground flex flex-col justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#C5A059]/20 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl border border-[#C5A059]/50 bg-[#07080b] flex items-center justify-center text-[#C5A059] shadow-[0_0_20px_rgba(197,160,89,0.2)] shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="px-2 py-0.5 rounded bg-[#C5A059]/15 border border-[#C5A059]/40 text-[#E8C56A] font-mono text-[9px] font-bold uppercase tracking-wider whitespace-nowrap">
                  ESCLUSIVA PIANO 150 €/MESE
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/35 text-emerald-300 font-mono text-[9px] font-bold uppercase tracking-wider whitespace-nowrap">
                  PROGETTO COMPLETO
                </span>
              </div>
              <h3 className="font-serif text-base sm:text-lg font-bold text-[#F4F4F6] mt-1">
                L&apos;Automa della Forgia · Generatore EA &amp; Casi Studio
              </h3>
            </div>
          </div>
          <div className="text-left sm:text-right font-mono shrink-0">
            <div className="text-lg font-bold text-[#E8C56A] whitespace-nowrap">150 € / mese</div>
            <div className="text-[10px] text-slate-400 whitespace-nowrap">o 1.500 € / anno (2 mesi omaggio)</div>
          </div>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">
          Spiega un concetto operativo o scrivi il codice: l&apos;Automa genera un Bot che testa la strategia sulle candele storiche ed estrae automaticamente Casi Studio, Winrate, R:R ed Expert Advisor per MT5 e cTrader.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-left">
          <div className="rounded-lg border border-[#C5A059]/25 bg-[#07080b]/90 p-2.5">
            <div className="flex items-center gap-1.5 text-[#E8C56A] font-mono text-[10px] font-bold uppercase">
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              <span>Da Concetto a Bot</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Descrivi l&apos;idea a parole o scegli 5 archetipi SMC, Wyckoff e Breakout.
            </p>
          </div>
          <div className="rounded-lg border border-[#C5A059]/25 bg-[#07080b]/90 p-2.5">
            <div className="flex items-center gap-1.5 text-emerald-400 font-mono text-[10px] font-bold uppercase">
              <Trophy className="w-3.5 h-3.5 shrink-0" />
              <span>Casi Studio &amp; KPI</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Estrazione automatica di Winrate, R:R, Profit Factor e trade da manuale.
            </p>
          </div>
          <div className="rounded-lg border border-[#C5A059]/25 bg-[#07080b]/90 p-2.5">
            <div className="flex items-center gap-1.5 text-[#C5A059] font-mono text-[10px] font-bold uppercase">
              <Code2 className="w-3.5 h-3.5 shrink-0" />
              <span>Codice MQL5 &amp; cBot</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Editor AUREUS Script ed esportazione pronta `.mq5` e `.cs`.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-[#C5A059]/20">
          <button
            type="button"
            onClick={handleUnlockPreview}
            className="px-3 py-2 rounded-lg border border-[#C5A059]/40 bg-[#C5A059]/10 hover:bg-[#C5A059]/20 text-[#E8C56A] font-mono text-[10.5px] font-bold uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap"
          >
            ⚡ Prova Simulazione Automa (Anteprima 150€)
          </button>

          <button
            type="button"
            onClick={() => setCandidacyModalOpen(true)}
            className="px-4 py-2 rounded-lg bg-[#C5A059] hover:bg-[#E8C56A] text-[#07080b] font-mono text-xs font-bold uppercase tracking-wider shadow-[0_0_20px_rgba(197,160,89,0.35)] transition-all cursor-pointer whitespace-nowrap"
          >
            Sblocca col Piano 150 €/mese
          </button>
        </div>

        <LimenCandidacyModal
          isOpen={candidacyModalOpen}
          onClose={() => setCandidacyModalOpen(false)}
          defaultTierId="complete_150"
        />
      </div>
    );
  }

  // ─── SEZIONE SINISTRA: CONCETTO & CODICE ───────────────────────────────────
  const renderBuilderColumn = () => (
    <div className="flex flex-col gap-2.5 min-w-0">
      {/* Sub-Tab Switcher (Concetto vs Codice) */}
      <div className="flex items-center justify-between gap-2 bg-[#07080b] p-1 rounded-lg border border-[#C5A059]/25">
        <button
          type="button"
          onClick={() => {
            synestheticClick();
            setStudioTab("concept");
          }}
          className={`flex-1 py-1.5 px-2.5 rounded-md font-mono text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
            studioTab === "concept"
              ? "bg-[#C5A059]/20 text-[#E8C56A] border border-[#C5A059]/45"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>1. Spiega Concetto</span>
        </button>
        <button
          type="button"
          onClick={() => {
            synestheticClick();
            setStudioTab("code");
          }}
          className={`flex-1 py-1.5 px-2.5 rounded-md font-mono text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
            studioTab === "code"
              ? "bg-[#C5A059]/20 text-[#E8C56A] border border-[#C5A059]/45"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <Code2 className="w-3.5 h-3.5" />
          <span>2. Codice EA / Bot</span>
        </button>
        {compact && (
          <button
            type="button"
            onClick={() => {
              synestheticClick();
              setStudioTab("studies");
            }}
            className={`flex-1 py-1.5 px-2.5 rounded-md font-mono text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
              studioTab === "studies"
                ? "bg-[#C5A059]/20 text-[#E8C56A] border border-[#C5A059]/45"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>3. Casi ({backtestResult.caseStudies.length})</span>
          </button>
        )}
      </div>

      {studioTab === "concept" && (
        <div className="space-y-2.5 rounded-xl border border-[#C5A059]/25 bg-[#0B0D13]/95 p-3">
          {/* Archetipi Istituzionali 1-Click */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-mono text-[9.5px] uppercase tracking-wider font-bold text-[#C5A059]">
                Archetipi Strategici Pre-Forgiati
              </span>
              <span className="font-mono text-[9px] text-slate-400 whitespace-nowrap">
                1-Click Template
              </span>
            </div>
            <div className="flex flex-wrap gap-1">
              {EA_ARCHETYPES.map((arch) => {
                const active = selectedArchetypeId === arch.id;
                return (
                  <button
                    key={arch.id}
                    type="button"
                    onClick={() => handleSelectArchetype(arch.id)}
                    className={`px-2 py-1 rounded text-[9.5px] font-mono font-bold transition-all cursor-pointer whitespace-nowrap border ${
                      active
                        ? "bg-[#C5A059]/20 border-[#C5A059]/60 text-[#E8C56A] shadow-[0_0_10px_rgba(197,160,89,0.2)]"
                        : "bg-[#07080b] border-white/10 text-slate-400 hover:border-[#C5A059]/35 hover:text-slate-200"
                    }`}
                  >
                    {arch.title.split(" (")[0]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Textarea spiegazione concetto */}
          <div>
            <label
              htmlFor="ea-concept-textarea"
              className="block font-mono text-[9.5px] uppercase tracking-wider font-bold text-slate-300 mb-1"
            >
              Spiega il Concetto o la Strategia all&apos;Automa
            </label>
            <textarea
              id="ea-concept-textarea"
              rows={compact ? 3 : 4}
              value={conceptInput}
              onChange={(e) => setConceptInput(e.target.value)}
              placeholder="Es: Entra Long quando il prezzo spazza il minimo a 20 periodi su Londra con RSI < 35, sopra EMA 50, SL sotto il minimo e R:R 1:3..."
              className="w-full rounded-lg border border-[#C5A059]/30 bg-[#07080b] p-2.5 text-xs font-mono text-slate-100 placeholder:text-slate-500 focus:border-[#C5A059] focus:outline-none leading-relaxed resize-none"
            />
          </div>

          {/* Controlli Parametrici Rapidi */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
            <div className="rounded-lg border border-white/10 bg-[#07080b] p-2">
              <span className="block font-mono text-[8.5px] uppercase text-slate-400 whitespace-nowrap">
                Target R:R
              </span>
              <div className="flex items-center gap-1 mt-1">
                {[1.5, 2.0, 2.5, 3.0].map((rr) => (
                  <button
                    key={rr}
                    type="button"
                    onClick={() => {
                      synestheticClick();
                      setStrategy((s) => ({ ...s, riskRewardTarget: rr }));
                    }}
                    className={`flex-1 py-0.5 rounded font-mono text-[9.5px] font-bold cursor-pointer whitespace-nowrap ${
                      strategy.riskRewardTarget === rr
                        ? "bg-[#C5A059] text-black"
                        : "bg-white/5 text-slate-300 hover:bg-white/10"
                    }`}
                  >
                    1:{rr}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-white/10 bg-[#07080b] p-2">
              <span className="block font-mono text-[8.5px] uppercase text-slate-400 whitespace-nowrap">
                Rischio / Trade
              </span>
              <div className="flex items-center gap-1 mt-1">
                {[0.25, 0.5, 1.0].map((rk) => (
                  <button
                    key={rk}
                    type="button"
                    onClick={() => {
                      synestheticClick();
                      setStrategy((s) => ({ ...s, riskPctPerTrade: rk }));
                    }}
                    className={`flex-1 py-0.5 rounded font-mono text-[9.5px] font-bold cursor-pointer whitespace-nowrap ${
                      strategy.riskPctPerTrade === rk
                        ? "bg-emerald-500 text-black"
                        : "bg-white/5 text-slate-300 hover:bg-white/10"
                    }`}
                  >
                    {rk}%
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-white/10 bg-[#07080b] p-2">
              <span className="block font-mono text-[8.5px] uppercase text-slate-400 whitespace-nowrap">
                Sessione
              </span>
              <select
                value={strategy.sessionFilter}
                onChange={(e) =>
                  setStrategy((s) => ({ ...s, sessionFilter: e.target.value as EaSessionFilter }))
                }
                className="w-full mt-1 bg-transparent font-mono text-[10px] font-bold text-[#E8C56A] focus:outline-none cursor-pointer"
              >
                <option value="london_ny" className="bg-[#0d0f14]">Londra + NY</option>
                <option value="london" className="bg-[#0d0f14]">Solo Londra</option>
                <option value="ny" className="bg-[#0d0f14]">Solo New York</option>
                <option value="asia" className="bg-[#0d0f14]">Solo Asia</option>
                <option value="all" className="bg-[#0d0f14]">Tutte (24h)</option>
              </select>
            </div>

            <div className="rounded-lg border border-white/10 bg-[#07080b] p-2">
              <span className="block font-mono text-[8.5px] uppercase text-slate-400 whitespace-nowrap">
                Break-Even
              </span>
              <div className="flex items-center gap-1 mt-1">
                {[
                  { label: "Off", val: null },
                  { label: "1.0R", val: 1.0 },
                  { label: "1.2R", val: 1.2 },
                ].map((opt) => (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => {
                      synestheticClick();
                      setStrategy((s) => ({ ...s, breakEvenAtR: opt.val }));
                    }}
                    className={`flex-1 py-0.5 rounded font-mono text-[9.5px] font-bold cursor-pointer whitespace-nowrap ${
                      strategy.breakEvenAtR === opt.val
                        ? "bg-[#C5A059] text-black"
                        : "bg-white/5 text-slate-300 hover:bg-white/10"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Pulsante Principale Forgia & Testa */}
          <div className="flex items-center justify-between gap-2 pt-1">
            <div className="font-mono text-[9.5px] text-slate-400 truncate">
              Trigger: <strong className="text-[#E8C56A] uppercase">{strategy.entryTrigger.replace(/_/g, " ")}</strong> · EMA <span className="whitespace-nowrap">{strategy.emaFastPeriod}/{strategy.emaSlowPeriod}</span>
            </div>
            <button
              type="button"
              onClick={handleCompileConcept}
              className="px-3.5 py-2 rounded-lg bg-gradient-to-r from-[#C5A059] to-[#E8C56A] text-[#07080b] font-mono text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-[0_0_15px_rgba(197,160,89,0.3)] hover:brightness-110 transition-all cursor-pointer whitespace-nowrap shrink-0"
            >
              <Bot className="w-4 h-4" />
              <span>Forgia &amp; Testa Bot</span>
            </button>
          </div>
        </div>
      )}

      {studioTab === "code" && (
        <div className="space-y-2.5 rounded-xl border border-[#C5A059]/25 bg-[#0B0D13]/95 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              {[
                { id: "dsl" as const, label: "AUREUS Script (Editabile)" },
                { id: "mql5" as const, label: "MetaTrader 5 (.mq5)" },
                { id: "ctrader" as const, label: "cTrader (.cs)" },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    synestheticClick();
                    setCodeTab(t.id);
                  }}
                  className={`px-2 py-1 rounded font-mono text-[9.5px] font-bold uppercase tracking-wider cursor-pointer whitespace-nowrap border ${
                    codeTab === t.id
                      ? "bg-[#C5A059]/20 border-[#C5A059]/50 text-[#E8C56A]"
                      : "bg-[#07080b] border-white/10 text-slate-400 hover:text-white"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleCopyCode}
                className="px-2 py-1 rounded border border-[#C5A059]/35 bg-[#C5A059]/10 hover:bg-[#C5A059]/20 text-[#E8C56A] font-mono text-[9.5px] font-bold uppercase flex items-center gap-1 cursor-pointer whitespace-nowrap"
              >
                {copiedCode ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedCode ? "Copiato" : "Copia"}</span>
              </button>
              <button
                type="button"
                onClick={handleDownloadCode}
                className="px-2 py-1 rounded border border-emerald-500/35 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 font-mono text-[9.5px] font-bold uppercase flex items-center gap-1 cursor-pointer whitespace-nowrap"
              >
                <Download className="w-3 h-3" />
                <span>Scarica EA</span>
              </button>
            </div>
          </div>

          <textarea
            aria-label="Editor Codice Strategia EA"
            rows={compact ? 9 : 11}
            value={activeCodeText}
            readOnly={codeTab !== "dsl"}
            onChange={(e) => {
              if (codeTab === "dsl") setDslDraft(e.target.value);
            }}
            className="w-full rounded-lg border border-white/15 bg-[#050608] p-2.5 font-mono text-[10.5px] text-emerald-300 focus:border-[#C5A059] focus:outline-none leading-relaxed resize-none scrollbar-thin"
          />

          {codeTab === "dsl" && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-mono text-slate-400">
                Modifica i parametri nel codice e premi Esegui per ricalcolare.
              </span>
              <button
                type="button"
                onClick={handleApplyDslCode}
                className="px-3 py-1.5 rounded-lg bg-[#C5A059] text-black font-mono text-[10px] font-bold uppercase tracking-wider hover:bg-[#E8C56A] cursor-pointer whitespace-nowrap"
              >
                Compila &amp; Ricalcola Da Codice
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );

  // ─── SEZIONE DESTRA: TELEMETRIA, EQUITY & CASI STUDIO ──────────────────────
  const renderTelemetryAndStudiesColumn = () => (
    <div className="flex flex-col gap-2.5 min-w-0 flex-1">
      {/* 6 KPI Monospace Cards */}
      <div className={`grid gap-2 ${compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3 xl:grid-cols-6"}`}>
        <div className="rounded-lg border border-[#C5A059]/25 bg-[#0B0D13]/90 p-2.5">
          <div className="flex items-center justify-between text-[9px] font-mono uppercase text-slate-400">
            <span>Win Rate</span>
            <TrendingUp className="w-3 h-3 text-emerald-400" />
          </div>
          <div
            className={`text-sm sm:text-base font-mono font-bold mt-0.5 whitespace-nowrap ${
              backtestResult.winRate >= 50 ? "text-emerald-400" : "text-[#E8C56A]"
            }`}
          >
            {backtestResult.winRate}%
          </div>
          <div className="text-[9px] font-mono text-slate-400 whitespace-nowrap">
            {backtestResult.wins}W · {backtestResult.losses}L · {backtestResult.breakevens}BE
          </div>
        </div>

        <div className="rounded-lg border border-[#C5A059]/25 bg-[#0B0D13]/90 p-2.5">
          <div className="flex items-center justify-between text-[9px] font-mono uppercase text-slate-400">
            <span>R:R Medio</span>
            <Target className="w-3 h-3 text-[#C5A059]" />
          </div>
          <div className="text-sm sm:text-base font-mono font-bold text-[#E8C56A] mt-0.5 whitespace-nowrap">
            1:{backtestResult.avgRealizedRR}
          </div>
          <div className="text-[9px] font-mono text-slate-400 whitespace-nowrap">
            Target 1:{backtestResult.avgTargetRR}
          </div>
        </div>

        <div className="rounded-lg border border-[#C5A059]/25 bg-[#0B0D13]/90 p-2.5">
          <div className="flex items-center justify-between text-[9px] font-mono uppercase text-slate-400">
            <span>Profit Factor</span>
            <Zap className="w-3 h-3 text-emerald-400" />
          </div>
          <div
            className={`text-sm sm:text-base font-mono font-bold mt-0.5 whitespace-nowrap ${
              backtestResult.profitFactor >= 1.4 ? "text-emerald-400" : "text-[#E8C56A]"
            }`}
          >
            PF {backtestResult.profitFactor}
          </div>
          <div className="text-[9px] font-mono text-slate-400 whitespace-nowrap">
            Exp: {backtestResult.expectancyR >= 0 ? `+${backtestResult.expectancyR}R` : `${backtestResult.expectancyR}R`}
          </div>
        </div>

        <div className="rounded-lg border border-[#C5A059]/25 bg-[#0B0D13]/90 p-2.5">
          <div className="flex items-center justify-between text-[9px] font-mono uppercase text-slate-400">
            <span>P&amp;L Netto</span>
            <BarChart3 className="w-3 h-3 text-emerald-400" />
          </div>
          <div
            className={`text-sm sm:text-base font-mono font-bold mt-0.5 whitespace-nowrap ${
              backtestResult.netProfit >= 0 ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            {backtestResult.netProfit >= 0 ? "+" : "-"}${Math.abs(backtestResult.netProfit).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </div>
          <div className="text-[9px] font-mono text-slate-400 whitespace-nowrap">
            ROI {backtestResult.netProfitPct >= 0 ? `+${backtestResult.netProfitPct}%` : `${backtestResult.netProfitPct}%`}
          </div>
        </div>

        <div className="rounded-lg border border-[#C5A059]/25 bg-[#0B0D13]/90 p-2.5">
          <div className="flex items-center justify-between text-[9px] font-mono uppercase text-slate-400">
            <span>Max Drawdown</span>
            <ShieldCheck className="w-3 h-3 text-[#C5A059]" />
          </div>
          <div
            className={`text-sm sm:text-base font-mono font-bold mt-0.5 whitespace-nowrap ${
              backtestResult.maxDrawdownPct <= 5 ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            -{backtestResult.maxDrawdownPct}%
          </div>
          <div className="text-[9px] font-mono text-slate-400 whitespace-nowrap">
            {backtestResult.maxDrawdownPct <= 5 ? "Conforme Prop 5%" : "Attenzione Prop"}
          </div>
        </div>

        <div className="rounded-lg border border-[#C5A059]/25 bg-[#0B0D13]/90 p-2.5">
          <div className="flex items-center justify-between text-[9px] font-mono uppercase text-slate-400">
            <span>Campione</span>
            <Clock className="w-3 h-3 text-slate-400" />
          </div>
          <div className="text-sm sm:text-base font-mono font-bold text-white mt-0.5 whitespace-nowrap">
            {backtestResult.totalTrades} Trade
          </div>
          <div className="text-[9px] font-mono text-slate-400 whitespace-nowrap">
            {backtestResult.candlesTested} Candele ({interval})
          </div>
        </div>
      </div>

      {/* Curva Equity & Performance per Sessione Bancaria */}
      <div className={`grid gap-2.5 ${compact ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-[1.2fr_1fr]"}`}>
        <div className="rounded-xl border border-[#C5A059]/20 bg-[#0B0D13]/90 p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1">
            <span className="font-mono text-[9.5px] font-bold uppercase tracking-wider text-[#E8C56A]">
              Traiettoria Equity Bot ($100k Base)
            </span>
            <span className="font-mono text-[9.5px] text-emerald-400 font-bold whitespace-nowrap">
              Long {backtestResult.longWinRate}% WR · Short {backtestResult.shortWinRate}% WR
            </span>
          </div>
          {equityPointsSvg ? (
            <svg viewBox="0 0 400 64" className="w-full h-14 overflow-visible">
              <polyline
                fill="none"
                stroke="#10b981"
                strokeWidth="2"
                points={equityPointsSvg}
              />
            </svg>
          ) : (
            <div className="h-14 flex items-center justify-center font-mono text-[10px] text-slate-500">
              Nessun trade generato con i filtri correnti
            </div>
          )}
        </div>

        <div className="rounded-xl border border-[#C5A059]/20 bg-[#0B0D13]/90 p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1.5">
            <span className="font-mono text-[9.5px] font-bold uppercase tracking-wider text-[#C5A059]">
              Resa per Finestra Operativa
            </span>
            {onApplyTradesToSession && backtestResult.trades.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  synestheticTrophy();
                  onApplyTradesToSession(backtestResult.trades, strategy.name);
                }}
                className="px-2 py-0.5 rounded bg-[#C5A059]/20 border border-[#C5A059]/45 text-[#E8C56A] hover:bg-[#C5A059]/30 font-mono text-[9px] font-bold uppercase tracking-wider cursor-pointer whitespace-nowrap"
              >
                Inietta {backtestResult.trades.length} Trade in Sessione
              </button>
            )}
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {backtestResult.sessionBreakdown.map((sb) => (
              <div
                key={sb.session}
                className="rounded border border-white/10 bg-[#07080b] px-2 py-1.5 text-center font-mono"
              >
                <div className="text-[8.5px] uppercase text-slate-400 font-bold whitespace-nowrap">
                  {sb.session} ({sb.total})
                </div>
                <div
                  className={`text-[11px] font-bold mt-0.5 whitespace-nowrap ${
                    sb.winRate >= 50 ? "text-emerald-400" : "text-slate-300"
                  }`}
                >
                  {sb.winRate}% WR
                </div>
                <div
                  className={`text-[9px] whitespace-nowrap ${
                    sb.netR >= 0 ? "text-[#E8C56A]" : "text-rose-400"
                  }`}
                >
                  {sb.netR >= 0 ? `+${sb.netR}R` : `${sb.netR}R`}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Galleria Casi Studio Estratti Automaticamente */}
      <div className="rounded-xl border border-[#C5A059]/30 bg-[#0B0D13]/95 p-3 space-y-2.5">
        <div className="flex items-center justify-between border-b border-white/10 pb-2">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-[#E8C56A]" />
            <strong className="font-mono text-[10.5px] uppercase tracking-wider text-white">
              Casi Studio Estratti dall&apos;Automa ({backtestResult.caseStudies.length})
            </strong>
          </div>
          <span className="font-mono text-[9px] text-slate-400 whitespace-nowrap">
            Analisi Chirurgica Setup &amp; Invalidazioni
          </span>
        </div>

        {backtestResult.caseStudies.length === 0 ? (
          <div className="p-4 text-center font-mono text-xs text-slate-400">
            Allarga il filtro sessione o riduci la severità RSI per estrarre Casi Studio su {symbol}.
          </div>
        ) : (
          <div className={`grid gap-2.5 ${compact ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2"}`}>
            {backtestResult.caseStudies.map((cs) => {
              const isWin = cs.trade.result === "win";
              const isLoss = cs.trade.result === "loss";
              const badgeStyle =
                cs.category === "textbook_gold"
                  ? "bg-[#C5A059]/20 border-[#C5A059]/50 text-[#E8C56A]"
                  : cs.category === "rapid_expansion"
                    ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                    : cs.category === "capital_shield"
                      ? "bg-sky-500/15 border-sky-500/40 text-sky-300"
                      : "bg-rose-500/15 border-rose-500/40 text-rose-300";

              const entryDateStr = new Date(cs.trade.entryTime * 1000)
                .toISOString()
                .replace("T", " ")
                .slice(0, 16);

              return (
                <div
                  key={cs.id}
                  className="rounded-lg border border-white/10 hover:border-[#C5A059]/45 bg-[#07080b]/95 p-2.5 flex flex-col justify-between gap-2 transition-all"
                >
                  <div>
                    <div className="flex items-center justify-between gap-1.5 mb-1">
                      <span
                        className={`px-1.5 py-0.5 rounded border font-mono text-[8.5px] font-bold uppercase tracking-wider whitespace-nowrap ${badgeStyle}`}
                      >
                        {cs.badge}
                      </span>
                      <span className="font-mono text-[9px] text-slate-400 whitespace-nowrap">
                        {entryDateStr} UTC
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2 mt-1">
                      <strong className="text-xs font-bold text-white truncate">
                        {cs.title}
                      </strong>
                      <span
                        className={`font-mono text-[11px] font-bold whitespace-nowrap ${
                          isWin ? "text-emerald-400" : isLoss ? "text-rose-400" : "text-[#E8C56A]"
                        }`}
                      >
                        {cs.trade.profit >= 0 ? `+$${cs.trade.profit.toFixed(0)}` : `-$${Math.abs(cs.trade.profit).toFixed(0)}`}
                      </span>
                    </div>

                    <p className="text-[10.5px] text-slate-300 mt-1 leading-snug">
                      {cs.lessonOrEdge}
                    </p>
                  </div>

                  <div className="space-y-1.5 pt-1.5 border-t border-white/10">
                    <div className="flex flex-wrap items-center justify-between gap-1 font-mono text-[9px] text-slate-400">
                      <span className="whitespace-nowrap">
                        {cs.trade.direction.toUpperCase()} @ {cs.trade.entryPrice}
                      </span>
                      <span className="whitespace-nowrap">
                        SL {cs.trade.slPips}p · TP {cs.trade.tpPips}p
                      </span>
                      <span className="whitespace-nowrap">
                        MAE {cs.trade.maeR}R · MFE +{cs.trade.mfeR}R
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[9.5px] font-mono text-[#E8C56A] truncate" title={cs.optimizationHint}>
                        💡 {cs.optimizationHint}
                      </span>
                      {onInspectCaseStudy && (
                        <button
                          type="button"
                          onClick={() => {
                            synestheticClick();
                            onInspectCaseStudy(cs);
                          }}
                          className="px-2 py-1 rounded bg-[#C5A059]/20 hover:bg-[#C5A059]/35 border border-[#C5A059]/50 text-[#E8C56A] font-mono text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                        >
                          <Crosshair className="w-3 h-3" />
                          <span>Vai al Grafico</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-3 text-foreground">
      {/* Banner Header Automa */}
      <div className="rounded-xl border border-[#C5A059]/35 bg-gradient-to-r from-[#C5A059]/15 via-[#0d0f14] to-[#0d0f14] p-2.5 sm:p-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-[#C5A059]/20 border border-[#C5A059]/50 flex items-center justify-center text-[#E8C56A] shrink-0">
            <Bot className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <strong className="text-xs sm:text-sm font-bold text-white truncate">
                L&apos;Automa della Forgia · {strategy.name}
              </strong>
              <span className="px-1.5 py-0.5 rounded bg-[#C5A059]/20 border border-[#C5A059]/45 text-[#E8C56A] font-mono text-[8.5px] font-bold uppercase tracking-wider whitespace-nowrap">
                PIANO 150€ · ATTIVO
              </span>
              {isLoadingCandles && (
                <span className="font-mono text-[9px] text-emerald-400 animate-pulse whitespace-nowrap">
                  Sincronizzazione candele...
                </span>
              )}
            </div>
            <p className="text-[10.5px] text-slate-400 truncate">
              {symbol} · {interval} — {strategy.conceptSummary}
            </p>
          </div>
        </div>

        {!has150Plan && previewUnlocked && (
          <button
            type="button"
            onClick={() => setCandidacyModalOpen(true)}
            className="px-2.5 py-1 rounded-md bg-[#C5A059] text-black font-mono text-[9.5px] font-bold uppercase tracking-wider hover:bg-[#E8C56A] cursor-pointer whitespace-nowrap"
          >
            Passa al Piano 150€/mese Ufficiale
          </button>
        )}
      </div>

      {compact ? (
        <div className="flex flex-col gap-2.5">
          {renderBuilderColumn()}
          {studioTab === "studies" && renderTelemetryAndStudiesColumn()}
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[430px_minmax(0,1fr)] gap-3 items-start">
          {renderBuilderColumn()}
          {renderTelemetryAndStudiesColumn()}
        </div>
      )}

      <LimenCandidacyModal
        isOpen={candidacyModalOpen}
        onClose={() => setCandidacyModalOpen(false)}
        defaultTierId="complete_150"
      />
    </div>
  );
}
