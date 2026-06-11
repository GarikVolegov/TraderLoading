import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { useBackground } from "@/contexts/BackgroundContext";
import { uiText } from "@/contexts/LanguageContext";

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
    <div className="space-y-6">
      <div className="space-y-4">
        <div>
          <label className="text-xs text-muted-foreground mb-2 block">{uiText("auto.ui.e46122f621")}</label>
          <input
            type="number"
            value={riskEuro}
            onChange={(e) => setRiskEuro(e.target.value)}
            placeholder={uiText("auto.ui.a5a9b84cff")}
            step="0.01"
            min="0"
            className="w-full px-3 py-2 text-base rounded-lg bg-secondary/50 border border-border hover:border-primary/50 transition-colors focus:outline-none focus:border-primary/50"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-2 block">{uiText("auto.ui.88cd2d84dd")}</label>
          <input
            type="number"
            value={stopLossPips}
            onChange={(e) => setStopLossPips(e.target.value)}
            placeholder={uiText("auto.ui.6b16da6cad")}
            step="1"
            min="0"
            className="w-full px-3 py-2 text-base rounded-lg bg-secondary/50 border border-border hover:border-primary/50 transition-colors focus:outline-none focus:border-primary/50"
          />
        </div>
      </div>

      {lotSize && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-xl bg-primary/10 border border-primary/30 p-4 text-center"
        >
          <p className="text-xs text-muted-foreground mb-1">{uiText("auto.ui.25c37eced0")}</p>
          <p className="text-3xl font-bold text-primary font-mono">{lotSize}</p>
          <p className="text-xs text-muted-foreground mt-2">
            Formula: ({Number(riskEuro).toFixed(2)} € / {Number(stopLossPips).toFixed(0)} pips) / {lotDivisor}
          </p>
        </motion.div>
      )}

      <div className="rounded-xl bg-card border border-border p-4">
        <p className="text-xs text-muted-foreground leading-relaxed">
          <strong>{uiText("lot_calculator.how_title")}</strong> {uiText("lot_calculator.how_desc")}
        </p>
      </div>
    </div>
  );
}
