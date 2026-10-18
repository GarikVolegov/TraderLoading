import { useCockpitCopy } from "@/hooks/useCockpitCopy";
import { Link, useSearch } from "wouter";
import { useTraderProcess } from "@/hooks/useTraderProcess";
import { ProcessLoading, ProcessPanel, useProcessCopy } from "@/components/process/ProcessUI";
import { completeProcessResult } from "@/lib/processGuidance";
import type { IntelligenceContext } from "@/lib/marketIntelligenceApi";
import "@/components/process/process.css";

/** A projection of confirmed process records: drafts never become journal entries. */
export function SessionJournal() {
  const ck = useCockpitCopy();
  const query = useTraderProcess();
  const copy = useProcessCopy();
  const selected = new URLSearchParams(useSearch()).get("session");
  if (!query.data) return <ProcessLoading error={query.error} retry={() => void query.refetch()} />;
  const state = query.data;
  const sessions = (state.sessions ?? (state.session ? [state.session] : []))
    .filter((session) => session.preparedAt && session.plan)
    .sort((a, b) => b.day.localeCompare(a.day));
  return (
    <section className="process-workspace session-journal" aria-label={copy("automaticJournal")}>
      <ProcessPanel
        title={copy("automaticJournal")}
        description={copy("automaticJournalDescription")}
      >
        {!sessions.length && (
          <Link href="/" className="underline underline-offset-4">
            {copy("prepareTrader")}
          </Link>
        )}
        {sessions.map((session) => {
          const plan = session.plan!;
          const guidance = plan.guidance;
          const context = guidance?.contextSnapshotId
            ? (state.contextSnapshots?.[guidance.contextSnapshotId] as
                | IntelligenceContext
                | undefined)
            : undefined;
          const evidence = state.evidence.filter((item) => item.sessionId === session.id);
          const closure = session.closure;
          const response = guidance?.response;
          return (
            <details
              key={session.id}
              open={selected === session.id || sessions.length === 1}
              className="session-journal-card"
              data-session-id={session.id}
            >
              <summary>
                <span className="font-mono">
                  {session.day} · {plan.market ?? session.rulesSnapshot.markets.join(", ")}
                </span>
                <span className="text-xs text-muted-foreground">
                  {copy(closure ? "savedPostTrade" : "savedPreTrade")}
                </span>
              </summary>
              <div className="process-form">
                <p className="text-xs text-muted-foreground">
                  {copy(session.mode === "practice" ? "practiceHint" : "apply")} ·{" "}
                  {state.methods.find((method) => method.id === session.methodVersionId)?.name}
                </p>
                <details>
                  <summary>{copy("checklist")}</summary>
                  <ul className="space-y-2">
                    {session.rulesSnapshot.checklist.map((criterion, index) => (
                      <li key={index}>
                        {session.checklist[index] ? "✓ " : "— "}
                        {criterion}
                      </li>
                    ))}
                  </ul>
                </details>
                {context && (
                  <details>
                    <summary>
                      {copy("pairContext")} · {context.generatedAt.slice(0, 16).replace("T", " ")}
                    </summary>
                    <p className="text-sm">
                      {context.pair}
                      {ck("cockpit.ui.a45ad81b86")}
                      {context.score ?? "—"}
                    </p>
                    <ul className="space-y-2 text-sm">
                      {context.components.map((item) => (
                        <li key={item.id}>
                          {item.id} · {item.source} ·{" "}
                          {item.status === "available" ? (item.score ?? "—") : "—"}
                        </li>
                      ))}
                    </ul>
                    <ul className="space-y-2 text-sm">
                      {context.news.map((item) => (
                        <li key={item.url}>
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline"
                          >
                            {item.title}
                          </a>
                        </li>
                      ))}
                    </ul>
                    <ul className="text-sm">
                      {context.events.map((item, index) => (
                        <li key={index}>
                          {item.date} · {item.country} · {item.title}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
                {guidance?.cockpit && (
                  <details>
                    <summary>
                      {ck("cockpit.ui.490ee99e18")}
                      {guidance.cockpit.mode === "scalp" ? "Scalping" : "Swing"}
                    </summary>
                    <dl className="process-plan-facts">
                      <div>
                        <dt>{ck("cockpit.ui.3740ed43e7")}</dt>
                        <dd>
                          {guidance.cockpit.cycle} · {guidance.cockpit.context}
                        </dd>
                      </div>
                      <div>
                        <dt>{ck("cockpit.ui.09007a3559")}</dt>
                        <dd>
                          {guidance.cockpit.scenario || ck("Attesa")} ·{" "}
                          {guidance.cockpit.trigger || ck("Non presente")}
                        </dd>
                      </div>
                      <div>
                        <dt>{ck("cockpit.ui.e82260fbbe")}</dt>
                        <dd>{guidance.cockpit.target || ck("Non definito")}</dd>
                      </div>
                      <div>
                        <dt>{ck("cockpit.ui.8d42603460")}</dt>
                        <dd>
                          {guidance.cockpit.itfSchema ? ck("Sì") : ck("No")} /{" "}
                          {guidance.cockpit.ltfSchema ? ck("Sì") : ck("No")}
                        </dd>
                      </div>
                      <div>
                        <dt>{ck("cockpit.ui.2c924e3088")}</dt>
                        <dd>{guidance.cockpit.notes || "—"}</dd>
                      </div>
                      <div>
                        <dt>{ck("cockpit.ui.240b517f9f")}</dt>
                        <dd>
                          {guidance.cockpit.version} · {guidance.cockpit.day}
                        </dd>
                      </div>
                    </dl>
                  </details>
                )}
                <dl className="process-plan-facts">
                  {guidance && (
                    <>
                      <div>
                        <dt>{copy("expectation")}</dt>
                        <dd>{guidance.expectation}</dd>
                      </div>
                      <div>
                        <dt>{copy("sessionInvalidation")}</dt>
                        <dd>{guidance.invalidation}</dd>
                      </div>
                      <div>
                        <dt>{copy("invalidationResponse")}</dt>
                        <dd>
                          {response === "custom"
                            ? guidance.responseNote
                            : copy(
                                response === "exit"
                                  ? "responseExit"
                                  : response === "reassess"
                                    ? "responseReassess"
                                    : "responseWait",
                              )}
                        </dd>
                      </div>
                    </>
                  )}
                  <div>
                    <dt>{copy("plan")}</dt>
                    <dd>
                      {plan.decision === "wait" ? plan.waitReason : `${plan.setup} · ${plan.entry}`}
                    </dd>
                  </div>
                  {plan.decision === "trade" && (
                    <>
                      <div>
                        <dt>{copy("stop")}</dt>
                        <dd>{plan.stop}</dd>
                      </div>
                      <div>
                        <dt>{copy("initialRisk")}</dt>
                        <dd>
                          {plan.initialRisk} {session.rulesSnapshot.currency}
                        </dd>
                      </div>
                    </>
                  )}
                  {closure?.outcome && (
                    <div>
                      <dt>{copy("sessionOutcome")}</dt>
                      <dd>
                        {copy(
                          closure.outcome === "confirmed"
                            ? "outcomeConfirmed"
                            : closure.outcome === "partial"
                              ? "outcomePartial"
                              : closure.outcome === "invalidated"
                                ? "outcomeInvalidated"
                                : "outcomeUnknown",
                        )}
                      </dd>
                    </div>
                  )}
                  {closure?.assessment && (
                    <div>
                      <dt>{copy("adherence")}</dt>
                      <dd>
                        {copy(
                          closure.assessment === "conforming"
                            ? "planRespected"
                            : closure.assessment === "deviation"
                              ? "planDeviation"
                              : "planReview",
                        )}
                      </dd>
                    </div>
                  )}
                </dl>
                {closure?.notes && <p className="whitespace-pre-wrap text-sm">{closure.notes}</p>}
                {closure?.violations.length ? (
                  <ul className="text-sm">
                    {closure.violations.map((violation, index) => (
                      <li key={index}>{violation}</li>
                    ))}
                  </ul>
                ) : null}
                {closure?.correction && (
                  <p className="process-plan-summary text-sm">
                    <strong>{copy("correctionCarry")}</strong>
                    <br />
                    <span className="block">{closure.correction}</span>
                  </p>
                )}
                {closure?.noTrades && <p className="text-sm">{copy("noTrades")}</p>}
                {evidence.map((item) => (
                  <p key={item.id} className="text-sm font-mono">
                    {item.account ?? "—"} · {item.netPnl ?? "—"} {item.currency ?? "—"} ·{" "}
                    {completeProcessResult(item)
                      ? `${item.netR?.toFixed(2) ?? "—"} R`
                      : copy("incompleteResult")}{" "}
                    · {copy(item.provenance)}
                  </p>
                ))}
                <Link
                  href={
                    session.state === "closed"
                      ? `/journal?t=trades&processSessionId=${session.id}`
                      : "/"
                  }
                  className="underline underline-offset-4"
                >
                  {copy(session.state === "closed" ? "journal" : "today")}
                </Link>
              </div>
            </details>
          );
        })}
      </ProcessPanel>
    </section>
  );
}
