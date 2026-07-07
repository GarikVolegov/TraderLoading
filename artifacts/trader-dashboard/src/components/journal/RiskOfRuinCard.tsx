import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ShieldAlert, Loader2 } from "lucide-react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import { computeRiskOfRuin, riskOfRuinKey } from "@/lib/riskOfRuinApi";

const HORIZON = 100;
const RISK_CHOICES = [0.5, 1, 2, 3];

/** Signed percent from an equity multiplier (start = 1): 1.34 → "+34%". */
function fmtEquity(v: number): string {
  const pct = (v - 1) * 100;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(0)}%`;
}

/** Severity colour for the ruin probability. */
function riskColor(p: number): string {
  if (p < 0.05) return "text-success";
  if (p < 0.2) return "text-warning";
  return "text-destructive";
}

export function RiskOfRuinCard() {
  const { t } = useLanguage();
  const [riskPercent, setRiskPercent] = useState(1);

  const { data, isLoading, isError } = useQuery({
    queryKey: riskOfRuinKey(riskPercent, HORIZON),
    queryFn: () => computeRiskOfRuin({ riskPercent, trades: HORIZON, sims: 500 }),
    retry: false,
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2">
        <ShieldAlert className="h-4 w-4 text-primary" />
        <div>
          <p className="text-sm font-semibold">{t("journal.ror.title")}</p>
          <p className="text-xs text-muted-foreground">{t("journal.ror.subtitle")}</p>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">{t("journal.ror.risk_label")}</span>
          {RISK_CHOICES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRiskPercent(r)}
              className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors ${
                r === riskPercent
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border text-muted-foreground hover:bg-muted/40"
              }`}
            >
              {r}%
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> …
          </div>
        ) : isError || !data ? (
          <p className="text-sm text-muted-foreground">{t("journal.ror.insufficient")}</p>
        ) : (
          <div className="space-y-3">
            <div>
              <p className={`text-3xl font-bold tabular-nums ${riskColor(data.riskOfRuin)}`}>
                {(data.riskOfRuin * 100).toFixed(1)}%
              </p>
              <p className="text-xs text-muted-foreground">
                {t("journal.ror.result_label", { trades: HORIZON })}
              </p>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
              <span className="text-muted-foreground">
                {t("journal.ror.median")}:{" "}
                <span className="font-mono font-semibold text-foreground">{fmtEquity(data.medianFinalEquity)}</span>
              </span>
              <span className="text-muted-foreground">
                {t("journal.ror.range")}:{" "}
                <span className="font-mono font-semibold text-foreground">
                  {fmtEquity(data.p5)} … {fmtEquity(data.p95)}
                </span>
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {t("journal.ror.basis", { count: data.tradesWithR })}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
