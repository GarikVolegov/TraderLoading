import assert from "node:assert/strict";
import { createServer, type Server, type Socket } from "node:net";
import { buildMt5Message, createMt5LocalSocketAdapter, parseMt5Line } from "./mt5LocalSocketAdapter.js";
import type { AccountBridgeConfig } from "./types.js";

type TestFailure = { name: string; error: unknown };
type Mt5TestServer = {
  port: number;
  connections: Socket[];
  receivedLines: string[];
  activeConnectionCount(): number;
  writeSnapshot(payload: Record<string, unknown>, socket?: Socket): void;
  writeMessage(type: string, payload: Record<string, unknown>, socket?: Socket): void;
  close(): Promise<void>;
};

const failures: TestFailure[] = [];

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function waitFor(assertion: () => boolean | Promise<boolean>, label: string, timeoutMs = 1_000): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await assertion()) return;
    await delay(10);
  }
  assert.fail(`Timed out waiting for ${label}`);
}

async function run(name: string, fn: () => Promise<void> | void): Promise<void> {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    failures.push({ name, error });
    console.error(`not ok - ${name}`);
    console.error(error);
  }
}

function makeConfig(
  port: number,
  overrides: Partial<Pick<AccountBridgeConfig, "mode" | "orderEnabled" | "orderAckTimeoutMs">> = {},
): AccountBridgeConfig {
  return {
    adapter: "mt5-local-socket",
    mode: overrides.mode ?? "live",
    host: "127.0.0.1",
    port,
    importJournal: false,
    orderEnabled: overrides.orderEnabled ?? true,
    orderAckTimeoutMs: overrides.orderAckTimeoutMs ?? 1_000,
  };
}

async function createMt5TestServer(): Promise<Mt5TestServer> {
  const connections: Socket[] = [];
  const receivedLines: string[] = [];
  const buffers = new Map<Socket, string>();

  const server: Server = createServer((socket) => {
    connections.push(socket);
    buffers.set(socket, "");

    socket.on("data", (chunk) => {
      const nextBuffer = (buffers.get(socket) ?? "") + chunk.toString("utf8");
      const lines = nextBuffer.split("\n");
      buffers.set(socket, lines.pop() ?? "");
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed) receivedLines.push(trimmed);
      }
    });

    socket.on("close", () => {
      buffers.delete(socket);
    });
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  assert.ok(address && typeof address === "object");

  return {
    port: address.port,
    connections,
    receivedLines,
    activeConnectionCount(): number {
      return connections.filter((socket) => !socket.destroyed).length;
    },
    writeSnapshot(payload: Record<string, unknown>, socket = connections.at(-1)): void {
      assert.ok(socket, "Expected an active test socket");
      socket.write(buildMt5Message("snapshot", payload));
    },
    writeMessage(type: string, payload: Record<string, unknown>, socket = connections.at(-1)): void {
      assert.ok(socket, "Expected an active test socket");
      socket.write(buildMt5Message(type, payload));
    },
    async close(): Promise<void> {
      for (const socket of connections) {
        socket.destroy();
      }
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    },
  };
}

function receivedMessageTypes(server: Mt5TestServer): string[] {
  return server.receivedLines.flatMap((line) => {
    const message = parseMt5Line(line);
    return message ? [message.type] : [];
  });
}

await run("builds and parses MT5 protocol lines", () => {
  assert.equal(
    buildMt5Message("snapshot", { requestId: "r1" }),
    JSON.stringify({ type: "snapshot", payload: { requestId: "r1" } }) + "\n",
  );

  assert.deepEqual(parseMt5Line('{"type":"account","payload":{"balance":100}}'), {
    type: "account",
    payload: { balance: 100 },
  });

  assert.equal(parseMt5Line("not json"), null);
});

await run("gates live order sending by connection, mode, and orderEnabled", async () => {
  const offlineAdapter = createMt5LocalSocketAdapter(makeConfig(65_535, { mode: "demo", orderEnabled: false }));
  assert.deepEqual(await offlineAdapter.placeOrder({ symbol: "EURUSD", direction: "buy", volume: 0.1 }), {
    accepted: false,
    reason: "MT5 bridge is not connected",
  });

  const demoServer = await createMt5TestServer();
  const demoAdapter = createMt5LocalSocketAdapter(makeConfig(demoServer.port, { mode: "demo", orderEnabled: true }));
  try {
    await demoAdapter.connect();
    assert.deepEqual(await demoAdapter.placeOrder({ symbol: "EURUSD", direction: "buy", volume: 0.1 }), {
      accepted: false,
      reason: "Live order sending is disabled",
    });
    await delay(20);
    assert.deepEqual(receivedMessageTypes(demoServer).filter((type) => type === "place_order"), []);
  } finally {
    await demoAdapter.disconnect();
    await demoServer.close();
  }

  const disabledServer = await createMt5TestServer();
  const disabledAdapter = createMt5LocalSocketAdapter(
    makeConfig(disabledServer.port, { mode: "live", orderEnabled: false }),
  );
  try {
    await disabledAdapter.connect();
    assert.deepEqual(await disabledAdapter.placeOrder({ symbol: "EURUSD", direction: "buy", volume: 0.1 }), {
      accepted: false,
      reason: "Live order sending is disabled",
    });
    await delay(20);
    assert.deepEqual(receivedMessageTypes(disabledServer).filter((type) => type === "place_order"), []);
  } finally {
    await disabledAdapter.disconnect();
    await disabledServer.close();
  }

  const liveServer = await createMt5TestServer();
  const liveAdapter = createMt5LocalSocketAdapter(makeConfig(liveServer.port, { mode: "live", orderEnabled: true }));
  try {
    await liveAdapter.connect();
    const pendingOrder = liveAdapter.placeOrder({ symbol: "EURUSD", direction: "sell", volume: 0.2 });
    await waitFor(
      () => receivedMessageTypes(liveServer).filter((type) => type === "place_order").length === 1,
      "one place_order message",
    );
    const placeOrderLine = liveServer.receivedLines.find((line) => parseMt5Line(line)?.type === "place_order");
    assert.ok(placeOrderLine);
    const placeOrderMessage = parseMt5Line(placeOrderLine);
    assert.ok(placeOrderMessage && typeof placeOrderMessage.payload === "object" && placeOrderMessage.payload !== null);
    const requestId = (placeOrderMessage.payload as { requestId?: string }).requestId;
    assert.ok(requestId);
    liveServer.writeMessage("order_ack", { requestId, result: { accepted: true, ticket: "REAL-1001" } });
    assert.deepEqual(await pendingOrder, { accepted: true, ticket: "REAL-1001" });
  } finally {
    await liveAdapter.disconnect();
    await liveServer.close();
  }
});

await run("times out live orders when the MT5 bridge does not acknowledge", async () => {
  const server = await createMt5TestServer();
  const adapter = createMt5LocalSocketAdapter(
    makeConfig(server.port, { mode: "live", orderEnabled: true, orderAckTimeoutMs: 50 }),
  );
  try {
    await adapter.connect();
    assert.deepEqual(await adapter.placeOrder({ symbol: "EURUSD", direction: "buy", volume: 0.1 }), {
      accepted: false,
      reason: "MT5 bridge did not acknowledge the order in time",
    });
  } finally {
    await adapter.disconnect();
    await server.close();
  }
});

await run("recovers when manual reconnect races an in-flight connect", async () => {
  const server = await createMt5TestServer();
  const adapter = createMt5LocalSocketAdapter(makeConfig(server.port));
  try {
    const firstConnect = adapter.connect();
    await adapter.disconnect();
    const secondConnect = adapter.connect();
    await Promise.allSettled([firstConnect, secondConnect]);

    await waitFor(() => server.activeConnectionCount() === 1, "fresh connection after reconnect race");
    server.writeSnapshot({ metrics: { balance: 456 }, openTrades: [], closedTrades: [] });
    await waitFor(() => receivedMessageTypes(server).length >= 1, "snapshot request after reconnect race");
    await waitFor(() => server.activeConnectionCount() === 1, "single active connection after reconnect race");

    const snapshot = await adapter.getSnapshot();
    assert.equal(snapshot.status, "connected");
    assert.equal(snapshot.metrics.balance, 456);
  } finally {
    await adapter.disconnect();
    await server.close();
  }
});

await run("normalizes malformed snapshot payload fields", async () => {
  const server = await createMt5TestServer();
  const adapter = createMt5LocalSocketAdapter(makeConfig(server.port));
  const validTrade = {
    ticket: "MT5-1",
    symbol: "EURUSD",
    direction: "buy",
    volume: 0.1,
    openTime: new Date().toISOString(),
    entryPrice: 1.09,
    status: "open",
    source: "mt5",
  };
  const nextValidTrade = {
    ...validTrade,
    ticket: "MT5-2",
    symbol: "GBPUSD",
  };
  try {
    await adapter.connect();
    server.writeSnapshot({
      account: {
        login: "123456",
        name: "Real Trader",
        server: "Broker-Live",
        broker: "Broker",
        leverage: 100,
        tradeMode: "real",
      },
      metrics: { balance: 321 },
      openTrades: [validTrade],
      closedTrades: [],
    });
    await waitFor(async () => (await adapter.getSnapshot()).metrics.balance === 321, "valid snapshot delivery");
    assert.deepEqual((await adapter.getSnapshot()).account, {
      login: "123456",
      name: "Real Trader",
      server: "Broker-Live",
      broker: "Broker",
      leverage: 100,
      tradeMode: "real",
    });

    await assert.doesNotReject(() => adapter.getSnapshot());
    server.writeSnapshot({
      metrics: { balance: "bad", currency: 123 },
      openTrades: [nextValidTrade, "bad"],
      closedTrades: "bad",
    });
    await waitFor(async () => (await adapter.getSnapshot()).openTrades[0]?.ticket === "MT5-2", "normalized trade array");
    const snapshot = await adapter.getSnapshot();

    assert.equal(snapshot.metrics.balance, 321);
    assert.equal(snapshot.metrics.currency, "USD");
    assert.ok(Array.isArray(snapshot.openTrades));
    assert.ok(Array.isArray(snapshot.closedTrades));
    assert.deepEqual(
      snapshot.openTrades.map((trade) => trade.ticket),
      ["MT5-2"],
    );
    assert.deepEqual(snapshot.closedTrades, []);

    server.writeSnapshot({ metrics: "bad", openTrades: "bad", closedTrades: "bad" });
    await delay(20);
    const preservedSnapshot = await adapter.getSnapshot();
    assert.equal(preservedSnapshot.metrics.balance, 321);
    assert.deepEqual(
      preservedSnapshot.openTrades.map((trade) => trade.ticket),
      ["MT5-2"],
    );
  } finally {
    await adapter.disconnect();
    await server.close();
  }
});

await run("does not leave multiple active sockets after repeated connect", async () => {
  const server = await createMt5TestServer();
  const adapter = createMt5LocalSocketAdapter(makeConfig(server.port));
  try {
    await adapter.connect();
    await adapter.connect();
    await delay(30);
    assert.equal(server.activeConnectionCount(), 1);
  } finally {
    await adapter.disconnect();
    await server.close();
  }
});

await run("ignores stale socket close after a newer connection is active", async () => {
  const server = await createMt5TestServer();
  const adapter = createMt5LocalSocketAdapter(makeConfig(server.port));
  try {
    const firstConnect = adapter.connect();
    await waitFor(() => server.connections.length === 1, "first socket connection");
    const firstSocket = server.connections[0];

    await adapter.disconnect();
    const secondConnect = adapter.connect();
    await waitFor(() => server.connections.length >= 2, "newer socket connection");
    server.writeSnapshot({ metrics: { balance: 654 }, openTrades: [], closedTrades: [] });

    assert.ok(firstSocket);
    firstSocket.destroy();
    await Promise.allSettled([firstConnect, secondConnect]);
    await delay(30);

    assert.equal((await adapter.getSnapshot()).status, "connected");
    assert.equal((await adapter.getSnapshot()).metrics.balance, 654);
  } finally {
    await adapter.disconnect();
    await server.close();
  }
});

await run("reconnects after unexpected close", async () => {
  const server = await createMt5TestServer();
  const adapter = createMt5LocalSocketAdapter(makeConfig(server.port));
  try {
    await adapter.connect();
    assert.equal(server.activeConnectionCount(), 1);
    server.connections[0]?.destroy();
    await waitFor(() => server.connections.length >= 2 && server.activeConnectionCount() >= 1, "MT5 reconnect");
    assert.equal((await adapter.getSnapshot()).status, "connected");
  } finally {
    await adapter.disconnect();
    await server.close();
  }
});

await run("clones snapshot events for each listener", async () => {
  const server = await createMt5TestServer();
  const adapter = createMt5LocalSocketAdapter(makeConfig(server.port));
  let secondListenerBalance: number | undefined;
  let secondListenerOpenTradeCount: number | undefined;

  adapter.onEvent((event) => {
    if (event.type === "snapshot") {
      event.snapshot.metrics.balance = -1;
      event.snapshot.openTrades.push({
        ticket: "MUTATED",
        symbol: "MUTATED",
        direction: "buy",
        volume: 1,
        openTime: new Date().toISOString(),
        entryPrice: 1,
        status: "open",
        source: "mt5",
      });
    }
  });
  adapter.onEvent((event) => {
    if (event.type === "snapshot") {
      secondListenerBalance = event.snapshot.metrics.balance;
      secondListenerOpenTradeCount = event.snapshot.openTrades.length;
    }
  });

  try {
    await adapter.connect();
    server.writeSnapshot({ metrics: { balance: 123 }, openTrades: [], closedTrades: [] });
    await waitFor(() => secondListenerBalance === 123, "snapshot listener delivery");
    assert.equal(secondListenerBalance, 123);
    assert.equal(secondListenerOpenTradeCount, 0);
  } finally {
    await adapter.disconnect();
    await server.close();
  }
});

if (failures.length > 0) {
  throw new Error(`${failures.length} mt5 protocol checks failed`);
}

console.log("mt5 protocol checks passed");
