import { BadgeCheck } from "lucide-react";
import type { EdgeStats } from "@workspace/api-client-react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";

function pct(v: number): string {
  return `${Math.round(v * 100)}%`;
}

function fmtDrawdown(v: number): string {
  if (!(v > 0)) return "0";
  return `−${Math.round(v).toLocaleString()}`;
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-md border border-border/35 bg-secondary/30 px-3 py-2.5">
      <p className="text-[0.62rem] font-bold uppercase leading-none text-muted-foreground">{label}</p>
      <p className="mt-1.5 font-mono text-lg font-black leading-none tabular-nums">{value}</p>
      {sub && <p className="mt-1 font-mono text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

/** Statistical edge-quality panel over /journal/edge `stats` (idea 5B): Wilson CI
 *  on the win rate, Kelly-optimal sizing, max drawdown, and the R distribution. */
export function EdgeQualityCard({ stats }: { stats: EdgeStats | undefined }) {
  const { t } = useLanguage();
  if (!stats) return null;

  const ci = stats.winRateCI;
  const kelly = stats.kelly;
  const maxBar = Math.max(1, ...stats.rHistogram.map((b) => b.count));
  const rLo = stats.rHistogram[0]?.from;
  const rHi = stats.rHistogram[stats.rHistogram.length - 1]?.to;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2">
        <BadgeCheck className="h-4 w-4 text-primary" />
        <div>
          <p className="text-sm font-semibold">{t("journal.edge_quality.title")}</p>
          <p className="text-xs text-muted-foreground">{t("journal.edge_quality.subtitle")}</p>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          <Stat
            label={t("journal.edge_quality.winrate_ci")}
            value={ci ? pct(ci.point) : "—"}
            sub={ci ? `${pct(ci.lower)}–${pct(ci.upper)}` : undefined}
          />
          <Stat
            label={t("journal.edge_quality.kelly")}
            value={kelly ? pct(kelly.half) : "—"}
            sub={kelly ? pct(kelly.full) : undefined}
          />
          <Stat label={t("journal.edge_quality.max_dd")} value={fmtDrawdown(stats.maxDrawdown)} />
        </div>

        {stats.rHistogram.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs text-muted-foreground">{t("journal.edge_quality.distribution")}</p>
            <div className="flex h-16 items-end gap-0.5">
              {stats.rHistogram.map((b, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t"
                  style={{
                    height: `${Math.max(3, (b.count / maxBar) * 100)}%`,
                    backgroundColor: b.from >= 0 ? "hsl(158 64% 45%)" : "hsl(0 72% 51%)",
                  }}
                  title={`${b.from}R … ${b.to}R: ${b.count}`}
                />
              ))}
            </div>
            {rLo !== undefined && rHi !== undefined && (
              <div className="mt-1 flex justify-between font-mono text-[10px] text-muted-foreground">
                <span>{rLo}R</span>
                <span>{rHi}R</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
