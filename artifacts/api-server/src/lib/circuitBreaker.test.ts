import assert from "node:assert/strict";
import {
  CircuitBreaker,
  CircuitBreakerOpenError,
  getOrCreateCircuitBreaker,
} from "./circuitBreaker.js";

let currentTime = 1000;
const fakeNow = () => currentTime;

const breaker = new CircuitBreaker({
  name: "test-provider",
  failureThreshold: 3,
  cooldownMs: 5000,
  successThreshold: 2,
  now: fakeNow,
});

assert.equal(breaker.getState(), "CLOSED");

// Successful calls in CLOSED state
const okResult = await breaker.execute(async () => "hello");
assert.equal(okResult, "hello");
assert.equal(breaker.getState(), "CLOSED");

// 1st failure
await assert.rejects(
  () => breaker.execute(async () => { throw new Error("err 1"); }),
  /err 1/,
);
assert.equal(breaker.getState(), "CLOSED");

// 2nd failure
await assert.rejects(
  () => breaker.execute(async () => { throw new Error("err 2"); }),
  /err 2/,
);
assert.equal(breaker.getState(), "CLOSED");

// 3rd failure -> trips circuit to OPEN
await assert.rejects(
  () => breaker.execute(async () => { throw new Error("err 3"); }),
  /err 3/,
);
assert.equal(breaker.getState(), "OPEN");

// Next call fails fast without calling inner fn
let fnCalled = false;
await assert.rejects(
  () => breaker.execute(async () => {
    fnCalled = true;
    return "unreachable";
  }),
  CircuitBreakerOpenError,
);
assert.equal(fnCalled, false, "inner function should not be executed when circuit is OPEN");

// Fallback execution when circuit is OPEN
const fallbackResult = await breaker.execute(
  async () => "ignored",
  () => "fallback_data",
);
assert.equal(fallbackResult, "fallback_data");

// Advance time past cooldownMs (5000ms)
currentTime += 6000;
assert.equal(breaker.getState(), "HALF_OPEN");

// 1st success in HALF_OPEN
const halfOpen1 = await breaker.execute(async () => "probe 1");
assert.equal(halfOpen1, "probe 1");
assert.equal(breaker.getState(), "HALF_OPEN");

// 2nd success in HALF_OPEN -> closes circuit
const halfOpen2 = await breaker.execute(async () => "probe 2");
assert.equal(halfOpen2, "probe 2");
assert.equal(breaker.getState(), "CLOSED");

// Registry test
const regBreaker = getOrCreateCircuitBreaker({ name: "shared-upstream" });
assert.equal(regBreaker.name, "shared-upstream");
const regBreaker2 = getOrCreateCircuitBreaker({ name: "shared-upstream" });
assert.equal(regBreaker, regBreaker2);

console.log("circuit breaker unit tests passed");
