import assert from "node:assert/strict";
import { singleFlight } from "./singleFlight.js";

// Concurrent calls for the same key share ONE invocation (dedup) — so a stale-while-
// revalidate rebuild can't be triggered N times by N simultaneous readers.
{
  const inFlight = new Map<string, Promise<number>>();
  let calls = 0;
  let resolveFn: (v: number) => void = () => {};
  const fn = () => {
    calls += 1;
    return new Promise<number>((resolve) => { resolveFn = resolve; });
  };
  const a = singleFlight(inFlight, "k", fn);
  const b = singleFlight(inFlight, "k", fn);
  assert.equal(calls, 1, "second concurrent call must not invoke fn again");
  assert.equal(inFlight.size, 1);
  resolveFn(42);
  assert.equal(await a, 42);
  assert.equal(await b, 42);
  // Settled → key cleared, so the next call runs fresh (don't await: this fn only
  // settles when resolveFn is called, which we skip here).
  assert.equal(inFlight.size, 0);
  void singleFlight(inFlight, "k", fn);
  assert.equal(calls, 2);
  resolveFn(0);
}

// Different keys run independently.
{
  const inFlight = new Map<string, Promise<string>>();
  let calls = 0;
  const fn = () => { calls += 1; return Promise.resolve("x"); };
  await Promise.all([singleFlight(inFlight, "a", fn), singleFlight(inFlight, "b", fn)]);
  assert.equal(calls, 2);
}

// A rejecting fn still clears the key (no poisoned lock).
{
  const inFlight = new Map<string, Promise<number>>();
  await assert.rejects(() => singleFlight(inFlight, "k", () => Promise.reject(new Error("boom"))));
  assert.equal(inFlight.size, 0);
}

console.log("single flight checks passed");
