import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(new URL(`../../${path}`, import.meta.url), "utf8")) as T;
}

function readText(path: string): string {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

const apiPackage = readJson<{
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}>("artifacts/api-server/package.json");

assert.ok(apiPackage.dependencies?.compression, "API server should depend on compression");
assert.ok(apiPackage.devDependencies?.["@types/compression"], "API server should include compression types");

const appSource = readText("artifacts/api-server/src/app.ts");
assert.match(appSource, /import compression from "compression"/);
assert.match(appSource, /app\.use\(compression\(\{\s*threshold:\s*1024\s*\}\)\);/s);
assert.ok(
  appSource.indexOf("compression({") < appSource.indexOf("express.json"),
  "compression should be registered before JSON body parsing",
);

const viteConfig = readText("artifacts/trader-dashboard/vite.config.ts");
assert.match(viteConfig, /export default defineConfig\(async \(\{\s*command\s*\}\)\s*=>/);
assert.match(viteConfig, /const isServe = command === "serve"/);
assert.match(viteConfig, /if \(!isServe\) \{\s*process\.env\.NODE_ENV = "production";/s);
// Production builds must refuse to ship a bundle with a missing Clerk key,
// which would render a black screen.
assert.match(viteConfig, /VITE_CLERK_PUBLISHABLE_KEY is missing or invalid/);
assert.match(viteConfig, /\.\.\.\(isServe\s*\?\s*\[runtimeErrorOverlay\(\)\]\s*:\s*\[\]\)/);
// Sourcemaps stay off for users: `false` by default, and "hidden" only when a Sentry
// token uploads + deletes them (filesToDeleteAfterUpload) — never shipped either way.
assert.match(viteConfig, /sourcemap:\s*(false|uploadSourcemaps\s*\?\s*"hidden"\s*:\s*false)/);
assert.match(viteConfig, /minify:\s*"esbuild"/);
assert.match(viteConfig, /cssMinify:\s*true/);

const serverEntry = readText("artifacts/api-server/src/index.ts");
assert.match(serverEntry, /import logger from "\.\/lib\/logger"/);
assert.match(serverEntry, /import \{\s*closeDbPool\s*\} from "@workspace\/db"/);
assert.doesNotMatch(serverEntry, /console\.(log|warn)\(/);

for (const token of [
  "sessionScheduler = startSessionScheduler()",
  "const accountBridgeSocket = attachAccountBridgeWebSocket(server)",
  "const brokerHubSocket = attachBrokerHubWebSocket(server)",
  "const newsHubSocket = attachNewsHubWebSocket(server, newsHubRuntime)",
  "let newsProviderSockets",
  "server.close",
  "accountBridgeSocket.close()",
  "brokerHubSocket.close()",
  "newsHubSocket.close()",
  "newsProviderSockets?.close()",
  "sessionScheduler.close()",
  "brokerHubRuntime.close()",
  "cotScheduler.close()",
  "newsHubRuntime.stop()",
  "const stopResults = await Promise.allSettled",
  "await closeDbPool()",
  'process.on("SIGTERM"',
  'process.on("SIGINT"',
  'process.on("unhandledRejection"',
  'process.on("uncaughtException"',
  "logger.info",
  "logger.warn",
  "logger.error",
]) {
  assert.match(serverEntry, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
}
assert.ok(
  serverEntry.indexOf("await closeDbPool()") > serverEntry.indexOf("logShutdownFailures(stopResults)"),
  "database pool should close after runtime and scheduler shutdown has drained",
);
assert.match(
  serverEntry,
  /process\.on\("unhandledRejection", \(reason\) => \{[\s\S]*void shutdown\("unhandledRejection", 1\)\.finally\(async \(\) => \{[\s\S]*await flushObservability\(2_000\);[\s\S]*process\.exit\(1\);[\s\S]*\}\);[\s\S]*\}\);/s,
);

const pushSource = readText("artifacts/api-server/src/routes/push.ts");
assert.match(pushSource, /import logger from "\.\.\/lib\/logger\.js"/);
assert.match(pushSource, /export interface SchedulerHandle/);
assert.match(pushSource, /close\(\): Promise<void>/);
assert.match(pushSource, /export function startSessionScheduler\(\): SchedulerHandle/);
assert.match(pushSource, /let activeRun: Promise<void> \| null = null/);
assert.match(pushSource, /await activeRun/);
assert.match(pushSource, /clearInterval\(interval\)/);

const brokerRuntimeSource = readText("artifacts/api-server/src/services/brokerHub/runtime.ts");
assert.match(brokerRuntimeSource, /close\(\): Promise<void>/);
assert.match(brokerRuntimeSource, /const activeSyncs = new Map<string, Promise<void>>\(\)/);
assert.match(brokerRuntimeSource, /for \(const timer of syncTimers\.values\(\)\)/);
assert.match(brokerRuntimeSource, /clearInterval\(timer\)/);
assert.match(brokerRuntimeSource, /await Promise\.allSettled\(activeSyncs\.values\(\)\)/);
assert.ok(
  brokerRuntimeSource.indexOf("await Promise.allSettled(activeSyncs.values())") >
    brokerRuntimeSource.indexOf("syncTimers.clear()"),
  "broker auto sync promises should drain after timers are stopped",
);
assert.ok(
  brokerRuntimeSource.lastIndexOf("await current.connector.disconnect()") >
    brokerRuntimeSource.indexOf("await Promise.allSettled(activeSyncs.values())"),
  "broker connectors should disconnect after in-flight auto sync work drains",
);
assert.match(brokerRuntimeSource, /await current\.connector\.disconnect\(\)/);

const toolsSource = readText("artifacts/api-server/src/routes/tools.ts");
assert.match(toolsSource, /const cotTask = cron\.schedule/);
assert.match(toolsSource, /export const cotScheduler/);
assert.match(toolsSource, /cotTask\.stop\(\)/);
assert.match(toolsSource, /cotTask\.destroy\(\)/);

const wsShutdownSource = readText("artifacts/api-server/src/services/webSocketShutdown.ts");
assert.match(wsShutdownSource, /export async function closeWebSocketServer/);
assert.match(wsShutdownSource, /for \(const client of wss\.clients\)/);
assert.match(wsShutdownSource, /client\.close\(/);
assert.match(wsShutdownSource, /client\.terminate\(\)/);

for (const path of [
  "artifacts/api-server/src/services/accountBridge/socketServer.ts",
  "artifacts/api-server/src/services/brokerHub/socketServer.ts",
  "artifacts/api-server/src/services/newsHub/socketServer.ts",
]) {
  const source = readText(path);
  assert.match(source, /import \{\s*closeWebSocketServer\s*\} from "\.\.\/webSocketShutdown\.js"/);
  assert.match(source, /await closeWebSocketServer\(wss\)/);
}

console.log("performance runtime checks passed");
