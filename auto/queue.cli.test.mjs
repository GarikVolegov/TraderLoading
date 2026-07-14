import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CLI = fileURLToPath(new URL("./queue.mjs", import.meta.url));

function setup(queue, chores = []) {
  const dir = mkdtempSync(path.join(tmpdir(), "nightshift-"));
  const env = {
    ...process.env,
    NIGHTSHIFT_QUEUE: path.join(dir, "queue.json"),
    NIGHTSHIFT_CHORES: path.join(dir, "chores.json"),
  };
  writeFileSync(env.NIGHTSHIFT_QUEUE, JSON.stringify(queue));
  writeFileSync(env.NIGHTSHIFT_CHORES, JSON.stringify(chores));
  return env;
}

const run = (env, ...args) =>
  execFileSync(process.execPath, [CLI, ...args], { env, encoding: "utf8" });

const baseTask = {
  id: "A", source: "audit", title: "t", description: "d", acceptanceCriteria: [],
  priority: 1, status: "pending", attempts: 0, maxAttempts: 2, branch: null, prUrl: null, notes: "",
};

test("next stampa il task; start/done persistono su file", () => {
  const env = setup([baseTask]);
  assert.equal(JSON.parse(run(env, "next")).id, "A");
  run(env, "start", "A");
  run(env, "done", "A", "https://github.com/x/y/pull/1");
  const q = JSON.parse(readFileSync(env.NIGHTSHIFT_QUEUE, "utf8"));
  assert.equal(q[0].status, "done");
  assert.equal(q[0].prUrl, "https://github.com/x/y/pull/1");
});

test("next esce 1 a coda vuota", () => {
  const env = setup([]);
  assert.throws(() => run(env, "next"));
});

test("next filtra per kind da CLI", () => {
  const env = setup([{ ...baseTask, id: "K", source: "chore", priority: 50 }]);
  assert.throws(() => run(env, "next", "heavy"));
  assert.equal(JSON.parse(run(env, "next", "chore")).id, "K");
});

test("fail incrementa attempts e persiste", () => {
  const env = setup([{ ...baseTask, status: "in_progress" }]);
  run(env, "fail", "A", "gate rosso");
  const q = JSON.parse(readFileSync(env.NIGHTSHIFT_QUEUE, "utf8"));
  assert.equal(q[0].attempts, 1);
  assert.equal(q[0].status, "pending");
});

test("recover stampa gli id recuperati", () => {
  const env = setup([{ ...baseTask, status: "in_progress" }]);
  assert.equal(run(env, "recover").trim(), "A");
});

test("materialize scrive; --dry non scrive", () => {
  const chores = [{ id: "C", recurrence: "nightly", template: { title: "c", description: "", acceptanceCriteria: [], priority: 50 } }];
  const dry = setup([], chores);
  assert.match(run(dry, "materialize", "2026-07-06", "--dry"), /\[dry\] C-2026-07-06/);
  assert.equal(JSON.parse(readFileSync(dry.NIGHTSHIFT_QUEUE, "utf8")).length, 0);
  const wet = setup([], chores);
  assert.match(run(wet, "materialize", "2026-07-06"), /C-2026-07-06/);
  assert.equal(JSON.parse(readFileSync(wet.NIGHTSHIFT_QUEUE, "utf8")).length, 1);
});
