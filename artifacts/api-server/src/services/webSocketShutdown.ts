import { WebSocket, type WebSocketServer } from "ws";

export async function closeWebSocketServer(
  wss: WebSocketServer,
  terminateAfterMs = 5_000,
): Promise<void> {
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN || client.readyState === WebSocket.CONNECTING) {
      client.close(1001, "Server shutting down");
    }
  }

  const terminateTimer = setTimeout(() => {
    for (const client of wss.clients) {
      if (client.readyState !== WebSocket.CLOSED) {
        client.terminate();
      }
    }
  }, terminateAfterMs);
  terminateTimer.unref();

  await new Promise<void>((resolve) => {
    wss.close(() => resolve());
  });

  clearTimeout(terminateTimer);
}
