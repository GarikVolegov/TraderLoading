// ─── Lifecycle email dispatch (I/O) ───────────────────────────────────────────
// Thin glue over the pure lifecycle core: load each user's snapshot, let
// selectLifecycleEmail decide who gets welcome/digest/win-back, build via the
// pure builders and send via Resend, then stamp the sent-at so we don't repeat.
// Best-effort and OFF by default — runs only when RESEND_API_KEY is set AND
// EMAIL_LIFECYCLE_ENABLED is truthy, so it can ship dark and be switched on after
// verification. Mirrors ticketEmails.ts (test-exempt pure-glue over tested units).

import { eq } from "drizzle-orm";
import {
  db,
  usersTable,
  profileTable,
  userSettingsTable,
  emailLifecycleStateTable,
} from "@workspace/db";
import { logger } from "../../lib/logger.js";
import { getNotificationLanguage } from "../notifications/notificationCopy.js";
import { loadClosedEdgeTrades } from "../edgeData.js";
import { isEmailConfigured, sendEmail } from "./resendClient.js";
import { getLifecycleCopy } from "./lifecycleCopy.js";
import {
  selectLifecycleEmail,
  type LifecycleEmailKind,
  type LifecycleUserState,
} from "./lifecycleAudience.js";
import { buildDigestStats } from "./digestStats.js";
import {
  buildWelcomeEmail,
  buildDigestEmail,
  buildWinbackEmail,
} from "./lifecycleEmailContent.js";
import type { BuiltEmail } from "./ticketEmailContent.js";

function resolveBaseUrl(): string {
  return (process.env.APP_BASE_URL || "https://traderloading.com").replace(/\/+$/, "");
}

/** Dark by default: needs both a Resend key and an explicit opt-in flag. */
export function lifecycleEnabled(): boolean {
  const flag = (process.env.EMAIL_LIFECYCLE_ENABLED || "").toLowerCase();
  return isEmailConfigured() && (flag === "1" || flag === "true");
}

function parseDate(value: string | Date | null): Date | null {
  if (value === null) return null;
  if (value instanceof Date) return value;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? new Date(ms) : null;
}

interface Candidate {
  state: LifecycleUserState;
  email: string;
  streak: number;
}

/** Every user with an email, joined with their activity + lifecycle history. */
async function loadCandidates(): Promise<Candidate[]> {
  const rows = await db
    .select({
      userId: usersTable.id,
      email: usersTable.email,
      createdAt: usersTable.createdAt,
      lastActiveDate: profileTable.lastActiveDate,
      streak: profileTable.streak,
      welcomeSentAt: emailLifecycleStateTable.welcomeSentAt,
      lastDigestAt: emailLifecycleStateTable.lastDigestAt,
      lastWinbackAt: emailLifecycleStateTable.lastWinbackAt,
      optOut: emailLifecycleStateTable.optOut,
    })
    .from(usersTable)
    .leftJoin(profileTable, eq(profileTable.userId, usersTable.id))
    .leftJoin(emailLifecycleStateTable, eq(emailLifecycleStateTable.userId, usersTable.id));

  const out: Candidate[] = [];
  for (const row of rows) {
    if (!row.email) continue;
    out.push({
      email: row.email,
      streak: row.streak ?? 0,
      state: {
        userId: row.userId,
        createdAt: parseDate(row.createdAt) ?? new Date(0),
        lastActiveAt: parseDate(row.lastActiveDate),
        welcomeSentAt: parseDate(row.welcomeSentAt),
        lastDigestAt: parseDate(row.lastDigestAt),
        lastWinbackAt: parseDate(row.lastWinbackAt),
        emailOptOut: row.optOut ?? false,
      },
    });
  }
  return out;
}

async function resolveLang(userId: string): Promise<string> {
  try {
    const [settings] = await db
      .select({ notificationPrefs: userSettingsTable.notificationPrefs })
      .from(userSettingsTable)
      .where(eq(userSettingsTable.userId, userId))
      .limit(1);
    const parsed = settings?.notificationPrefs ? JSON.parse(settings.notificationPrefs) : null;
    return getNotificationLanguage(parsed?.__language);
  } catch {
    return "it";
  }
}

/** Record that `kind` just went out, so it is deduped on the next run. */
async function stampSent(userId: string, kind: LifecycleEmailKind, now: Date): Promise<void> {
  const patch =
    kind === "welcome"
      ? { welcomeSentAt: now }
      : kind === "digest"
        ? { lastDigestAt: now }
        : { lastWinbackAt: now };
  await db
    .insert(emailLifecycleStateTable)
    .values({ userId, ...patch })
    .onConflictDoUpdate({
      target: emailLifecycleStateTable.userId,
      set: { ...patch, updatedAt: now },
    });
}

async function buildEmail(
  candidate: Candidate,
  kind: LifecycleEmailKind,
  now: Date,
  baseUrl: string,
): Promise<BuiltEmail> {
  const lang = await resolveLang(candidate.state.userId);
  const copy = getLifecycleCopy(lang);
  if (kind === "digest") {
    const trades = await loadClosedEdgeTrades(candidate.state.userId);
    const stats = buildDigestStats(trades, now, { streakDays: candidate.streak });
    return buildDigestEmail({ copy, lang, baseUrl, stats });
  }
  if (kind === "winback") {
    const last = candidate.state.lastActiveAt;
    const idleDays = last ? Math.max(0, Math.floor((now.getTime() - last.getTime()) / 86_400_000)) : 0;
    return buildWinbackEmail({ copy, lang, baseUrl, idleDays });
  }
  return buildWelcomeEmail({ copy, lang, baseUrl });
}

export interface LifecycleRunResult {
  processed: number;
  sent: number;
}

/**
 * One pass over the whole audience. Decides per user, sends the due email, and
 * stamps it. No-op unless lifecycleEnabled(). Every per-user failure is isolated
 * so one bad row never aborts the batch.
 */
export async function runLifecycleEmails(now: Date = new Date()): Promise<LifecycleRunResult> {
  if (!lifecycleEnabled()) return { processed: 0, sent: 0 };
  const baseUrl = resolveBaseUrl();
  const candidates = await loadCandidates();

  let processed = 0;
  let sent = 0;
  for (const candidate of candidates) {
    const kind = selectLifecycleEmail(candidate.state, now);
    if (!kind) continue;
    processed += 1;
    try {
      const email = await buildEmail(candidate, kind, now, baseUrl);
      const result = await sendEmail({
        to: candidate.email,
        subject: email.subject,
        html: email.html,
        text: email.text,
      });
      if (result.sent) {
        await stampSent(candidate.state.userId, kind, now);
        sent += 1;
      }
    } catch (err) {
      logger.error({ err, userId: candidate.state.userId, kind }, "[email] lifecycle dispatch fallito");
    }
  }
  logger.info({ processed, sent }, "[email] lifecycle pass completata");
  return { processed, sent };
}
