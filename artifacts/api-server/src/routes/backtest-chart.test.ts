import assert from "node:assert/strict";
import express from "express";
import type { AddressInfo } from "node:net";
import {
  defaultChartPreferences,
  type BacktestChartSnapshot,
} from "../../../../contracts/backtestChart.js";
import type { BacktestChartStore } from "../services/backtestChartPreferences.js";

process.env.DATABASE_URL ??= "postgres://user:pass@127.0.0.1:5432/test";
const { createBacktestChartRouter } = await import("./backtest-chart.js");
const rows = new Map<string, BacktestChartSnapshot>();
const calls: string[] = [];
const store: BacktestChartStore = {
  async read(userId) {
    calls.push(userId);
    return rows.get(userId) ?? { revision: 0, preferences: null };
  },
  async write(userId, request) {
    calls.push(userId);
    const current = rows.get(userId) ?? { revision: 0, preferences: null };
    if (request.revision !== current.revision) return { conflict: true, snapshot: current };
    const next = { revision: current.revision + 1, preferences: request.preferences };
    rows.set(userId, next);
    return { conflict: false, snapshot: next };
  },
};
const app = express();
app.use(express.json({ limit: "300kb" }));
app.use((req, _res, next) => {
  const userId = req.header("x-test-user");
  if (userId) req.user = { id: userId } as Express.User;
  next();
});
app.use(createBacktestChartRouter(store));
const server = app.listen(0, "127.0.0.1");
await new Promise<void>((resolve) => server.once("listening", resolve));
const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/settings/backtest-chart`;
const request = (userId?: string, body?: unknown) =>
  fetch(url, {
    method: body ? "PUT" : "GET",
    headers: { "Content-Type": "application/json", ...(userId ? { "x-test-user": userId } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
try {
  assert.equal((await request()).status, 401);
  assert.equal(
    (await request(undefined, { revision: 0, preferences: defaultChartPreferences() })).status,
    401,
  );
  assert.equal(calls.length, 0, "unauthenticated requests never reach storage");
  assert.deepEqual(await (await request("a")).json(), { revision: 0, preferences: null });
  assert.equal(
    (await request("a", { revision: -1, preferences: defaultChartPreferences() })).status,
    400,
  );
  const preferences = defaultChartPreferences();
  preferences.settings.chartBgColor1 = "#fafafa";
  let response = await request("a", { revision: 0, preferences });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(((await response.json()) as BacktestChartSnapshot).revision, 1);
  assert.equal(
    ((await (await request("a")).json()) as BacktestChartSnapshot).preferences?.settings
      .chartBgColor1,
    "#fafafa",
  );
  assert.deepEqual(await (await request("b")).json(), { revision: 0, preferences: null });
  // Two devices with the same base revision cannot silently overwrite each other.
  const results = await Promise.all([
    request("a", { revision: 1, preferences }),
    request("a", { revision: 1, preferences }),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  response = results.find((r) => r.status === 409)!;
  assert.equal(((await response.json()) as BacktestChartSnapshot).revision, 2);
  assert.equal(
    (await request("a", { revision: 0, preferences, padding: "x".repeat(200_001) })).status,
    413,
  );
} finally {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}
console.log("chart preferences authenticated routes, isolation and CAS conflict responses passed");
