// Pure helpers for community message reports (audit 3.6 — closing the moderation
// loop). Reason whitelist + free-text sanitation, so the report route stays thin
// and these rules are unit-tested in isolation.

export const REPORT_REASONS = ["spam", "harassment", "off_topic", "misinformation", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

const REASON_SET = new Set<string>(REPORT_REASONS);

/** Map arbitrary input to a known reason, defaulting to "other". */
export function normalizeReportReason(raw: unknown): ReportReason {
  if (typeof raw !== "string") return "other";
  const value = raw.trim().toLowerCase();
  return (REASON_SET.has(value) ? value : "other") as ReportReason;
}

const DETAILS_MAX = 500;

/** Trim + cap the optional free-text note; empty/blank → null. */
export function sanitizeReportDetails(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  return trimmed.slice(0, DETAILS_MAX);
}
