import { createServer } from "node:http";
import { closeDbPool } from "@workspace/db";
import app from "./app";
import { startSessionScheduler } from "./routes/push.js";
import { startBrainScanner } from "./services/brainScanner.js";
import { attachAccountBridgeWebSocket } from "./services/accountBridge/socketServer.js";
import { attachBrokerHubWebSocket } from "./services/brokerHub/socketServer.js";
import { newsHubRuntime } from "./services/newsHub/runtimeSingleton.js";
import { attachNewsHubWebSocket } from "./services/newsHub/socketServer.js";
import { attachNewsProviderSockets } from "./services/newsHub/providerSockets.js";
import logger from "./lib/logger";

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
const accountBridgeSocket = attachAccountBridgeWebSocket(server);
const brokerHubSocket = attachBrokerHubWebSocket(server);
const newsHubSocket = attachNewsHubWebSocket(server, newsHubRuntime);
let newsProviderSockets: ReturnType<typeof attachNewsProviderSockets> | null = null;

type CloseHandle = {
  close(): void | Promise<void>;
};

const noopCloseHandle: CloseHandle = {
  close() {},
};

let sessionScheduler: CloseHandle = noopCloseHandle;
let brainScanner: CloseHandle = noopCloseHandle;
let isShuttingDown = false;

function closeHttpServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!server.listening) {
      resolve();
      return;
    }

    server.close((err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
}

function logShutdownFailures(results: PromiseSettledResult<unknown>[]): void {
  const failures = results.filter((result) => result.status === "rejected");
  if (failures.length === 0) return;
  logger.error({ failures }, "Some shutdown tasks failed");
}

async function shutdown(reason: string, exitCode = 0): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;
  process.exitCode = exitCode;

  logger.info({ reason }, "Starting graceful shutdown");

  const forceExit = setTimeout(() => {
    logger.error({ reason }, "Graceful shutdown timed out");
    process.exit(1);
  }, 25_000);
  forceExit.unref();

  const stopResults = await Promise.allSettled([
    closeHttpServer(),
    accountBridgeSocket.close(),
    brokerHubSocket.close(),
    newsHubSocket.close(),
    newsProviderSockets?.close(),
    sessionScheduler.close(),
    brainScanner.close(),
    newsHubRuntime.stop(),
  ]);

  logShutdownFailures(stopResults);
  try {
    await closeDbPool();
  } catch (err) {
    logger.error({ err }, "Database pool shutdown failed");
  }
  clearTimeout(forceExit);
  logger.info({ reason }, "Graceful shutdown completed");
}

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("unhandledRejection", (reason) => {
  logger.error({ reason }, "Unhandled promise rejection");
});

process.on("uncaughtException", (err) => {
  logger.error({ err }, "Uncaught exception");
  void shutdown("uncaughtException", 1).finally(() => {
    process.exit(1);
  });
});

server.listen(port, () => {
  logger.info({ port }, "Server listening");
  sessionScheduler = startSessionScheduler();
  brainScanner = startBrainScanner();
  newsProviderSockets = attachNewsProviderSockets(newsHubRuntime);
  void newsHubRuntime.refresh({ force: true }).catch((error) => {
    logger.warn({ err: error }, "Initial news refresh failed");
  });
  newsHubRuntime.start();
});
