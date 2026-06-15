import { EveningTradeReport, type TodayReport } from "@/components/EveningTradeReport";
import { uiText } from "@/contexts/LanguageContext";
import type { Answers } from "./types";

export function TradeReviewStep({ answers, onChange }: { answers: Answers; onChange: (a: Answers) => void }) {
  const review = (answers.tradeReview as Record<string, string> | undefined) ?? {};

  const set = (k: string, v: string) =>
    onChange({ ...answers, tradeReview: { ...review, [k]: v } });

  const applyReport = (report: TodayReport) =>
    onChange({
      ...answers,
      tradeReview: {
        ...review,
        win: String(report.win),
        loss: String(report.loss),
        be: String(report.be),
        ...(report.netPnl != null
          ? { pnl: `${report.netPnl >= 0 ? "+" : ""}${report.netPnl.toFixed(2)} ${report.currency}`.trim() }
          : {}),
      },
    });

  return (
    <div className="flex flex-col gap-4 w-full max-w-lg mx-auto">
      <EveningTradeReport onApply={applyReport} />
      <div className="grid grid-cols-3 gap-3">
        {[
          { key: "win",   label: "Win",   color: "#10b981" },
          { key: "loss",  label: "Loss",  color: "#ef4444" },
          { key: "be",    label: "B/E",   color: "#6b7280" },
        ].map(({ key, label, color }) => (
          <div key={key} className="flex flex-col gap-1">
            <label className="text-xs font-bold text-center" style={{ color }}>{label}</label>
            <input
              type="number"
              min="0"
              value={review[key] ?? ""}
              onChange={(e) => set(key, e.target.value)}
              placeholder="0"
              className="w-full rounded-xl border border-border/50 bg-card/60 px-3 py-3 text-sm text-center font-mono text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary/60 transition-all"
              style={{ borderColor: review[key] ? color : undefined, color: review[key] ? color : undefined }}
            />
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">
          P&amp;L del giorno
        </label>
        <input
          type="text"
          value={review.pnl ?? ""}
          onChange={(e) => set("pnl", e.target.value)}
          placeholder={uiText("auto.ui.b7480644da")}
          className="w-full rounded-xl border border-border/50 bg-card/60 px-4 py-3 text-sm font-mono text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary/60 transition-all"
        />
      </div>
    </div>
  );
}
