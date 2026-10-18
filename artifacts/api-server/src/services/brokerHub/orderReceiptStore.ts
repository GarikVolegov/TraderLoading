import { createHash } from "node:crypto";
import type { BrokerOrderResult, NormalizedBrokerOrderRequest } from "./types.js";

export type ReceiptRequest = NormalizedBrokerOrderRequest | { action: "closePosition"; positionId: string; clientRequestId: string };
type Receipt = { version: 1; profileId: string; clientRequestId: string; operation?: string; fingerprint: string; phase: "pending" | "resolved"; result?: BrokerOrderResult };
export type OrderClaim = { status: "new" | "pending" | "conflict" } | { status: "resolved"; result: BrokerOrderResult };
export interface OrderReceiptStore {
  claim(profileId: string, request: ReceiptRequest): Promise<OrderClaim>;
  resolve(profileId: string, request: ReceiptRequest, result: BrokerOrderResult): Promise<void>;
}
function receiptFor(profileId: string, request: ReceiptRequest): Receipt {
  return { version: 1, profileId, clientRequestId: request.clientRequestId, operation: "action" in request ? request.action : "placeOrder", fingerprint: createHash("sha256").update(JSON.stringify(request)).digest("hex"), phase: "pending" };
}
function keyFor(profileId: string, request: ReceiptRequest): string {
  return "order-receipt:" + createHash("sha256").update(JSON.stringify([profileId, "action" in request ? request.action : "placeOrder", request.clientRequestId])).digest("hex");
}
function existingClaim(value: Receipt, expected: Receipt): OrderClaim {
  if (value.version !== 1 || value.profileId !== expected.profileId || value.clientRequestId !== expected.clientRequestId || (value.operation ?? "placeOrder") !== expected.operation) throw new Error("Invalid order receipt");
  if (value.fingerprint !== expected.fingerprint) return { status: "conflict" };
  if (value.phase === "pending") return { status: "pending" };
  if (value.phase !== "resolved" || typeof value.result?.accepted !== "boolean") throw new Error("Invalid order receipt state");
  return { status: "resolved", result: { ...value.result } };
}
export function createMemoryOrderReceiptStore(): OrderReceiptStore {
  const receipts = new Map<string, Receipt>();
  return {
    async claim(profileId, request) {
      const expected = receiptFor(profileId, request), key = keyFor(profileId, request), existing = receipts.get(key);
      if (existing) return existingClaim(existing, expected);
      receipts.set(key, expected);
      return { status: "new" };
    },
    async resolve(profileId, request, result) {
      const key = keyFor(profileId, request), expected = receiptFor(profileId, request), current = receipts.get(key);
      if (!current || current.fingerprint !== expected.fingerprint) throw new Error("Missing order receipt");
      receipts.set(key, { ...current, phase: "resolved", result: { ...result } });
    },
  };
}

// Dedicated keys in the existing generic JSON store, separate from its
// 'default' profile-list row. A unique INSERT reserves the request across API
// processes without a schema migration or holding a transaction over network IO.
export function createDatabaseOrderReceiptStore(): OrderReceiptStore {
  return {
    async claim(profileId, request) {
      const { pool } = await import("@workspace/db");
      const expected = receiptFor(profileId, request), key = keyFor(profileId, request);
      const inserted = await pool.query("INSERT INTO broker_profile_store(store_key,data,updated_at) VALUES($1,$2::jsonb,now()) ON CONFLICT(store_key) DO NOTHING RETURNING data", [key, JSON.stringify(expected)]);
      if (inserted.rows.length) return { status: "new" };
      const current = await pool.query<{ data: Receipt }>("SELECT data FROM broker_profile_store WHERE store_key=$1", [key]);
      if (!current.rows[0]) throw new Error("Order receipt unavailable");
      return existingClaim(current.rows[0].data, expected);
    },
    async resolve(profileId, request, result) {
      const { pool } = await import("@workspace/db");
      const expected = receiptFor(profileId, request), key = keyFor(profileId, request);
      const updated = await pool.query("UPDATE broker_profile_store SET data=$2::jsonb,updated_at=now() WHERE store_key=$1 AND data->>'fingerprint'=$3 RETURNING store_key", [key, JSON.stringify({ ...expected, phase: "resolved", result }), expected.fingerprint]);
      if (updated.rows.length !== 1) throw new Error("Order receipt resolution failed");
    },
  };
}
