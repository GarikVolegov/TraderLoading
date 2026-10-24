// ─── Account panel ───────────────────────────────────────────────────────────
// Balance, live equity, return %, max drawdown, total exposure, and the equity
// mini-curve with dynamic gradient area fill.
import { useMemo } from "react";
import { Wallet } from "lucide-react";
import { uiText, useLanguage } from "@/contexts/LanguageContext";
import { formatMoney, formatPercent } from "./format";
import type { ReplayEngine } from "./useReplayEngine";

const CURVE_WIDTH = 300;
const CURVE_HEIGHT = 64;

export function AccountPanel({ engine }: { engine: ReplayEngine }) {
  const { language } = useLanguage();
  const { account, totalExposureLots, positions } = engine;

  const curve = useMemo(() => {
    const points = account.equityCurve;
    if (points.length < 2) return null;
    let min = Math.min(...points);
    let max = Math.max(...points);
    const pad = (max - min) * 0.1 || 1;
    min -= pad;
    max += pad;
    const stepX = CURVE_WIDTH / (points.length - 1);
    const coords = points.map((value, index) => ({
      x: index * stepX,
      y: CURVE_HEIGHT - ((value - min) / (max - min)) * CURVE_HEIGHT,
      value,
    }));
    const linePath = coords
      .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)},${point.y.toFixed(1)}`)
      .join(" ");
    const areaPath = `${linePath} L${CURVE_WIDTH},${CURVE_HEIGHT} L0,${CURVE_HEIGHT} Z`;
    const rising = points[points.length - 1] >= points[0];
    return { linePath, areaPath, rising, points: coords };
  }, [account.equityCurve]);

  const returnColor = account.returnPct > 0 ? "var(--btm-up)" : account.returnPct < 0 ? "var(--btm-dn)" : undefined;

  return (
    <section className="btm-section" aria-label={uiText("backtest_terminal.account")}>
      <h3 className="btm-section-title">
        <Wallet size={13} />
        {uiText("backtest_terminal.account")}
        <span style={{ marginLeft: "auto", color: returnColor, fontFamily: "var(--btm-mono)" }}>
          {formatPercent(account.returnPct)}
        </span>
      </h3>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
        <div className="btm-stattile">
          <span className="btm-field-label">{uiText("backtest_terminal.balance")}</span>
          <strong style={{ fontFamily: "var(--btm-mono)", fontSize: 13 }}>{formatMoney(account.balance, language)}</strong>
        </div>
        <div className="btm-stattile">
          <span className="btm-field-label">{uiText("backtest_terminal.equity")}</span>
          <strong style={{ fontFamily: "var(--btm-mono)", fontSize: 13, color: account.equity >= account.balance ? "var(--btm-up)" : "var(--btm-dn)" }}>
            {formatMoney(account.equity, language)}
          </strong>
        </div>
      </div>

      {positions.length > 0 && totalExposureLots > 0 && (
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 8, color: "var(--btm-mut)" }}>
          <span>{uiText("backtest_terminal.total_exposure")}</span>
          <span style={{ fontFamily: "var(--btm-mono)", color: "hsl(217 91% 60%)", fontWeight: 700 }}>
            {`${totalExposureLots.toFixed(2)} lots (${positions.length} pos)`}
          </span>
        </div>
      )}

      {curve ? (
        <svg
          className="btm-eqcurve"
          viewBox={`0 0 ${CURVE_WIDTH} ${CURVE_HEIGHT}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={uiText("backtest_terminal.account")}
        >
          <defs>
            <linearGradient id="eqAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={curve.rising ? "hsl(142 71% 45%)" : "hsl(0 84% 60%)"} stopOpacity="0.28" />
              <stop offset="100%" stopColor={curve.rising ? "hsl(142 71% 45%)" : "hsl(0 84% 60%)"} stopOpacity="0.0" />
            </linearGradient>
          </defs>
          <path d={curve.areaPath} fill="url(#eqAreaGrad)" />
          <path
            d={curve.linePath}
            fill="none"
            stroke={curve.rising ? "hsl(142 71% 45%)" : "hsl(0 84% 60%)"}
            strokeWidth={1.6}
          />
          {curve.points.map((point, index) => (
            <circle key={index} cx={point.x} cy={point.y} r={4} fill="transparent" stroke="none">
              <title>{`#${index} · ${formatMoney(point.value, language)}`}</title>
            </circle>
          ))}
        </svg>
      ) : (
        <div style={{ fontSize: 11.5, color: "var(--btm-mut)" }}>{uiText("backtest_terminal.equity_empty")}</div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 11 }}>
        <span style={{ color: "var(--btm-mut)" }}>
          {uiText("backtest_terminal.equity_range", {
            min: formatMoney(Math.min(...account.equityCurve), language),
            max: formatMoney(Math.max(...account.equityCurve), language),
          })}
        </span>
        <span style={{ color: "var(--btm-dn)", fontFamily: "var(--btm-mono)" }}>
          DD {formatPercent(-account.maxDrawdownPct)}
        </span>
      </div>
    </section>
  );
}
