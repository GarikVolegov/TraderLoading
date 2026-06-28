import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isSupportStatus,
  serializeMessage,
  serializeTicket,
} from "./supportSerialize.js";

test("serializeTicket maps columns and emits ISO dates", () => {
  const out = serializeTicket({
    id: 5,
    subject: "Login",
    status: "open",
    category: null,
    createdAt: new Date("2026-06-28T10:00:00.000Z"),
    updatedAt: new Date("2026-06-28T11:00:00.000Z"),
  });
  assert.deepEqual(out, {
    id: 5,
    subject: "Login",
    status: "open",
    category: null,
    createdAt: "2026-06-28T10:00:00.000Z",
    updatedAt: "2026-06-28T11:00:00.000Z",
  });
});

test("serializeMessage maps columns and emits ISO dates", () => {
  const out = serializeMessage({
    id: 9,
    ticketId: 5,
    authorType: "support",
    body: "Ciao",
    createdAt: new Date("2026-06-28T12:00:00.000Z"),
  });
  assert.deepEqual(out, {
    id: 9,
    ticketId: 5,
    authorType: "support",
    body: "Ciao",
    createdAt: "2026-06-28T12:00:00.000Z",
  });
});

test("isSupportStatus accepts only the known statuses", () => {
  assert.equal(isSupportStatus("open"), true);
  assert.equal(isSupportStatus("pending"), true);
  assert.equal(isSupportStatus("closed"), true);
  assert.equal(isSupportStatus("archived"), false);
  assert.equal(isSupportStatus(""), false);
});
