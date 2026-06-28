import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Calculator } from "lucide-react";
import { useBackground } from "@/contexts/BackgroundContext";
import { uiText } from "@/contexts/LanguageContext";
import { Card, CardContent } from "@/components/ui/card";
import { WidgetHeader } from "@/components/ui/WidgetHeader";
import { StatTile } from "@/components/ui/StatTile";
import { Input } from "@/components/ui/input";

export function LotCalculatorWidget() {
  const [riskEuro, setRiskEuro] = useState<string>("");
  const [stopLossPips, setStopLossPips] = useState<string>("");
  const { lotDivisor } = useBackground();

  const lotSize = useMemo(() => {
    const risk = parseFloat(riskEuro);
    const pips = parseFloat(stopLossPips);
    if (isNaN(risk) || isNaN(pips) || pips <= 0) return null;
    return ((risk / pips) / lotDivisor).toFixed(2);
  }, [riskEuro, stopLossPips, lotDivisor]);

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
            <label className="text-xs text-muted-foreground mb-2 block">{uiText("auto.ui.e46122f621")}</label>
            <Input
              type="number"
              value={riskEuro}
              onChange={(e) => setRiskEuro(e.target.value)}
              placeholder={uiText("auto.ui.a5a9b84cff")}
              step="0.01"
              min="0"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-2 block">{uiText("auto.ui.88cd2d84dd")}</label>
            <Input
              type="number"
              value={stopLossPips}
              onChange={(e) => setStopLossPips(e.target.value)}
              placeholder={uiText("auto.ui.6b16da6cad")}
              step="1"
              min="0"
            />
          </div>
        </div>

        {lotSize && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <StatTile
              label={uiText("auto.ui.25c37eced0")}
              value={lotSize}
              tone="primary"
              size="lg"
              className="text-center border-primary/30 bg-primary/10"
            />
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Formula: ({Number(riskEuro).toFixed(2)} € / {Number(stopLossPips).toFixed(0)} pips) / {lotDivisor}
            </p>
          </motion.div>
        )}

        <div className="rounded-xl bg-card border border-border p-4">
          <p className="text-xs text-muted-foreground leading-relaxed">
            <strong>{uiText("lot_calculator.how_title")}</strong> {uiText("lot_calculator.how_desc")}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
