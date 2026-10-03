import assert from "node:assert/strict";
import { retryWithBackoff } from "./retry.js";

// succeeds on the first try → no sleeps
{
  const sleeps: number[] = [];
  let calls = 0;
  const result = await retryWithBackoff(
    async () => {
      calls += 1;
      return "ok";
    },
    { attempts: 4, baseDelayMs: 100, factor: 3, sleep: async (ms) => void sleeps.push(ms) },
  );
  assert.equal(result, "ok");
  assert.equal(calls, 1);
  assert.deepEqual(sleeps, []);
}

// fails twice, then succeeds → two exponential backoff sleeps
{
  const sleeps: number[] = [];
  let calls = 0;
  const result = await retryWithBackoff(
    async () => {
      calls += 1;
      if (calls < 3) throw new Error(`fail ${calls}`);
      return calls;
    },
    { attempts: 5, baseDelayMs: 100, factor: 3, sleep: async (ms) => void sleeps.push(ms) },
  );
  assert.equal(result, 3);
  assert.equal(calls, 3);
  assert.deepEqual(sleeps, [100, 300]); // base, base×factor
}

// exhausts all attempts → rethrows the LAST error, sleeps between (attempts−1) tries
{
  const sleeps: number[] = [];
  let calls = 0;
  await assert.rejects(
    retryWithBackoff(
      async () => {
        calls += 1;
        throw new Error(`boom ${calls}`);
      },
      { attempts: 3, baseDelayMs: 50, factor: 2, sleep: async (ms) => void sleeps.push(ms) },
    ),
    /boom 3/,
  );
  assert.equal(calls, 3);
  assert.deepEqual(sleeps, [50, 100]); // no sleep after the final failed attempt
}

// onRetry is notified with (error, attemptIndex) before each backoff
{
  const events: Array<{ msg: string; attempt: number }> = [];
  let calls = 0;
  await retryWithBackoff(
    async () => {
      calls += 1;
      if (calls < 2) throw new Error("transient");
      return "done";
    },
    {
      attempts: 3,
      baseDelayMs: 10,
      factor: 2,
      sleep: async () => {},
      onRetry: (error, attempt) => events.push({ msg: (error as Error).message, attempt }),
    },
  );
  assert.deepEqual(events, [{ msg: "transient", attempt: 1 }]);
}

// a maxDelayMs cap bounds the backoff growth
{
  const sleeps: number[] = [];
  let calls = 0;
  await retryWithBackoff(
    async () => {
      calls += 1;
      if (calls < 4) throw new Error("x");
      return 1;
    },
    { attempts: 6, baseDelayMs: 100, factor: 10, maxDelayMs: 500, sleep: async (ms) => void sleeps.push(ms) },
  );
  assert.deepEqual(sleeps, [100, 500, 500]); // 100, 1000→cap 500, 10000→cap 500
}

console.log("retryWithBackoff checks passed");
