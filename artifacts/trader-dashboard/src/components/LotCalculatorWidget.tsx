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
        icon={<Calculator className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
        iconTone="primary"
        title={uiText("lot_calculator.title")}
        subtitle={uiText("lot_calculator.subtitle")}
        infoText={`${uiText("lot_calculator.how_title")} ${uiText("lot_calculator.how_desc")}`}
      />

      <CardContent className="flex flex-col gap-2.5 p-3 pt-0 sm:gap-4 sm:p-6 sm:pt-0">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-1 sm:gap-4">
          <div>
            <label className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-muted-foreground sm:mb-2 sm:text-xs sm:normal-case sm:tracking-normal">
              {uiText("auto.ui.e46122f621")}
            </label>
            <Input
              type="number"
              value={riskEuro}
              onChange={(e) => setRiskEuro(e.target.value)}
              placeholder={uiText("auto.ui.a5a9b84cff")}
              step="0.01"
              min="0"
              className="h-8 text-xs sm:h-9 sm:text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-muted-foreground sm:mb-2 sm:text-xs sm:normal-case sm:tracking-normal">
              {uiText("auto.ui.88cd2d84dd")}
            </label>
            <Input
              type="number"
              value={stopLossPips}
              onChange={(e) => setStopLossPips(e.target.value)}
              placeholder={uiText("auto.ui.6b16da6cad")}
              step="1"
              min="0"
              className="h-8 text-xs sm:h-9 sm:text-sm"
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
            <p className="mt-1.5 text-center font-mono text-[10px] text-muted-foreground sm:mt-2 sm:text-xs">
              ({Number(riskEuro).toFixed(2)} € / {Number(stopLossPips).toFixed(0)} pips) / {lotDivisor}
            </p>
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}
