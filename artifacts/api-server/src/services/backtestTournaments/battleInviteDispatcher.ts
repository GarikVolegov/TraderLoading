import type { BattleInvitePayload } from "./battleRoomManager.js";
import { battleRoomManager } from "./battleRoomManager.js";
import logger from "../../lib/logger.js";

export type SendPushFunction = (
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
  prefKey?:
    | "social"
    | "sessions"
    | "messages"
    | "goals"
    | "dailyReminder"
    | "macroEvents"
    | "scheduledCalls",
) => Promise<void>;

export type GetUserLanguageFunction = (userId: string | null) => Promise<string>;

export interface BattleInvitePushPayload {
  title: string;
  body: string;
  tag: string;
  data: {
    url: string;
    roomId: string;
    roomCode: string;
    senderName: string;
    pair: string;
    timeframe: string;
    durationMinutes: number;
  };
}

export const BATTLE_INVITE_COPY: Record<
  string,
  { title: string; body: (sender: string, pair: string, tf: string, mins: number) => string }
> = {
  it: {
    title: "Le Prove del Fuoco — Convocazione",
    body: (sender, pair, tf, mins) =>
      `${sender} ti convoca a duello nella Forgia [${pair} · ${tf} · ${mins} min]. Rispondi alla chiamata.`,
  },
  en: {
    title: "The Trials of Fire — Summons",
    body: (sender, pair, tf, mins) =>
      `${sender} summons you to a duel in the Forge [${pair} · ${tf} · ${mins} min]. Answer the call.`,
  },
};

/**
 * Builds the localized Web Push notification payload for an arena invite.
 */
export function buildBattleInvitePushPayload(
  invite: BattleInvitePayload,
  language = "it",
): BattleInvitePushPayload {
  const langKey = language.toLowerCase().startsWith("en") ? "en" : "it";
  const copy = BATTLE_INVITE_COPY[langKey] || BATTLE_INVITE_COPY.it;

  const sender = invite.senderName?.trim() || "Un Operatore";
  const pair = invite.pair?.trim() || "XAU/USD";
  const tf = invite.timeframe?.trim() || "M5";
  const mins = invite.durationMinutes || 15;

  return {
    title: copy.title,
    body: copy.body(sender, pair, tf, mins),
    tag: `battle-invite-${invite.roomId}`,
    data: {
      url: `/backtest?tab=battaglie&join=${encodeURIComponent(invite.roomCode)}`,
      roomId: invite.roomId,
      roomCode: invite.roomCode,
      senderName: sender,
      pair,
      timeframe: tf,
      durationMinutes: mins,
    },
  };
}

export interface DispatchDependencies {
  sendPush?: SendPushFunction;
  getLang?: GetUserLanguageFunction;
}

/**
 * Dispatches a real-time Web Push notification to an invited trader.
 */
export async function dispatchBattleInvitePush(
  invite: BattleInvitePayload,
  deps: DispatchDependencies = {},
): Promise<void> {
  try {
    const getLang =
      deps.getLang ?? (await import("../../routes/push.js")).getUserNotificationLanguage;
    const sendPush =
      deps.sendPush ?? (await import("../../routes/push.js")).sendPushToUser;

    const lang = await getLang(invite.targetUserId);
    const payload = buildBattleInvitePushPayload(invite, lang);

    await sendPush(
      invite.targetUserId,
      {
        title: payload.title,
        body: payload.body,
        tag: payload.tag,
        icon: "/app-icon-192.png",
        badge: "/app-icon-192.png",
        data: payload.data,
      },
      "social",
    );
  } catch (err) {
    logger.warn(
      { err, targetUserId: invite.targetUserId, roomId: invite.roomId },
      "Failed to dispatch battle invite push notification",
    );
  }
}

/**
 * Registers the Web Push bridge on the battle room manager.
 * Returns an unregister function.
 */
export function registerBattleInvitePushBridge(
  manager = battleRoomManager,
  deps?: DispatchDependencies,
): () => void {
  return manager.onInvite((invite) => {
    void dispatchBattleInvitePush(invite, deps);
  });
}
