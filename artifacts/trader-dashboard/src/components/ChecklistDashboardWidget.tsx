import { useState, useEffect, useCallback } from "react";
import {
  ClipboardCheck,
  ShieldCheck,
  ArrowRight,
  RotateCcw,
  AlertTriangle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { WidgetHeader } from "@/components/ui/WidgetHeader";
import { Progress } from "@/components/ui/progress";
import { useGetChecklist } from "@workspace/api-client-react";
import { reportClientError } from "@/lib/clientErrorReporter";
import { uiText } from "@/contexts/LanguageContext";

const STORAGE_KEY = "tl_confirmation_session";

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function loadChecked(itemIds: number[]): Set<number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const { date, checked } = JSON.parse(raw) as {
      date: string;
      checked: number[];
    };
    if (date !== todayKey()) return new Set();
    return new Set(checked.filter((id) => itemIds.includes(id)));
  } catch (error) {
    reportClientError(error, {
      context: "checklist confirmation load",
      notify: false,
    });
    return new Set();
  }
}

function saveChecked(checked: Set<number>) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ date: todayKey(), checked: [...checked] }),
    );
  } catch (error) {
    reportClientError(error, {
      context: "checklist confirmation save",
      notify: false,
    });
  }
}

export function ChecklistDashboardWidget() {
  const { data: items, isLoading } = useGetChecklist();
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [animatingId, setAnimatingId] = useState<number | null>(null);

  useEffect(() => {
    if (items && items.length > 0) {
      setChecked(loadChecked(items.map((i) => i.id)));
    }
  }, [items]);

  const toggle = useCallback((id: number) => {
    setAnimatingId(id);
    setTimeout(() => setAnimatingId(null), 300);
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      saveChecked(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setChecked(new Set());
    saveChecked(new Set());
  }, []);

  const total = items?.length ?? 0;
  const confirmed = checked.size;
  const pct = total > 0 ? Math.round((confirmed / total) * 100) : 0;
  const isGo = total > 0 && confirmed === total;
  const isWarn = total > 0 && pct >= 50 && pct < 100;

  const statusColor = isGo
    ? "text-success"
    : isWarn
      ? "text-warning"
      : "text-muted-foreground";

  const subtitleText =
    total > 0
      ? uiText("checklist.completed_count", { done: confirmed, total })
      : undefined;

  const headerAction = total > 0 ? (
    <div className="flex items-center gap-2">
      {confirmed > 0 && (
        <button
          onClick={reset}
          className="p-1 rounded-lg text-muted-foreground/50 hover:text-muted-foreground hover:bg-secondary/60 transition-all"
          title={uiText("auto.ui.4634a0ed9f")}
        >
          <RotateCcw className="w-3 h-3" />
        </button>
      )}
      <AnimatePresence mode="wait">
        {isGo ? (
          <motion.span
            key="go"
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.7, opacity: 0 }}
            className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-success/40 bg-success/15 text-success tracking-wide"
          >
            GO ✓
          </motion.span>
        ) : (
          <motion.span
            key="count"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="text-[10px] font-mono text-muted-foreground"
          >
            {confirmed}/{total}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  ) : undefined;

  return (
    <Card className="h-full relative overflow-hidden">
      <WidgetHeader
        icon={<ClipboardCheck className="w-4 h-4" />}
        iconTone="accent"
        title={uiText("checklist.title")}
        subtitle={subtitleText}
        action={headerAction}
      />

      {total > 0 && (
        <div className="px-4 sm:px-5 pb-3 space-y-1 border-b border-border/30">
          <Progress value={(confirmed / total) * 100} className="h-1" />
          <p className={`text-[10px] font-medium ${statusColor}`}>
            {isGo
              ? "Tutti i criteri confermati — trade validato"
              : confirmed === 0
                ? "Spunta i criteri prima di entrare"
                : `${confirmed} di ${total} criteri confermati`}
          </p>
        </div>
      )}

      <CardContent className="p-2 sm:p-3">
        {isLoading ? (
          <div className="py-6 flex justify-center">
            <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        ) : !items || items.length === 0 ? (
          <Link
            href="/checklist"
            className="w-full py-6 flex flex-col items-center gap-2 text-muted-foreground hover:text-foreground transition-colors group"
          >
            <ShieldCheck className="w-10 h-10 opacity-15 group-hover:opacity-30 transition-opacity" />
            <p className="text-xs font-medium text-center">
              Nessun criterio di conferma
            </p>
            <span className="text-xs flex items-center gap-1 text-primary">
              Configura la checklist
              <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        ) : (
          <div className="space-y-0.5">
            {items.map((item, idx) => {
              const isChecked = checked.has(item.id);
              const isAnimating = animatingId === item.id;
              return (
                <motion.button
                  key={item.id}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  onClick={() => toggle(item.id)}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left transition-all active:scale-[0.98] ${
                    isChecked
                      ? "bg-success/8 hover:bg-success/12"
                      : "hover:bg-secondary/50"
                  }`}
                >
                  <motion.span
                    animate={isAnimating ? { scale: [1, 1.3, 1] } : {}}
                    transition={{ duration: 0.25 }}
                    className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all ${
                      isChecked
                        ? "bg-success border-success"
                        : "border-muted-foreground/25 bg-transparent"
                    }`}
                  >
                    <AnimatePresence>
                      {isChecked && (
                        <motion.svg
                          key="check"
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0, opacity: 0 }}
                          transition={{ duration: 0.15 }}
                          viewBox="0 0 10 8"
                          fill="none"
                          className="w-2.5 h-2"
                        >
                          <path
                            d="M1 4L3.5 6.5L9 1"
                            stroke="white"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </motion.svg>
                      )}
                    </AnimatePresence>
                  </motion.span>

                  <span
                    className={`text-xs flex-1 leading-snug transition-all ${
                      isChecked
                        ? "text-success/90 line-through decoration-success/40"
                        : "text-foreground/80"
                    }`}
                  >
                    {item.text}
                  </span>
                </motion.button>
              );
            })}

            {!isGo && total > 0 && confirmed > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-1.5 px-2.5 pt-2 pb-1"
              >
                <AlertTriangle className="w-3 h-3 text-warning/70 shrink-0" />
                <p className="text-[10px] text-warning/70">
                  {total - confirmed}{" "}
                  {total - confirmed === 1
                    ? "criterio mancante"
                    : "criteri mancanti"}{" "}
                  — non entrare ancora
                </p>
              </motion.div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
