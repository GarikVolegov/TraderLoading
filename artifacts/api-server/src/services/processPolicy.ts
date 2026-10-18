import {
  processDay,
  type ProcessCheck,
  type ProcessEvidence,
  type ProcessGuidance,
  type ProcessMethod,
  type ProcessProgress,
  type ProcessReport,
  type ProcessReview,
  type ProcessReviewDue,
  type ProcessReviewPeriod,
  type ProcessSession,
} from "../../../../contracts/trader-process.js";
import { getJournalRecapPeriodForDate } from "./journalRecapPeriods.js";
import { computeProcessProgress, economicallyComplete } from "./traderProcess.js";

export const reviewPeriodKey = (period: ProcessReviewPeriod) =>
  `${period.kind}:${period.periodStart}:${period.periodEnd}`;

export function hasApplicationHold(methodId: string, reviews: ProcessReview[]): boolean {
  return reviews.some((review) => review.methodVersionId === methodId && review.decision === "reverify");
}

/** Only activity recorded after the policy started can create an obligation. */
export function pendingProcessReviews(
  method: ProcessMethod | null,
  sessions: ProcessSession[],
  evidence: ProcessEvidence[],
  reviews: ProcessReview[],
  now = new Date(),
): ProcessReviewDue[] {
  if (!method || !method.applicationStartedAt || !method.reviewPolicyStartedAt) return [];
  const basis = [method.applicationStartedAt, method.reviewPolicyStartedAt].sort().at(-1)!;
  const today = processDay(now);
  const completed = new Set(
    reviews.filter((review) => review.methodVersionId === method.id)
      .flatMap((review) => review.coveredPeriods.map(reviewPeriodKey)),
  );
  const activity = [
    ...sessions.filter((session) => session.methodVersionId === method.id &&
      session.mode === "application" && session.preparedAt != null &&
      session.preparedAt >= basis).map((session) => session.preparedAt!),
    ...evidence.filter((row) => row.methodVersionId === method.id && row.purpose === "live" &&
      row.executionEnvironment === "real" && row.createdAt >= basis && row.observedAt >= basis)
      .map((row) => row.observedAt),
  ];
  const periods = new Map<string, ProcessReviewPeriod>();
  for (const instant of activity) {
    for (const kind of ["weekly", "four_week"] as const) {
      const { periodStart, periodEnd } = getJournalRecapPeriodForDate(kind, new Date(instant));
      const period = { kind, periodStart, periodEnd };
      if (periodEnd < today && !completed.has(reviewPeriodKey(period)))
        periods.set(reviewPeriodKey(period), period);
    }
  }
  const pending = [...periods.values()];
  const groups: ProcessReviewDue[] = [];
  const covered = new Set<string>();
  for (const period of pending.filter((value) => value.kind === "four_week")) {
    const contained = pending.filter((value) =>
      value.periodStart >= period.periodStart && value.periodEnd <= period.periodEnd);
    contained.forEach((value) => covered.add(reviewPeriodKey(value)));
    groups.push({ ...period, coveredPeriods: contained.sort((a, b) =>
      a.periodStart.localeCompare(b.periodStart) || a.kind.localeCompare(b.kind)) });
  }
  for (const period of pending) {
    if (!covered.has(reviewPeriodKey(period))) groups.push({ ...period, coveredPeriods: [period] });
  }
  return groups.sort((a, b) => a.periodStart.localeCompare(b.periodStart) || a.periodEnd.localeCompare(b.periodEnd));
}

/** The report stays cumulative: a weekly review never demands a new weekly sample. */
export function assessProcessReview(
  method: ProcessMethod,
  evidence: ProcessEvidence[],
  sessions: ProcessSession[],
  now = new Date(),
): { checks: ProcessCheck[]; report: ProcessReport; decision: ProcessReview["decision"] } {
  const report = computeProcessProgress({ ...method, phase: "apply" }, evidence, sessions, [], null, now).report;
  const protocol = method.protocol;
  const checks: ProcessCheck[] = [];
  if (protocol && report.eligibleSamples >= protocol.minSamples) {
    checks.push({ key: "expectancy", label: "Aspettativa netta", met: report.expectancyR != null &&
      report.expectancyR >= protocol.minExpectancyR, detail: `Criterio personale ≥ ${protocol.minExpectancyR} R netto.` });
    checks.push({ key: "drawdown", label: "Drawdown", met: report.drawdownR != null &&
      report.drawdownR <= protocol.maxDrawdownR, detail: `Criterio personale ≤ ${protocol.maxDrawdownR} R.` });
  }
  if (protocol && report.adherencePct != null) {
    checks.push({ key: "adherence", label: "Aderenza", met: report.adherencePct >= protocol.minAdherencePct,
      detail: `Criterio personale ≥ ${protocol.minAdherencePct}%.` });
  }
  return { checks, report, decision: checks.some((check) => !check.met) ? "reverify" : "continue" };
}

export function processSessionMode(method: ProcessMethod) {
  return method.phase === "define" ? "practice" as const : method.phase === "verify" ? "validation" as const : "application" as const;
}

export function resolveProcessGuidance(input: {
  method: ProcessMethod | null;
  session: ProcessSession | null;
  progress: ProcessProgress;
  pendingReviews: ProcessReviewDue[];
  reviews: ProcessReview[];
  now?: Date;
}): ProcessGuidance {
  const { method, session, progress, pendingReviews, reviews } = input;
  const now = input.now ?? new Date();
  const hold = method ? hasApplicationHold(method.id, reviews) : false;
  const due = pendingReviews[0] ?? null;
  const base = {
    methodVersionId: method?.id ?? null,
    sessionId: session?.id ?? null,
    sessionMode: session?.mode ?? (method ? processSessionMode(method) : null),
    applicationHold: hold,
    blockers: progress.checks.filter((check) => !check.met),
    reviewDue: due,
    nextAvailableAt: null,
  } satisfies Omit<ProcessGuidance, "action" | "reason" | "href">;
  const decision = (action: ProcessGuidance["action"], reason: ProcessGuidance["reason"], href: string): ProcessGuidance =>
    ({ ...base, action, reason, href });
  // An actual session always remains documentable, even when a new obligation has arrived.
  if (session && session.state !== "closed" && (session.preparedAt || session.day < processDay(now)))
    return decision("resume_session", "work_pending", "/");
  if (!method) return decision("define_method", "method_missing", "/method");
  if (hold) return decision("revise_method", "reverification_required", `/method?revise=${method.id}`);
  if (due) return decision("review_period", "review_due", "/?review=due");
  if (method.phase === "define")
    return decision("confirm_verification", "protocol_required", "/method");
  if (method.phase === "verify") {
    if (session?.mode === "validation" && session.day === processDay(now) && session.state !== "closed" &&
      method.protocol && processDay(now) >= method.protocol.periodStart && processDay(now) <= method.protocol.periodEnd)
      return decision("check_in", "session_ready", "/");
    if (progress.canAdvance) return decision("review_verification", "requirements_met", "/method");
    const missing = progress.checks.filter((check) => !check.met);
    if (method.protocol && missing.length === 1 && missing[0].key === "period") {
      const after = new Date(`${method.protocol.periodEnd}T12:00:00Z`);
      after.setUTCDate(after.getUTCDate() + 1);
      return { ...decision("collect_evidence", "verification_waiting", "/method"), nextAvailableAt: after.toISOString().slice(0, 10) };
    }
    return decision("collect_evidence", "verification_in_progress", "/method?section=evidence");
  }
  if (method.phase === "apply" && progress.canAdvance)
    return decision("review_application", "requirements_met", "/method");
  if (session?.state === "closed" && session.day === processDay(now))
    return decision("done", "day_complete", "/");
  return decision("check_in", "session_ready", "/");
}

/** Daily limits use canonical identity and never offset separate accounts/currencies. */
export function processDailyLimits(session: ProcessSession, evidence: ProcessEvidence[]) {
  const unique = new Map<string, ProcessEvidence>();
  for (const row of evidence) {
    if (row.methodVersionId !== session.methodVersionId || row.executionEnvironment !== "real" ||
      processDay(new Date(row.observedAt)) !== session.day) continue;
    const key = row.accountTradeId != null ? `trade:${row.accountTradeId}` : row.id;
    if (!unique.has(key)) unique.set(key, row);
  }
  const rows = [...unique.values()];
  const amounts = new Map<string, number>();
  for (const row of rows) {
    if (row.costsStatus !== "included" || row.provenance === "estimated" || row.netPnl == null ||
      row.currency !== session.rulesSnapshot.currency || !Number.isFinite(row.netPnl)) continue;
    const key = row.account || row.id;
    amounts.set(key, (amounts.get(key) ?? 0) + row.netPnl);
  }
  return {
    tradeLimit: rows.length >= session.rulesSnapshot.maxDailyTrades,
    lossLimit: [...amounts.values()].some((value) => value <= -session.rulesSnapshot.maxDailyLoss),
    incomplete: rows.some((row) => !economicallyComplete(row)),
  };
}
