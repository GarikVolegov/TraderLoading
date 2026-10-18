import type {
  AddProcessEvidence,
  CreateProcessMethod,
  ProcessMethod,
  ProcessSession,
  ProcessState,
  UpdateProcessSession,
  ProcessMethodDraft,
  SaveProcessMethodDraft,
  VerificationProtocol,
  ConfirmProcessReview,
  ProcessReview,
} from "../../../../contracts/trader-process";
import { apiJSON } from "./apiFetch";

export type {
  AddProcessEvidence,
  CheckInDraft,
  CreateProcessMethod,
  MethodRules,
  ProcessCheck,
  ProcessEvidence,
  ProcessImprovement,
  ProcessMethod,
  ProcessMethodDraft,
  SaveProcessMethodDraft,
  ProcessPhase,
  ProcessProgress,
  ProcessReport,
  ProcessSession,
  ProcessSessionDraft,
  ProcessState,
  SessionClosure,
  SessionPlan,
  SessionGuidance,
  UpdateProcessSession,
  VerificationProtocol,
} from "../../../../contracts/trader-process";

export const traderProcessKey = ["trader-process"] as const;
export const fetchTraderProcess = () => apiJSON<ProcessState>("process");
export const createProcessMethod = (data: CreateProcessMethod) =>
  apiJSON<ProcessMethod>("process/methods", { method: "POST", body: JSON.stringify(data) });
export const activateProcessMethod = (id: string) =>
  apiJSON<ProcessMethod>(`process/methods/${encodeURIComponent(id)}/activate`, {
    method: "POST",
    body: "{}",
  });
export const advanceProcessMethod = (data: {
  id: string;
  review: string;
  expectedPhase: ProcessMethod["phase"];
  protocol?: VerificationProtocol;
}) =>
  apiJSON<ProcessMethod>(`process/methods/${encodeURIComponent(data.id)}/advance`, {
    method: "POST",
    body: JSON.stringify({
      review: data.review,
      expectedPhase: data.expectedPhase,
      ...(data.protocol ? { protocol: data.protocol } : {}),
    }),
  });
export const addProcessEvidence = (data: AddProcessEvidence) =>
  apiJSON("process/evidence", { method: "POST", body: JSON.stringify(data) });
export const startProcessSession = (methodVersionId?: string) =>
  apiJSON<ProcessSession>("process/sessions", {
    method: "POST",
    body: JSON.stringify({ methodVersionId }),
  });
export const startGuidedProcess = (data: {
  method: CreateProcessMethod;
  preparation: { checklist: boolean[] };
  plan: import("../../../../contracts/trader-process").SessionPlan;
}) =>
  apiJSON<ProcessSession>("process/guided-start", { method: "POST", body: JSON.stringify(data) });
export const updateProcessSession = (data: { id: string; update: UpdateProcessSession }) =>
  apiJSON<ProcessSession>(`process/sessions/${encodeURIComponent(data.id)}`, {
    method: "PATCH",
    body: JSON.stringify(data.update),
  });

/** Server-owned draft: no progress or financial confirmation is inferred from a device. */
export const saveProcessMethodDraft = (data: SaveProcessMethodDraft) =>
  apiJSON<ProcessMethodDraft>("process/method-draft", {
    method: "PUT",
    body: JSON.stringify(data),
  });
export interface ProcessHistoryItem {
  id: number;
  symbol: string;
  closedAt: string | null;
  netPnl: number | null;
  account: string;
  initialRisk?: number | null;
  currency?: string | null;
  costsStatus?: string;
  executionEnvironment?: "simulation" | "real" | "unknown";
  sessionId?: number;
  netR?: number | null;
}
export const fetchProcessHistory = () =>
  apiJSON<{ trades: ProcessHistoryItem[]; replays: ProcessHistoryItem[] }>("process/history");

export type { ProcessGuidance, ProcessReviewDue, ProcessReview, ConfirmProcessReview, ExecutionEnvironment } from "../../../../contracts/trader-process";
export const confirmProcessReview = (data: ConfirmProcessReview) =>
  apiJSON<ProcessReview>("process/reviews", { method: "POST", body: JSON.stringify(data) });
export const discardProcessSession = (session: ProcessSession) =>
  apiJSON<void>(`process/sessions/${encodeURIComponent(session.id)}?expectedRevision=${session.revision}`, { method: "DELETE" });
