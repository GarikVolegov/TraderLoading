import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { WebSocket } from "ws";

process.env.DATABASE_URL ??= "postgres://user:pass@127.0.0.1:5432/test";

const { attachBattleRoomWebSocket } = await import("./battleRoomSocket.js");
const { battleRoomManager } = await import("./battleRoomManager.js");
type BattleRoomServerMessage = import("./battleRoomTypes.js").BattleRoomServerMessage;

async function listen(): Promise<{ server: Server; socketServer: ReturnType<typeof attachBattleRoomWebSocket>; url: string }> {
  const server = createServer();
  const socketServer = attachBattleRoomWebSocket(server, {
    authenticate: async () => ({ userId: "test_user_alpha", source: "session" }),
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

function nextMessage<T = BattleRoomServerMessage>(ws: WebSocket, timeoutMs = 2500): Promise<T> {
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

async function runTests() {
  battleRoomManager.resetForTesting();

  // Test 1: Connect, Snapshot, Broadcast trade & Telemetry
  const { server, socketServer, url } = await listen();

  try {
    const client1 = await openSocket(url);

    // Join room 1
    client1.send(
      JSON.stringify({
        type: "join_room",
        roomId: "room_gold_trial",
        tournamentId: 1,
        user: {
          displayName: "Gazz Master",
          country: "IT",
          gradeTitle: "Custode della Regola",
        },
      }),
    );

    const msg1 = await nextMessage(client1);
    assert.equal(msg1.type, "room_snapshot");
    assert.equal(msg1.roomId, "room_gold_trial");
    assert.ok(msg1.participants.some((p: any) => p.displayName === "Gazz Master"));

    // Broadcast a trade
    client1.send(
      JSON.stringify({
        type: "trade_executed",
        roomId: "room_gold_trial",
        trade: {
          userId: "test_user_alpha",
          displayName: "Gazz Master",
          type: "BUY",
          price: 2650.5,
          timestamp: Date.now(),
        },
      }),
    );

    const tradeMsg = await nextMessage(client1);
    assert.equal(tradeMsg.type, "trade_broadcast");
    assert.equal((tradeMsg as any).trade.type, "BUY");
    assert.equal((tradeMsg as any).trade.price, 2650.5);

    // Telemetry update
    client1.send(
      JSON.stringify({
        type: "telemetry_update",
        roomId: "room_gold_trial",
        profitPct: 3.45,
        drawdownPct: 1.2,
        tradesCount: 4,
      }),
    );

    const tickMsg = await nextMessage(client1);
    assert.equal(tickMsg.type, "telemetry_tick");
    const me = (tickMsg as any).participants.find((p: any) => p.userId === "test_user_alpha");
    assert.equal(me.currentProfitPct, 3.45);
    assert.equal(me.currentDrawdownPct, 1.2);

    client1.close();
  } finally {
    await socketServer.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  // Test 2: Excessive Drawdown Disqualification
  const { server: server2, socketServer: socketServer2, url: url2 } = await listen();
  try {
    const client = await openSocket(url2);

    client.send(
      JSON.stringify({
        type: "join_room",
        roomId: "room_strict_dd",
        tournamentId: 1,
        user: { displayName: "Aggressive Scalper" },
      }),
    );
    await nextMessage(client); // snapshot

    // Send excessive drawdown (> 10%)
    client.send(
      JSON.stringify({
        type: "telemetry_update",
        roomId: "room_strict_dd",
        profitPct: -10.5,
        drawdownPct: 10.5,
        tradesCount: 12,
      }),
    );

    const dqMsg = await nextMessage(client);
    assert.equal(dqMsg.type, "participant_disqualified");
    assert.ok((dqMsg as any).reason.includes("Drawdown 10%"));

    client.close();
  } finally {
    await socketServer2.close();
    await new Promise<void>((resolve) => server2.close(() => resolve()));
  }

  // Test 3: Custom Lobby, Ready Toggle & Countdown Launch with Blind Dates
  const { server: server3, socketServer: socketServer3, url: url3 } = await listen();
  try {
    const client = await openSocket(url3);

    client.send(
      JSON.stringify({
        type: "join_room",
        roomId: "custom_forgia_999",
        tournamentId: 999,
        user: { displayName: "Limen Veteran", isReady: false },
        rules: {
          title: "Stanza Spartana",
          pair: "EUR/USD",
          timeframe: "M15",
          randomDates: true,
        },
      }),
    );

    const snapMsg = await nextMessage(client);
    assert.equal(snapMsg.type, "room_snapshot");
    assert.equal((snapMsg as any).rules?.pair, "EUR/USD");
    assert.equal((snapMsg as any).rules?.randomDates, true);

    // Toggle Ready status
    client.send(
      JSON.stringify({
        type: "set_ready_status",
        roomId: "custom_forgia_999",
        isReady: true,
      }),
    );

    const readyMsg = await nextMessage(client);
    assert.equal(readyMsg.type, "ready_status_changed");
    assert.equal((readyMsg as any).isReady, true);

    // Start battle
    client.send(
      JSON.stringify({
        type: "start_battle_request",
        roomId: "custom_forgia_999",
      }),
    );

    // Receives countdown
    const cdMsg = await nextMessage(client, 4000);
    assert.equal(cdMsg.type, "battle_countdown");

    client.close();
  } finally {
    battleRoomManager.resetForTesting();
    await socketServer3.close();
    await new Promise<void>((resolve) => server3.close(() => resolve()));
  }

  console.log("battleRoomSocket and real-time room synchronization checks passed successfully");
}

await runTests();
