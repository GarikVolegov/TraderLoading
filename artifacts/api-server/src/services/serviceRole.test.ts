import assert from "node:assert/strict";
import test from "node:test";
import {
  getServiceRole,
  shouldRunHttpApi,
  shouldRunWebSockets,
  shouldRunSchedulers,
} from "./serviceRole.js";

test("getServiceRole defaults to 'all'", () => {
  assert.equal(getServiceRole({}), "all");
  assert.equal(getServiceRole({ SERVICE_ROLE: "" }), "all");
  assert.equal(getServiceRole({ SERVICE_ROLE: "unknown" }), "all");
});

test("getServiceRole parses valid roles case-insensitively", () => {
  assert.equal(getServiceRole({ SERVICE_ROLE: "API" }), "api");
  assert.equal(getServiceRole({ SERVICE_ROLE: "Gateway" }), "gateway");
  assert.equal(getServiceRole({ SERVICE_ROLE: "worker" }), "worker");
});

test("role permissions properly isolate workloads", () => {
  // all
  assert.equal(shouldRunHttpApi("all"), true);
  assert.equal(shouldRunWebSockets("all"), true);
  assert.equal(shouldRunSchedulers("all"), true);

  // api
  assert.equal(shouldRunHttpApi("api"), true);
  assert.equal(shouldRunWebSockets("api"), false);
  assert.equal(shouldRunSchedulers("api"), false);

  // gateway
  assert.equal(shouldRunHttpApi("gateway"), false);
  assert.equal(shouldRunWebSockets("gateway"), true);
  assert.equal(shouldRunSchedulers("gateway"), false);

  // worker
  assert.equal(shouldRunHttpApi("worker"), false);
  assert.equal(shouldRunWebSockets("worker"), false);
  assert.equal(shouldRunSchedulers("worker"), true);
});
