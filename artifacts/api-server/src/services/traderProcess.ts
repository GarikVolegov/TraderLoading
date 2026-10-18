import {
  calculateNetR,
  processDay,
  type ProcessEvidence,
  type ProcessImprovement,
  type ProcessMethod,
  type ProcessProgress,
  type ProcessReport,
  type ProcessSession,
  type ProcessReviewDue,
} from "../../../../contracts/trader-process.js";
export { calculateNetR, processDay };
const DAY = 86_400_000;
export function economicallyComplete(e: ProcessEvidence): boolean {
  return (
    (e.source !== "account_trade" || e.accountTradeId != null) &&
    (e.source !== "replay" || e.backtestTradeId != null) &&
    e.costsStatus === "included" &&
    e.provenance !== "estimated" &&
    e.initialRisk != null &&
    e.initialRisk > 0 &&
    e.netPnl != null &&
    Number.isFinite(e.netPnl) &&
    e.netR != null &&
    Number.isFinite(e.netR) &&
    !!e.currency &&
    !!e.account &&
    Math.abs(e.netR - (calculateNetR(e.netPnl, e.initialRisk) ?? NaN)) < 1e-8
  );
}
export function computeProcessProgress(
  method: ProcessMethod | null,
  evidence: ProcessEvidence[],
  sessions: ProcessSession[],
  improvements: ProcessImprovement[],
  todaySession: ProcessSession | null,
  now: Date = new Date(),
  pendingReviews?: ProcessReviewDue[],
): ProcessProgress {
  const empty: ProcessReport = {
    eligibleSamples: 0,
    incompleteSamples: 0,
    expectancyR: null,
    drawdownR: null,
    adherencePct: null,
    closedSessions: 0,
    amounts: [],
  };
  if (!method)
    return {
      phase: "define",
      checks: [],
      canAdvance: false,
      nextAction: "define_method",
      report: empty,
    };
  const protocol = method.protocol;
  const belongsToPhase = (e: ProcessEvidence) => {
    const session = e.sessionId ? sessions.find((s) => s.id === e.sessionId) : null;
    if (session?.mode === "practice") return false;
    if (method.phase === "verify")
      return e.executionEnvironment === "simulation" && (!session || session.mode === "validation");
    return e.executionEnvironment === "real" && (!session || session.mode !== "validation");
  };
  const rows = evidence.filter((e) => e.methodVersionId === method.id &&
    (!e.sessionId || !sessions.some(session => session.id === e.sessionId && session.mode === "practice")));
  const basis =
    method.phase === "verify"
      ? (method.verificationStartedAt ?? method.phaseStartedAt)
      : (method.applicationStartedAt ?? method.phaseStartedAt);
  const relevant = rows.filter((e) =>
    method.phase === "verify"
      ? e.purpose === "validation" &&
        protocol != null &&
        processDay(new Date(e.observedAt)) >= protocol.periodStart &&
        processDay(new Date(e.observedAt)) <= protocol!.periodEnd &&
        e.observedAt >= basis &&
        e.createdAt >= basis
      : e.purpose === "live" && e.observedAt >= basis,
  );
  const eligible = relevant
    .filter(belongsToPhase)
    .filter(economicallyComplete)
    .sort((a, b) => a.observedAt.localeCompare(b.observedAt) || a.id.localeCompare(b.id));
  let equity = 0,
    peak = 0,
    drawdown = 0;
  for (const e of eligible) {
    equity += e.netR!;
    peak = Math.max(peak, equity);
    drawdown = Math.max(drawdown, peak - equity);
  }
  const liveRows = rows.filter((e) => e.purpose === "live" && e.observedAt >= basis);
  const live = liveRows.filter(
    (e) =>
      e.executionEnvironment === "real" && e.purpose === "live" &&
      e.observedAt >= basis &&
      e.sessionId != null &&
      sessions.some(
        (s) =>
          s.mode !== "practice" && s.mode !== "validation" &&
          s.id === e.sessionId &&
          s.preparedAt != null &&
          s.closedAt != null &&
          s.preparedAt <= e.observedAt,
      ),
  );
  const assessmentAllows = (s: ProcessSession | undefined) =>
    !s?.closure?.assessment || s.closure.assessment === "conforming";
  const documented = live.filter((e) => e.adherence !== "unknown");
  const closed = sessions.filter(
    (s) =>
      s.mode !== "practice" && s.mode !== "validation" &&
      s.methodVersionId === method.id &&
      s.closedAt != null &&
      s.preparedAt != null &&
      s.createdAt >= basis,
  );
  // No-trade sessions document following the plan without manufacturing a trade result.
  const noTrades = closed.filter((s) => s.closure?.noTrades && s.plan?.decision === "wait");
  const adherenceDenominator = liveRows.length + noTrades.length;
  const adherenceNumerator =
    documented.filter(
      (e) =>
        e.adherence === "conforming" &&
        assessmentAllows(sessions.find((s) => s.id === e.sessionId)) &&
        sessions.find((s) => s.id === e.sessionId)?.closure?.violations.length === 0,
    ).length +
    noTrades.filter((s) => assessmentAllows(s) && s.closure!.violations.length === 0).length;
  const amounts = new Map<string, ProcessReport["amounts"][number]>();
  for (const e of eligible) {
    const key = JSON.stringify([e.account, e.currency]);
    const group = amounts.get(key) ?? {
      account: e.account!,
      currency: e.currency!,
      netPnl: 0,
      samples: 0,
    };
    group.netPnl += e.netPnl!;
    group.samples++;
    amounts.set(key, group);
  }
  const report: ProcessReport = {
    eligibleSamples: eligible.length,
    incompleteSamples: relevant.length - eligible.length,
    expectancyR: eligible.length ? equity / eligible.length : null,
    drawdownR: eligible.length ? drawdown : null,
    adherencePct: adherenceDenominator ? (100 * adherenceNumerator) / adherenceDenominator : null,
    closedSessions: closed.length,
    amounts: [...amounts.values()],
  };
  const checks: ProcessProgress["checks"] = [];
  const check = (key: string, label: string, met: boolean, detail: string) =>
    checks.push({ key, label, met, detail });
  if (method.phase === "define") {
    const rules = method.rules;
    check(
      "rules",
      "Regole complete",
      rules.markets.length > 0 &&
        rules.checklist.length > 0 &&
        [
          rules.windows,
          rules.setup,
          rules.entry,
          rules.exit,
          rules.invalidation,
          rules.waitConditions,
        ].every(Boolean),
      "Mercati, setup, entrate, uscite, attesa e checklist definiti.",
    );
    check(
      "risk",
      "Limiti confermati",
      !!method.riskConfirmedAt &&
        rules.riskPerTrade > 0 &&
        rules.maxDailyLoss > 0 &&
        rules.maxDailyTrades > 0 &&
        !!rules.currency,
      "Rischio e limiti personali confermati.",
    );
    check(
      "protocol",
      "Protocollo fissato prima del test",
      protocol != null &&
        protocol.periodStart >= processDay(new Date(method.createdAt)) &&
        protocol!.periodEnd >= protocol!.periodStart &&
        processDay(now) <= protocol!.periodEnd,
      "Campione, periodo e criteri fissati prima di raccogliere evidenze di validazione.",
    );
  } else if (method.phase === "verify" && protocol) {
    check(
      "samples",
      "Campione completo",
      eligible.length >= protocol!.minSamples,
      `${eligible.length}/${protocol!.minSamples} evidenze di validazione complete; ${report.incompleteSamples} incomplete.`,
    );
    check(
      "period",
      "Periodo concluso",
      processDay(now) > protocol!.periodEnd,
      `Periodo ${protocol!.periodStart} – ${protocol!.periodEnd}.`,
    );
    check(
      "expectancy",
      "Aspettativa netta",
      report.expectancyR != null && report.expectancyR >= protocol!.minExpectancyR,
      `Obiettivo ≥ ${protocol!.minExpectancyR} R netto.`,
    );
    check(
      "drawdown",
      "Drawdown entro limite",
      report.drawdownR != null && report.drawdownR <= protocol!.maxDrawdownR,
      `Limite ≤ ${protocol!.maxDrawdownR} R.`,
    );
  } else if (method.phase === "apply" && protocol) {
    const elapsed = Math.floor(
      (Date.parse(processDay(now)) - Date.parse(processDay(new Date(basis)))) / DAY,
    );
    const reviews = improvements.filter(
      (i) =>
        i.methodVersionId === method.id &&
        i.periodEnd >= processDay(new Date(basis)) &&
        i.periodEnd < processDay(now) &&
        i.createdAt >= basis,
    );
    check(
      "observation",
      "Periodo osservato",
      elapsed >= protocol!.observationDays,
      `${elapsed}/${protocol!.observationDays} giorni osservati.`,
    );
    check(
      "sessions",
      "Sessioni documentate",
      closed.length > 0,
      `${closed.length} sessioni preparate e chiuse.`,
    );
    check(
      "adherence",
      "Aderenza documentata",
      report.adherencePct != null && report.adherencePct >= protocol!.minAdherencePct,
      `Obiettivo ≥ ${protocol!.minAdherencePct}%; dati sconosciuti non attestano aderenza.`,
    );
    check(
      "samples",
      "Campione economico",
      eligible.length >= protocol!.minSamples,
      `${eligible.length}/${protocol!.minSamples} risultati live completi.`,
    );
    check(
      "expectancy",
      "Aspettativa netta",
      report.expectancyR != null && report.expectancyR >= protocol!.minExpectancyR,
      `Obiettivo personale ≥ ${protocol!.minExpectancyR} R netto.`,
    );
    check(
      "drawdown",
      "Drawdown entro limite",
      report.drawdownR != null && report.drawdownR <= protocol!.maxDrawdownR,
      `Limite personale ≤ ${protocol!.maxDrawdownR} R.`,
    );
    check(
      "weekly_review",
      "Revisione settimanale",
      pendingReviews ? !pendingReviews.some((r) => r.coveredPeriods.some((p) => p.kind === "weekly"))
        : elapsed < 7 || reviews.some((r) => r.recapKind === "weekly"),
      elapsed < 7
        ? "Non ancora dovuta."
        : "Recap settimanale con un miglioramento e un criterio di verifica.",
    );
    check(
      "period_review",
      "Revisione di 28 giorni",
      pendingReviews ? !pendingReviews.some((r) => r.coveredPeriods.some((p) => p.kind === "four_week"))
        : elapsed < 28 || reviews.some((r) => r.recapKind === "four_week"),
      elapsed < 28
        ? "Non ancora dovuta."
        : "Recap di 28 giorni con un miglioramento e un criterio di verifica.",
    );
  }
  const canAdvance = protocol != null && checks.length > 0 && checks.every((c) => c.met);
  let nextAction: ProcessProgress["nextAction"];
  if (method.phase === "define") nextAction = canAdvance ? "confirm_verification" : "define_method";
  else if (method.phase === "verify")
    nextAction = canAdvance ? "review_verification" : "collect_evidence";
  else if (method.phase === "apply" && canAdvance) nextAction = "review_application";
  else if (!todaySession || todaySession.methodVersionId !== method.id)
    nextAction = "prepare_session";
  else if (todaySession.state === "preparation") nextAction = "prepare_session";
  else if (todaySession.state === "plan") nextAction = "plan_session";
  else if (todaySession.state === "operation")
    nextAction = todaySession.plan?.decision === "wait" ? "close_session" : "operate";
  else nextAction = "continue_improvement";
  return { phase: method.phase, checks, canAdvance, nextAction, report };
}
