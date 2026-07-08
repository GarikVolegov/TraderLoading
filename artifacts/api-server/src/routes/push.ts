import { Router, type IRouter } from "express";
import webpush from "web-push";
import { db, pushSubscriptionsTable, userSettingsTable, missionsTable, ideasTable } from "@workspace/db";
import { eq, and, isNull } from "drizzle-orm";
import { getUserId } from "./profile.js";
import { shouldSendPushNotification } from "../services/notifications/pushDedupe.js";
import { getNotificationLanguage, getServerNotificationCopy, pickSessionQuote } from "../services/notifications/notificationCopy.js";
import {
  buildScheduledCallDedupeKey,
  buildScheduledCallPayload,
  isServerScheduledCallDue,
  parseScheduledCallConfigs,
} from "../services/notifications/scheduledCalls.js";
import { isTimeReminderDue, localDayKey, isMacroAlertDue } from "../services/notifications/reminders.js";
import { getCalendarEvents, type CalendarEvent } from "./calendar.js";
import logger from "../lib/logger.js";
import { reportJobError } from "../lib/observability.js";
import { tryAcquireLock } from "../lib/distributedLock.js";

const router: IRouter = Router();

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY ?? "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? "";
const VAPID_EMAIL = process.env.VAPID_EMAIL || "mailto:assistenza@traderloading.com";
const PUSH_DEDUPE_WINDOW_MS = 30_000;
const _recentPushes = new Map<string, number>();

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

export interface NotificationPrefs {
  sessions: boolean;
  messages: boolean;
  social: boolean;
  goals: boolean;
  dailyReminder: boolean;
  macroEvents: boolean;
  scheduledCalls: boolean;
}

export const DEFAULT_NOTIF_PREFS: NotificationPrefs = {
  sessions: true,
  messages: true,
  social: true,
  goals: true,
  dailyReminder: true,
  macroEvents: true,
  scheduledCalls: true,
};

interface TradingSessionConfig {
  name: string;
  openUTC: string;
  closeUTC: string;
  enabled: boolean;
  kind?: "trading" | "market_closed";
}

function parsePrefs(raw: string | null): NotificationPrefs {
  if (!raw) return { ...DEFAULT_NOTIF_PREFS };
  try {
    return { ...DEFAULT_NOTIF_PREFS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_NOTIF_PREFS };
  }
}

export async function getUserNotificationLanguage(userId: string | null): Promise<string> {
  const where = userId ? eq(userSettingsTable.userId, userId) : isNull(userSettingsTable.userId);
  const [settings] = await db
    .select({ notificationPrefs: userSettingsTable.notificationPrefs })
    .from(userSettingsTable)
    .where(where)
    .limit(1);
  try {
    const parsed = settings?.notificationPrefs ? JSON.parse(settings.notificationPrefs) : null;
    return getNotificationLanguage(parsed?.__language);
  } catch {
    return "it";
  }
}

async function getUserPrefs(userId: string | null): Promise<NotificationPrefs> {
  const where = userId ? eq(userSettingsTable.userId, userId) : isNull(userSettingsTable.userId);
  const [settings] = await db
    .select({ notificationPrefs: userSettingsTable.notificationPrefs })
    .from(userSettingsTable)
    .where(where)
    .limit(1);
  return parsePrefs(settings?.notificationPrefs ?? null);
}

export async function sendPushToUser(
  targetUserId: string | null,
  payload: {
    title: string;
    body: string;
    tag?: string;
    icon?: string;
    badge?: string;
    requireInteraction?: boolean;
    vibrate?: number[];
    actions?: Array<{ action: string; title: string }>;
    data?: Record<string, unknown>;
  },
  prefKey?: keyof NotificationPrefs,
): Promise<void> {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return;

  if (prefKey) {
    const prefs = await getUserPrefs(targetUserId);
    if (!prefs[prefKey]) return;
  }

  const where = targetUserId
    ? eq(pushSubscriptionsTable.userId, targetUserId)
    : isNull(pushSubscriptionsTable.userId);

  const subs = await db.select().from(pushSubscriptionsTable).where(where);
  if (subs.length === 0) return;

  const dedupeKey = `${targetUserId ?? "guest"}:${payload.tag ?? payload.title}:${payload.body}`;
  if (!shouldSendPushNotification(_recentPushes, dedupeKey, Date.now(), PUSH_DEDUPE_WINDOW_MS)) return;

  const pushPayload = JSON.stringify(payload);

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          pushPayload,
        );
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 410 || statusCode === 404) {
          await db.delete(pushSubscriptionsTable).where(eq(pushSubscriptionsTable.id, sub.id));
        }
      }
    }),
  );
}

// Per-day "already sent" guard for session/scheduled-call pushes. Keys embed the
// day, so once the local day rolls over every entry is stale; we clear the map at
// that boundary (see runSchedulerTick) to keep it bounded to a single day instead
// of accumulating one entry per user/event for the whole process lifetime.
const _sentToday = new Map<string, string>();
let _sentTodayDay = "";

export interface SchedulerHandle {
  close(): Promise<void>;
}

const noopScheduler: SchedulerHandle = {
  async close() {},
};

function todayLocal(date = new Date()): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function parseLocalTime(t: string): { h: number; m: number } {
  const [h, m] = t.split(":").map(Number);
  return { h: Number.isFinite(h) ? h : 0, m: Number.isFinite(m) ? m : 0 };
}

async function checkSessionsForUser(
  userId: string,
  sessions: TradingSessionConfig[],
  nowH: number,
  nowM: number,
  today: string,
): Promise<void> {
  for (const session of sessions) {
    if (!session.enabled) continue;
    if (session.kind === "market_closed") continue;

    const { h, m } = parseLocalTime(session.openUTC);
    if (h !== nowH || m !== nowM) continue;

    const dedupeKey = `${userId}:${session.name}`;
    if (_sentToday.get(dedupeKey) === today) continue;
    _sentToday.set(dedupeKey, today);

    const language = await getUserNotificationLanguage(userId);
    const copy = getServerNotificationCopy(language);
    await sendPushToUser(
      userId,
      {
        title: copy.sessionTitle(session.name),
        body: pickSessionQuote(language),
        tag: `session-${session.name.toLowerCase().replace(/\s+/g, "-")}`,
        data: { url: "/" },
      },
      "sessions",
    );
  }
}

async function checkScheduledCallsForUser(
  userId: string,
  rawAlarmConfigs: string | null | undefined,
  now: Date,
): Promise<void> {
  const calls = parseScheduledCallConfigs(rawAlarmConfigs ?? null);
  for (const call of calls) {
    if (!isServerScheduledCallDue(call, now)) continue;

    const dedupeKey = buildScheduledCallDedupeKey(userId, call, now);
    if (_sentToday.get(dedupeKey) === "sent") continue;
    _sentToday.set(dedupeKey, "sent");

    await sendPushToUser(userId, buildScheduledCallPayload(call, "/"), "scheduledCalls");
  }
}

function calendarEventKey(event: CalendarEvent): string {
  return `${event.date}:${event.country}:${event.title}`.toLowerCase().replace(/[^a-z0-9:-]+/g, "-");
}

/** Finding 3.3: the daily-reminder push (mission count) only ever fired via an
 *  in-tab setTimeout — never reaches a closed app. */
async function checkDailyReminderForUser(
  userId: string,
  dailyReminderTime: string | null | undefined,
  now: Date,
  romeDay: string,
): Promise<void> {
  if (!isTimeReminderDue(dailyReminderTime, now)) return;
  const dedupeKey = `daily-reminder:${userId}:${romeDay}`;
  if (_sentToday.get(dedupeKey) === "sent") return;
  _sentToday.set(dedupeKey, "sent");

  const missionDate = now.toISOString().slice(0, 10); // matches routes/missions.ts's "today"
  const rows = await db
    .select({ completed: missionsTable.completed })
    .from(missionsTable)
    .where(and(eq(missionsTable.userId, userId), eq(missionsTable.missionDate, missionDate)));
  const total = rows.length;
  const pending = rows.filter((r) => !r.completed).length;

  const language = await getUserNotificationLanguage(userId);
  const copy = getServerNotificationCopy(language);
  await sendPushToUser(
    userId,
    {
      title: copy.dailyReminderTitle,
      body: total > 0 ? copy.dailyMissionsBody(pending, total) : copy.dailyEmptyBody,
      // Matches the client DailyAlarmNotifier's tag so the browser coalesces the
      // two into one when the app is open (goal/macro tags already match).
      tag: "daily-alarm",
      data: { url: "/" },
    },
    "dailyReminder",
  );
}

/** Finding 3.3: goal reminders (journal "goal" ideas with a reminderTime) only
 *  ever fired via an in-tab setTimeout — never reaches a closed app. */
async function checkGoalRemindersForUser(userId: string, now: Date, romeDay: string): Promise<void> {
  const goals = await db
    .select({ id: ideasTable.id, content: ideasTable.content, reminderTime: ideasTable.reminderTime })
    .from(ideasTable)
    .where(and(eq(ideasTable.userId, userId), eq(ideasTable.type, "goal"), eq(ideasTable.completed, false)));

  for (const goal of goals) {
    if (!isTimeReminderDue(goal.reminderTime, now)) continue;
    const dedupeKey = `goal-reminder:${userId}:${goal.id}:${romeDay}`;
    if (_sentToday.get(dedupeKey) === "sent") continue;
    _sentToday.set(dedupeKey, "sent");

    const language = await getUserNotificationLanguage(userId);
    const copy = getServerNotificationCopy(language);
    await sendPushToUser(
      userId,
      {
        title: copy.goalReminderTitle,
        body: goal.content,
        tag: `goal-reminder-${goal.id}`,
        data: { url: "/" },
      },
      "goals",
    );
  }
}

/** Finding 3.3: high-impact macro-event alerts only ever fired via an in-tab
 *  setTimeout — never reaches a closed app. `events` is fetched once per tick
 *  (shared, not per-user); each user's own preMacroMinutes gates the alert. */
async function checkMacroEventsForUser(
  userId: string,
  preMacroMinutes: number,
  now: Date,
  events: CalendarEvent[],
): Promise<void> {
  const nowMs = now.getTime();
  for (const event of events) {
    if (event.impact !== "High") continue;
    const timestamp = Date.parse(event.date);
    if (!Number.isFinite(timestamp)) continue;
    if (timestamp < nowMs || timestamp - nowMs > 24 * 60 * 60 * 1000) continue;
    if (!isMacroAlertDue(timestamp, preMacroMinutes, nowMs)) continue;

    // Day-scoped dedup (like the other checks): _sentToday is cleared at the
    // local-day rollover, so it stays bounded. isMacroAlertDue already restricts
    // firing to a single 60s tick window per event, so per-day dedup suffices —
    // a past event is skipped above (timestamp < nowMs) and never re-alerted.
    const dedupeKey = `macro:${userId}:${calendarEventKey(event)}`;
    if (_sentToday.get(dedupeKey) === "sent") continue;
    _sentToday.set(dedupeKey, "sent");

    const label = `${event.country ? `${event.country}: ` : ""}${event.title}`;
    const language = await getUserNotificationLanguage(userId);
    const copy = getServerNotificationCopy(language);
    await sendPushToUser(
      userId,
      {
        title: copy.macroAlertTitle,
        body: copy.macroEventBody(label),
        tag: `macro-${calendarEventKey(event)}`,
        data: { url: "/" },
      },
      "macroEvents",
    );
  }
}

export function startSessionScheduler(): SchedulerHandle {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    logger.info("Push session scheduler disabled because VAPID keys are missing");
    return noopScheduler;
  }

  logger.info("Push session scheduler started");
  let isClosing = false;
  let activeRun: Promise<void> | null = null;

  async function runSchedulerTick(): Promise<void> {
    try {
      const now = new Date();

      // Leader-election: across a horizontally-scaled fleet only one instance may
      // run a given minute's tick, otherwise every instance scans all subscribers
      // and users receive one duplicate push per instance. The per-minute lock key
      // (TTL < the 60s interval) lets exactly one instance win each tick; without
      // Redis the lock no-ops to true and the single instance handles it.
      const minuteBucket = Math.floor(now.getTime() / 60_000);
      const isLeader = await tryAcquireLock(`cron:session-push:${minuteBucket}`, 55_000);
      if (!isLeader) return;

      const nowH = now.getHours();
      const nowM = now.getMinutes();
      const today = todayLocal(now);
      const romeDay = localDayKey(now);

      // Drop the previous day's dedup entries once the local day rolls over.
      if (today !== _sentTodayDay) {
        _sentToday.clear();
        _sentTodayDay = today;
      }

      // Shared, not per-user — fetched once per tick (cached ~4h server-side).
      const macroEvents = await getCalendarEvents();

      const rows = await db
        .selectDistinct({ userId: pushSubscriptionsTable.userId })
        .from(pushSubscriptionsTable);

      await Promise.allSettled(
        rows.map(async ({ userId }) => {
          if (!userId) return;
          const where = eq(userSettingsTable.userId, userId);
          const [settings] = await db
            .select({
              tradingSessions: userSettingsTable.tradingSessions,
              alarmConfigs: userSettingsTable.alarmConfigs,
              dailyReminderTime: userSettingsTable.dailyReminderTime,
              preMacroMinutes: userSettingsTable.preMacroMinutes,
            })
            .from(userSettingsTable)
            .where(where)
            .limit(1);

          let sessions: TradingSessionConfig[] = [];
          try {
            if (settings?.tradingSessions) sessions = JSON.parse(settings.tradingSessions);
          } catch {
            // malformed sessions config — skip session checks, other reminders still run below
          }

          // Each check runs independently: a transient error in one (e.g. a pool
          // timeout on its query) must not skip the user's other reminders, and
          // must be observable instead of swallowed by the outer allSettled.
          const runCheck = async (name: string, fn: () => Promise<void>): Promise<void> => {
            try {
              await fn();
            } catch (err) {
              reportJobError(err, { job: "push-scheduler", check: name, userId });
            }
          };
          if (sessions.length > 0) await runCheck("sessions", () => checkSessionsForUser(userId, sessions, nowH, nowM, today));
          await runCheck("scheduledCalls", () => checkScheduledCallsForUser(userId, settings?.alarmConfigs, now));
          await runCheck("dailyReminder", () => checkDailyReminderForUser(userId, settings?.dailyReminderTime, now, romeDay));
          await runCheck("goalReminders", () => checkGoalRemindersForUser(userId, now, romeDay));
          await runCheck("macroEvents", () => checkMacroEventsForUser(userId, settings?.preMacroMinutes ?? 15, now, macroEvents));
        }),
      );
    } catch (err) {
      reportJobError(err, { job: "push-scheduler" });
    }
  }

  function scheduleTick(): void {
    if (isClosing || activeRun) return;
    activeRun = runSchedulerTick().finally(() => {
      activeRun = null;
    });
  }

  const interval = setInterval(() => {
    scheduleTick();
  }, 60_000);

  return {
    async close() {
      isClosing = true;
      clearInterval(interval);
      if (activeRun) await activeRun;
      logger.info("Push session scheduler stopped");
    },
  };
}

router.get("/push/vapid-public-key", (_req, res) => {
  res.json({ publicKey: VAPID_PUBLIC_KEY || null });
});

router.post("/push/subscribe", async (req, res) => {
  const userId = getUserId(req);
  const { endpoint, keys } = req.body;

  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    res.status(400).json({ error: "endpoint and keys are required" });
    return;
  }

  try {
    await db
      .insert(pushSubscriptionsTable)
      .values({ userId, endpoint, p256dh: keys.p256dh, auth: keys.auth })
      .onConflictDoUpdate({
        target: pushSubscriptionsTable.endpoint,
        set: { userId, p256dh: keys.p256dh, auth: keys.auth },
      });
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "Push subscription failed");
    res.status(500).json({ error: "Internal error" });
  }
});

router.delete("/push/unsubscribe", async (req, res) => {
  const { endpoint } = req.body;
  if (!endpoint) {
    res.status(400).json({ error: "endpoint is required" });
    return;
  }
  await db.delete(pushSubscriptionsTable).where(eq(pushSubscriptionsTable.endpoint, endpoint));
  res.json({ ok: true });
});

router.get("/push/preferences", async (req, res) => {
  const userId = getUserId(req);
  const prefs = await getUserPrefs(userId);
  res.json(prefs);
});

router.put("/push/preferences", async (req, res) => {
  const userId = getUserId(req);
  const incoming = req.body as Partial<NotificationPrefs>;
  const current = await getUserPrefs(userId);
  const merged: NotificationPrefs = { ...current, ...incoming };

  const where = userId ? eq(userSettingsTable.userId, userId) : isNull(userSettingsTable.userId);
  const [existing] = await db.select({ id: userSettingsTable.id })
    .from(userSettingsTable)
    .where(where)
    .limit(1);

  if (existing) {
    await db.update(userSettingsTable)
      .set({ notificationPrefs: JSON.stringify(merged) })
      .where(eq(userSettingsTable.id, existing.id));
  } else {
    await db.insert(userSettingsTable).values({
      userId,
      notificationPrefs: JSON.stringify(merged),
      backgroundType: "default",
      fontChoice: "inter",
      backgroundDarkness: 60,
    });
  }

  res.json(merged);
});

export default router;
