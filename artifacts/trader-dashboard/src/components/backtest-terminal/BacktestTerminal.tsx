// ─── Backtest replay terminal shell ──────────────────────────────────────────
// Full-screen grid per the Claude Design mockup: 46px header / main (46px tool
// rail · chart column · 340px right panel) / 54px transport bar. Orchestrates
// the engine hook and the chart; the order ticket, account and journal panels
// land in the trading phase, drawings in the final phase.
import { useEffect, useRef, useState } from "react";
import { Settings2, Trash2, X } from "lucide-react";
import { uiText } from "@/contexts/LanguageContext";
import type { ClosedTrade } from "@/lib/replay/types";
import { AccountPanel } from "./AccountPanel";
import { formatPrice } from "./format";
import { HotkeysHelp } from "./HotkeysHelp";
import { IndicatorStrip } from "./IndicatorStrip";
import { JournalPanel } from "./JournalPanel";
import { OrderTicket } from "./OrderTicket";
import { ReplayChart, type ReplayChartApi } from "./ReplayChart";
import { TerminalHeader } from "./TerminalHeader";
import { TerminalSettingsDialog } from "./TerminalSettingsDialog";
import { DRAWING_TOOLS, type DrawingToolId } from "./toolRailModel";
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
  const [limitedDismissed, setLimitedDismissed] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"indicators" | "tools">("indicators");
  const [activeTool, setActiveTool] = useState<DrawingToolId>("cursor");

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
      <div className="btm-desktop-only">
        <h2>{uiText("backtest_terminal.desktop_only_title")}</h2>
        <p>{uiText("backtest_terminal.desktop_only_body")}</p>
        <button type="button" className="btm-close-btn" style={{ width: "auto", padding: "9px 18px" }} onClick={onExit}>
          {uiText("backtest_terminal.exit")}
        </button>
      </div>
      <div className="btm-desktop-shell">
      <TerminalHeader
        engine={engine}
        sessionName={sessionName}
        onExit={onExit}
        panelOpen={panelOpen}
        onTogglePanel={() => setPanelOpen((open) => !open)}
        onToggleHelp={() => setHelpOpen((open) => !open)}
        onScreenshot={() => {
          const dataUrl = chartApiRef.current?.takeScreenshot();
          if (!dataUrl) return;
          const anchor = document.createElement("a");
          anchor.href = dataUrl;
          anchor.download = `replay-${engine.symbol}-${engine.interval}.png`;
          anchor.click();
        }}
        onOpenSettings={() => {
          setSettingsTab("indicators");
          setSettingsOpen(true);
        }}
      />

      <div className="btm-main">
        <aside className="btm-rail" aria-label={uiText("backtest_terminal.tools")}>
          {DRAWING_TOOLS.filter((tool) => engine.settings.visibleTools[tool.id] !== false).map((tool) => (
            <button
              key={tool.id}
              type="button"
              className="btm-iconbtn"
              data-active={activeTool === tool.id}
              onClick={() => setActiveTool(activeTool === tool.id ? "cursor" : tool.id)}
              title={uiText(tool.labelKey)}
              aria-label={uiText(tool.labelKey)}
            >
              <tool.Icon size={16} />
            </button>
          ))}
          <div className="btm-rail-sep" aria-hidden="true" />
          <button
            type="button"
            className="btm-iconbtn"
            onClick={() => {
              setSettingsTab("tools");
              setSettingsOpen(true);
            }}
            title={uiText("backtest_terminal.tools_tab")}
            aria-label={uiText("backtest_terminal.tools_tab")}
          >
            <Settings2 size={15} />
          </button>
          <button
            type="button"
            className="btm-iconbtn"
            onClick={() => engine.setDrawings([])}
            title={uiText("backtest_terminal.clear_drawings")}
            aria-label={uiText("backtest_terminal.clear_drawings")}
          >
            <Trash2 size={15} />
          </button>
        </aside>

        <div className="btm-chartcol">
          <IndicatorStrip engine={engine} onOpenSettings={() => setSettingsOpen(true)} />
          <div className="btm-chartwrap">
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
              engine={engine}
              apiRef={chartApiRef}
              activeTool={activeTool}
              onToolDone={() => setActiveTool("cursor")}
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
              </div>
            )}
            {engine.noData && !engine.loading && !engine.error && (
              <div className="btm-center">
                <span>{uiText("backtest_terminal.no_data")}</span>
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
              <TerminalSettingsDialog engine={engine} initialTab={settingsTab} onClose={() => setSettingsOpen(false)} />
            )}
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
    </div>
  );
}
