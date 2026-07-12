// ─── Journal panel ───────────────────────────────────────────────────────────
// Trade count, Win Rate / Net R / Expectancy tiles, the W/BE/L split bar and
// the scrollable trade list (direction, entry→exit, exit reason, P&L, R).
import { BookOpen, Trash2, TrendingDown, TrendingUp } from "lucide-react";
import { uiText, useLanguage } from "@/contexts/LanguageContext";
import type { ClosedTrade } from "@/lib/replay/types";
import { formatPrice, formatSignedMoney } from "./format";
import type { ReplayEngine } from "./useReplayEngine";

const RESULT_COLOR: Record<ClosedTrade["result"], string> = {
  win: "hsl(142 71% 45%)",
  loss: "hsl(0 84% 60%)",
  breakeven: "hsl(38 92% 50%)",
};

export function JournalPanel({ engine }: { engine: ReplayEngine }) {
  const { language } = useLanguage();
  const { stats, trades } = engine;

  return (
    <section className="btm-section" style={{ borderBottom: "none", flex: 1 }} aria-label={uiText("backtest_terminal.journal")}>
      <h3 className="btm-section-title">
        <BookOpen size={13} />
        {uiText("backtest_terminal.journal")}
        <span style={{ marginLeft: "auto", fontFamily: "var(--btm-mono)" }}>{stats.total}</span>
      </h3>

      {stats.total === 0 ? (
        <div style={{ fontSize: 11.5, color: "var(--btm-mut)", lineHeight: 1.5 }}>
          {uiText("backtest_terminal.journal_empty")}
        </div>
      ) : (
        <>
          <div className="btm-statgrid">
            <div className="btm-stattile">
              <span className="btm-field-label">{uiText("backtest_terminal.win_rate")}</span>
              <strong style={{ color: stats.winRate >= 50 ? "var(--btm-up)" : "var(--btm-dn)" }}>
                {stats.winRate}%
              </strong>
            </div>
            <div className="btm-stattile">
              <span className="btm-field-label">{uiText("backtest_terminal.net_r")}</span>
              <strong style={{ color: stats.netR > 0 ? "var(--btm-up)" : stats.netR < 0 ? "var(--btm-dn)" : undefined }}>
                {stats.netR > 0 ? "+" : ""}
                {stats.netR.toFixed(2)}R
              </strong>
            </div>
            <div className="btm-stattile">
              <span className="btm-field-label">{uiText("backtest_terminal.expectancy")}</span>
              <strong>{stats.expectancy != null ? `${stats.expectancy.toFixed(2)}R` : "—"}</strong>
            </div>
          </div>

          <div className="btm-wblbar" aria-hidden="true">
            {stats.wins > 0 && <div style={{ width: `${(stats.wins / stats.total) * 100}%`, background: RESULT_COLOR.win }} />}
            {stats.breakevens > 0 && (
              <div style={{ width: `${(stats.breakevens / stats.total) * 100}%`, background: RESULT_COLOR.breakeven }} />
            )}
            {stats.losses > 0 && <div style={{ width: `${(stats.losses / stats.total) * 100}%`, background: RESULT_COLOR.loss }} />}
          </div>
          <div style={{ fontFamily: "var(--btm-mono)", fontSize: 10.5, color: "var(--btm-mut)", marginBottom: 10 }}>
            {stats.wins}W / {stats.losses}L / {stats.breakevens}BE
          </div>

          <div className="btm-tradelist">
            {trades.map((trade) => {
              const directionColor = trade.direction === "buy" ? RESULT_COLOR.win : RESULT_COLOR.loss;
              return (
                <div key={trade.id} className="btm-traderow">
                  <div
                    className="btm-traderow-icon"
                    style={{
                      background: `color-mix(in srgb, ${directionColor} 14%, transparent)`,
                      color: directionColor,
                    }}
                  >
                    {trade.direction === "buy" ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                  </div>
                  <div className="btm-traderow-main">
                    <span className="btm-traderow-prices">
                      {formatPrice(trade.entryPrice, engine.symbol)} → {formatPrice(trade.exitPrice, engine.symbol)}
                      {trade.exitReason !== "manual" && (
                        <span style={{ marginLeft: 5, color: trade.exitReason === "tp" ? RESULT_COLOR.win : RESULT_COLOR.loss }}>
                          {trade.exitReason.toUpperCase()}
                        </span>
                      )}
                    </span>
                    <span className="btm-traderow-pl" style={{ color: RESULT_COLOR[trade.result] }}>
                      {formatSignedMoney(trade.profit, language)}
                      {trade.rMultiple != null && (
                        <span style={{ marginLeft: 6, color: "var(--btm-mut)", fontWeight: 400 }}>
                          {trade.rMultiple > 0 ? "+" : ""}
                          {trade.rMultiple.toFixed(2)}R
                        </span>
                      )}
                    </span>
                  </div>
                  <span
                    className="btm-tag"
                    style={{
                      color: RESULT_COLOR[trade.result],
                      background: `color-mix(in srgb, ${RESULT_COLOR[trade.result]} 14%, transparent)`,
                    }}
                  >
                    {trade.result === "breakeven" ? "BE" : trade.result}
                  </span>
                  <button
                    type="button"
                    className="btm-trash"
                    onClick={() => engine.deleteTrade(trade.id)}
                    title={uiText("backtest_terminal.delete_trade")}
                    aria-label={uiText("backtest_terminal.delete_trade")}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
