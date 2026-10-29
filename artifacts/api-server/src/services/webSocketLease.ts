import type { Duplex } from "node:stream";
/** Recheck long-lived connections; an expired/revoked identity cannot keep a socket forever. */
export function watchWebSocketAuthorization(socket: Duplex, validate: () => Promise<boolean>, intervalMs = 15_000): () => void {
  let checking = false;
  // Add up to ±2.5s jitter on production intervals (>= 1s) to prevent thundering-herd DB/Redis spikes
  const jitterMs =
    intervalMs >= 1_000 ? Math.floor((Math.random() - 0.5) * Math.min(intervalMs * 0.3, 5_000)) : 0;
  const effectiveIntervalMs = Math.max(5, intervalMs + jitterMs);
  const timer = setInterval(() => {
    if (checking || socket.destroyed) return;
    checking = true;
    void validate().then(valid => { if (!valid) socket.destroy(); }, () => socket.destroy()).finally(() => { checking = false; });
  }, effectiveIntervalMs);
  timer.unref();
  const stop = () => clearInterval(timer);
  socket.once("close", stop);
  return stop;
}
