import { useQuery } from "@tanstack/react-query";
import { Grid3x3, Loader2, AlertTriangle } from "lucide-react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import { fetchCorrelation, correlationKey, type ConcentrationPair } from "@/lib/correlationApi";

/** Diverging cell colour: +1 jade, −1 red, 0 transparent; opacity ∝ |corr|. */
function cellStyle(corr: number | null): React.CSSProperties {
  if (corr === null) return { backgroundColor: "transparent" };
  const a = Math.min(1, Math.abs(corr)) * 0.55;
  const hue = corr >= 0 ? "158 64% 45%" : "0 72% 51%";
  return { backgroundColor: `hsl(${hue} / ${a})` };
}

function shortSym(symbol: string): string {
  return symbol.replace(/[^A-Za-z0-9]/g, "").slice(0, 6);
}

export function CorrelationCard() {
  const { t } = useLanguage();
  const { data, isLoading, isError } = useQuery({
    queryKey: correlationKey(),
    queryFn: () => fetchCorrelation(),
    retry: false,
  });

  const hasMatrix = data && data.symbols.length >= 2;
  const compounding = (data?.concentration ?? []).filter((c) => c.effect === "compounding");

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2">
        <Grid3x3 className="h-4 w-4 text-primary" />
        <div>
          <p className="text-sm font-semibold">{t("journal.corr.title")}</p>
          <p className="text-xs text-muted-foreground">{t("journal.corr.subtitle")}</p>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> …
          </div>
        ) : isError || !hasMatrix ? (
          <p className="text-sm text-muted-foreground">{t("journal.corr.empty")}</p>
        ) : (
          <div className="space-y-4">
            <div className="overflow-x-auto">
              <table className="border-collapse text-[11px]">
                <thead>
                  <tr>
                    <th className="p-1" />
                    {data!.symbols.map((s) => (
                      <th key={s} className="p-1 font-mono font-medium text-muted-foreground">
                        {shortSym(s)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data!.symbols.map((rowSym, i) => (
                    <tr key={rowSym}>
                      <td className="p-1 pr-2 text-right font-mono font-medium text-muted-foreground">
                        {shortSym(rowSym)}
                      </td>
                      {data!.symbols.map((colSym, j) => {
                        const c = data!.matrix[i][j];
                        return (
                          <td
                            key={colSym}
                            style={cellStyle(c)}
                            className="h-8 w-10 rounded text-center font-mono tabular-nums text-foreground/90"
                            title={`${rowSym} · ${colSym}`}
                          >
                            {c === null ? "" : c.toFixed(2)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {compounding.length > 0 && (
              <ul className="space-y-1.5">
                {compounding.map((pair: ConcentrationPair) => (
                  <li
                    key={`${pair.a}-${pair.b}`}
                    className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 px-2.5 py-1.5 text-xs"
                  >
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-warning" />
                    <span className="font-mono font-semibold">
                      {shortSym(pair.a)} ↔ {shortSym(pair.b)}
                    </span>
                    <span className="font-mono text-muted-foreground">{pair.correlation.toFixed(2)}</span>
                    <span className="ml-auto text-warning">{t("journal.corr.compounding")}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
