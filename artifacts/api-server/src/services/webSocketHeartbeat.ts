import { WebSocket, WebSocketServer } from "ws";

/**
 * Shared hardening for our control-channel WebSocket servers (account bridge,
 * broker hub, news hub). At thousands of concurrent users the two risks that
 * actually bite are:
 *
 *  1. Zombie connections — a client that drops off the network (laptop sleep,
 *     dead Wi-Fi) never sends a TCP FIN, so the socket lingers and leaks memory
 *     and file descriptors. A ping/pong heartbeat detects and reaps them.
 *  2. Unbounded inbound frames — ws defaults to a 100 MiB max payload, which is
 *     a trivial memory-exhaustion vector for a control channel. We cap it.
 *  3. Slow consumers — a client that can't keep up makes the server buffer
 *     broadcasts without bound. We skip sends once its buffer is backed up.
 */

/** Inbound frame cap for control-channel sockets (ws default is 100 MiB). */
export const CONTROL_WS_MAX_PAYLOAD_BYTES = 1024 * 1024; // 1 MiB

/** Skip broadcasting to a client whose outbound buffer is backed up past this. */
export const WS_MAX_BUFFERED_BYTES = 4 * 1024 * 1024; // 4 MiB

/** Default heartbeat cadence: ping every 30s, reap clients that miss a pong. */
export const DEFAULT_HEARTBEAT_INTERVAL_MS = 30_000;

export function createControlWebSocketServer(): WebSocketServer {
  return new WebSocketServer({
    noServer: true,
    maxPayload: CONTROL_WS_MAX_PAYLOAD_BYTES,
  });
}

/** True when the client is open and not backpressured — safe to send to. */
export function canSend(
  client: Pick<WebSocket, "readyState" | "bufferedAmount">,
  maxBufferedBytes = WS_MAX_BUFFERED_BYTES,
): boolean {
  return (
    client.readyState === WebSocket.OPEN &&
    client.bufferedAmount <= maxBufferedBytes
  );
}

interface HeartbeatClient {
  readyState: number;
  on(event: "pong", listener: () => void): unknown;
  ping(): void;
  terminate(): void;
}

interface HeartbeatServer {
  clients: Iterable<HeartbeatClient>;
  on(event: "connection", listener: (client: HeartbeatClient) => void): unknown;
}

interface HeartbeatScheduler {
  setInterval: (handler: () => void, ms: number) => unknown;
  clearInterval: (handle: unknown) => void;
}

export interface HeartbeatOptions {
  intervalMs?: number;
  scheduler?: HeartbeatScheduler;
}

/**
 * Installs a ping/pong heartbeat on a WebSocket server and returns a stop
 * function. Call before any client connects so every connection is tracked.
 */
export function startHeartbeat(
  wss: HeartbeatServer,
  options: HeartbeatOptions = {},
): () => void {
  const intervalMs = options.intervalMs ?? DEFAULT_HEARTBEAT_INTERVAL_MS;
  const scheduler = options.scheduler;
  // WeakSet keeps liveness off the client object and never blocks GC.
  const alive = new WeakSet<object>();

  wss.on("connection", (client) => {
    alive.add(client);
    client.on("pong", () => alive.add(client));
  });

  const tick = () => {
    for (const client of wss.clients) {
      if (!alive.has(client)) {
        client.terminate();
        continue;
      }
      alive.delete(client);
      client.ping();
    }
  };

  const handle = scheduler
    ? scheduler.setInterval(tick, intervalMs)
    : setInterval(tick, intervalMs);
  // Never let the heartbeat keep the process alive on its own.
  if (
    !scheduler &&
    handle &&
    typeof (handle as NodeJS.Timeout).unref === "function"
  ) {
    (handle as NodeJS.Timeout).unref();
  }

  return () => {
    if (scheduler) scheduler.clearInterval(handle);
    else clearInterval(handle as NodeJS.Timeout);
  };
}
