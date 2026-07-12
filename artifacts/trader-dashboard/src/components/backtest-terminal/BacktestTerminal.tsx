// ─── Backtest replay terminal shell ──────────────────────────────────────────
// Full-screen grid per the Claude Design mockup: 46px header / main (46px tool
// rail · chart column · 340px right panel) / 54px transport bar. Orchestrates
// the engine hook and the chart; the order ticket, account and journal panels
// land in the trading phase, drawings in the final phase.
import { useEffect, useRef, useState } from "react";
import { Crosshair } from "lucide-react";
import { uiText } from "@/contexts/LanguageContext";
import type { ClosedTrade } from "@/lib/replay/types";
import { AccountPanel } from "./AccountPanel";
import { HotkeysHelp } from "./HotkeysHelp";
import { IndicatorStrip } from "./IndicatorStrip";
import { JournalPanel } from "./JournalPanel";
import { OrderTicket } from "./OrderTicket";
import { ReplayChart, type ReplayChartApi } from "./ReplayChart";
import { TerminalHeader } from "./TerminalHeader";
import { TerminalSettingsDialog } from "./TerminalSettingsDialog";
import { TransportBar } from "./TransportBar";
import { useReplayEngine } from "./useReplayEngine";
import { useReplayHotkeys } from "./useReplayHotkeys";
import "./terminal.css";

export interface BacktestTerminalProps {
  sessionKey: string;
  sessionName: string;
  symbol: string;
  initialInterval: string;
  onExit: () => void;
  /** Called whenever a trade closes (the page persists them to the API). */
  onTradeClosed?: (trade: ClosedTrade) => void;
}

export function BacktestTerminal({
  sessionKey,
  sessionName,
  symbol,
  initialInterval,
  onExit,
  onTradeClosed,
}: BacktestTerminalProps) {
  const engine = useReplayEngine({ sessionKey, symbol, initialInterval });
  const chartApiRef = useRef<ReplayChartApi | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [helpOpen, setHelpOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Notify the page of newly closed trades (it persists them, deduped).
  const notifiedIdsRef = useRef<Set<number>>(new Set());
  useEffect(() => {
    if (!onTradeClosed) return;
    for (const trade of engine.trades) {
      if (notifiedIdsRef.current.has(trade.id)) continue;
      notifiedIdsRef.current.add(trade.id);
      onTradeClosed(trade);
    }
  }, [engine.trades, onTradeClosed]);

  useReplayHotkeys(engine, {
    enabled: !helpOpen && !settingsOpen,
    zoomIn: () => chartApiRef.current?.zoomIn(),
    zoomOut: () => chartApiRef.current?.zoomOut(),
  });

  const limitedHistory = engine.meta != null && engine.meta.warehouse == null;

  return (
    <div className="btm-root" data-testid="backtest-terminal">
      <TerminalHeader
        engine={engine}
        sessionName={sessionName}
        onExit={onExit}
        panelOpen={panelOpen}
        onTogglePanel={() => setPanelOpen((open) => !open)}
        onToggleHelp={() => setHelpOpen((open) => !open)}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <div className="btm-main">
        <aside className="btm-rail" aria-label={uiText("backtest_terminal.tools")}>
          <button
            type="button"
            className="btm-iconbtn"
            data-active="true"
            title={uiText("backtest_terminal.tool_cursor")}
            aria-label={uiText("backtest_terminal.tool_cursor")}
          >
            <Crosshair size={16} />
          </button>
        </aside>

        <div className="btm-chartcol">
          <IndicatorStrip engine={engine} onOpenSettings={() => setSettingsOpen(true)} />
          <div className="btm-chartwrap">
            {limitedHistory && !engine.loading && !engine.error && (
              <div className="btm-notice">{uiText("backtest_terminal.limited_history")}</div>
            )}
            <ReplayChart engine={engine} apiRef={chartApiRef} />
            {engine.loading && (
              <div className="btm-center">
                <div className="btm-spin" aria-hidden="true" />
                <span>{uiText("backtest_terminal.loading")}</span>
              </div>
            )}
            {engine.error && !engine.loading && (
              <div className="btm-center">
                <span>{engine.error}</span>
              </div>
            )}
            {helpOpen && <HotkeysHelp onClose={() => setHelpOpen(false)} />}
            {settingsOpen && <TerminalSettingsDialog engine={engine} onClose={() => setSettingsOpen(false)} />}
          </div>
        </div>

        {panelOpen && (
          <aside className="btm-panel" aria-label={uiText("backtest_terminal.panel")}>
            <OrderTicket engine={engine} />
            <AccountPanel engine={engine} />
            <JournalPanel engine={engine} />
          </aside>
        )}
      </div>

      <TransportBar engine={engine} />
    </div>
  );
}
