import assert from "node:assert/strict";
import { WebSocket } from "ws";

import {
  CONTROL_WS_MAX_PAYLOAD_BYTES,
  WS_MAX_BUFFERED_BYTES,
  canSend,
  createControlWebSocketServer,
  startHeartbeat,
} from "./webSocketHeartbeat.js";

// ── canSend: open + within buffer budget only ──
assert.equal(canSend({ readyState: WebSocket.OPEN, bufferedAmount: 0 }), true);
assert.equal(
  canSend({ readyState: WebSocket.CONNECTING, bufferedAmount: 0 }),
  false,
);
assert.equal(
  canSend({ readyState: WebSocket.OPEN, bufferedAmount: WS_MAX_BUFFERED_BYTES + 1 }),
  false,
  "a backed-up client must be skipped",
);
assert.equal(
  canSend({ readyState: WebSocket.OPEN, bufferedAmount: 10 }, 5),
  false,
  "custom threshold is honoured",
);

// ── createControlWebSocketServer caps inbound frame size ──
{
  const wss = createControlWebSocketServer();
  assert.equal(
    (wss.options as { maxPayload?: number }).maxPayload,
    CONTROL_WS_MAX_PAYLOAD_BYTES,
  );
  assert.equal((wss.options as { noServer?: boolean }).noServer, true);
  wss.close();
}

// ── startHeartbeat: pings live clients, reaps the ones that miss a pong ──
type FakeClient = {
  readyState: number;
  pings: number;
  terminated: boolean;
  pongListener?: () => void;
  on(event: "pong", listener: () => void): void;
  ping(): void;
  terminate(): void;
  pong(): void;
};

function makeClient(): FakeClient {
  return {
    readyState: WebSocket.OPEN,
    pings: 0,
    terminated: false,
    on(_event, listener) {
      this.pongListener = listener;
    },
    ping() {
      this.pings += 1;
    },
    terminate() {
      this.terminated = true;
    },
    pong() {
      this.pongListener?.();
    },
  };
}

{
  const clients = new Set<FakeClient>();
  let connectionListener: ((client: FakeClient) => void) | undefined;
  let captured: (() => void) | undefined;
  let cleared = 0;
  const scheduler = {
    setInterval: (handler: () => void) => {
      captured = handler;
      return 1 as unknown;
    },
    clearInterval: () => {
      cleared += 1;
    },
  };
  const wss = {
    clients,
    on(_event: "connection", listener: (client: FakeClient) => void) {
      connectionListener = listener;
    },
  };

  const stop = startHeartbeat(wss, { scheduler, intervalMs: 1_000 });
  assert.ok(connectionListener, "heartbeat should subscribe to connections");
  assert.ok(captured, "heartbeat should schedule a tick");

  const healthy = makeClient();
  const zombie = makeClient();
  clients.add(healthy);
  clients.add(zombie);
  connectionListener!(healthy);
  connectionListener!(zombie);

  // First tick: both were marked alive on connect -> both pinged, none reaped.
  captured!();
  assert.equal(healthy.pings, 1);
  assert.equal(zombie.pings, 1);
  assert.equal(zombie.terminated, false);

  // Healthy client replies with a pong; zombie stays silent.
  healthy.pong();

  // Second tick: healthy is alive again, zombie missed its pong -> terminated.
  captured!();
  assert.equal(healthy.pings, 2);
  assert.equal(zombie.terminated, true);

  stop();
  assert.equal(cleared, 1, "stop() must clear the interval");
}

console.log("websocket heartbeat checks passed");
