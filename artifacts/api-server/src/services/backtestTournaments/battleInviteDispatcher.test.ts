process.env.DATABASE_URL ??= "postgres://user:pass@127.0.0.1:5432/test";

import test from "node:test";
import assert from "node:assert/strict";

const {
  buildBattleInvitePushPayload,
  dispatchBattleInvitePush,
  registerBattleInvitePushBridge,
} = await import("./battleInviteDispatcher.js");
const { battleRoomManager } = await import("./battleRoomManager.js");
type BattleInvitePayload = import("./battleRoomManager.js").BattleInvitePayload;
type BattleInvitePushPayload = import("./battleInviteDispatcher.js").BattleInvitePushPayload;

test("battleInviteDispatcher: buildBattleInvitePushPayload renders solemn Italian copy by default", () => {
  const invite: BattleInvitePayload = {
    roomId: "custom_forgia_ALPHA7",
    roomCode: "ALPHA7",
    senderName: "Guerriero Aureus",
    targetUserId: "user_target_42",
    pair: "XAU/USD",
    timeframe: "M5",
    durationMinutes: 15,
  };

  const payload = buildBattleInvitePushPayload(invite, "it");

  assert.equal(payload.title, "Le Prove del Fuoco — Convocazione");
  assert.equal(
    payload.body,
    "Guerriero Aureus ti convoca a duello nella Forgia [XAU/USD · M5 · 15 min]. Rispondi alla chiamata.",
  );
  assert.equal(payload.tag, "battle-invite-custom_forgia_ALPHA7");
  assert.equal(payload.data.url, "/backtest?tab=battaglie&join=ALPHA7");
  assert.equal(payload.data.roomId, "custom_forgia_ALPHA7");
  assert.equal(payload.data.roomCode, "ALPHA7");
  assert.equal(payload.data.pair, "XAU/USD");
  assert.equal(payload.data.timeframe, "M5");
  assert.equal(payload.data.durationMinutes, 15);
});

test("battleInviteDispatcher: buildBattleInvitePushPayload renders solemn English copy when requested", () => {
  const invite: BattleInvitePayload = {
    roomId: "custom_forgia_BETA9",
    roomCode: "BETA9",
    senderName: "Architetto del Rischio",
    targetUserId: "user_target_99",
    pair: "EUR/USD",
    timeframe: "M15",
    durationMinutes: 30,
  };

  const payload = buildBattleInvitePushPayload(invite, "en-US");

  assert.equal(payload.title, "The Trials of Fire — Summons");
  assert.equal(
    payload.body,
    "Architetto del Rischio summons you to a duel in the Forge [EUR/USD · M15 · 30 min]. Answer the call.",
  );
  assert.equal(payload.tag, "battle-invite-custom_forgia_BETA9");
  assert.equal(payload.data.url, "/backtest?tab=battaglie&join=BETA9");
  assert.equal(payload.data.pair, "EUR/USD");
});

test("battleInviteDispatcher: dispatchBattleInvitePush invokes sendPush with social category", async () => {
  const sentPushes: Array<{
    targetUserId: string | null;
    payload: unknown;
    prefKey: string | undefined;
  }> = [];

  const mockSendPush = async (
    targetUserId: string | null,
    payload: any,
    prefKey?: any,
  ): Promise<void> => {
    sentPushes.push({ targetUserId, payload, prefKey });
  };

  const mockGetLang = async (_userId: string | null): Promise<string> => {
    return "it";
  };

  const invite: BattleInvitePayload = {
    roomId: "custom_forgia_TITAN",
    roomCode: "TITAN",
    senderName: "Custode del Varco",
    targetUserId: "trader_sov_10",
    pair: "BTC/USD",
    timeframe: "H1",
    durationMinutes: 60,
  };

  await dispatchBattleInvitePush(invite, {
    sendPush: mockSendPush as any,
    getLang: mockGetLang,
  });

  assert.equal(sentPushes.length, 1);
  assert.equal(sentPushes[0].targetUserId, "trader_sov_10");
  assert.equal(sentPushes[0].prefKey, "social");
  assert.equal((sentPushes[0].payload as any).title, "Le Prove del Fuoco — Convocazione");
  assert.equal(
    (sentPushes[0].payload as any).data.url,
    "/backtest?tab=battaglie&join=TITAN",
  );
});

test("battleInviteDispatcher: battleRoomManager.sendInvite triggers registered invite listeners", async () => {
  battleRoomManager.resetForTesting();

  // Create a custom room
  const roomId = "custom_forgia_DELTA44";
  battleRoomManager.getOrCreateRoom(roomId, 1, {
    pair: "NAS100",
    timeframe: "M1",
    timeLimitSeconds: 600,
  });

  const capturedInvites: BattleInvitePayload[] = [];
  const unsub = battleRoomManager.onInvite((inv) => {
    capturedInvites.push(inv);
  });

  battleRoomManager.sendInvite(roomId, "Comandante Aureus", "challenger_77");

  assert.equal(capturedInvites.length, 1);
  assert.equal(capturedInvites[0].roomId, roomId);
  assert.equal(capturedInvites[0].roomCode, "DELTA44");
  assert.equal(capturedInvites[0].senderName, "Comandante Aureus");
  assert.equal(capturedInvites[0].targetUserId, "challenger_77");
  assert.equal(capturedInvites[0].pair, "NAS100");
  assert.equal(capturedInvites[0].timeframe, "M1");
  assert.equal(capturedInvites[0].durationMinutes, 10);

  // Unsubscribe should cease delivery
  unsub();
  battleRoomManager.sendInvite(roomId, "Comandante Aureus", "challenger_88");
  assert.equal(capturedInvites.length, 1);

  battleRoomManager.resetForTesting();
});

test("battleInviteDispatcher: registerBattleInvitePushBridge lifecycle handles dispatch correctly", async () => {
  battleRoomManager.resetForTesting();

  const dispatched: Array<{ targetUserId: string | null; payload: any }> = [];
  const mockSendPush = async (targetUserId: string | null, payload: any): Promise<void> => {
    dispatched.push({ targetUserId, payload });
  };
  const mockGetLang = async (): Promise<string> => "en";

  const unregister = registerBattleInvitePushBridge(battleRoomManager, {
    sendPush: mockSendPush as any,
    getLang: mockGetLang,
  });

  const roomId = "custom_forgia_OLYMPUS";
  battleRoomManager.getOrCreateRoom(roomId, 2, {
    pair: "XAU/USD",
    timeframe: "M5",
    timeLimitSeconds: 900,
  });

  battleRoomManager.sendInvite(roomId, "Master Aureus", "operative_100");

  // Allow microtasks to complete
  await new Promise((r) => setTimeout(r, 10));

  assert.equal(dispatched.length, 1);
  assert.equal(dispatched[0].targetUserId, "operative_100");
  assert.equal(dispatched[0].payload.title, "The Trials of Fire — Summons");

  unregister();
  battleRoomManager.resetForTesting();
});
