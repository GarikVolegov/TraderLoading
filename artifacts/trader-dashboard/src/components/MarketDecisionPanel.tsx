import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowRight, Check, Pause, BookOpen } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { decisionJournalHref, marketDecisionsKey, saveMarketDecision, type MarketDecision } from "@/lib/marketIntelligenceApi";

export function MarketDecisionPanel({ snapshotId, pair, fresh }: { snapshotId?: string | null; pair: string; fresh: boolean }) {
  const { t } = useLanguage(); const qc = useQueryClient();
  const [note, setNote] = useState(""); const [saved, setSaved] = useState<MarketDecision | null>(null); const busy = useRef(false);
  const activePair = useRef(pair); activePair.current = pair;
  const mutation = useMutation({ mutationFn: saveMarketDecision, meta: { suppressGlobalError: true }, onSuccess: decision => { if (decision.snapshot.pair === activePair.current) setSaved(decision); void qc.invalidateQueries({ queryKey: marketDecisionsKey }); }, onSettled: () => { busy.current = false; } });
  const reset = mutation.reset;
  useEffect(() => { setSaved(null); setNote(""); if (!busy.current) reset(); }, [pair, reset]);
  const submit = (choice: "trade" | "wait") => { if (!fresh || !snapshotId || busy.current) return; busy.current = true; mutation.mutate({ snapshotId, choice, ...(note.trim() ? { note: note.trim() } : {}) }); };
  return <section className="context-surface intelligence-decision" aria-label={t("intelligence.decision")}>
    <h2 className="text-base font-semibold">{t("intelligence.decision")}</h2><p className="mt-1 text-sm text-muted-foreground">{t("intelligence.decision_hint")}</p>
    <label className="mt-4 block text-xs font-semibold" htmlFor="market-decision-note">{t("intelligence.note")}</label>
    <textarea id="market-decision-note" className="mt-2 min-h-20 w-full resize-y rounded-md border border-border bg-background/50 p-3 text-sm" maxLength={2000} value={note} onChange={e => setNote(e.target.value)} disabled={mutation.isPending} />
    <div className="mt-3 flex flex-wrap gap-2"><Button onClick={() => submit("trade")} disabled={!fresh || !snapshotId || mutation.isPending}><BookOpen size={15} className="mr-2" />{t("intelligence.record_trade")}</Button><Button variant="outline" onClick={() => submit("wait")} disabled={!fresh || !snapshotId || mutation.isPending}><Pause size={15} className="mr-2" />{t("intelligence.record_wait")}</Button></div>
    {mutation.isPending && <p role="status" className="mt-3 text-sm text-muted-foreground">{t("intelligence.saving")}</p>}
    {mutation.isError && <p role="alert" className="mt-3 text-sm text-destructive">{t("intelligence.save_error")} {mutation.error.message}</p>}
    {!snapshotId && <p role="status" className="mt-3 text-xs text-muted-foreground">{t("intelligence.snapshot_unavailable")}</p>}
    {saved && <div role="status" className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-3"><p className="flex items-center gap-2 text-sm"><Check size={15} className="text-primary" />{t(saved.choice === "trade" ? "intelligence.trade_saved" : "intelligence.wait_saved")}</p>{saved.choice === "trade" && <Link className="mt-3 inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-primary" href={decisionJournalHref(saved)}>{t("intelligence.open_journal")}<ArrowRight size={15} /></Link>}<Link className="mt-2 block min-h-10 py-2 text-sm text-muted-foreground underline" href="/journal?t=revisione&kind=market">{t("intelligence.review")}</Link></div>}
  </section>;
}
