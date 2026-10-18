import type { Duplex } from "node:stream";
/** Recheck long-lived connections; an expired/revoked identity cannot keep a socket forever. */
export function watchWebSocketAuthorization(socket: Duplex, validate: () => Promise<boolean>, intervalMs = 15_000): () => void {
  let checking = false;
  const timer = setInterval(() => {
    if (checking || socket.destroyed) return;
    checking = true;
    void validate().then(valid => { if (!valid) socket.destroy(); }, () => socket.destroy()).finally(() => { checking = false; });
  }, intervalMs);
  timer.unref();
  const stop = () => clearInterval(timer);
  socket.once("close", stop);
  return stop;
}
