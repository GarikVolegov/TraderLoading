import { useRef, useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTraderProcess, useProcessMutation } from "@/hooks/useTraderProcess";
import { confirmProcessReview, type ProcessState, type ProcessReviewDue, type ConfirmProcessReview } from "@/lib/traderProcessApi";
import { journeyText } from "@/lib/processJourneyCopy";
import { completeProcessResult } from "@/lib/processGuidance";
import { processDay } from "../../../../../contracts/trader-process";
import { Button, buttonVariants } from "@/components/ui/button";
import { ProcessPanel, ProcessField, ProcessChoices, ProcessError, ProcessLoading, useProcessCopy } from "./ProcessUI";

export function ProcessReviewForm({ state, due }: { state: ProcessState; due: ProcessReviewDue }) {
  const { language } = useLanguage();
  const copy = useProcessCopy();
  const text = (key: Parameters<typeof journeyText>[1]) => journeyText(language, key);
  const client = useQueryClient();
  const [judgment, setJudgment] = useState("");
  const [action, setAction] = useState("");
  const [criterion, setCriterion] = useState("");
  const [outcome, setOutcome] = useState<NonNullable<ConfirmProcessReview["previousImprovementOutcome"]> | "">("");
  const [note, setNote] = useState("");
  const requestId = useRef(crypto.randomUUID());
  const method = state.activeMethod!;
  const previous = state.improvement?.methodVersionId === method.id && !(state.improvement.recapKind === due.kind && state.improvement.periodStart === due.periodStart && state.improvement.periodEnd === due.periodEnd) ? state.improvement : null;
  const save = useProcessMutation(confirmProcessReview);
  const periods = due.coveredPeriods.length ? due.coveredPeriods : [due];
  return <ProcessPanel title={text("review_period")} description={text("review_due")} focusHeading>
    {periods.length > 1 && <p className="text-sm text-muted-foreground">{text("reviewCombined")}</p>}
    {periods.map(period => {
      const evidence = state.evidence.filter(row => row.methodVersionId === method.id && row.purpose === "live" && processDay(new Date(row.observedAt)) >= period.periodStart && processDay(new Date(row.observedAt)) <= period.periodEnd);
      const complete = evidence.filter(row => row.executionEnvironment === "real" && completeProcessResult(row));
      const sessions = (state.sessions ?? []).filter(session => session.methodVersionId === method.id && session.mode === "application" && session.day >= period.periodStart && session.day <= period.periodEnd && session.state === "closed");
      return <section key={`${period.kind}:${period.periodStart}`} className="process-plan-summary space-y-3">
        <h3 className="font-medium">{copy(period.kind === "weekly" ? "check_weekly_review" : "check_period_review")}</h3>
        <p className="text-xs font-mono text-muted-foreground">{period.periodStart} – {period.periodEnd}</p>
        <dl className="process-plan-facts"><div><dt>{copy("eligible")}</dt><dd>{complete.length}</dd></div><div><dt>{copy("incomplete")}</dt><dd>{evidence.length - complete.length}</dd></div><div><dt>{copy("journalSessions")}</dt><dd>{sessions.length}</dd></div></dl>
        <details><summary>{copy("evidenceList")}</summary><ul className="space-y-2 pt-3 text-sm">{evidence.map(row => <li key={row.id}>{row.account ?? "—"} · {row.netPnl ?? "—"} {row.currency ?? "—"} · {row.netR ?? "—"} R · {copy(row.adherence)}</li>)}</ul></details>
      </section>;
    })}
    {method.protocol && <details><summary>{copy("confirmProtocol")}</summary><dl className="process-summary">
      <div><dt>{copy("minSamples")}</dt><dd>{method.protocol.minSamples}</dd></div>
      <div><dt>{copy("minExpectancy")}</dt><dd>{method.protocol.minExpectancyR} R</dd></div>
      <div><dt>{copy("maxDrawdown")}</dt><dd>{method.protocol.maxDrawdownR} R</dd></div>
      <div><dt>{copy("minAdherence")}</dt><dd>{method.protocol.minAdherencePct}%</dd></div>
    </dl></details>}
    <form className="process-form" onSubmit={event => {
      event.preventDefault();
      save.mutate({ methodVersionId: method.id, kind: due.kind, periodStart: due.periodStart, periodEnd: due.periodEnd, judgment, action, criterion, requestId: requestId.current,
        ...(previous && outcome ? { previousImprovementOutcome: outcome, previousImprovementNote: note } : {}) }, { onSuccess: () => { void client.invalidateQueries({ queryKey: ["/api/journal/recaps"] }); } });
    }}>
      <fieldset className="process-form min-w-0" disabled={save.isPending}>
        {previous && <>
          <div className="process-plan-summary text-sm"><p>{previous.action}</p><p className="mt-2 text-muted-foreground">{previous.criterion}</p></div>
          <ProcessChoices label={text("previousImprovement")} value={outcome} onChange={setOutcome} options={(["met", "not_met", "unassessable"] as const).map(value => ({ value, label: text(value) }))} />
          {outcome && outcome !== "met" && <ProcessField label={copy("evidenceNote")}><textarea required maxLength={4000} rows={2} value={note} onChange={event => setNote(event.target.value)} /></ProcessField>}
        </>}
        <ProcessField label={text("reviewJudgment")}><textarea required maxLength={4000} rows={2} value={judgment} onChange={event => setJudgment(event.target.value)} /></ProcessField>
        <ProcessField label={text("reviewAction")}><textarea required maxLength={4000} rows={2} value={action} onChange={event => setAction(event.target.value)} /></ProcessField>
        <ProcessField label={text("reviewCriterion")}><textarea required maxLength={4000} rows={2} value={criterion} onChange={event => setCriterion(event.target.value)} /></ProcessField>
        <ProcessError error={save.error} />
        <Button type="submit" className="self-start min-h-11" disabled={save.isPending}>{save.isPending ? copy("saving") : text("reviewConfirm")}</Button>
      </fieldset>
    </form>
  </ProcessPanel>;
}

export function ProcessReviewWorkspace() {
  const query = useTraderProcess();
  const { language } = useLanguage();
  const copy = useProcessCopy();
  if (!query.data) return <ProcessLoading error={query.error} retry={() => void query.refetch()} />;
  const state = query.data;
  const due = state.guidance?.action === "review_period" ? state.guidance.reviewDue : null;
  return <div className="process-workspace">
    {due && state.activeMethod ? <ProcessReviewForm key={`${state.activeMethod.id}:${due.kind}:${due.periodStart}`} state={state} due={due} /> : <ProcessPanel title={journeyText(language, "noReview")}>
      <Link href="/" className={buttonVariants() + " self-start"}>{copy("today")}</Link>
    </ProcessPanel>}
    {(state.reviews ?? []).map(review => <details key={review.id} className="process-plan-summary">
      <summary>{copy(review.kind === "weekly" ? "check_weekly_review" : "check_period_review")} · {review.periodStart} – {review.periodEnd}</summary>
      <dl className="process-summary pt-3"><div><dt>{journeyText(language, "reviewJudgment")}</dt><dd>{review.judgment}</dd></div><div><dt>{journeyText(language, "reviewAction")}</dt><dd>{review.action}</dd></div><div><dt>{journeyText(language, "reviewCriterion")}</dt><dd>{review.criterion}</dd></div></dl>
      <dl className="process-summary mt-3">
        <div><dt>{copy("eligible")}</dt><dd>{review.report.eligibleSamples}</dd></div>
        <div><dt>{copy("expectancy")}</dt><dd>{review.report.expectancyR == null ? "—" : `${review.report.expectancyR.toFixed(2)} R`}</dd></div>
        <div><dt>{copy("drawdown")}</dt><dd>{review.report.drawdownR == null ? "—" : `${review.report.drawdownR.toFixed(2)} R`}</dd></div>
      </dl>
      <ul className="space-y-2 mt-3 text-sm">{review.checks.map(check => <li key={check.key}>{check.met ? "✓" : "×"} {check.label} · {check.detail}</li>)}</ul>
      <p className="mt-3 text-sm">{journeyText(language, review.decision === "reverify" ? "reverification_required" : "reviewContinues")}</p>
      <p className="mt-2 text-xs text-muted-foreground">{new Intl.DateTimeFormat(language, { timeZone: "Europe/Rome", dateStyle: "medium", timeStyle: "short" }).format(new Date(review.reviewedAt))}</p>
    </details>)}
  </div>;
}
