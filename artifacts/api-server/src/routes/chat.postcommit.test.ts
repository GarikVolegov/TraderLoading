import assert from "node:assert/strict";
import { mock } from "node:test";
import { readFileSync, writeFileSync } from "node:fs";
import type { Request, Response } from "express";

process.env.DATABASE_URL ??= "postgres://user:pass@127.0.0.1:5432/test";
const [{ default: router }, { db }] = await Promise.all([import("./chat.js"), import("@workspace/db")]);
const layers = router.stack as unknown as Array<{ route?: { path: string; methods: Record<string, boolean>; stack: Array<{ handle: (req: Request, res: Response) => Promise<void> }> } }>;
const handler = layers.find(layer => layer.route?.path === "/chat/messages" && layer.route.methods.post)?.route?.stack[0].handle;
assert.ok(handler, "The actual POST chat/messages handler is available");

let selects = 0;
const selectMock = mock.method(db, "select", (() => {
  const order = ++selects;
  return { from: () => ({ where: () => ({ limit: () => order <= 2 ? Promise.resolve([{ id: order }]) : Promise.reject(new Error("Synthetic post-commit sender profile failure")) }) }) };
}) as unknown as typeof db.select);
const insertMock = mock.method(db, "insert", (() => ({ values: () => ({ returning: () => Promise.resolve([{ id: 123, senderId: "audit_sender", receiverId: "audit_receiver", ciphertext: "synthetic", iv: "synthetic" }]) }) })) as unknown as typeof db.insert);
const errors: string[] = [];
const errorMock = mock.method(console, "error", (...parts: unknown[]) => { errors.push(String(parts[0])); });
const statuses: number[] = [];
let sent = false, jsonCalls = 0, handlerRejected = false;
const response = {
  get headersSent() { return sent; },
  status(code: number) { statuses.push(code); if (sent) throw new Error("A second status was attempted after response commit"); return response; },
  json() { if (sent) throw new Error("A second JSON response was attempted"); sent = true; jsonCalls++; return response; },
};
try {
  try { await handler({ user: { id: "audit_sender" }, body: { receiverId: "audit_receiver", ciphertext: "synthetic", iv: "synthetic" } } as unknown as Request, response as unknown as Response); }
  catch { handlerRejected = true; }
  await new Promise<void>(resolve => setImmediate(resolve));
} finally {
  selectMock.mock.restore(); insertMock.mock.restore(); errorMock.mock.restore();
}
const observation = { statuses, jsonCalls, handlerRejected, sideEffectFailureObserved: selects > 2, errorLabels: errors };
const label = process.argv[2];
if (label === "baseline" || label === "after") {
  const run = JSON.parse(readFileSync(new URL("../../../../.local-logs/full-audit-run.json", import.meta.url), "utf8")) as { runId: string; output: string };
  writeFileSync(`${run.output}/chat-postcommit-${label}.json`, JSON.stringify({ runId: run.runId, label, proof: "Actual route handler with synthetic DB query failure after a saved message; no push delivery", ...observation }, null, 2));
}
assert.equal(handlerRejected, false, "Post-commit notification lookup failure must not reject the request handler");
assert.deepEqual(statuses, [201], "The message response is committed once; side-effect failure never attempts HTTP 500");
assert.equal(jsonCalls, 1);
assert.equal(observation.sideEffectFailureObserved, true);
console.log("chat post-commit side-effect regression passed");
