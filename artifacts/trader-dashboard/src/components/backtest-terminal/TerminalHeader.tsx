// ─── Terminal header ─────────────────────────────────────────────────────────
// Mockup layout: back/logo + badge, session symbol, timeframe tabs, account
// chips (Saldo/Equity/P&L/DD) and the panel/help toggles on the right.
import { ArrowLeft, Camera, Keyboard, PanelRight, Settings2 } from "lucide-react";
import { uiText, useLanguage } from "@/contexts/LanguageContext";
import { formatMoney, formatPercent, formatSignedMoney } from "./format";
import { REPLAY_TIMEFRAMES, type ReplayEngine } from "./useReplayEngine";

export function TerminalHeader({
  engine,
  sessionName,
  onExit,
  panelOpen,
  onTogglePanel,
  onToggleHelp,
  onOpenSettings,
  onScreenshot,
}: {
  engine: ReplayEngine;
  sessionName: string;
  onExit: () => void;
  panelOpen: boolean;
  onTogglePanel: () => void;
  onToggleHelp: () => void;
  onOpenSettings: () => void;
  onScreenshot: () => void;
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
      <div className="btm-logo">
        <span>{sessionName}</span>
        <span className="btm-badge">{uiText("backtest_terminal.badge")}</span>
      </div>

      <div className="btm-symbol">{engine.symbol}</div>

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
            {timeframe}
          </button>
        ))}
      </div>

      <div className="btm-chips">
        {chip(uiText("backtest_terminal.balance"), formatMoney(account.balance, language))}
        {chip(uiText("backtest_terminal.equity"), formatMoney(account.equity, language))}
        {chip(uiText("backtest_terminal.pl"), formatSignedMoney(openProfit, language), plColor)}
        {chip(uiText("backtest_terminal.dd"), formatPercent(-account.maxDrawdownPct), ddColor)}
        <button
          type="button"
          className="btm-iconbtn"
          data-active={panelOpen}
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
