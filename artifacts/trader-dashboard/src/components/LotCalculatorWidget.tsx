import { estimateLotSize } from "@/lib/lotSize";
import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Calculator } from "lucide-react";
import { useBackground } from "@/contexts/BackgroundContext";
import { uiText } from "@/contexts/LanguageContext";
import { useFinancialProfile } from "@/lib/financialProfileApi";
import { Card, CardContent } from "@/components/ui/card";
import { WidgetHeader } from "@/components/ui/WidgetHeader";
import { StatTile } from "@/components/ui/StatTile";
import { Input } from "@/components/ui/input";

export function LotCalculatorWidget({ initialRisk = "" }: { initialRisk?: string } = {}) {
  const [riskEuro, setRiskEuro] = useState<string>(initialRisk);
  const [stopLossPips, setStopLossPips] = useState<string>("");
  const { lotDivisor } = useBackground();
  const { data: finProfile } = useFinancialProfile();
  const tradingCapital = finProfile?.tradingAllocation ?? null;

  const lotSize = useMemo(
    () => estimateLotSize(riskEuro, stopLossPips, lotDivisor),
    [riskEuro, stopLossPips, lotDivisor],
  );

  return (
    <Card className="overflow-hidden flex flex-col">
      <WidgetHeader
        icon={<Calculator className="w-4 h-4" />}
        iconTone="primary"
        title={uiText("lot_calculator.title")}
        subtitle={uiText("lot_calculator.subtitle")}
      />

      <CardContent className="flex flex-col gap-4">
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-muted-foreground block">
                {uiText("auto.ui.e46122f621")}
              </label>
              {tradingCapital && tradingCapital > 0 && (
                <span className="text-[10px] text-muted-foreground font-mono">
                  Capitale: €{tradingCapital.toLocaleString("it-IT")}
                </span>
              )}
            </div>
            <Input
              type="number"
              aria-label={uiText("auto.ui.e46122f621")}
              value={riskEuro}
              onChange={(e) => setRiskEuro(e.target.value)}
              placeholder={uiText("auto.ui.a5a9b84cff")}
              step="0.01"
              min="0"
            />
            {tradingCapital && tradingCapital > 0 && (
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                <span className="text-[10px] text-muted-foreground uppercase font-mono">{"Quick Risk:"}</span>
                {[0.5, 1, 1.5, 2].map((pct) => {
                  const val = ((tradingCapital * pct) / 100).toFixed(0);
                  return (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => setRiskEuro(val)}
                      className="px-1.5 py-0.5 rounded text-[10px] font-mono border border-border bg-muted/40 hover:bg-muted text-foreground transition-colors"
                      title={`${pct}% di €${tradingCapital.toLocaleString("it-IT")}`}
                    >
                      {pct}% (€{val})
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-2 block">
              {uiText("auto.ui.88cd2d84dd")}
            </label>
            <Input
              type="number"
              aria-label={uiText("auto.ui.88cd2d84dd")}
              value={stopLossPips}
              onChange={(e) => setStopLossPips(e.target.value)}
              placeholder={uiText("auto.ui.6b16da6cad")}
              step="1"
              min="0"
            />
          </div>
        </div>

        {lotSize && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
            <StatTile
              label={uiText("auto.ui.25c37eced0")}
              value={lotSize}
              tone="primary"
              size="lg"
              className="text-center border-primary/30 bg-primary/10"
            />
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Formula: ({Number(riskEuro).toFixed(2)} € / {Number(stopLossPips).toFixed(0)} pips) /{" "}
              {lotDivisor}
            </p>
          </motion.div>
        )}

        <div className="rounded-xl bg-card border border-border p-4">
          <p className="text-xs text-muted-foreground leading-relaxed">
            <strong>{uiText("lot_calculator.how_title")}</strong>{" "}
            {uiText("lot_calculator.how_desc")}
          </p>
          <p className="text-xs text-warning mt-2">{uiText("lot_calculator.assumption")}</p>
        </div>
      </CardContent>
    </Card>
  );
}
