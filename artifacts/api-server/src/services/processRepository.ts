import { and, desc, eq, inArray } from "drizzle-orm";
import { db, processMethodsTable, processDraftsTable, processSessionsTable, processEvidenceTable,
  processImprovementsTable, processReviewsTable, journalRecapsTable, marketSnapshotsTable } from "@workspace/db";
import { computeProcessProgress, processDay } from "./traderProcess.js";
import { pendingProcessReviews, resolveProcessGuidance } from "./processPolicy.js";
import type { MethodRules, ProcessMethod, ProcessEvidence, ProcessSession, ProcessSessionDraft,
  ProcessImprovement, ProcessPhase, ProcessState, ProcessMethodDraft, VerificationProtocol,
  ProcessReview, ExecutionEnvironment } from "../../../../contracts/trader-process.js";
export type ProcessTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Tx = ProcessTransaction;
const iso = (v: Date | null) => v?.toISOString() ?? null;
export function methodDraftDTO(r: typeof processDraftsTable.$inferSelect): ProcessMethodDraft {
  return {
    id: r.id,
    revision: r.revision,
    step: Math.max(0, Math.min(2, r.step)) as 0 | 1 | 2,
    draft: r.draft as Record<string, string | boolean>,
    previousVersionId: r.previousVersionId,
  };
}
export function methodDTO(r: typeof processMethodsTable.$inferSelect): ProcessMethod {
  return {
    ...r,
    rules: r.rules as MethodRules,
    protocol: r.protocol as VerificationProtocol | null,
    phase: r.phase as ProcessPhase,
    createdAt: r.createdAt.toISOString(),
    phaseStartedAt: r.phaseStartedAt.toISOString(),
    riskConfirmedAt: r.riskConfirmedAt.toISOString(),
    verificationStartedAt: iso(r.verificationStartedAt),
    applicationStartedAt: iso(r.applicationStartedAt),
    reviewPolicyStartedAt: r.reviewPolicyStartedAt.toISOString(),
  };
}
export function evidenceDTO(r: typeof processEvidenceTable.$inferSelect): ProcessEvidence {
  return {
    ...r,
    purpose: r.purpose as ProcessEvidence["purpose"],
    source: r.source as ProcessEvidence["source"],
    executionEnvironment: r.executionEnvironment as ExecutionEnvironment,
    costsStatus: r.costsStatus as ProcessEvidence["costsStatus"],
    adherence: r.adherence as ProcessEvidence["adherence"],
    provenance: r.provenance as ProcessEvidence["provenance"],
    netR: r.netR == null ? null : Number(r.netR),
    initialRisk: r.initialRisk == null ? null : Number(r.initialRisk),
    netPnl: r.netPnl == null ? null : Number(r.netPnl),
    observedAt: r.observedAt.toISOString(),
    createdAt: r.createdAt.toISOString(),
  };
}
export function sessionDTO(r: typeof processSessionsTable.$inferSelect): ProcessSession {
  return {
    ...r,
    mode: r.mode as ProcessSession["mode"],
    draft: r.draft as ProcessSessionDraft | null,
    rulesSnapshot: r.rulesSnapshot as MethodRules,
    state: r.state as ProcessSession["state"],
    checklist: r.checklist as boolean[],
    plan: r.plan as ProcessSession["plan"],
    closure: r.closure as ProcessSession["closure"],
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    preparedAt: iso(r.preparedAt),
    closedAt: iso(r.closedAt),
  };
}
export function reviewDTO(r: typeof processReviewsTable.$inferSelect): ProcessReview {
  return {
    id: r.id, methodVersionId: r.methodVersionId, recapId: r.recapId,
    improvementId: r.improvementId, kind: r.kind as ProcessReview["kind"],
    periodStart: r.periodStart, periodEnd: r.periodEnd,
    coveredPeriods: r.coveredPeriods as ProcessReview["coveredPeriods"],
    judgment: r.judgment, action: r.action, criterion: r.criterion,
    previousImprovementId: r.previousImprovementId,
    previousImprovementOutcome: r.previousImprovementOutcome as ProcessReview["previousImprovementOutcome"],
    previousImprovementNote: r.previousImprovementNote,
    decision: r.decision as ProcessReview["decision"], checks: r.checks as ProcessReview["checks"],
    report: r.report as ProcessReview["report"], reviewedAt: r.reviewedAt.toISOString(),
  };
}
export async function improvements(tx: Tx, userId: string): Promise<ProcessImprovement[]> {
  const rows = await tx
    .select({ improvement: processImprovementsTable, recap: journalRecapsTable })
    .from(processImprovementsTable)
    .innerJoin(journalRecapsTable, eq(processImprovementsTable.recapId, journalRecapsTable.id))
    .where(and(eq(processImprovementsTable.userId, userId), eq(journalRecapsTable.userId, userId)))
    .orderBy(desc(processImprovementsTable.createdAt));
  return rows.map(({ improvement: r, recap }) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
    recapKind: recap.kind,
    periodStart: recap.periodStart,
    periodEnd: recap.periodEnd,
  }));
}
export async function loadProcessState(tx: Tx, userId: string): Promise<ProcessState> {
  const methods = (
    await tx
      .select()
      .from(processMethodsTable)
      .where(eq(processMethodsTable.userId, userId))
      .orderBy(desc(processMethodsTable.createdAt))
  ).map(methodDTO);
  const activeMethod = methods.find((m) => m.active) ?? null;
  const sessions = (
    await tx.select().from(processSessionsTable).where(eq(processSessionsTable.userId, userId))
  ).map(sessionDTO);
  const session =
    sessions.find((s) => s.day === processDay()) ??
    sessions.filter((s) => s.state !== "closed").sort((a, b) => b.day.localeCompare(a.day))[0] ??
    null;
  const evidence = (
    await tx
      .select()
      .from(processEvidenceTable)
      .where(eq(processEvidenceTable.userId, userId))
      .orderBy(desc(processEvidenceTable.observedAt))
  ).map(evidenceDTO);
  const snapshotIds = [
    ...new Set(
      sessions.flatMap((s) =>
        s.plan?.guidance?.contextSnapshotId ? [s.plan.guidance.contextSnapshotId] : [],
      ),
    ),
  ];
  const contextSnapshots = snapshotIds.length
    ? Object.fromEntries(
        (
          await tx
            .select()
            .from(marketSnapshotsTable)
            .where(inArray(marketSnapshotsTable.id, snapshotIds))
        ).map((snapshot) => [snapshot.id, snapshot.payload]),
      )
    : {};
  const allImprovements = await improvements(tx, userId);
  const improvement = allImprovements.find((i) => i.methodVersionId === activeMethod?.id) ?? null;
  const [draft] = await tx
    .select()
    .from(processDraftsTable)
    .where(eq(processDraftsTable.userId, userId))
    .limit(1);
  const reviews = (await tx.select().from(processReviewsTable)
    .where(eq(processReviewsTable.userId, userId)).orderBy(desc(processReviewsTable.reviewedAt))).map(reviewDTO);
  const pendingReviews = pendingProcessReviews(activeMethod, sessions, evidence, reviews);
  const progress = computeProcessProgress(activeMethod, evidence, sessions, allImprovements, session, new Date(), pendingReviews);
  return {
    guidance: resolveProcessGuidance({ method: activeMethod, session, progress, pendingReviews, reviews }),
    pendingReviews,
    reviews,
    methods,
    dailyNextAction: !activeMethod
      ? "define_method"
      : !session || ["preparation", "plan"].includes(session.state)
        ? "check_in"
        : session.state === "closed"
          ? "done"
          : session.draft?.stage === "closure" && session.draft.open
            ? "close_session"
            : "operate",
    activeMethod,
    session,
    sessions,
    contextSnapshots,
    evidence,
    improvement,
    methodDraft: draft ? methodDraftDTO(draft) : null,
    progress,
    progressByVersion: Object.fromEntries(
      methods.map((method) => [
        method.id,
        computeProcessProgress(
          method,
          evidence,
          sessions,
          allImprovements,
          session?.methodVersionId === method.id ? session : null,
          new Date(),
          pendingProcessReviews(method, sessions, evidence, reviews),
        ),
      ]),
    ),
  };
}
