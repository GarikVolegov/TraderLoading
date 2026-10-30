import { createServer } from "node:http";
import { closeDbPool } from "@workspace/db";
import app from "./app";
import { cotScheduler } from "./routes/tools.js";
import { startTorneiScheduler } from "./cron/torneiScheduler.js";
import { startLifecycleScheduler } from "./cron/lifecycleScheduler.js";
import { startCandleTailScheduler } from "./cron/candleTailScheduler.js";
import { startSessionScheduler } from "./routes/push.js";
import { attachAccountBridgeWebSocket } from "./services/accountBridge/socketServer.js";
import { attachBrokerHubWebSocket } from "./services/brokerHub/socketServer.js";
import { brokerHubRuntime } from "./services/brokerHub/runtime.js";
import { newsHubRuntime } from "./services/newsHub/runtimeSingleton.js";
import { attachNewsHubWebSocket } from "./services/newsHub/socketServer.js";
import { attachNewsProviderSockets } from "./services/newsHub/providerSockets.js";
import { startMarketIntelligenceScheduler } from "./services/marketIntelligence.js";
import { attachSocialHubWebSocket } from "./services/socialHub/socketServer.js";
import { attachBattleRoomWebSocket } from "./services/backtestTournaments/battleRoomSocket.js";
import logger from "./lib/logger";
import { backgroundTasksEnabled } from "./lib/localBackgroundTasks.js";
import { assertRedisConfigured, closeSharedRedisClient } from "./lib/redisClient.js";
import { closeAppCache } from "./lib/cache.js";
import { warmupCache } from "./services/cacheWarmup.js";
import { bootstrapSovereignAdmins } from "./services/identitySync.js";
import {
  getServiceRole,
  shouldRunSchedulers,
  shouldRunWebSockets,
} from "./services/serviceRole.js";
import { uploadsPersistenceWarning } from "./lib/uploads.js";
import { captureError, flushObservability, initObservability } from "./lib/observability";
import { systemWatchdog } from "./lib/systemWatchdog.js";

initObservability();

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Refuse to boot a production instance that would silently run with per-process
// rate limits, double-firing cron and no cross-instance dedup (see redisClient).
assertRedisConfigured();

// Non-fatal: warn if uploads would land on ephemeral disk (lost on redeploy).
const uploadsWarning = uploadsPersistenceWarning();
if (uploadsWarning) logger.warn(uploadsWarning);

const serviceRole = getServiceRole();
logger.info({ serviceRole }, "Initializing AUREUS service runtime");

const server = createServer(app);
// High-concurrency production tuning: Keep-alive timeout must exceed the reverse proxy idle timeout
// (e.g. AWS ALB 60s, Railway proxy, Cloudflare) to prevent premature socket resets and 502 Bad Gateway errors.
server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;
server.requestTimeout = 30_000;
const noopAsyncCloseHandle = {
  async close() {},
};

const runWebSockets = shouldRunWebSockets(serviceRole);
const accountBridgeSocket = attachAccountBridgeWebSocket(server);
const brokerHubSocket = attachBrokerHubWebSocket(server);
const newsHubSocket = attachNewsHubWebSocket(server, newsHubRuntime);
const socialHubSocket = runWebSockets
  ? attachSocialHubWebSocket(server)
  : noopAsyncCloseHandle;
const battleRoomSocket = runWebSockets
  ? attachBattleRoomWebSocket(server)
  : noopAsyncCloseHandle;
if (!runWebSockets) {
  void Promise.allSettled([
    accountBridgeSocket.close(),
    brokerHubSocket.close(),
    newsHubSocket.close(),
  ]);
}
let newsProviderSockets: ReturnType<typeof attachNewsProviderSockets> | null = null;
let intelligenceScheduler: ReturnType<typeof startMarketIntelligenceScheduler> | null = null;

type CloseHandle = {
  close(): void | Promise<void>;
};

const noopCloseHandle: CloseHandle = {
  close() {},
};

let sessionScheduler: CloseHandle = noopCloseHandle;
let torneiScheduler: { close(): void | Promise<void> } = { close() {} };
let lifecycleScheduler: { close(): void | Promise<void> } = { close() {} };
let candleTailScheduler: { close(): void | Promise<void> } = { close() {} };
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
    socialHubSocket.close(),
    battleRoomSocket.close(),
    newsProviderSockets?.close(),
    intelligenceScheduler?.close(),
    sessionScheduler.close(),
    torneiScheduler.close(),
    lifecycleScheduler.close(),
    candleTailScheduler.close(),
    brokerHubRuntime.close(),
    cotScheduler.close(),
    newsHubRuntime.stop(),
    closeAppCache(),
  ]);

  logShutdownFailures(stopResults);
  try {
    await closeDbPool();
  } catch (err) {
    logger.error({ err }, "Database pool shutdown failed");
  }
  try {
    await closeSharedRedisClient();
  } catch (err) {
    logger.error({ err }, "Redis client shutdown failed");
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
  systemWatchdog.handleUnhandledRejection(reason);
  captureError(reason instanceof Error ? reason : new Error("Unhandled promise rejection"), {
    reason,
    surface: "process",
    kind: "unhandledRejection",
  });
  logger.error({ reason }, "Unhandled promise rejection");
  void shutdown("unhandledRejection", 1).finally(async () => {
    await flushObservability(2_000);
    process.exit(1);
  });
});

process.on("uncaughtException", (err) => {
  captureError(err, { surface: "process", kind: "uncaughtException" });
  logger.error({ err }, "Uncaught exception");
  void shutdown("uncaughtException", 1).finally(async () => {
    await flushObservability(2_000);
    process.exit(1);
  });
});

server.listen(port, () => {
  logger.info({ port, serviceRole }, "Server listening");
  void bootstrapSovereignAdmins().catch((err) => {
    logger.warn({ err }, "Initial admin bootstrap execution failed");
  });
  if (!shouldRunSchedulers(serviceRole)) {
    void cotScheduler
      .close()
      .catch((err) => logger.warn({ err }, "COT scheduler bypass failed"));
    logger.info({ serviceRole }, "Background schedulers bypassed for service role");
    return;
  }
  if (!backgroundTasksEnabled(process.env)) {
    void cotScheduler
      .close()
      .catch((err) => logger.warn({ err }, "Local COT scheduler shutdown failed"));
    logger.info("Background jobs disabled for this local development session");
    return;
  }
  sessionScheduler = startSessionScheduler();
  torneiScheduler = startTorneiScheduler();
  lifecycleScheduler = startLifecycleScheduler();
  candleTailScheduler = startCandleTailScheduler();
  newsProviderSockets = attachNewsProviderSockets(newsHubRuntime);
  intelligenceScheduler = startMarketIntelligenceScheduler();
  void newsHubRuntime.refresh({ force: true }).catch((error) => {
    logger.warn({ err: error }, "Initial news refresh failed");
  });
  newsHubRuntime.start();
  void warmupCache().catch((err) => {
    logger.warn({ err }, "Cache warmup background execution failed");
  });
});
