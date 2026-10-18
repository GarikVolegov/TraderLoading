import type { CockpitAnalysis } from "./cockpit";
/** Shared authenticated trading-process contract. Progress is independent of XP. */
export type ProcessPhase = "define" | "verify" | "apply" | "consolidate";
export type EvidencePurpose = "development" | "validation" | "live";
export type EvidenceSource = "manual" | "external" | "replay" | "account_trade";
export type ExecutionEnvironment = "simulation" | "real" | "unknown";
export type ProcessSessionMode = "practice" | "validation" | "application";
export interface MethodRules {
  markets: string[];
  windows: string;
  setup: string;
  entry: string;
  exit: string;
  invalidation: string;
  waitConditions: string;
  riskPerTrade: number;
  maxDailyLoss: number;
  maxDailyTrades: number;
  currency: string;
  checklist: string[];
  tools?: Array<"markets" | "news" | "economic-calendar" | "sessions" | "calculator">;
}
export interface VerificationProtocol {
  minSamples: number;
  periodStart: string;
  periodEnd: string;
  minExpectancyR: number;
  maxDrawdownR: number;
  observationDays: number;
  minAdherencePct: number;
}
export interface ProcessMethod {
  id: string;
  methodId: string;
  version: number;
  name: string;
  rules: MethodRules;
  protocol: VerificationProtocol | null;
  phase: ProcessPhase;
  active: boolean;
  createdAt: string;
  phaseStartedAt: string;
  riskConfirmedAt: string;
  verificationStartedAt: string | null;
  applicationStartedAt: string | null;
  /** Review obligations start here; migration never invents overdue historical work. */
  reviewPolicyStartedAt?: string;
}
export interface ProcessEvidence {
  executionEnvironment?: ExecutionEnvironment;
  id: string;
  methodVersionId: string;
  purpose: EvidencePurpose;
  source: EvidenceSource;
  netR: number | null;
  initialRisk: number | null;
  netPnl: number | null;
  costsStatus: "included" | "excluded" | "unknown";
  currency: string | null;
  account: string | null;
  observedAt: string;
  createdAt: string;
  adherence: "conforming" | "violation" | "unknown";
  provenance: "declared" | "calculated" | "estimated";
  note: string;
  accountTradeId: number | null;
  backtestTradeId: number | null;
  sessionId: string | null;
}
export interface SessionPlan {
  decision: "trade" | "wait";
  market?: string;
  setup?: string;
  entry?: string;
  stop?: string;
  initialRisk?: number;
  invalidation?: string;
  waitReason?: string;
  marketDecisionId?: string;
  guidance?: SessionGuidance;
}
export interface SessionGuidance {
  cockpit?: CockpitAnalysis;
  expectation: string;
  invalidation: string;
  response: "wait" | "reassess" | "exit" | "custom";
  responseNote?: string;
  contextSnapshotId?: string | null;
}
export interface SessionClosure {
  notes: string;
  violations: string[];
  reconciled: boolean;
  noTrades: boolean;
  assessment?: "conforming" | "deviation" | "unknown";
  outcome?: "confirmed" | "partial" | "invalidated" | "unassessable";
  correction?: string;
}
export interface CheckInDraft {
  cockpit?: CockpitAnalysis;
  stage: "check_in";
  checklist: boolean[];
  mood: string;
  focus: string;
  decision: "trade" | "wait" | "";
  market: string;
  entry: string;
  stop: string;
  risk: string;
  reason: string;
  reasonCode: string;
  marketDecisionId?: string;
  step?: 0 | 1 | 2;
  expectation?: string;
  invalidation?: string;
  response?: SessionGuidance["response"] | "";
  responseNote?: string;
  contextSnapshotId?: string | null;
}
/** A saved draft never confirms preparation, a plan or closure. */
export type ProcessSessionDraft =
  | CheckInDraft
  | { stage: "preparation"; checklist: boolean[]; mood: string; focus: string }
  | {
      stage: "plan";
      decision: "trade" | "wait";
      market: string;
      entry: string;
      stop: string;
      risk: string;
      reason: string;
      marketDecisionId?: string;
    }
  | {
      stage: "closure";
      open: boolean;
      notes: string;
      violations: string;
      reconciled: boolean;
      noTrades: boolean;
      assessment?: "conforming" | "deviation" | "unknown" | "";
      outcome?: SessionClosure["outcome"] | "";
      correction?: string;
    };
export interface ProcessSession {
  mode?: ProcessSessionMode;
  id: string;
  day: string;
  methodVersionId: string;
  rulesSnapshot: MethodRules;
  draft: ProcessSessionDraft | null;
  revision: number;
  state: "preparation" | "plan" | "operation" | "closed";
  checklist: boolean[];
  mood: string;
  focus: string;
  plan: SessionPlan | null;
  closure: SessionClosure | null;
  improvementId: string | null;
  createdAt: string;
  updatedAt: string;
  preparedAt: string | null;
  closedAt: string | null;
}
export interface ProcessImprovement {
  id: string;
  methodVersionId: string;
  recapId: number;
  action: string;
  criterion: string;
  createdAt: string;
  recapKind: string;
  periodStart: string;
  periodEnd: string;
}
export interface ProcessCheck {
  key: string;
  label: string;
  met: boolean;
  detail: string;
}
export interface ProcessReport {
  eligibleSamples: number;
  incompleteSamples: number;
  expectancyR: number | null;
  drawdownR: number | null;
  adherencePct: number | null;
  closedSessions: number;
  amounts: { account: string; currency: string; netPnl: number; samples: number }[];
}
export interface ProcessProgress {
  phase: ProcessPhase;
  checks: ProcessCheck[];
  canAdvance: boolean;
  nextAction:
    | "define_method"
    | "confirm_verification"
    | "collect_evidence"
    | "review_verification"
    | "prepare_session"
    | "plan_session"
    | "operate"
    | "close_session"
    | "review_application"
    | "continue_improvement";
  report: ProcessReport;
}
export interface ProcessState {
  guidance?: ProcessGuidance;
  pendingReviews?: ProcessReviewDue[];
  reviews?: ProcessReview[];
  dailyNextAction?: "define_method" | "check_in" | "operate" | "close_session" | "done";
  methodDraft: ProcessMethodDraft | null;
  methods: ProcessMethod[];
  activeMethod: ProcessMethod | null;
  session: ProcessSession | null;
  sessions?: ProcessSession[];
  contextSnapshots?: Record<string, unknown>;
  evidence: ProcessEvidence[];
  improvement: ProcessImprovement | null;
  progress: ProcessProgress;
  progressByVersion: Record<string, ProcessProgress>;
}
export interface ProcessMethodDraft {
  id: string;
  revision: number;
  step: 0 | 1 | 2;
  draft: Record<string, string | boolean>;
  previousVersionId: string | null;
}
export type SaveProcessMethodDraft = Omit<ProcessMethodDraft, "revision"> & {
  expectedRevision: number;
};
export interface CreateProcessMethod {
  name: string;
  rules: MethodRules;
  protocol?: VerificationProtocol | null;
  riskConfirmed: true;
  previousVersionId?: string;
  requestId: string;
  draftId?: string;
  expectedDraftRevision?: number;
}
export interface AddProcessEvidence {
  executionEnvironment?: ExecutionEnvironment;
  methodVersionId: string;
  purpose: EvidencePurpose;
  source: EvidenceSource;
  initialRisk?: number | null;
  netPnl?: number | null;
  netR?: number | null;
  costsStatus: ProcessEvidence["costsStatus"];
  currency?: string | null;
  account?: string | null;
  observedAt: string;
  adherence: ProcessEvidence["adherence"];
  provenance: ProcessEvidence["provenance"];
  note?: string;
  accountTradeId?: number | null;
  backtestTradeId?: number | null;
  sessionId?: string | null;
  requestId: string;
}
export interface ProcessReviewPeriod {
  kind: "weekly" | "four_week";
  periodStart: string;
  periodEnd: string;
}
export interface ProcessReviewDue extends ProcessReviewPeriod {
  coveredPeriods: ProcessReviewPeriod[];
}
export type ProcessImprovementOutcome = "met" | "not_met" | "unassessable";
export interface ProcessReview extends ProcessReviewDue {
  id: string;
  methodVersionId: string;
  recapId: number;
  improvementId: string;
  judgment: string;
  action: string;
  criterion: string;
  previousImprovementId: string | null;
  previousImprovementOutcome: ProcessImprovementOutcome | null;
  previousImprovementNote: string;
  decision: "continue" | "reverify";
  checks: ProcessCheck[];
  report: ProcessReport;
  reviewedAt: string;
}
export interface ConfirmProcessReview extends ProcessReviewPeriod {
  methodVersionId: string;
  judgment: string;
  action: string;
  criterion: string;
  previousImprovementOutcome?: ProcessImprovementOutcome;
  previousImprovementNote?: string;
  requestId: string;
}
export interface ProcessGuidance {
  action: "resume_session" | "define_method" | "confirm_verification" | "collect_evidence" |
    "review_verification" | "review_application" | "review_period" | "revise_method" | "check_in" | "done";
  reason: "work_pending" | "method_missing" | "protocol_required" | "verification_in_progress" |
    "verification_waiting" | "requirements_met" | "review_due" | "reverification_required" | "session_ready" | "day_complete";
  href: string;
  methodVersionId: string | null;
  sessionId: string | null;
  sessionMode: ProcessSessionMode | null;
  applicationHold: boolean;
  blockers: ProcessCheck[];
  reviewDue: ProcessReviewDue | null;
  nextAvailableAt: string | null;
}
export type UpdateProcessSession =
  | {
      action: "check_in";
      expectedRevision: number;
      preparation: { checklist: boolean[]; mood?: string; focus?: string };
      plan: SessionPlan;
    }
  | { action: "draft"; expectedRevision: number; draft: ProcessSessionDraft }
  | {
      action: "preparation";
      expectedRevision: number;
      checklist: boolean[];
      mood: string;
      focus: string;
    }
  | { action: "plan"; expectedRevision: number; plan: SessionPlan }
  | { action: "close"; expectedRevision: number; closure: SessionClosure };
/** Monetary initial risk is immutable and strictly positive; net P&L includes costs. */
export function calculateNetR(
  netPnl: number | null | undefined,
  initialRisk: number | null | undefined,
): number | null {
  if (
    netPnl == null ||
    initialRisk == null ||
    !Number.isFinite(netPnl) ||
    !Number.isFinite(initialRisk) ||
    initialRisk <= 0
  )
    return null;
  const ratio = netPnl / initialRisk;
  return Number.isFinite(ratio) ? ratio : null;
}
export function processDay(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
