import assert from "node:assert/strict";

import { fetchWithRetry, isRetriableHttpStatus } from "./httpRetry.js";

// Only transient statuses are worth retrying.
assert.equal(isRetriableHttpStatus(429), true);
assert.equal(isRetriableHttpStatus(500), true);
assert.equal(isRetriableHttpStatus(503), true);
assert.equal(isRetriableHttpStatus(200), false);
assert.equal(isRetriableHttpStatus(400), false);
assert.equal(isRetriableHttpStatus(404), false);

const noSleep = async () => {};

// Success on the first try: a single fetch, no retries.
{
  let calls = 0;
  const res = await fetchWithRetry("u", {
    fetchImpl: async () => {
      calls += 1;
      return new Response("ok", { status: 200 });
    },
    sleep: noSleep,
  });
  assert.equal(res.status, 200);
  assert.equal(calls, 1);
}

// Retries a transient 503, then succeeds.
{
  let calls = 0;
  const res = await fetchWithRetry("u", {
    retries: 3,
    fetchImpl: async () => {
      calls += 1;
      return new Response("", { status: calls < 3 ? 503 : 200 });
    },
    sleep: noSleep,
  });
  assert.equal(res.status, 200);
  assert.equal(calls, 3);
}

// Does NOT retry a non-transient 400.
{
  let calls = 0;
  const res = await fetchWithRetry("u", {
    fetchImpl: async () => {
      calls += 1;
      return new Response("", { status: 400 });
    },
    sleep: noSleep,
  });
  assert.equal(res.status, 400);
  assert.equal(calls, 1);
}

// Exhausts retries on a persistent 503 and returns the last response (caller decides).
{
  let calls = 0;
  const res = await fetchWithRetry("u", {
    retries: 2,
    fetchImpl: async () => {
      calls += 1;
      return new Response("", { status: 503 });
    },
    sleep: noSleep,
  });
  assert.equal(res.status, 503);
  assert.equal(calls, 3); // initial + 2 retries
}

// Retries a thrown network error, then rethrows after exhausting attempts.
{
  let calls = 0;
  await assert.rejects(
    () =>
      fetchWithRetry("u", {
        retries: 1,
        fetchImpl: async () => {
          calls += 1;
          throw new Error("ECONNRESET");
        },
        sleep: noSleep,
      }),
    /ECONNRESET/,
  );
  assert.equal(calls, 2); // initial + 1 retry
}

console.log("http retry checks passed");
