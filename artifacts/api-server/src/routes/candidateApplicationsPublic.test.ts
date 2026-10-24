import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import { createCandidateApplicationsRouter } from "./candidateApplicationsPublic.js";
let writes = 0;
const app = express();
app.use(express.json());
app.use(
  createCandidateApplicationsRouter(async (input) => {
    writes++;
    assert.equal(input.email, "trader@example.test");
    return { candidateCode: "TL-PERSISTED", status: "in_valutazione" };
  }),
);
const server = createServer(app);
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
assert.ok(address && typeof address === "object");
const post = (body: unknown) =>
  fetch(`http://127.0.0.1:${address.port}/candidate-applications`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
try {
  assert.equal((await post({ name: "Incomplete" })).status, 400);
  assert.equal(writes, 0);
  const body = {
    requestKey: "2eae9062-bbc1-4f43-8b3b-4597c8063512",
    name: "Trader",
    email: "Trader@example.test",
    contactHandle: "@trader",
    planChosen: "direct_150",
  };
  assert.equal((await post({ ...body, planChosen: "trial_1_day" })).status, 400);
  assert.equal(writes, 0);
  const response = await post(body);
  assert.equal(response.status, 201);
  assert.deepEqual(((await response.json()) as { candidate: unknown }).candidate, {
    candidateCode: "TL-PERSISTED",
    status: "in_valutazione",
  });
  assert.equal(writes, 1);

  // Test with modular services
  const modularBody = {
    requestKey: "550e8400-e29b-41d4-a716-446655440000",
    name: "Trader Modular",
    email: "Trader@example.test",
    contactHandle: "@trader_mod",
    planChosen: "modular_protocol",
    selectedServices: ["forge_of_the_past", "financial_architecture"],
  };
  const modResponse = await post(modularBody);
  assert.equal(modResponse.status, 201);
  assert.equal(writes, 2);
} finally {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
}
console.log("Candidate validation, obsolete trial refusal and persisted receipt passed");
