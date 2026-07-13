// ─── Order ticket ────────────────────────────────────────────────────────────
// Mockup panel: risk mode (% of balance vs fixed €), risk value, SL/TP in
// pips, the computed Lots / Risk € / R:R row and BUY/SELL. With an open
// position it shows the live card with P&L and "close at market (C)".
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ClipboardList, Save } from "lucide-react";
import { uiText, useLanguage } from "@/contexts/LanguageContext";
import {
  createTicketProfilesStorageKey,
  parseTicketProfiles,
  serializeTicketProfiles,
  type TerminalTicket,
} from "@/lib/replay/terminalPersistence";
import { formatMoney, formatPrice, formatSignedMoney } from "./format";
import type { ReplayEngine } from "./useReplayEngine";

function readProfiles(): Record<string, TerminalTicket> {
  try {
    return parseTicketProfiles(window.localStorage.getItem(createTicketProfilesStorageKey()));
  } catch {
    return {};
  }
}

function writeProfiles(profiles: Record<string, TerminalTicket>): void {
  try {
    window.localStorage.setItem(createTicketProfilesStorageKey(), serializeTicketProfiles(profiles));
  } catch {
    /* storage unavailable: profiles stay in-memory for the session */
  }
}

/** Named ticket presets (Scalper / Swing …): apply with one click, saved globally. */
function TicketProfiles({ engine }: { engine: ReplayEngine }) {
  const [profiles, setProfiles] = useState<Record<string, TerminalTicket>>(() => readProfiles());
  const [name, setName] = useState("");
  const names = useMemo(() => Object.keys(profiles).sort(), [profiles]);

  const saveCurrent = () => {
    const trimmed = name.trim();
    if (trimmed === "") return;
    const next = { ...profiles, [trimmed]: engine.ticket };
    setProfiles(next);
    writeProfiles(next);
    setName("");
  };

  return (
    <div className="btm-field">
      <span className="btm-field-label">{uiText("backtest_terminal.profiles")}</span>
      {names.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {names.map((profileName) => (
            <button
              key={profileName}
              type="button"
              className="btm-indchip"
              data-on="false"
              onClick={() => engine.setTicket({ ...profiles[profileName] })}
              title={uiText("backtest_terminal.profile_apply")}
            >
              {profileName}
            </button>
          ))}
        </div>
      )}
      <div style={{ display: "flex", gap: 6 }}>
        <input
          className="btm-input"
          value={name}
          placeholder={uiText("backtest_terminal.profile_name")}
          onChange={(event) => setName(event.target.value)}
          aria-label={uiText("backtest_terminal.profile_name")}
        />
        <button
          type="button"
          className="btm-transport-btn"
          style={{ flexShrink: 0 }}
          onClick={saveCurrent}
          disabled={name.trim() === ""}
          title={uiText("backtest_terminal.profile_save")}
          aria-label={uiText("backtest_terminal.profile_save")}
        >
          <Save size={14} />
        </button>
      </div>
    </div>
  );
}

export function OrderTicket({ engine }: { engine: ReplayEngine }) {
  const { language } = useLanguage();
  const { ticket, setTicket, position, pendingOrder } = engine;
  const [pendingMode, setPendingMode] = useState(false);
  const [orderPrice, setOrderPrice] = useState("");

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

  if (pendingOrder) {
    const directionColor = pendingOrder.direction === "buy" ? "var(--btm-up)" : "var(--btm-dn)";
    return (
      <section className="btm-section" aria-label={uiText("backtest_terminal.ticket")}>
        <h3 className="btm-section-title">
          <ClipboardList size={13} />
          {uiText("backtest_terminal.ticket")}
        </h3>
        <div className="btm-poscard" data-dir={pendingOrder.direction}>
          <div className="btm-poscard-head">
            <span style={{ color: directionColor }}>
              {pendingOrder.direction === "buy" ? "BUY" : "SELL"} {pendingOrder.kind.toUpperCase()} {pendingOrder.lots.toFixed(2)}
            </span>
            <span style={{ color: "var(--btm-mut)", fontFamily: "var(--btm-mono)" }}>
              @ {formatPrice(pendingOrder.price, engine.symbol)}
            </span>
          </div>
          <div className="btm-poscard-levels">
            <span style={{ color: "var(--btm-mut)" }}>{uiText("backtest_terminal.pending_waiting")}</span>
          </div>
          <button type="button" className="btm-close-btn" onClick={engine.cancelOrder}>
            {uiText("backtest_terminal.cancel_order")}
          </button>
        </div>
      </section>
    );
  }

  const parsedPrice = Number.parseFloat(orderPrice);
  const canPlace = pendingMode && Number.isFinite(parsedPrice) && parsedPrice > 0 && engine.lots > 0;
  const submit = (direction: "buy" | "sell") => {
    if (pendingMode) {
      if (canPlace) {
        engine.placeOrder(direction, parsedPrice);
        setOrderPrice("");
      }
      return;
    }
    if (direction === "buy") engine.buy();
    else engine.sell();
  };

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

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
          <div className="btm-field">
            <span className="btm-field-label">{uiText("backtest_terminal.be_trigger")}</span>
            {numberInput(ticket.breakevenAtR ?? 0, (next) => setTicket({ ...ticket, breakevenAtR: next > 0 ? next : null }), undefined, uiText("backtest_terminal.be_trigger"))}
          </div>
          <div className="btm-field">
            <span className="btm-field-label">{uiText("backtest_terminal.trailing_pips")}</span>
            {numberInput(ticket.trailingPips ?? 0, (next) => setTicket({ ...ticket, trailingPips: next > 0 ? next : null }), undefined, uiText("backtest_terminal.trailing_pips"))}
          </div>
        </div>

        <div className="btm-field">
          <span className="btm-field-label">{uiText("backtest_terminal.order_type")}</span>
          <div style={{ display: "flex", gap: 8 }}>
            <div className="btm-segmented" style={{ flex: 1 }}>
              <button type="button" data-active={!pendingMode} onClick={() => setPendingMode(false)}>
                {uiText("backtest_terminal.order_market")}
              </button>
              <button type="button" data-active={pendingMode} onClick={() => setPendingMode(true)}>
                {uiText("backtest_terminal.order_pending")}
              </button>
            </div>
            {pendingMode && (
              <input
                type="number"
                className="btm-input"
                style={{ width: 100 }}
                value={orderPrice}
                placeholder={uiText("backtest_terminal.order_price")}
                onChange={(event) => setOrderPrice(event.target.value)}
                aria-label={uiText("backtest_terminal.order_price")}
              />
            )}
          </div>
        </div>

        <TicketProfiles engine={engine} />

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

        {engine.lots <= 0 && (
          <p style={{ margin: 0, fontSize: 10.5, color: "var(--btm-mut)", textAlign: "center" }}>
            {uiText("backtest_terminal.size_hint")}
          </p>
        )}

        <div className="btm-buysell">
          <button
            type="button"
            className="btm-buy"
            onClick={() => submit("buy")}
            disabled={engine.lots <= 0 || (pendingMode && !canPlace)}
          >
            <ArrowUp size={15} /> BUY
          </button>
          <button
            type="button"
            className="btm-sell"
            onClick={() => submit("sell")}
            disabled={engine.lots <= 0 || (pendingMode && !canPlace)}
          >
            <ArrowDown size={15} /> SELL
          </button>
        </div>
      </div>
    </section>
  );
}
