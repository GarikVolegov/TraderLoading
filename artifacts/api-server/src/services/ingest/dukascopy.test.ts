import assert from "node:assert/strict";
import { dukascopySource, fetchDukascopyFile } from "./dukascopy.js";
import { symbolId, REPLAY_INSTRUMENTS } from "../candleRegistry.js";

assert.equal(dukascopySource.supports("USOIL"), true);
assert.equal(symbolId("USOIL"), 18);
assert.equal(REPLAY_INSTRUMENTS.USOIL.instrument, "lightcmdusd");
await assert.rejects(
  fetchDukascopyFile(
    "https://datafeed.dukascopy.com/test",
    (async () =>
      new Response("rate limited", {
        status: 429,
        headers: { "Retry-After": "60" },
      })) as typeof fetch,
  ),
  /HTTP 429.*Retry-After 60/,
);
await assert.rejects(
  fetchDukascopyFile(
    "https://datafeed.dukascopy.com/test",
    (async () => new Response("server failure", { status: 503 })) as typeof fetch,
  ),
  /HTTP 503/,
);
const buffer = await fetchDukascopyFile(
  "https://datafeed.dukascopy.com/test",
  (async () => new Response(new Uint8Array([1, 2, 3]))) as typeof fetch,
);
assert.deepEqual([...buffer], [1, 2, 3]);
console.log("Dukascopy transport checks passed");
