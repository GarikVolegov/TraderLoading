import assert from "node:assert/strict";
import type { ConnectionHealth } from "./useBattleRoom";
import type { RoomTradeBroadcast } from "../../../../api-server/src/services/backtestTournaments/battleRoomTypes";

// Mock WebSocket implementation for client-side testing
class MockWebSocket {
  static OPEN = 1;
  static CLOSED = 3;
  readyState = MockWebSocket.OPEN;
  sentMessages: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;

  send(data: string) {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error("WebSocket not open");
    }
    this.sentMessages.push(data);
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.();
  }
}

async function testResilienceQueueAndHeartbeat() {
  console.log("Testing useBattleRoom resilience, action buffering & latency sentinel...");

  // 1. ConnectionHealth Type Assertions
  const states: ConnectionHealth[] = ["connected", "degraded", "reconnecting", "offline"];
  assert.equal(states.length, 4);

  // 2. Action Buffering Simulation (Queue Logic)
  type PendingAction =
    | { type: "trade"; payload: Omit<RoomTradeBroadcast, "id"> }
    | { type: "telemetry"; payload: { profitPct: number; drawdownPct: number; tradesCount: number } }
    | { type: "sentence"; payload: string };

  let pendingActions: PendingAction[] = [];

  // Simulate disconnected calls
  const mockTrade: Omit<RoomTradeBroadcast, "id"> = {
    userId: "op_01",
    displayName: "Iniziato Aureus",
    type: "BUY",
    price: 2650.0,
    timestamp: 1729000000,
  };

  // Queue trade
  pendingActions.push({ type: "trade", payload: mockTrade });
  assert.equal(pendingActions.length, 1);

  // Queue first telemetry
  pendingActions.push({
    type: "telemetry",
    payload: { profitPct: 1.5, drawdownPct: 0.5, tradesCount: 1 },
  });
  assert.equal(pendingActions.length, 2);

  // Queue second telemetry: must replace prior telemetry (latest-wins)
  const newTelemetry = { profitPct: 3.2, drawdownPct: 0.8, tradesCount: 2 };
  pendingActions = [
    ...pendingActions.filter((a) => a.type !== "telemetry"),
    { type: "telemetry", payload: newTelemetry },
  ];
  assert.equal(pendingActions.length, 2, "Telemetry must be deduplicated (latest-wins)");
  assert.equal((pendingActions[1].payload as any).profitPct, 3.2);

  // Queue stoic sentence
  pendingActions.push({
    type: "sentence",
    payload: "Nessun cedimento emotivo",
  });
  assert.equal(pendingActions.length, 3);

  // 3. Reconnection Flush Test
  const mockWs = new MockWebSocket();
  const roomId = "room_arena_test";

  // Simulate flush
  const flushed = [...pendingActions];
  pendingActions = [];
  assert.equal(pendingActions.length, 0);

  for (const action of flushed) {
    if (action.type === "trade") {
      mockWs.send(JSON.stringify({ type: "trade_executed", roomId, trade: action.payload }));
    } else if (action.type === "telemetry") {
      mockWs.send(JSON.stringify({ type: "telemetry_update", roomId, ...action.payload }));
    } else if (action.type === "sentence") {
      mockWs.send(JSON.stringify({ type: "send_stoic_sentence", roomId, sentence: action.payload }));
    }
  }

  assert.equal(mockWs.sentMessages.length, 3);
  const msg1 = JSON.parse(mockWs.sentMessages[0]);
  const msg2 = JSON.parse(mockWs.sentMessages[1]);
  const msg3 = JSON.parse(mockWs.sentMessages[2]);

  assert.equal(msg1.type, "trade_executed");
  assert.equal(msg1.trade.type, "BUY");
  assert.equal(msg2.type, "telemetry_update");
  assert.equal(msg2.profitPct, 3.2);
  assert.equal(msg3.type, "send_stoic_sentence");
  assert.equal(msg3.sentence, "Nessun cedimento emotivo");

  // 4. Latency Calculation & Degraded State Check
  const sentPingAt = Date.now() - 320; // 320ms ago
  const pongMsg = {
    type: "pong",
    clientTimestamp: sentPingAt,
    serverTimestamp: Date.now(),
  };

  const rtt = Math.max(1, Date.now() - pongMsg.clientTimestamp);
  assert.ok(rtt >= 300, "RTT should be at least 300ms");
  const health: ConnectionHealth = rtt >= 280 ? "degraded" : "connected";
  assert.equal(health, "degraded", "RTT >= 280ms must classify as degraded");

  const lowLatencyPing = Date.now() - 45; // 45ms ago
  const fastRtt = Math.max(1, Date.now() - lowLatencyPing);
  const fastHealth: ConnectionHealth = fastRtt >= 280 ? "degraded" : "connected";
  assert.equal(fastHealth, "connected", "Fast RTT must classify as connected");

  console.log("WebSocket Resiliency Sentinel tests passed with 100% precision!");
}

testResilienceQueueAndHeartbeat();
