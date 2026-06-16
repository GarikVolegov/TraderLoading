// Risk-guard push notifications: when a trade syncs and a DANGER breaker is
// active, push the trader so the circuit-breaker reaches them even when they're
// not looking at the Edge tab. Warnings stay in-app (no push noise).
//
// The decision (which breaches → which push payloads, localized) is the pure,
// unit-tested core. Delivery reuses sendPushToUser, which is VAPID-safe,
// deduplicated, and cleans up dead subscriptions.

import {
  DEFAULT_RISK_GUARD_CONFIG,
  evaluateRiskGuard,
  type RiskGuardAlertType,
  type RiskGuardReport,
} from "./riskGuard.js";
import { loadClosedEdgeTrades, loadGuardOverrides } from "./edgeData.js";
import { getUserNotificationLanguage, sendPushToUser } from "../routes/push.js";

export interface BreachNotification {
  type: RiskGuardAlertType;
  title: string;
  body: string;
  tag: string;
}

type BreachBody = (value: number, threshold: number) => string;

interface LangCopy {
  title: string;
  bodies: Partial<Record<RiskGuardAlertType, BreachBody>>;
}

const COPY: Record<string, LangCopy> = {
  it: {
    title: "Risk guard — fermati",
    bodies: {
      loss_streak: (v) => `${v} perdite di fila. Stacca prima di peggiorare.`,
      daily_loss: (v, t) => `Sei a ${v}R oggi (limite −${t}R). Valuta di fermarti.`,
      daily_loss_cash: (v, t) => `P&L di oggi ${v} (limite −${t}). Stai sforando il limite giornaliero.`,
      revenge: (v) => `${v} trade in revenge dopo una perdita. Respira prima di rientrare.`,
    },
  },
  en: {
    title: "Risk guard — stop",
    bodies: {
      loss_streak: (v) => `${v} losses in a row. Step away before it gets worse.`,
      daily_loss: (v, t) => `You're at ${v}R today (limit −${t}R). Consider stopping.`,
      daily_loss_cash: (v, t) => `Today's P&L ${v} (limit −${t}). You're hitting your daily limit.`,
      revenge: (v) => `${v} revenge trades after a loss. Breathe before re-entering.`,
    },
  },
  es: {
    title: "Risk guard — para",
    bodies: {
      loss_streak: (v) => `${v} pérdidas seguidas. Aléjate antes de que empeore.`,
      daily_loss: (v, t) => `Vas ${v}R hoy (límite −${t}R). Considera parar.`,
      daily_loss_cash: (v, t) => `P&L de hoy ${v} (límite −${t}). Estás alcanzando tu límite diario.`,
      revenge: (v) => `${v} operaciones de revancha tras una pérdida. Respira antes de reentrar.`,
    },
  },
  fr: {
    title: "Risk guard — stop",
    bodies: {
      loss_streak: (v) => `${v} pertes d'affilée. Mets-toi en retrait avant que ça empire.`,
      daily_loss: (v, t) => `Tu es à ${v}R aujourd'hui (limite −${t}R). Envisage d'arrêter.`,
      daily_loss_cash: (v, t) => `P&L du jour ${v} (limite −${t}). Tu atteins ta limite journalière.`,
      revenge: (v) => `${v} trades de revanche après une perte. Respire avant de rentrer.`,
    },
  },
  de: {
    title: "Risk Guard — Stopp",
    bodies: {
      loss_streak: (v) => `${v} Verluste in Folge. Zieh dich zurück, bevor es schlimmer wird.`,
      daily_loss: (v, t) => `Du bist heute bei ${v}R (Limit −${t}R). Erwäge aufzuhören.`,
      daily_loss_cash: (v, t) => `Heutiges P&L ${v} (Limit −${t}). Du erreichst dein Tageslimit.`,
      revenge: (v) => `${v} Revenge-Trades nach einem Verlust. Atme durch, bevor du wieder einsteigst.`,
    },
  },
};

/** Pure: which DANGER breaches in a report should be pushed, with localized copy. */
export function buildBreachNotifications(report: RiskGuardReport, language: string): BreachNotification[] {
  const copy = COPY[language] ?? COPY.it;
  const notifications: BreachNotification[] = [];
  for (const alert of report.alerts) {
    if (alert.severity !== "danger") continue;
    const body = copy.bodies[alert.type];
    if (!body) continue;
    notifications.push({
      type: alert.type,
      title: copy.title,
      body: body(alert.value, alert.threshold),
      tag: `risk-guard:${alert.type}`,
    });
  }
  return notifications;
}

/**
 * Evaluates the user's guard and pushes any active danger breaches. Called from
 * the broker sync after new trades land. Must be wrapped by the caller so a
 * notification failure can never break the sync.
 */
export async function notifyRiskGuardBreaches(userId: string): Promise<void> {
  const [trades, overrides, language] = await Promise.all([
    loadClosedEdgeTrades(userId),
    loadGuardOverrides(userId),
    getUserNotificationLanguage(userId),
  ]);

  const report = evaluateRiskGuard(trades, new Date(), { ...DEFAULT_RISK_GUARD_CONFIG, ...overrides });
  const notifications = buildBreachNotifications(report, language);

  for (const notification of notifications) {
    await sendPushToUser(userId, {
      title: notification.title,
      body: notification.body,
      tag: notification.tag,
      requireInteraction: true,
      data: { type: "risk-guard", breach: notification.type, url: "/journal" },
    });
  }
}
