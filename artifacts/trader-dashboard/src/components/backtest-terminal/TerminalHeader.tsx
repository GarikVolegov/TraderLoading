// ─── Terminal header ─────────────────────────────────────────────────────────
// Mockup layout: back/logo + badge, session symbol, timeframe tabs, account
// chips (Saldo/Equity/P&L/DD) and the panel/help toggles on the right.
import { PencilRuler, ArrowLeft, Camera, Eye, EyeOff, Keyboard, PanelRight, Settings2, Flame, Users, Clock, Sparkles, Loader2 } from "lucide-react";
import { uiText, useLanguage } from "@/contexts/LanguageContext";
import { formatMoney, formatPercent, formatSignedMoney } from "./format";
import { CoverageStatus } from "./CoverageStatus";
import { REPLAY_TIMEFRAMES, type ReplayEngine } from "./useReplayEngine";

export function TerminalHeader({
  engine,
  sessionName,
  onExit,
  panelOpen,
  toolsOpen,
  onToggleTools,
  onTogglePanel,
  onToggleHelp,
  onOpenSettings,
  onScreenshot,
  isBattle,
  onFinishBattle,
  connectedCount,
  onToggleTelemetry,
  telemetryOpen,
  matchSecondsRemaining,
  onScanAi,
  isAiScanning,
  hasAiSetup,
  aiScore,
}: {
  engine: ReplayEngine;
  sessionName: string;
  onExit: () => void;
  panelOpen: boolean;
  toolsOpen: boolean;
  onToggleTools: () => void;
  onTogglePanel: () => void;
  onToggleHelp: () => void;
  onOpenSettings: () => void;
  onScreenshot: () => void;
  isBattle?: boolean;
  onFinishBattle?: () => void;
  connectedCount?: number;
  onToggleTelemetry?: () => void;
  telemetryOpen?: boolean;
  matchSecondsRemaining?: number | null;
  onScanAi?: () => void;
  isAiScanning?: boolean;
  hasAiSetup?: boolean;
  aiScore?: number;
}) {
  const { language } = useLanguage();
  const { account, openProfit } = engine;

  const chip = (label: string, value: string, color?: string) => (
    <div className="btm-chip">
      <span className="btm-chip-label">{label}</span>
      <span className="btm-chip-value" style={color ? { color } : undefined}>{value}</span>
    </div>
  );

  const plColor = openProfit > 0 ? "var(--btm-up)" : openProfit < 0 ? "var(--btm-dn)" : undefined;
  const ddColor = account.maxDrawdownPct > 0 ? "var(--btm-dn)" : undefined;

  return (
    <header className="btm-header">
      <button
        type="button"
        className="btm-iconbtn"
        onClick={onExit}
        title={uiText("backtest_terminal.exit")}
        aria-label={uiText("backtest_terminal.exit")}
      >
        <ArrowLeft size={16} />
      </button>
      <div className="btm-symbol" title={sessionName}>
        <span>{engine.symbol}</span>
        <span className={`btm-badge ${isBattle ? "btm-badge-battle" : ""}`}>
          {isBattle ? uiText("backtest_terminal.battle_badge") : uiText("backtest_terminal.badge")}
        </span>
      </div>

      <div className="btm-tfgroup" role="tablist" aria-label={uiText("backtest_terminal.timeframe")}>
        {REPLAY_TIMEFRAMES.map((timeframe) => (
          <button
            key={timeframe}
            type="button"
            role="tab"
            aria-selected={engine.interval === timeframe}
            className="btm-tfbtn"
            data-active={engine.interval === timeframe}
            onClick={() => engine.changeInterval(timeframe)}
          >
            {({ M1: "1m", M5: "5m", M15: "15m", M30: "30m", H1: "1h", H4: "4h", D1: "1D", W1: "1W" } as Record<string, string>)[timeframe]}
          </button>
        ))}
      </div>

      <CoverageStatus engine={engine} />

      <div className="btm-chips">
        {isBattle && matchSecondsRemaining != null && (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              padding: "4px 8px",
              borderRadius: 6,
              background: matchSecondsRemaining < 60 ? "rgba(239, 68, 68, 0.2)" : "rgba(197, 160, 89, 0.15)",
              border: `1px solid ${matchSecondsRemaining < 60 ? "rgba(239, 68, 68, 0.6)" : "rgba(197, 160, 89, 0.45)"}`,
              fontFamily: "ui-monospace, monospace",
              fontSize: 10,
              fontWeight: 800,
              color: matchSecondsRemaining < 60 ? "#EF4444" : "#D4AF37",
              letterSpacing: "0.06em",
              whiteSpace: "nowrap",
            }}
            title={uiText("backtest_terminal.battle_timer_title")}
          >
            <Clock size={11} className={matchSecondsRemaining < 60 ? "animate-pulse" : ""} />
            <span>
              {Math.floor(matchSecondsRemaining / 60)
                .toString()
                .padStart(2, "0")}
              :{(matchSecondsRemaining % 60).toString().padStart(2, "0")}
            </span>
          </div>
        )}
        {isBattle && onFinishBattle && (
          <button
            type="button"
            onClick={onFinishBattle}
            className="btm-battle-finish-btn"
            title={uiText("backtest_terminal.battle_seal_title")}
          >
            <Flame size={13} className="text-[#ff7761] animate-pulse" />
            <span>{uiText("backtest_terminal.battle_seal")}</span>
          </button>
        )}
        {isBattle && onToggleTelemetry && (
          <button
            type="button"
            onClick={onToggleTelemetry}
            className="btm-battle-telemetry-btn"
            data-active={telemetryOpen}
            title={uiText("backtest_terminal.battle_telemetry_title")}
          >
            <Users size={12} className="text-[#D4AF37]" />
            <span>{connectedCount ?? 4} TRADER</span>
          </button>
        )}
        <button type="button" className="btm-iconbtn btm-mobile-tools-toggle" onClick={onToggleTools} aria-expanded={toolsOpen} aria-controls="replay-drawing-tools" aria-label={uiText("backtest_terminal.tools")} data-active={toolsOpen}><PencilRuler size={18} /></button>
        {chip(uiText("backtest_terminal.balance"), formatMoney(account.balance, language))}
        {chip(uiText("backtest_terminal.equity"), formatMoney(account.equity, language))}
        {chip(uiText("backtest_terminal.pl"), formatSignedMoney(openProfit, language), plColor)}
        {chip(uiText("backtest_terminal.dd"), formatPercent(-account.maxDrawdownPct), ddColor)}
        <button
          type="button"
          className="btm-iconbtn"
          data-active={engine.settings.showTradesOnChart !== false}
          onClick={() =>
            engine.setSettings({
              ...engine.settings,
              showTradesOnChart: engine.settings.showTradesOnChart === false,
            })
          }
          title={uiText("backtest_terminal.toggle_trades_on_chart")}
          aria-label={uiText("backtest_terminal.toggle_trades_on_chart")}
        >
          {engine.settings.showTradesOnChart !== false ? <Eye size={16} /> : <EyeOff size={16} />}
        </button>
        <button
          type="button"
          className="btm-iconbtn"
          data-active={panelOpen}
          aria-expanded={panelOpen}
          onClick={onTogglePanel}
          title={uiText("backtest_terminal.toggle_panel")}
          aria-label={uiText("backtest_terminal.toggle_panel")}
        >
          <PanelRight size={16} />
        </button>
        <button
          type="button"
          className="btm-iconbtn"
          onClick={onOpenSettings}
          title={uiText("backtest_terminal.settings")}
          aria-label={uiText("backtest_terminal.settings")}
        >
          <Settings2 size={16} />
        </button>
        {/* IA Sentinel Button */}
        {onScanAi && (
          <button
            type="button"
            className="btm-iconbtn"
            style={{
              width: "auto",
              padding: "0 8px",
              gap: 5,
              borderColor: hasAiSetup ? "rgba(197, 160, 89, 0.5)" : undefined,
              background: hasAiSetup ? "rgba(197, 160, 89, 0.15)" : undefined,
              color: hasAiSetup ? "#C5A059" : undefined,
            }}
            onClick={onScanAi}
            disabled={isAiScanning}
            title="Analisi Visiva IA: scansione barra storica e checklist"
          >
            {isAiScanning ? (
              <>
                <Loader2 size={14} className="animate-spin text-[#C5A059]" />
                <span style={{ fontSize: 11, fontFamily: "monospace" }}>Analisi...</span>
              </>
            ) : (
              <>
                <Sparkles size={14} className="text-[#C5A059]" />
                <span style={{ fontSize: 11, fontFamily: "monospace", fontWeight: 600 }}>
                  IA Sentinel {hasAiSetup && aiScore ? `(${aiScore}%)` : ""}
                </span>
              </>
            )}
          </button>
        )}

        <button
          type="button"
          className="btm-iconbtn"
          onClick={onScreenshot}
          title={uiText("backtest_terminal.screenshot")}
          aria-label={uiText("backtest_terminal.screenshot")}
        >
          <Camera size={16} />
        </button>
        <button
          type="button"
          className="btm-iconbtn"
          onClick={onToggleHelp}
          title={uiText("backtest_terminal.hotkeys")}
          aria-label={uiText("backtest_terminal.hotkeys")}
        >
          <Keyboard size={16} />
        </button>
      </div>
    </header>
  );
}
