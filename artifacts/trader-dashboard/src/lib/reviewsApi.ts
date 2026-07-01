// Client off-contract delle recensioni (come torneiApi): tipi a mano + apiJSON.
import { apiJSON, apiRequest, type RelativeApiOptions } from "./apiFetch";

export type PromptSignal = "level" | "streak" | "coach" | "none";

export type PromptReason =
  | "opted_out"
  | "snoozed"
  | "already_reviewed"
  | "below_threshold"
  | "no_signal"
  | "level"
  | "streak"
  | "coach";

export interface ReviewPromptStatus {
  shouldPrompt: boolean;
  eligible: boolean;
  hasReviewed: boolean;
  reason: PromptReason;
}

export type ReviewStatus = "pending" | "approved" | "rejected" | "withdrawn";

export interface MyReview {
  id: number;
  rating: number;
  text: string;
  role: string | null;
  status: ReviewStatus;
  published: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SubmitReviewInput {
  rating: number;
  text: string;
  role?: string | null;
  consent: boolean;
  locale?: string;
}

// ── query keys ───────────────────────────────────────────────────────────────
export const reviewPromptStatusKey = (signal?: PromptSignal) =>
  ["/api/reviews/prompt-status", signal ?? "none"] as const;
export const myReviewKey = () => ["/api/reviews/me"] as const;

// ── fetchers ─────────────────────────────────────────────────────────────────
export function fetchReviewPromptStatus(
  signal?: PromptSignal,
  options?: RelativeApiOptions,
): Promise<ReviewPromptStatus> {
  const qs = signal && signal !== "none" ? `?signal=${signal}` : "";
  return apiJSON<ReviewPromptStatus>(`reviews/prompt-status${qs}`, undefined, options);
}

export function fetchMyReview(options?: RelativeApiOptions): Promise<{ review: MyReview | null }> {
  return apiJSON<{ review: MyReview | null }>("reviews/me", undefined, options);
}

async function postJSON<T>(
  path: string,
  body: unknown,
  method: "POST" | "PATCH" | "DELETE",
  options?: RelativeApiOptions,
): Promise<T> {
  const res = await apiRequest(
    path,
    {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    },
    options,
  );
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function submitReview(
  input: SubmitReviewInput,
  options?: RelativeApiOptions,
): Promise<{ review: MyReview }> {
  return postJSON<{ review: MyReview }>("reviews", input, "POST", options);
}

export function updateMyReview(
  input: Partial<Pick<SubmitReviewInput, "rating" | "text" | "role">>,
  options?: RelativeApiOptions,
): Promise<{ review: MyReview }> {
  return postJSON<{ review: MyReview }>("reviews/me", input, "PATCH", options);
}

export function withdrawMyReview(options?: RelativeApiOptions): Promise<{ ok: true }> {
  return postJSON<{ ok: true }>("reviews/me", undefined, "DELETE", options);
}

export function snoozeReviewPrompt(
  days?: number,
  options?: RelativeApiOptions,
): Promise<{ ok: true; snoozedUntil: string }> {
  return postJSON<{ ok: true; snoozedUntil: string }>(
    "reviews/prompt-status/snooze",
    days ? { days } : {},
    "POST",
    options,
  );
}

export function optOutReviewPrompt(options?: RelativeApiOptions): Promise<{ ok: true }> {
  return postJSON<{ ok: true }>("reviews/prompt-status/opt-out", {}, "POST", options);
}
