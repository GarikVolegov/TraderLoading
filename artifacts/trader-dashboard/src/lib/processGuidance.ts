import {
  calculateNetR,
  processDay,
  type ProcessEvidence,
  type ProcessMethod,
  type ProcessProgress,
  type ProcessSession,
} from "../../../../contracts/trader-process";
import { getJournalRecapPeriod, isJournalRecapEditable } from "./journalRecapPeriods";

/** Prefer work the trader can actually do now over waiting for a period to finish. */
export function methodGuidance(method: ProcessMethod, progress: ProcessProgress, now = new Date()) {
  const missing = progress.checks.filter((check) => !check.met);
  const review = missing.find((check) => ["weekly_review", "period_review"].includes(check.key));
  const requirement =
    review ??
    missing.find((check) => !["period", "observation"].includes(check.key)) ??
    missing[0] ??
    null;
  if (method.phase === "consolidate") return { kind: "continue" as const, requirement: null };
  if (method.phase === "define")
    return {
      kind:
        method.protocol && method.protocol.periodEnd < processDay(now)
          ? ("expired" as const)
          : ("define" as const),
      requirement,
    };
  if (progress.canAdvance) return { kind: "advance" as const, requirement: null };
  if (review) {
    const period = getJournalRecapPeriod(
      review.key === "period_review" ? "four_week" : "weekly",
      now,
    );
    return {
      kind: isJournalRecapEditable(period, now)
        ? ("review" as const)
        : ("scheduled_review" as const),
      requirement: review,
      reviewWindow: period,
    };
  }
  if (method.phase === "verify" && requirement?.key === "period")
    return { kind: "wait" as const, requirement };
  return {
    kind: method.phase === "verify" ? ("evidence" as const) : ("session" as const),
    requirement,
  };
}

/** An R number alone cannot attest a complete net outcome. */
export function completeProcessResult(row: ProcessEvidence) {
  const computed = calculateNetR(row.netPnl, row.initialRisk);
  return (
    (row.source !== "account_trade" || row.accountTradeId != null) &&
    (row.source !== "replay" || row.backtestTradeId != null) &&
    row.costsStatus === "included" &&
    row.provenance !== "estimated" &&
    Boolean(row.account) &&
    Boolean(row.currency) &&
    computed != null &&
    row.netR != null &&
    Number.isFinite(row.netR) &&
    Math.abs(row.netR - computed) < 1e-8
  );
}

/** Never offset one account's losses with another's gains, or convert currencies implicitly. */
export function dailyProcessRisk(session: ProcessSession, evidence: ProcessEvidence[]) {
  const unique = new Map<string, ProcessEvidence>();
  for (const row of evidence) {
    if (
      row.methodVersionId !== session.methodVersionId ||
      !(row.purpose === "live" || row.sessionId === session.id) ||
      processDay(new Date(row.observedAt)) !== session.day
    )
      continue;
    const key =
      row.accountTradeId != null
        ? `trade:${row.accountTradeId}`
        : row.backtestTradeId != null
          ? `replay:${row.backtestTradeId}`
          : row.id;
    if (!unique.has(key)) unique.set(key, row);
  }
  const rows = [...unique.values()];
  const amounts = new Map<string, { account: string | null; currency: string; netPnl: number }>();
  for (const row of rows) {
    if (
      row.costsStatus !== "included" ||
      row.provenance === "estimated" ||
      row.netPnl == null ||
      !Number.isFinite(row.netPnl) ||
      !row.currency
    )
      continue;
    // An unidentified account cannot be safely merged with another unidentified account.
    const key = JSON.stringify([row.account || row.id, row.currency]);
    const amount = amounts.get(key) ?? { account: row.account, currency: row.currency, netPnl: 0 };
    amount.netPnl += row.netPnl;
    amounts.set(key, amount);
  }
  const losses = [...amounts.values()].filter(
    (amount) =>
      amount.currency === session.rulesSnapshot.currency &&
      amount.netPnl <= -session.rulesSnapshot.maxDailyLoss,
  );
  const tradeLimit = rows.length >= session.rulesSnapshot.maxDailyTrades;
  const incomplete = rows.filter((row) => !completeProcessResult(row));
  return {
    rows,
    amounts: [...amounts.values()],
    losses,
    tradeLimit,
    pause: tradeLimit || losses.length > 0,
    incomplete,
    otherCurrencies: rows.some(
      (row) => row.currency && row.currency !== session.rulesSnapshot.currency,
    ),
  };
}
