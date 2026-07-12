// ─── Backtest replay terminal shell ──────────────────────────────────────────
// Full-screen grid per the Claude Design mockup: 46px header / main (46px tool
// rail · chart column · 340px right panel) / 54px transport bar. Orchestrates
// the engine hook and the chart; the order ticket, account and journal panels
// land in the trading phase, drawings in the final phase.
import { useRef, useState } from "react";
import { Crosshair } from "lucide-react";
import { uiText } from "@/contexts/LanguageContext";
import type { ClosedTrade } from "@/lib/replay/types";
import { HotkeysHelp } from "./HotkeysHelp";
import { ReplayChart, type ReplayChartApi } from "./ReplayChart";
import { TerminalHeader } from "./TerminalHeader";
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
}: BacktestTerminalProps) {
  const engine = useReplayEngine({ sessionKey, symbol, initialInterval });
  const chartApiRef = useRef<ReplayChartApi | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [helpOpen, setHelpOpen] = useState(false);

  useReplayHotkeys(engine, {
    enabled: !helpOpen,
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
          </div>
        </div>

        {panelOpen && (
          <aside className="btm-panel" aria-label={uiText("backtest_terminal.panel")}>
            <div className="btm-center" style={{ position: "static", flex: 1 }}>
              <span>{uiText("backtest_terminal.journal_empty")}</span>
            </div>
          </aside>
        )}
      </div>

      <TransportBar engine={engine} />
    </div>
  );
}
