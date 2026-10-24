// ─── Order ticket ────────────────────────────────────────────────────────────
// Multi-position order ticket & active position management drawer:
// - Always-available order entry form for market & pending executions.
// - Dynamic risk adaptation toggle (ticket.adaptRiskOnSlMove).
// - Interactive chart price-picker.
// - R:R preset ratio quick chips (1:1, 1:2, 1:3, 1:5).
// - Active positions list with individual P&L, BE buttons, 25%/50%/75% partials,
//   and bulk "Tutte a BE" / "Chiudi tutte" operations.
// - Pending orders list with cancel controls.
import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ClipboardList, Crosshair, Layers, Save, X } from "lucide-react";
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
function TicketProfiles({ engine, name, onNameChange }: { engine: ReplayEngine; name: string; onNameChange: (name: string) => void }) {
  const [profiles, setProfiles] = useState<Record<string, TerminalTicket>>(() => readProfiles());
  const names = useMemo(() => Object.keys(profiles).sort(), [profiles]);

  const saveCurrent = () => {
    const trimmed = name.trim();
    if (trimmed === "") return;
    const next = { ...profiles, [trimmed]: engine.ticket };
    setProfiles(next);
    writeProfiles(next);
    onNameChange("");
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
          onChange={(event) => onNameChange(event.target.value)}
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

export interface OrderTicketDraft {
  pendingMode: boolean;
  orderPrice: string;
  profileName: string;
}

export function OrderTicket({
  engine,
  draft,
  onDraftChange,
}: {
  engine: ReplayEngine;
  draft: OrderTicketDraft;
  onDraftChange: (patch: Partial<OrderTicketDraft>) => void;
}) {
  const { language } = useLanguage();
  const { ticket, setTicket, positions, pendingOrders, currentPrice } = engine;
  const { pendingMode, orderPrice } = draft;
  const setPendingMode = (mode: boolean) => {
    if (mode && (!orderPrice || Number.parseFloat(orderPrice) <= 0) && currentPrice > 0) {
      onDraftChange({ pendingMode: true, orderPrice: formatPrice(currentPrice, engine.symbol) });
    } else {
      onDraftChange({ pendingMode: mode });
    }
  };
  const setOrderPrice = (orderPrice: string) => onDraftChange({ orderPrice });

  useEffect(() => {
    if (engine.pickedPrice != null) {
      onDraftChange({ pendingMode: true, orderPrice: formatPrice(engine.pickedPrice, engine.symbol) });
      engine.setPickedPrice?.(null);
    }
  }, [engine.pickedPrice, engine.symbol, onDraftChange]);

  const unavailable = engine.loading || engine.executing || engine.noData || Boolean(engine.error);
  const oil = engine.symbol === "USOIL";
  const slLabel = uiText(oil ? "backtest_terminal.stop_loss_ticks" : "backtest_terminal.stop_loss_pips");
  const tpLabel = uiText(oil ? "backtest_terminal.take_profit_ticks" : "backtest_terminal.take_profit_pips");

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

  const applyRrPreset = (ratio: number) => {
    const sl = ticket.slPips > 0 ? ticket.slPips : 25;
    setTicket({ ...ticket, tpPips: Math.round(sl * ratio * 10) / 10 });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* ── Active Positions List (if any) ─────────────────────────── */}
      {positions.length > 0 && (
        <section className="btm-section" aria-label={uiText("backtest_terminal.active_positions")}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <h3 className="btm-section-title" style={{ margin: 0 }}>
              <Layers size={13} />
              {`${uiText("backtest_terminal.active_positions")} (${positions.length})`}
            </h3>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                type="button"
                className="btm-indchip"
                data-on="false"
                style={{ fontSize: 9.5, padding: "2px 6px" }}
                onClick={engine.moveAllToBreakeven}
                title={uiText("backtest_terminal.move_all_be")}
              >
                {uiText("backtest_terminal.move_all_be")}
              </button>
              <button
                type="button"
                className="btm-indchip"
                data-on="false"
                style={{ fontSize: 9.5, padding: "2px 6px", color: "var(--btm-dn)" }}
                onClick={engine.closeAllPositions}
                title={uiText("backtest_terminal.close_all")}
              >
                {uiText("backtest_terminal.close_all")}
              </button>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {positions.map((pos, index) => {
              const posId = pos.id ?? `pos-${index}`;
              const directionColor = pos.direction === "buy" ? "var(--btm-up)" : "var(--btm-dn)";
              const posProfit = currentPrice > 0 ? (pos.direction === "buy" ? (currentPrice - pos.entryPrice) : (pos.entryPrice - currentPrice)) * pos.lots * 100000 : 0;
              const plColor = posProfit > 0 ? "var(--btm-up)" : posProfit < 0 ? "var(--btm-dn)" : "var(--btm-fg)";
              const isSelected = engine.selectedPositionId === posId;

              return (
                <div
                  key={posId}
                  className="btm-poscard"
                  data-dir={pos.direction}
                  style={{
                    borderColor: isSelected ? "hsl(217 91% 60% / 0.6)" : undefined,
                    boxShadow: isSelected ? "0 0 0 1px hsl(217 91% 60% / 0.3)" : undefined,
                  }}
                  onClick={() => engine.setSelectedPositionId?.(posId)}
                >
                  <div className="btm-poscard-head">
                    <span style={{ color: directionColor, fontWeight: 700 }}>
                      {`${pos.direction === "buy" ? "LONG" : "SHORT"} ${pos.lots.toFixed(2)} @ ${formatPrice(pos.entryPrice, engine.symbol)}`}
                    </span>
                    <span style={{ color: plColor, fontWeight: 700, fontFamily: "var(--btm-mono)" }}>
                      {formatSignedMoney(posProfit, language)}
                    </span>
                  </div>

                  <div className="btm-poscard-levels" style={{ fontSize: 10 }}>
                    <span style={{ color: "var(--btm-dn)" }}>SL {formatPrice(pos.stopLoss, engine.symbol)}</span>
                    <span style={{ color: "var(--btm-up)" }}>TP {formatPrice(pos.takeProfit, engine.symbol)}</span>
                    {pos.realizedPartialProfit != null && pos.realizedPartialProfit > 0 && (
                      <span style={{ color: "var(--btm-up)" }}>
                        {`${uiText("backtest_terminal.partial_badge")}: +${pos.realizedPartialProfit.toFixed(2)}€`}
                      </span>
                    )}
                  </div>

                  {/* Partial Close & Quick Action buttons */}
                  <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
                    <button
                      type="button"
                      className="btm-indchip"
                      data-on="false"
                      style={{ fontSize: 9.5, padding: "2px 6px" }}
                      onClick={(e) => {
                        e.stopPropagation();
                        engine.moveToBreakeven(posId);
                      }}
                      title={uiText("backtest_terminal.move_all_be")}
                    >
                      BE
                    </button>
                    <button
                      type="button"
                      className="btm-indchip"
                      data-on="false"
                      style={{ fontSize: 9.5, padding: "2px 6px" }}
                      onClick={(e) => {
                        e.stopPropagation();
                        engine.partialClose(posId, 0.25);
                      }}
                      title={uiText("backtest_terminal.partial_25")}
                    >
                      25%
                    </button>
                    <button
                      type="button"
                      className="btm-indchip"
                      data-on="false"
                      style={{ fontSize: 9.5, padding: "2px 6px" }}
                      onClick={(e) => {
                        e.stopPropagation();
                        engine.partialClose(posId, 0.5);
                      }}
                      title={uiText("backtest_terminal.partial_50")}
                    >
                      50%
                    </button>
                    <button
                      type="button"
                      className="btm-indchip"
                      data-on="false"
                      style={{ fontSize: 9.5, padding: "2px 6px" }}
                      onClick={(e) => {
                        e.stopPropagation();
                        engine.partialClose(posId, 0.5, true);
                      }}
                      title={uiText("backtest_terminal.partial_50_be")}
                    >
                      50%+BE
                    </button>
                    <button
                      type="button"
                      className="btm-close-btn"
                      style={{ marginLeft: "auto", padding: "2px 8px", height: 22, fontSize: 10 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        engine.closePositionById(posId);
                      }}
                      disabled={unavailable}
                    >
                      <X size={11} style={{ marginRight: 2 }} />
                      {uiText("backtest_terminal.close_market")}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Pending Orders List (if any) ───────────────────────────── */}
      {pendingOrders.length > 0 && (
        <section className="btm-section" aria-label={uiText("backtest_terminal.pending_orders")}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <h3 className="btm-section-title" style={{ margin: 0 }}>
              <ClipboardList size={13} />
              {`${uiText("backtest_terminal.pending_orders")} (${pendingOrders.length})`}
            </h3>
            <button
              type="button"
              className="btm-indchip"
              data-on="false"
              style={{ fontSize: 9.5, padding: "2px 6px", color: "var(--btm-dn)" }}
              onClick={engine.cancelAllOrders}
              title={uiText("backtest_terminal.cancel_all_orders")}
            >
              {uiText("backtest_terminal.cancel_all_orders")}
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {pendingOrders.map((order) => {
              const directionColor = order.direction === "buy" ? "var(--btm-up)" : "var(--btm-dn)";
              return (
                <div key={order.id} className="btm-poscard" data-dir={order.direction}>
                  <div className="btm-poscard-head">
                    <span style={{ color: directionColor, fontWeight: 700 }}>
                      {`${order.direction.toUpperCase()} ${order.kind.toUpperCase()} ${order.lots.toFixed(2)}`}
                    </span>
                    <span style={{ color: "var(--btm-mut)", fontFamily: "var(--btm-mono)" }}>
                      @ {formatPrice(order.price, engine.symbol)}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btm-close-btn"
                    style={{ marginTop: 4, height: 22, fontSize: 10 }}
                    onClick={() => engine.cancelOrder(order.id ?? "")}
                    disabled={engine.executing}
                  >
                    {uiText("backtest_terminal.cancel_order")}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Order Entry Ticket (Always Available) ──────────────────── */}
      <section className="btm-section" aria-label={uiText("backtest_terminal.ticket")}>
        <h3 className="btm-section-title">
          <ClipboardList size={13} />
          {uiText("backtest_terminal.ticket")}
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
          {/* Order Type: Market vs Pending */}
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
                <div style={{ display: "flex", gap: 4 }}>
                  <input
                    type="number"
                    className="btm-input"
                    style={{ width: 100 }}
                    value={orderPrice}
                    placeholder={uiText("backtest_terminal.order_price")}
                    onChange={(event) => setOrderPrice(event.target.value)}
                    aria-label={uiText("backtest_terminal.order_price")}
                  />
                  <button
                    type="button"
                    className="btm-transport-btn"
                    data-active={engine.pickingOrderPrice}
                    onClick={() => engine.setPickingOrderPrice(!engine.pickingOrderPrice)}
                    title={uiText("backtest_terminal.pick_price_chart")}
                    aria-label={uiText("backtest_terminal.pick_price_chart")}
                  >
                    <Crosshair size={14} />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Risk Input */}
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

          {/* SL & TP distances */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
            <div className="btm-field">
              <span className="btm-field-label" style={{ color: "var(--btm-dn)" }}>
                {slLabel}
              </span>
              {numberInput(ticket.slPips, (next) => setTicket({ ...ticket, slPips: next }), "sl", slLabel)}
            </div>
            <div className="btm-field">
              <span className="btm-field-label" style={{ color: "var(--btm-up)" }}>
                {tpLabel}
              </span>
              {numberInput(ticket.tpPips, (next) => setTicket({ ...ticket, tpPips: next }), "tp", tpLabel)}
            </div>
          </div>

          {/* R:R Presets Quick Chips */}
          <div className="btm-field">
            <span className="btm-field-label">{uiText("backtest_terminal.rr_preset")}</span>
            <div style={{ display: "flex", gap: 6 }}>
              {[1, 1.5, 2, 3, 5].map((ratio) => (
                <button
                  key={ratio}
                  type="button"
                  className="btm-indchip"
                  data-on={engine.rr != null && Math.abs(engine.rr - ratio) < 0.05}
                  onClick={() => applyRrPreset(ratio)}
                  style={{ flex: 1, padding: "2px 0", fontSize: 10, textAlign: "center" }}
                >
                  {`1:${ratio}`}
                </button>
              ))}
            </div>
          </div>

          {/* Breakeven trigger & Trailing stop inputs */}
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

          {/* Auto-adapt risk on SL drag checkbox */}
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, cursor: "pointer", color: "var(--btm-fg)" }}>
            <input
              type="checkbox"
              checked={Boolean(ticket.adaptRiskOnSlMove)}
              onChange={(e) => setTicket({ ...ticket, adaptRiskOnSlMove: e.target.checked })}
              style={{ cursor: "pointer", accentColor: "hsl(217 91% 60%)" }}
            />
            {uiText("backtest_terminal.adapt_risk_sl")}
          </label>

          {/* Ticket Profiles */}
          <TicketProfiles engine={engine} name={draft.profileName} onNameChange={(profileName) => onDraftChange({ profileName })} />

          {/* Computed Risk & Lots Summary */}
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

          {oil && <p className="btm-muted" style={{ margin: 0, fontSize: 10.5 }}>{uiText("backtest_terminal.oil_contract")}</p>}

          {engine.lots <= 0 && (
            <p style={{ margin: 0, fontSize: 10.5, color: "var(--btm-mut)", textAlign: "center" }}>
              {uiText("backtest_terminal.size_hint")}
            </p>
          )}

          {/* Buy and Sell Execution Buttons */}
          <div className="btm-buysell">
            <button
              type="button"
              className="btm-buy"
              onClick={() => submit("buy")}
              disabled={unavailable || engine.lots <= 0 || (pendingMode && !canPlace)}
            >
              <ArrowUp size={15} /> BUY
            </button>
            <button
              type="button"
              className="btm-sell"
              onClick={() => submit("sell")}
              disabled={unavailable || engine.lots <= 0 || (pendingMode && !canPlace)}
            >
              <ArrowDown size={15} /> SELL
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
