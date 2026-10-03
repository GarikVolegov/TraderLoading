import test from "node:test";
import assert from "node:assert/strict";
import { nextTask, startTask, completeTask, failTask, recoverStale, materializeChores } from "./queue.mjs";

const mk = (over = {}) => ({
  id: "T-1", source: "audit", title: "t", description: "d",
  acceptanceCriteria: [], priority: 1, status: "pending",
  attempts: 0, maxAttempts: 2, branch: null, prUrl: null, notes: "", ...over,
});

test("nextTask sceglie il pending con priorità più bassa (tie-break per id)", () => {
  const q = [mk({ id: "B", priority: 2 }), mk({ id: "A", priority: 1, status: "done" }), mk({ id: "C", priority: 1 })];
  assert.equal(nextTask(q).id, "C");
});

test("nextTask filtra per kind: chore vs heavy", () => {
  const q = [mk({ id: "H", source: "audit", priority: 5 }), mk({ id: "K", source: "chore", priority: 50 })];
  assert.equal(nextTask(q, "chore").id, "K");
  assert.equal(nextTask(q, "heavy").id, "H");
});

test("nextTask restituisce null se non c'è nulla di pending", () => {
  assert.equal(nextTask([mk({ status: "done" })]), null);
  assert.equal(nextTask([], "chore"), null);
});

test("startTask marca in_progress", () => {
  const q = [mk()];
  startTask(q, "T-1");
  assert.equal(q[0].status, "in_progress");
});

test("completeTask salva done + prUrl + nota", () => {
  const q = [mk({ status: "in_progress" })];
  completeTask(q, "T-1", "https://github.com/x/y/pull/9", "ok");
  assert.equal(q[0].status, "done");
  assert.equal(q[0].prUrl, "https://github.com/x/y/pull/9");
  assert.match(q[0].notes, /ok/);
});

test("failTask sotto maxAttempts torna pending e incrementa attempts", () => {
  const q = [mk({ status: "in_progress" })];
  failTask(q, "T-1", "boom");
  assert.equal(q[0].status, "pending");
  assert.equal(q[0].attempts, 1);
  assert.match(q[0].notes, /boom/);
});

test("failTask a maxAttempts marca failed", () => {
  const q = [mk({ status: "in_progress", attempts: 1 })];
  failTask(q, "T-1");
  assert.equal(q[0].status, "failed");
});

test("id inesistente lancia un errore esplicito", () => {
  assert.throws(() => startTask([], "NOPE"), /NOPE/);
});

test("recoverStale fallisce tutte le in_progress e ne restituisce gli id", () => {
  const q = [mk({ id: "A", status: "in_progress" }), mk({ id: "B" })];
  const ids = recoverStale(q);
  assert.deepEqual(ids, ["A"]);
  assert.equal(q[0].status, "pending");
  assert.equal(q[0].attempts, 1);
  assert.equal(q[1].status, "pending");
  assert.equal(q[1].attempts, 0);
});

const mkChore = (over = {}) => ({
  id: "CHORE-x",
  recurrence: "nightly",
  template: { title: "c", description: "d", acceptanceCriteria: [], priority: 50, model: "sonnet" },
  ...over,
});

test("nightly viene materializzato con id datato e campi di stato", () => {
  const q = [];
  const added = materializeChores(q, [mkChore()], "2026-07-06");
  assert.equal(added.length, 1);
  assert.equal(q[0].id, "CHORE-x-2026-07-06");
  assert.equal(q[0].source, "chore");
  assert.equal(q[0].status, "pending");
  assert.equal(q[0].priority, 50);
  assert.equal(q[0].model, "sonnet");
  assert.equal(q[0].maxAttempts, 1);
});

test("weekly solo nel weekday giusto (2026-07-06 è lunedì)", () => {
  const c = mkChore({ id: "CHORE-w", recurrence: "weekly", weekday: 1 });
  assert.equal(materializeChores([], [c], "2026-07-06").length, 1);
  assert.equal(materializeChores([], [c], "2026-07-07").length, 0);
});

test("non duplica se c'è già un task aperto dello stesso chore", () => {
  const q = [];
  materializeChores(q, [mkChore()], "2026-07-05");
  assert.equal(materializeChores(q, [mkChore()], "2026-07-06").length, 0);
});

test("riappare il giorno dopo quando il precedente è concluso", () => {
  const q = [];
  materializeChores(q, [mkChore()], "2026-07-05");
  completeTask(q, "CHORE-x-2026-07-05");
  assert.equal(materializeChores(q, [mkChore()], "2026-07-06").length, 1);
});

test("idempotente nello stesso giorno anche se il precedente è done", () => {
  const q = [];
  materializeChores(q, [mkChore()], "2026-07-05");
  completeTask(q, "CHORE-x-2026-07-05");
  assert.equal(materializeChores(q, [mkChore()], "2026-07-05").length, 0);
});
