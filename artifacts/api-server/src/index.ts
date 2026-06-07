import { createServer } from "node:http";
import app from "./app";
import { startSessionScheduler } from "./routes/push.js";
import { startBrainScanner } from "./services/brainScanner.js";
import { attachAccountBridgeWebSocket } from "./services/accountBridge/socketServer.js";
import { attachBrokerHubWebSocket } from "./services/brokerHub/socketServer.js";
import { newsHubRuntime } from "./services/newsHub/runtimeSingleton.js";
import { attachNewsHubWebSocket } from "./services/newsHub/socketServer.js";
import { attachNewsProviderSockets } from "./services/newsHub/providerSockets.js";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = createServer(app);
attachAccountBridgeWebSocket(server);
attachBrokerHubWebSocket(server);
attachNewsHubWebSocket(server, newsHubRuntime);

server.listen(port, () => {
  console.log(`Server listening on port ${port}`);
  startSessionScheduler();
  startBrainScanner();
  attachNewsProviderSockets(newsHubRuntime);
  void newsHubRuntime.refresh({ force: true }).catch((error) => {
    console.warn("[news] Initial refresh failed:", error instanceof Error ? error.message : error);
  });
  newsHubRuntime.start();
});
