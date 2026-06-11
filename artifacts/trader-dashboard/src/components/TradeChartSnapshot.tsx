import { useQuery } from "@tanstack/react-query";
import { CandlestickChart } from "lucide-react";
import { fetchReplayCandles } from "@/lib/replayCandlesApi";
import { normalizeTradeSymbol, pickChartInterval, selectTradeWindow } from "@/lib/tradeChart";
import type { ParsedTradeContent } from "@/lib/parseTradeContent";

const WIDTH = 320;
const HEIGHT = 110;
const PAD_Y = 6;

/**
 * Contesto visivo del trade: mini grafico candele attorno alla finestra
 * open→close, con livelli di entry/exit. I dati arrivano dallo stesso feed
 * del Backtest e vengono cachati per simbolo+timeframe.
 */
export function TradeChartSnapshot({ parsed }: { parsed: ParsedTradeContent }) {
  const symbol = normalizeTradeSymbol(parsed.symbol);
  const { openTime, closeTime, entryPrice, exitPrice } = parsed;
  const enabled = Boolean(symbol && openTime && closeTime);
  const interval = enabled ? pickChartInterval(openTime!, closeTime!) : "H1";

  const { data, isLoading, isError } = useQuery({
    queryKey: ["trade-chart-candles", symbol, interval],
    queryFn: () => fetchReplayCandles({ symbol: symbol!, interval }),
    enabled,
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });

  if (!enabled) return null;

  if (isLoading) {
    return <div className="h-24 animate-pulse rounded-lg border border-border/25 bg-secondary/20" />;
  }

  const window = data && !isError ? selectTradeWindow(data.candles, openTime!, closeTime!) : [];
  if (window.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border/25 bg-secondary/15 px-3 py-2 text-[11px] text-muted-foreground/70">
        <CandlestickChart className="h-3.5 w-3.5 shrink-0" />
        Grafico non disponibile per questo periodo ({interval}).
      </div>
    );
  }

  const prices = window.flatMap((c) => [c.high, c.low]);
  if (typeof entryPrice === "number") prices.push(entryPrice);
  if (typeof exitPrice === "number") prices.push(exitPrice);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const toY = (price: number) => PAD_Y + (HEIGHT - 2 * PAD_Y) * (1 - (price - min) / range);

  const slot = WIDTH / window.length;
  const bodyWidth = Math.max(1.5, Math.min(7, slot * 0.6));

  const openSec = Math.floor(new Date(openTime!).getTime() / 1000);
  const closeSec = Math.floor(new Date(closeTime!).getTime() / 1000);
  const inTradeXs = window
    .map((c, i) => ({ c, x: i * slot + slot / 2 }))
    .filter(({ c }) => c.time >= openSec && c.time <= closeSec)
    .map(({ x }) => x);
  const tradeX0 = inTradeXs.length > 0 ? Math.min(...inTradeXs) - bodyWidth : null;
  const tradeX1 = inTradeXs.length > 0 ? Math.max(...inTradeXs) + bodyWidth : null;

  return (
    <div className="overflow-hidden rounded-lg border border-border/30 bg-black/25">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-28 w-full"
        preserveAspectRatio="none"
        role="img"
        aria-label={`Grafico ${symbol} ${interval} attorno al trade`}
      >
        {tradeX0 != null && tradeX1 != null && (
          <rect x={tradeX0} y={0} width={tradeX1 - tradeX0} height={HEIGHT} fill="rgb(129 140 248)" fillOpacity="0.08" />
        )}

        {window.map((c, i) => {
          const x = i * slot + slot / 2;
          const up = c.close >= c.open;
          const color = up ? "rgb(52 211 153)" : "rgb(248 113 113)";
          const bodyTop = toY(Math.max(c.open, c.close));
          const bodyHeight = Math.max(1, Math.abs(toY(c.open) - toY(c.close)));
          return (
            <g key={c.time}>
              <line x1={x} x2={x} y1={toY(c.high)} y2={toY(c.low)} stroke={color} strokeWidth="1" strokeOpacity="0.85" />
              <rect x={x - bodyWidth / 2} y={bodyTop} width={bodyWidth} height={bodyHeight} fill={color} fillOpacity="0.9" />
            </g>
          );
        })}

        {typeof entryPrice === "number" && (
          <line x1={0} x2={WIDTH} y1={toY(entryPrice)} y2={toY(entryPrice)} stroke="rgb(250 250 250)" strokeWidth="1" strokeDasharray="3 3" strokeOpacity="0.55" />
        )}
        {typeof exitPrice === "number" && (
          <line
            x1={0} x2={WIDTH} y1={toY(exitPrice)} y2={toY(exitPrice)}
            stroke={(parsed.profit ?? 0) >= 0 ? "rgb(52 211 153)" : "rgb(248 113 113)"}
            strokeWidth="1" strokeDasharray="3 3" strokeOpacity="0.7"
          />
        )}
      </svg>
      <div className="flex items-center justify-between border-t border-border/25 px-2 py-1 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground/70">
        <span>{symbol} · {interval}</span>
        <span className="flex items-center gap-2">
          {typeof entryPrice === "number" && <span>— entry {entryPrice}</span>}
          {typeof exitPrice === "number" && (
            <span className={(parsed.profit ?? 0) >= 0 ? "text-emerald-300/80" : "text-red-300/80"}>
              — exit {exitPrice}
            </span>
          )}
        </span>
      </div>
    </div>
  );
}
