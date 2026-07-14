// ─── Account panel ───────────────────────────────────────────────────────────
// Balance, return %, max drawdown and the equity mini-curve (inline SVG
// polyline over the closed-trade equity points).
import { useMemo } from "react";
import { Wallet } from "lucide-react";
import { uiText, useLanguage } from "@/contexts/LanguageContext";
import { formatMoney, formatPercent } from "./format";
import type { ReplayEngine } from "./useReplayEngine";

const CURVE_WIDTH = 300;
const CURVE_HEIGHT = 64;

export function AccountPanel({ engine }: { engine: ReplayEngine }) {
  const { language } = useLanguage();
  const { account } = engine;

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
    const path = coords
      .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)},${point.y.toFixed(1)}`)
      .join(" ");
    const rising = points[points.length - 1] >= points[0];
    return { path, rising, points: coords };
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
      {curve ? (
        <svg
          className="btm-eqcurve"
          viewBox={`0 0 ${CURVE_WIDTH} ${CURVE_HEIGHT}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={uiText("backtest_terminal.account")}
        >
          <path
            d={curve.path}
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
