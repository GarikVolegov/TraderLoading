/**
 * Per-instance cap on concurrent control-channel WebSocket connections. Without it
 * a single malicious or broken client can open thousands of sockets and exhaust
 * the process's file descriptors / memory. Heartbeat reaps *dead* sockets; this
 * bounds *live* ones. Override with MAX_WS_CLIENTS.
 */
export function maxWsClients(env: { MAX_WS_CLIENTS?: string | undefined } = process.env): number {
  const raw = Number(env.MAX_WS_CLIENTS);
  return Number.isInteger(raw) && raw > 0 ? raw : 10_000;
}

export function isAtConnectionCapacity(currentClients: number, max: number = maxWsClients()): boolean {
  return currentClients >= max;
}
