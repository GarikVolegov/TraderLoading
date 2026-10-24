import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useLanguage } from "@/contexts/LanguageContext";
import { journeyText } from "@/lib/processJourneyCopy";
import { MethodEditor, VerificationStart } from "./Method";
import { ProcessNextAction } from "@/components/process/ProcessNextAction";
import { ProcessReviewForm } from "@/components/process/ProcessReview";
import { useSessionDraft } from "@/hooks/useSessionDraft";
import { SessionDraftStatus } from "@/components/process/SessionDraftStatus";
import { GuidedCheckIn } from "@/components/process/GuidedSession";
import { processToolHref } from "@/lib/processToolNavigation";
import { completeProcessResult, dailyProcessRisk } from "@/lib/processGuidance";
import { ArrowRight } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { useTraderProcess, useProcessMutation } from "@/hooks/useTraderProcess";
import {
  discardProcessSession,
  startProcessSession,
  type ProcessSession,
  type ProcessState,
  type SessionClosure,
} from "@/lib/traderProcessApi";
import { processDay } from "../../../../contracts/trader-process";
import {
  ProcessChoices,
  ProcessError,
  ProcessField,
  ProcessFrame,
  ProcessLink,
  ProcessLoading,
  ProcessPanel,
  SessionRail,
  PhaseRail,
  useProcessCopy,
} from "@/components/process/ProcessUI";

function SessionPlanSummary({ session }: { session: ProcessSession }) {
  const copy = useProcessCopy();
  const plan = session.plan;
  if (!plan) return null;
  return (
    <section className="process-plan-summary" aria-label={copy("confirmedPlan")}>
      <p className="process-eyebrow">
        {copy(plan.decision === "wait" ? "waitingPlan" : "confirmedPlan")}
      </p>
      {plan.decision === "wait" ? (
        <p className="text-sm">
          {plan.market && <strong>{plan.market} · </strong>}
          {plan.waitReason}
        </p>
      ) : (
        <>
          <p className="text-sm">
            <strong>{plan.market}</strong> · {plan.setup}
          </p>
          <dl className="process-plan-facts">
            <div>
              <dt>{copy("stop")}</dt>
              <dd>{plan.stop ?? "—"}</dd>
            </div>
            <div>
              <dt>{copy("initialRisk")}</dt>
              <dd>
                {plan.initialRisk ?? "—"} {session.rulesSnapshot.currency}
              </dd>
            </div>
          </dl>
        </>
      )}
      {plan.guidance && (
        <dl className="process-summary">
          <div>
            <dt>{copy("expectation")}</dt>
            <dd>{plan.guidance.expectation}</dd>
          </div>
          <div>
            <dt>{copy("sessionInvalidation")}</dt>
            <dd>{plan.guidance.invalidation}</dd>
          </div>
          <div>
            <dt>{copy("invalidationResponse")}</dt>
            <dd>
              {copy(
                plan.guidance.response === "wait"
                  ? "responseWait"
                  : plan.guidance.response === "reassess"
                    ? "responseReassess"
                    : plan.guidance.response === "exit"
                      ? "responseExit"
                      : "responseNote",
              )}
              {plan.guidance.responseNote && ` · ${plan.guidance.responseNote}`}
            </dd>
          </div>
        </dl>
      )}
      <details>
        <summary>{copy("planConditions")}</summary>
        <dl className="process-summary">
          {(["windows", "setup", "entry", "exit", "invalidation", "waitConditions"] as const)
            .filter((key) => key !== "invalidation" || !plan.guidance)
            .map((key) => (
              <div key={key}>
                <dt>{copy(key)}</dt>
                <dd>
                  {(key === "entry" || key === "invalidation" ? plan[key] : undefined) ??
                    session.rulesSnapshot[key]}
                </dd>
              </div>
            ))}
          <div>
            <dt>{copy("riskPerTrade")}</dt>
            <dd>
              {session.rulesSnapshot.riskPerTrade} {session.rulesSnapshot.currency}
            </dd>
          </div>
          <div>
            <dt>{copy("maxLoss")}</dt>
            <dd>
              {session.rulesSnapshot.maxDailyLoss} {session.rulesSnapshot.currency}
            </dd>
          </div>
          <div>
            <dt>{copy("maxTrades")}</dt>
            <dd>{session.rulesSnapshot.maxDailyTrades}</dd>
          </div>
        </dl>
        <ProcessLink href={`/method?version=${encodeURIComponent(session.methodVersionId)}`}>
          {copy("openMethod")}
        </ProcessLink>
      </details>
    </section>
  );
}
function Operation({
  session,
  state,
  overdue = false,
}: {
  session: ProcessSession;
  state: ProcessState;
  overdue?: boolean;
}) {
  const copy = useProcessCopy();
  const rows = state.evidence.filter((item) => item.sessionId === session.id);
  const draft = useSessionDraft(session, {
    stage: "closure" as const,
    open: overdue,
    assessment: "" as "" | "conforming" | "deviation" | "unknown",
    notes: "",
    violations: "",
    reconciled: false as boolean,
    noTrades: rows.length === 0,
    outcome: "" as SessionClosure["outcome"] | "",
    correction: "",
  });
  const { open: closing, notes, violations, noTrades, assessment } = draft.value;
  const setClosing = (open: boolean) => draft.setValue((v) => ({ ...v, open }));
  const setNotes = (notes: string) => draft.setValue((v) => ({ ...v, notes }));
  const [noteOpen, setNoteOpen] = useState(Boolean(notes));
  useEffect(() => {
    if (notes) setNoteOpen(true);
  }, [notes]);
  const setDraftValue = draft.setValue;
  useEffect(() => {
    if (rows.length > 0 && noTrades) setDraftValue((v) => ({ ...v, noTrades: false }));
  }, [rows.length, noTrades, setDraftValue]);
  const save = useProcessMutation(() =>
    draft.confirm((value, expectedRevision) => ({
      action: "close",
      expectedRevision,
      closure: {
        notes: value.notes,
        assessment: value.assessment || "unknown",
        violations: value.violations
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
        reconciled: true,
        noTrades: value.noTrades,
        ...(session.plan?.guidance
          ? { outcome: value.outcome || undefined, correction: value.correction }
          : {}),
      },
    })),
  );
  const risk = dailyProcessRisk(session, state.evidence);
  const pause = risk.pause;
  const params = new URLSearchParams({
    t: "trades",
    new: "1",
    processSessionId: session.id,
    methodVersionId: session.methodVersionId,
  });
  if (session.plan?.market) params.set("pair", session.plan.market);
  if (session.plan?.marketDecisionId) params.set("marketDecisionId", session.plan.marketDecisionId);
  return (
    <ProcessPanel
      title={copy(closing ? "closed" : "operation")}
      description={copy(closing ? "closeHint" : "operationHint")}
      focusHeading
    >
      {pause && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm"
        >
          {copy("pause")} · {copy("maxLoss")}: {session.rulesSnapshot.maxDailyLoss}{" "}
          {session.rulesSnapshot.currency} · {copy("maxTrades")}:{" "}
          {session.rulesSnapshot.maxDailyTrades}
          {risk.losses.map((amount, index) => (
            <span className="block mt-2" key={index}>
              {amount.account || copy("unnamedAccount")}: {amount.netPnl.toFixed(2)}{" "}
              {amount.currency}
            </span>
          ))}
        </p>
      )}
      <SessionPlanSummary session={session} />
      {(risk.incomplete.length > 0 || risk.otherCurrencies) && (
        <div className="process-data-notice">
          {risk.incomplete.length > 0 && <p>{copy("incompleteSessionResults")}</p>}
          {risk.otherCurrencies && <p>{copy("separateCurrencies")}</p>}
          <ProcessLink href="/journal?t=trades" beforeNavigate={draft.flush}>
            {copy("historyAccess")}
          </ProcessLink>
        </div>
      )}
      {rows.length > 0 && (
        <ul className="space-y-2 text-sm">
          {rows.map((e) => (
            <li
              key={e.id}
              className="flex flex-wrap justify-between gap-2 border-b border-border pb-2"
            >
              <span>
                {e.note || copy("registerTrade")} · {copy(e.adherence)}
              </span>
              <span className="font-mono">
                {!completeProcessResult(e)
                  ? copy("incompleteResult")
                  : `${e.netR == null ? "—" : e.netR.toFixed(2)} R`}{" "}
                · {copy(e.provenance)}
              </span>
            </li>
          ))}
        </ul>
      )}
      {closing ? (
        <form
          className="process-form"
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate(undefined);
          }}
        >
          <fieldset disabled={save.isPending} className="process-form min-w-0">
            {session.plan?.guidance && (
              <ProcessChoices
                label={copy("sessionOutcome")}
                value={
                  (draft.value.outcome as
                    | "confirmed"
                    | "partial"
                    | "invalidated"
                    | "unassessable"
                    | "") ?? ""
                }
                options={
                  [
                    { value: "confirmed", label: copy("outcomeConfirmed") },
                    { value: "partial", label: copy("outcomePartial") },
                    { value: "invalidated", label: copy("outcomeInvalidated") },
                    { value: "unassessable", label: copy("outcomeUnknown") },
                  ] as const
                }
                onChange={(outcome) => draft.setValue((value) => ({ ...value, outcome }))}
              />
            )}
            <ProcessChoices
              label={copy("recapAssessment")}
              value={assessment ?? ""}
              options={
                [
                  { value: "conforming", label: copy("planRespected") },
                  { value: "deviation", label: copy("planDeviation") },
                  { value: "unknown", label: copy("planReview") },
                ] as const
              }
              onChange={(assessment) => draft.setValue((v) => ({ ...v, assessment }))}
            />
            {assessment === "deviation" ? (
              <ProcessField label={copy("deviationReason")}>
                <textarea
                  required
                  rows={2}
                  maxLength={4000}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                />
              </ProcessField>
            ) : (
              <details open={noteOpen} onToggle={(event) => setNoteOpen(event.currentTarget.open)}>
                <summary>{copy("addOptionalNote")}</summary>
                <div className="process-field pt-3">
                  <textarea
                    aria-label={copy("optionalNote")}
                    rows={2}
                    maxLength={4000}
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                  />
                </div>
              </details>
            )}
            {violations && (
              <p className="text-sm text-muted-foreground">
                {copy("violations")}: {violations}
              </p>
            )}
            {session.plan?.guidance && (
              <ProcessField label={copy("nextCorrection")}>
                <textarea
                  rows={2}
                  maxLength={4000}
                  value={draft.value.correction ?? ""}
                  onChange={(event) =>
                    draft.setValue((value) => ({ ...value, correction: event.target.value }))
                  }
                />
              </ProcessField>
            )}
            {rows.length === 0 && (
              <p className="text-sm text-muted-foreground">{copy("noTrades")}</p>
            )}
            <p className="text-sm text-muted-foreground">{copy("reconcileOnClose")}</p>
            <ProcessError error={save.error} />
            <div className="process-actions">
              <Button type="submit" disabled={save.isPending || draft.status === "conflict"}>
                {copy(save.isPending ? "saving" : "confirmClose")}
              </Button>
              {!overdue && (
                <Button type="button" variant="ghost" onClick={() => setClosing(false)}>
                  {copy("back")}
                </Button>
              )}
            </div>
          </fieldset>
        </form>
      ) : (
        <div className="process-actions">
          {!pause && session.plan?.decision !== "wait" && (
            <Link href={`/journal?${params}`} className={buttonVariants() + " min-h-11"}>
              {copy("registerTrade")}
              <ArrowRight size={16} />
            </Link>
          )}
          <Button
            variant={pause || session.plan?.decision === "wait" ? "default" : "outline"}
            onClick={() => setClosing(true)}
            className="min-h-11"
          >
            {copy("closeSession")}
          </Button>
        </div>
      )}
      <SessionDraftStatus {...draft} retry={draft.flush} />
      <div className="flex flex-wrap gap-3">
        <ProcessLink
          href={processToolHref("/?vista=strumenti", {
            pair: session.plan?.market,
            methodVersionId: session.methodVersionId,
            fromProcess: true,
          })}
          beforeNavigate={draft.flush}
        >
          {copy("allTools")}
        </ProcessLink>
        <ProcessLink
          href={processToolHref("/routine", { fromProcess: true })}
          beforeNavigate={draft.flush}
        >
          {copy("waitPause")}
        </ProcessLink>
      </div>
      <ProcessLink href={`/journal?${params}`} beforeNavigate={draft.flush}>
        {copy("outsidePlan")}
      </ProcessLink>
    </ProcessPanel>
  );
}
export default function Today() {
  const copy = useProcessCopy();
  const { language } = useLanguage();
  const journey = (key: Parameters<typeof journeyText>[1]) => journeyText(language, key);
  const [, navigate] = useLocation();
  const query = useTraderProcess();
  const discard = useProcessMutation(discardProcessSession);
  const simulate = useProcessMutation(startProcessSession);
  if (!query.data) return <ProcessLoading error={query.error} retry={() => void query.refetch()} />;
  const state = query.data;
  const method = state.activeMethod;
  const session = state.session;
  const guidance = state.guidance;
  const action = guidance?.action;
  const sessionMethod = session ? state.methods.find(item => item.id === session.methodVersionId) : method;
  const operative = action === "resume_session" && session && Boolean(session.preparedAt);
  const preparing = action === "check_in" || (action === "resume_session" && session?.day === processDay() && !session.preparedAt);
  const unstarted = action === "resume_session" && session && !session.preparedAt && session.day < processDay();
  const inlineAction = !method || action === "confirm_verification" || action === "review_period" || operative || preparing || unstarted || action === "done";
  return <ProcessFrame title={copy("today")} subtitle={copy("todayIntro")}>
    <PhaseRail phase={method?.phase ?? "define"} />
    {method && <p className="text-sm text-muted-foreground">{sessionMethod?.name ?? method.name} · {copy("version")} {sessionMethod?.version ?? method.version} · {copy(sessionMethod?.phase ?? method.phase)}{session && ` · ${session.day}`}</p>}
    {session && session.methodVersionId !== method?.id && <p className="text-sm text-muted-foreground">{copy("pinnedVersion")}</p>}
    {session && ["operation", "closed"].includes(session.state) && <SessionRail session={session} />}
    {guidance && (inlineAction ? <p className="text-sm leading-relaxed text-muted-foreground">{journey(guidance.reason)}</p> :
      <ProcessNextAction state={state} action={guidance.reason !== "verification_waiting"} />)}
    {!method ? <MethodEditor previous={null} stored={state.methodDraft}
      onDone={() => { void query.refetch(); }} onCancel={() => navigate("/journal?t=trades")} />
    : operative && session ? <Operation key={session.id} session={session} state={state} overdue={session.day < processDay()} />
    : unstarted && session ? <ProcessPanel title={journey("discardDraft")} focusHeading>
      <ProcessError error={discard.error} />
      <Button className="self-start" disabled={discard.isPending} onClick={() => discard.mutate(session)}>{journey("discardDraft")}</Button>
    </ProcessPanel>
    : action === "confirm_verification" ? <ProcessPanel title={copy("startVerification")}>
      <VerificationStart key={method.id} method={method} initiallyOpen />
    </ProcessPanel>
    : action === "review_period" && guidance?.reviewDue ? <ProcessReviewForm key={`${method.id}:${guidance.reviewDue.kind}:${guidance.reviewDue.periodStart}`} state={state} due={guidance.reviewDue} />
    : preparing ? <GuidedCheckIn key={`check:${session?.methodVersionId ?? method.id}`} session={session} state={state} />
    : action === "done" && session ? <ProcessPanel title={copy("done")} focusHeading>
      {session.closure?.assessment && <p className="text-sm">{copy(session.closure.assessment === "conforming" ? "planRespected" : session.closure.assessment === "deviation" ? "planDeviation" : "planReview")}</p>}
      {session.closure?.notes && <p className="text-sm text-muted-foreground">{session.closure.notes}</p>}
      <ProcessLink href={`/journal?t=sessioni&session=${encodeURIComponent(session.id)}`}>{copy("openSessionJournal")}</ProcessLink>
    </ProcessPanel> : null}
    {method && action === "collect_evidence" && guidance?.reason !== "verification_waiting" && <p className="text-sm text-muted-foreground">{journey("simulation")} · <ProcessLink href={`/backtest?methodVersionId=${encodeURIComponent(method.id)}`}>{copy("replay")}</ProcessLink><Button type="button" variant="ghost" className="ml-3 min-h-11" disabled={simulate.isPending} onClick={() => simulate.mutate(method.id)}>{journey("optionalPractice")}</Button><ProcessError error={simulate.error} /></p>}
    {method && <details>
      <summary>{copy("rules")}</summary>
      <dl className="process-summary">{(["windows", "setup", "entry", "exit", "invalidation", "waitConditions"] as const).map(key => <div key={key}><dt>{copy(key)}</dt><dd>{(session?.rulesSnapshot ?? method.rules)[key]}</dd></div>)}</dl>
      <ProcessLink href={session ? `/method?version=${encodeURIComponent(session.methodVersionId)}` : "/method"}>{copy("openMethod")}</ProcessLink>
    </details>}
    {!operative && <ProcessLink href="/journal?t=trades">{journey("facts")}</ProcessLink>}
  </ProcessFrame>;
}
