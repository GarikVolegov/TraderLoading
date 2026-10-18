import assert from "node:assert/strict";
import { fetchReplayCandles, fetchReplayExecutionCandles } from "./replayCandlesApi.js";

const originalFetch = globalThis.fetch;
let calledUrl: RequestInfo | URL | undefined;
let calledInit: RequestInit | undefined;

try {
  const controller = new AbortController();
  globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
    calledUrl = url;
    calledInit = init;
    return Response.json({ candles: [{ time: 1, open: 1, high: 2, low: 0.5, close: 1.5, volume: 10 }] });
  }) as typeof fetch;

  const data = await fetchReplayCandles({ symbol: "XAU/USD", interval: "M15", startDate: "2021-04-05" }, {
    baseUrl: "https://api.example.test",
    signal: controller.signal,
  });

  assert.equal(data.candles[0]?.close, 1.5);
  assert.equal(calledUrl, "https://api.example.test/api/backtest/candles?symbol=XAUUSD&interval=M15&startDate=2021-04-05");
  assert.equal(calledInit?.signal, controller.signal);

  await fetchReplayCandles({ symbol: "EURUSD", interval: "H4", mode: "replay", anchorTime: 300, replayTime: 300, warmupBars: 250 }, {
    baseUrl: "https://api.example.test",
  });
  const strictUrl = new URL(String(calledUrl));
  assert.equal(strictUrl.searchParams.get("mode"), "replay");
  assert.equal(strictUrl.searchParams.get("anchorTime"), "300");
  assert.equal(strictUrl.searchParams.get("replayTime"), "300");

  const pageRequests: URL[] = [];
  globalThis.fetch = (async (url: RequestInfo | URL) => {
    const parsed = new URL(String(url));
    pageRequests.push(parsed);
    const from = Number(parsed.searchParams.get("from"));
    const candle = (time: number) => ({ time, open: 1, high: 2, low: 0.5, close: 1.5 });
    return Response.json(from === 120
      ? { candles: [candle(60), candle(120), candle(180)], nextFrom: 240 }
      : { candles: [candle(240), candle(300), candle(360)] });
  }) as typeof fetch;
  const execution = await fetchReplayExecutionCandles("USOIL", 120, 360, { baseUrl: "https://api.example.test" });
  assert.deepEqual(execution.map((bar) => bar.time), [120, 180, 240, 300], "execute only M1 inside exclusive [from,to)");
  assert.equal(pageRequests.length, 2);
  assert.ok(pageRequests.every((url) => url.searchParams.get("interval") === "M1" && url.searchParams.get("mode") === "replay"));

  globalThis.fetch = (async () => new Response("", { status: 503 })) as typeof fetch;
  await assert.rejects(
    fetchReplayCandles({ symbol: "EURUSD", interval: "H4" }, { baseUrl: "https://api.example.test" }),
    /HTTP 503/,
  );

  globalThis.fetch = (async () => Response.json(
    { error: "Servono almeno 120 candele per avviare il replay." },
    { status: 502 },
  )) as typeof fetch;
  await assert.rejects(
    fetchReplayCandles({ symbol: "EURUSD", interval: "M5" }, { baseUrl: "https://api.example.test" }),
    /Servono almeno 120 candele/,
  );
} finally {
  globalThis.fetch = originalFetch;
}

console.log("replay candles api fetch checks passed");
