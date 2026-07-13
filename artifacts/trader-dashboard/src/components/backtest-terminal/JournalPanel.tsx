// ─── Journal panel ───────────────────────────────────────────────────────────
// Trade count, Win Rate / Net R / Expectancy tiles, the W/BE/L split bar and
// the scrollable trade list (direction, entry→exit, exit reason, P&L, R).
import { useMemo, useState } from "react";
import { BookOpen, Download, Plus, Trash2, TrendingDown, TrendingUp, X } from "lucide-react";
import { uiText, useLanguage } from "@/contexts/LanguageContext";
import { monteCarloBands } from "@/lib/equityProjection";
import {
  collectTags,
  computeTimeBuckets,
  filterTradesByTags,
  type TimeBucket,
} from "@/lib/replay/journalStats";
import type { ClosedTrade } from "@/lib/replay/types";
import { formatPrice, formatSignedMoney } from "./format";
import type { ReplayEngine } from "./useReplayEngine";

/** Inline tag editor for a journal row: chips + add-input. */
function TradeTags({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const [adding, setAdding] = useState(false);
  const [value, setValue] = useState("");

  const commit = () => {
    const trimmed = value.trim();
    if (trimmed !== "" && !tags.includes(trimmed)) onChange([...tags, trimmed]);
    setValue("");
    setAdding(false);
  };

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center", width: "100%", marginTop: 4 }}>
      {tags.map((tag) => (
        <span
          key={tag}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 3,
            fontSize: 9.5,
            fontFamily: "var(--btm-mono)",
            padding: "1px 6px",
            borderRadius: 5,
            background: "hsl(var(--accent-jade) / 0.14)",
            color: "hsl(var(--accent-jade))",
          }}
        >
          {tag}
          <button
            type="button"
            onClick={() => onChange(tags.filter((t) => t !== tag))}
            style={{ border: "none", background: "transparent", color: "inherit", cursor: "pointer", padding: 0, display: "flex" }}
            aria-label={uiText("backtest_terminal.tag_remove")}
          >
            <X size={9} />
          </button>
        </span>
      ))}
      {adding ? (
        <input
          className="btm-input"
          style={{ height: 22, width: 90, fontSize: 10, padding: "0 6px" }}
          autoFocus
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") commit();
            if (event.key === "Escape") {
              setValue("");
              setAdding(false);
            }
          }}
          aria-label={uiText("backtest_terminal.tag_add")}
        />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="btm-tag"
          style={{ display: "inline-flex", alignItems: "center", gap: 2, cursor: "pointer", border: "none" }}
          title={uiText("backtest_terminal.tag_add")}
          aria-label={uiText("backtest_terminal.tag_add")}
        >
          <Plus size={9} /> tag
        </button>
      )}
    </div>
  );
}

function tradesToCsv(trades: ClosedTrade[], symbol: string): string {
  const header = "id,symbol,direction,entryTime,exitTime,entryPrice,exitPrice,stopLoss,takeProfit,lots,pips,profit,rMultiple,maeR,mfeR,exitReason,result,tags";
  const rows = [...trades]
    .sort((a, b) => a.exitTime - b.exitTime)
    .map((trade) =>
      [
        trade.id,
        symbol,
        trade.direction,
        new Date(trade.entryTime * 1000).toISOString(),
        new Date(trade.exitTime * 1000).toISOString(),
        trade.entryPrice,
        trade.exitPrice,
        trade.stopLoss,
        trade.takeProfit,
        trade.lots,
        trade.pips,
        trade.profit,
        trade.rMultiple ?? "",
        trade.maeR ?? "",
        trade.mfeR ?? "",
        trade.exitReason,
        trade.result,
        (trade.tags ?? []).join("|"),
      ].join(","),
    );
  return [header, ...rows].join("\n");
}

function downloadText(filename: string, mime: string, content: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/** Tiny net-R bar row for the time-analytics buckets. */
function BucketBars({ buckets, labelOf }: { buckets: TimeBucket[]; labelOf: (bucket: number) => string }) {
  const max = Math.max(...buckets.map((b) => Math.abs(b.netR)), 0.5);
  return (
    <div style={{ display: "flex", gap: 3, alignItems: "flex-end", height: 44 }}>
      {buckets.map((b) => {
        const height = Math.max(3, (Math.abs(b.netR) / max) * 36);
        const color = b.netR > 0 ? "hsl(142 71% 45%)" : b.netR < 0 ? "hsl(0 84% 60%)" : "hsl(215 20% 65% / 0.5)";
        return (
          <div key={b.bucket} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}
            title={`${labelOf(b.bucket)} · ${b.count} trade · ${b.netR > 0 ? "+" : ""}${b.netR}R`}>
            <div style={{ width: 12, height, background: color, borderRadius: 2 }} />
            <span style={{ fontSize: 7.5, fontFamily: "var(--btm-mono)", color: "var(--btm-mut)" }}>{labelOf(b.bucket)}</span>
          </div>
        );
      })}
    </div>
  );
}


const RESULT_COLOR: Record<ClosedTrade["result"], string> = {
  win: "hsl(142 71% 45%)",
  loss: "hsl(0 84% 60%)",
  breakeven: "hsl(38 92% 50%)",
};

export function JournalPanel({ engine }: { engine: ReplayEngine }) {
  const { language } = useLanguage();
  const { stats, trades } = engine;

  const [activeTags, setActiveTags] = useState<string[]>([]);
  const allTags = useMemo(() => collectTags(trades), [trades]);
  // Keep the filter valid as tags are removed from the underlying trades.
  const effectiveTags = useMemo(() => activeTags.filter((tag) => allTags.includes(tag)), [activeTags, allTags]);
  const visibleTrades = useMemo(() => filterTradesByTags(trades, effectiveTags), [trades, effectiveTags]);

  const buckets = useMemo(() => computeTimeBuckets(trades), [trades]);
  const projection = useMemo(() => {
    const samples = [...trades]
      .sort((a, b) => a.exitTime - b.exitTime)
      .map((trade) => trade.rMultiple)
      .filter((r): r is number => r != null);
    if (samples.length < 5) return null;
    return monteCarloBands(samples, { steps: 60, start: 0 });
  }, [trades]);

  // Sunday reference (2021-01-03) shifted by the bucket index → localized initial
  const weekdayLabel = (day: number) =>
    new Date(Date.UTC(2021, 0, 3 + day)).toLocaleDateString(language, { weekday: "narrow", timeZone: "UTC" });

  return (
    <section className="btm-section" style={{ borderBottom: "none", flex: 1 }} aria-label={uiText("backtest_terminal.journal")}>
      <h3 className="btm-section-title">
        <BookOpen size={13} />
        {uiText("backtest_terminal.journal")}
        <span style={{ marginLeft: "auto", fontFamily: "var(--btm-mono)" }}>{stats.total}</span>
        {trades.length > 0 && (
          <button
            type="button"
            className="btm-iconbtn"
            style={{ width: 24, height: 24 }}
            onClick={() => downloadText(`replay-${engine.symbol}-trades.csv`, "text/csv", tradesToCsv(trades, engine.symbol))}
            title={uiText("backtest_terminal.export_csv")}
            aria-label={uiText("backtest_terminal.export_csv")}
          >
            <Download size={13} />
          </button>
        )}
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

          {stats.avgMaeR != null && stats.avgMfeR != null && (
            <div className="btm-statgrid" style={{ gridTemplateColumns: "1fr 1fr", marginBottom: 10 }}>
              <div className="btm-stattile">
                <span className="btm-field-label">{uiText("backtest_terminal.avg_mae")}</span>
                <strong style={{ color: "var(--btm-dn)" }}>−{stats.avgMaeR.toFixed(2)}R</strong>
              </div>
              <div className="btm-stattile">
                <span className="btm-field-label">{uiText("backtest_terminal.avg_mfe")}</span>
                <strong style={{ color: "var(--btm-up)" }}>+{stats.avgMfeR.toFixed(2)}R</strong>
              </div>
            </div>
          )}

          {stats.total >= 5 && (
            <div style={{ marginBottom: 10 }}>
              <span className="btm-field-label">{uiText("backtest_terminal.time_analytics")}</span>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 5 }}>
                <BucketBars buckets={buckets.byHour} labelOf={(hour) => String(hour).padStart(2, "0")} />
                <BucketBars buckets={buckets.byWeekday} labelOf={weekdayLabel} />
              </div>
            </div>
          )}

          {projection && (
            <div style={{ marginBottom: 10 }}>
              <span className="btm-field-label">{uiText("backtest_terminal.montecarlo")}</span>
              <svg viewBox="0 0 300 60" preserveAspectRatio="none" style={{ width: "100%", height: 54, display: "block", marginTop: 4 }} aria-hidden="true">
                {(() => {
                  const all = [...projection.p10, ...projection.p90];
                  const min = Math.min(...all);
                  const max = Math.max(...all);
                  const span = max - min || 1;
                  const path = (values: number[]) =>
                    values
                      .map((value, index) => `${index === 0 ? "M" : "L"}${((index / (values.length - 1)) * 300).toFixed(1)},${(56 - ((value - min) / span) * 52).toFixed(1)}`)
                      .join(" ");
                  return (
                    <>
                      <path d={`${path(projection.p90)} L300,60 L0,60 Z`} fill="hsl(142 71% 45% / 0.08)" stroke="none" />
                      <path d={path(projection.p90)} fill="none" stroke="hsl(142 71% 45% / 0.5)" strokeWidth={1} />
                      <path d={path(projection.p50)} fill="none" stroke="hsl(var(--accent-jade))" strokeWidth={1.5} />
                      <path d={path(projection.p10)} fill="none" stroke="hsl(0 84% 60% / 0.5)" strokeWidth={1} />
                    </>
                  );
                })()}
              </svg>
            </div>
          )}

          {allTags.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 9 }}>
              {allTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className="btm-indchip"
                  data-on={effectiveTags.includes(tag)}
                  onClick={() =>
                    setActiveTags((current) =>
                      current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag],
                    )
                  }
                >
                  {tag}
                </button>
              ))}
            </div>
          )}

          <div className="btm-tradelist">
            {visibleTrades.map((trade) => {
              const directionColor = trade.direction === "buy" ? RESULT_COLOR.win : RESULT_COLOR.loss;
              return (
                <div key={trade.id} className="btm-traderow" style={{ flexWrap: "wrap" }}>
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
                          {trade.maeR != null && trade.mfeR != null && (
                            <span style={{ marginLeft: 5, fontSize: 10 }}>
                              MAE −{trade.maeR.toFixed(1)} · MFE +{trade.mfeR.toFixed(1)}
                            </span>
                          )}
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
                  <TradeTags
                    tags={trade.tags ?? []}
                    onChange={(tags) => engine.setTradeTags(trade.id, tags)}
                  />
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
