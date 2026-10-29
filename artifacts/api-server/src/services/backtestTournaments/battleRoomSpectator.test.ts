import test from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { WebSocket } from "ws";

process.env.DATABASE_URL ??= "postgres://user:pass@127.0.0.1:5432/test";

const { attachBattleRoomWebSocket } = await import("./battleRoomSocket.js");
const { battleRoomManager } = await import("./battleRoomManager.js");
type BattleRoomServerMessage = import("./battleRoomTypes.js").BattleRoomServerMessage;

let userCounter = 0;

async function listen(): Promise<{ server: Server; socketServer: ReturnType<typeof attachBattleRoomWebSocket>; url: string }> {
  const server = createServer();
  const socketServer = attachBattleRoomWebSocket(server, {
    authenticate: async () => ({ userId: `test_user_${++userCounter}`, source: "session" }),
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const port = (server.address() as AddressInfo).port;
  return { server, socketServer, url: `ws://127.0.0.1:${port}/api/backtest/battle-rooms/ws` };
}

function openSocket(url: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.once("open", () => resolve(ws));
    ws.once("error", reject);
  });
}

function nextMessage<T = BattleRoomServerMessage>(ws: WebSocket, timeoutMs = 10000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.off("message", onMessage);
      reject(new Error("timed out waiting for battle room socket message"));
    }, timeoutMs);
    function onMessage(data: WebSocket.RawData) {
      clearTimeout(timer);
      ws.off("message", onMessage);
      try {
        resolve(JSON.parse(String(data)) as T);
      } catch (err) {
        reject(err);
      }
    }
    ws.on("message", onMessage);
  });
}

test("battleRoomSpectator: spectator joins, receives live telemetry without entering participants, and decrements on leave", async () => {
  battleRoomManager.resetForTesting();
  const { server, socketServer, url } = await listen();

  const combatant = await openSocket(url);
  const spectator = await openSocket(url);

  const roomId = "custom_forgia_spectator_test";

  try {
    // 1. Combatant joins the room
    combatant.send(
      JSON.stringify({
        type: "join_room",
        roomId,
        tournamentId: 1,
        user: {
          displayName: "GARIKFX",
          gradeTitle: "Sovrano",
          currentProfitPct: 0,
          currentDrawdownPct: 0,
        },
      }),
    );

    const combatantSnapshot = await nextMessage(combatant);
    assert.equal(combatantSnapshot.type, "room_snapshot");

    // 2. Spectator joins in spectator mode
    spectator.send(
      JSON.stringify({
        type: "spectate_room",
        roomId,
      }),
    );

    const spectatorSnapshot = await nextMessage(spectator);
    assert.equal(spectatorSnapshot.type, "room_snapshot");
    assert.equal((spectatorSnapshot as any).spectatorCount, 1);
    
    // Spectator must NOT be listed in room participants
    const participants = (spectatorSnapshot as any).participants;
    assert.ok(participants.length >= 1, "Must contain combatant");
    assert.ok(participants.some((p: any) => p.displayName === "GARIKFX"), "Combatant must be present");
    assert.ok(!participants.some((p: any) => p.userId === `test_user_${userCounter}`), "Spectator must NOT be a participant");

    // 3. Combatant sends telemetry update with bio-telemetry heart rate
    combatant.send(
      JSON.stringify({
        type: "telemetry_update",
        roomId,
        profitPct: 4.85,
        drawdownPct: 0.9,
        tradesCount: 2,
        biometricBpm: 72,
        biometricShareConsent: true,
      }),
    );

    // Spectator receives live telemetry_tick broadcast
    const tickMsg = await nextMessage(spectator);
    assert.equal(tickMsg.type, "telemetry_tick");
    const garik = (tickMsg as any).participants.find((p: any) => p.displayName === "GARIKFX");
    assert.ok(garik, "Garik must be in telemetry tick");
    assert.equal(garik.currentProfitPct, 4.85);
    assert.equal(garik.biometricBpm, 72);
    assert.equal(garik.stressLevel, "calm");

    // 4. Spectator sends leave_spectate
    spectator.send(
      JSON.stringify({
        type: "leave_spectate",
        roomId,
      }),
    );

    // Combatant receives spectator_count_update with 0
    const countMsg = await nextMessage(combatant);
    assert.equal(countMsg.type, "spectator_count_update");
    assert.equal((countMsg as any).spectatorCount, 0);

  } finally {
    combatant.close();
    spectator.close();
    await socketServer.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    battleRoomManager.resetForTesting();
  }
});
