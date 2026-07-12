// ─── Order ticket ────────────────────────────────────────────────────────────
// Mockup panel: risk mode (% of balance vs fixed €), risk value, SL/TP in
// pips, the computed Lots / Risk € / R:R row and BUY/SELL. With an open
// position it shows the live card with P&L and "close at market (C)".
import { ArrowDown, ArrowUp, ClipboardList } from "lucide-react";
import { uiText, useLanguage } from "@/contexts/LanguageContext";
import { formatMoney, formatPrice, formatSignedMoney } from "./format";
import type { ReplayEngine } from "./useReplayEngine";

export function OrderTicket({ engine }: { engine: ReplayEngine }) {
  const { language } = useLanguage();
  const { ticket, setTicket, position } = engine;

  const numberInput = (
    value: number,
    onChange: (next: number) => void,
    tone?: "sl" | "tp",
    ariaLabel?: string,
  ) => (
    <input
      type="number"
      className="btm-input"
      data-tone={tone}
      value={Number.isFinite(value) ? value : ""}
      min={0}
      onChange={(event) => onChange(Math.max(0, Number.parseFloat(event.target.value) || 0))}
      aria-label={ariaLabel}
    />
  );

  if (position) {
    const directionColor = position.direction === "buy" ? "var(--btm-up)" : "var(--btm-dn)";
    const plColor = engine.openProfit > 0 ? "var(--btm-up)" : engine.openProfit < 0 ? "var(--btm-dn)" : "var(--btm-fg)";
    return (
      <section className="btm-section" aria-label={uiText("backtest_terminal.ticket")}>
        <h3 className="btm-section-title">
          <ClipboardList size={13} />
          {uiText("backtest_terminal.ticket")}
        </h3>
        <div className="btm-poscard" data-dir={position.direction}>
          <div className="btm-poscard-head">
            <span style={{ color: directionColor }}>
              {position.direction === "buy" ? "LONG" : "SHORT"} {position.lots.toFixed(2)} @{" "}
              {formatPrice(position.entryPrice, engine.symbol)}
            </span>
            <span style={{ color: plColor }}>
              {formatSignedMoney(engine.openProfit, language)}
            </span>
          </div>
          <div className="btm-poscard-levels">
            <span style={{ color: "var(--btm-dn)" }}>SL {formatPrice(position.stopLoss, engine.symbol)}</span>
            <span style={{ color: "var(--btm-up)" }}>TP {formatPrice(position.takeProfit, engine.symbol)}</span>
            <span style={{ color: "var(--btm-mut)" }}>
              {engine.openPips > 0 ? "+" : ""}
              {engine.openPips} pip
            </span>
          </div>
          <button type="button" className="btm-close-btn" onClick={engine.closeMarket}>
            {uiText("backtest_terminal.close_market")}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="btm-section" aria-label={uiText("backtest_terminal.ticket")}>
      <h3 className="btm-section-title">
        <ClipboardList size={13} />
        {uiText("backtest_terminal.ticket")}
      </h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
        <div className="btm-field">
          <span className="btm-field-label">{uiText("backtest_terminal.risk_per_trade")}</span>
          <div style={{ display: "flex", gap: 8 }}>
            <div className="btm-segmented" style={{ width: 110, flexShrink: 0 }}>
              <button
                type="button"
                data-active={ticket.riskMode === "percent"}
                onClick={() => setTicket({ ...ticket, riskMode: "percent" })}
              >
                %
              </button>
              <button
                type="button"
                data-active={ticket.riskMode === "fixed"}
                onClick={() => setTicket({ ...ticket, riskMode: "fixed" })}
              >
                €
              </button>
            </div>
            {numberInput(ticket.riskValue, (next) => setTicket({ ...ticket, riskValue: next }), undefined, uiText("backtest_terminal.risk_per_trade"))}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
          <div className="btm-field">
            <span className="btm-field-label" style={{ color: "var(--btm-dn)" }}>
              {uiText("backtest_terminal.stop_loss_pips")}
            </span>
            {numberInput(ticket.slPips, (next) => setTicket({ ...ticket, slPips: next }), "sl", uiText("backtest_terminal.stop_loss_pips"))}
          </div>
          <div className="btm-field">
            <span className="btm-field-label" style={{ color: "var(--btm-up)" }}>
              {uiText("backtest_terminal.take_profit_pips")}
            </span>
            {numberInput(ticket.tpPips, (next) => setTicket({ ...ticket, tpPips: next }), "tp", uiText("backtest_terminal.take_profit_pips"))}
          </div>
        </div>

        <div className="btm-computed">
          <div>
            <span className="btm-field-label">{uiText("backtest_terminal.lots")}</span>
            <strong>{engine.lots.toFixed(2)}</strong>
          </div>
          <div>
            <span className="btm-field-label">{uiText("backtest_terminal.risk")}</span>
            <strong>{formatMoney(engine.riskAmount, language)}</strong>
          </div>
          <div>
            <span className="btm-field-label">R:R</span>
            <strong>{engine.rr != null ? engine.rr.toFixed(2) : "—"}</strong>
          </div>
        </div>

        <div className="btm-buysell">
          <button type="button" className="btm-buy" onClick={engine.buy} disabled={engine.lots <= 0}>
            <ArrowUp size={15} /> BUY
          </button>
          <button type="button" className="btm-sell" onClick={engine.sell} disabled={engine.lots <= 0}>
            <ArrowDown size={15} /> SELL
          </button>
        </div>
      </div>
    </section>
  );
}
