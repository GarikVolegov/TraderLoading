import assert from "node:assert/strict";
import { createBrokerHubRuntime } from "./runtime.js";
import { createBrokerProfileStoreFromBackend } from "./profileStore.js";
import { createDemoBrokerConnector } from "./demoConnector.js";
import { createMemoryOrderReceiptStore, type OrderReceiptStore } from "./orderReceiptStore.js";
import type { BrokerOrderResult } from "./types.js";

let data: unknown;
const backend = { async read() { return structuredClone(data); }, async write(value: unknown) { data = structuredClone(value); } };
const store = createBrokerProfileStoreFromBackend(backend);
const runtimes: ReturnType<typeof createBrokerHubRuntime>[] = [];
const request = { symbol: "EURUSD", side: "buy", volume: 0.1, clientRequestId: "synthetic-request" };
let nextProfile = 0;
async function setup(receipts: OrderReceiptStore, hook?: (send: () => Promise<BrokerOrderResult>) => Promise<BrokerOrderResult>, auditFails = false, profileId?: string) {
  let calls = 0;
  const profile = profileId ? (await store.getProfile(profileId))! : await store.saveProfile({ id: "receipt-test-" + ++nextProfile, label: "Synthetic demo", brokerName: "Audit", kind: "demo", environment: "demo", tradingEnabled: true, ownerUserId: "synthetic" });
  const runtime = createBrokerHubRuntime({
    store, orderReceiptStore: receipts,
    vault: { async setSecret() {}, async getSecret() { return null; }, async deleteProfile() {}, async readRawForTest() { return "{}"; } },
    auditLog: { async append() { if (auditFails) throw new Error("Synthetic audit failure"); }, async readAll() { return []; } },
    connectorFactory(current) {
      const connector = createDemoBrokerConnector(current);
      return { ...connector, async placeOrder(order) { calls++; return hook ? hook(() => connector.placeOrder(order)) : connector.placeOrder(order); } };
    },
  });
  runtimes.push(runtime); await runtime.connectProfile(profile.id);
  return { runtime, profile, calls: () => calls };
}
try {
  {
    const s = await setup(createMemoryOrderReceiptStore(), async send => { await new Promise(resolve => setTimeout(resolve, 20)); return send(); });
    const results = await Promise.all(Array.from({ length: 8 }, () => s.runtime.placeOrder(s.profile.id, request)));
    assert.equal(results.filter(r => r.accepted).length, 1);
    assert.equal(s.calls(), 1); assert.equal((await s.runtime.getSnapshot(s.profile.id)).positions.length, 1);
    const repeat = await s.runtime.placeOrder(s.profile.id, request); assert.equal(repeat.accepted, true); assert.equal(s.calls(), 1);
    const conflict = await s.runtime.placeOrder(s.profile.id, { ...request, volume: 0.2 }); assert.equal(conflict.accepted, false); assert.match(conflict.reason!, /ordine diverso/); assert.equal(s.calls(), 1);
    const position = (await s.runtime.getSnapshot(s.profile.id)).positions[0].id;
    const closed = await s.runtime.closePosition(s.profile.id, position);
    assert.equal(closed.accepted, true);
    assert.deepEqual(await s.runtime.closePosition(s.profile.id, position), closed);
    assert.equal((await s.runtime.getSnapshot(s.profile.id)).positions.length, 0);
    assert.equal((await s.runtime.getHistory(s.profile.id)).filter(deal => deal.closedAt).length, 1);
  }
  {
    const receipts = createMemoryOrderReceiptStore();
    const s = await setup(receipts, async send => { await send(); throw new Error("Synthetic lost provider reply"); });
    const lost = await s.runtime.placeOrder(s.profile.id, request); assert.equal(lost.accepted, false); assert.match(lost.reason!, /non confermato/);
    assert.equal((await s.runtime.getSnapshot(s.profile.id)).positions.length, 1);
    await s.runtime.placeOrder(s.profile.id, request); assert.equal(s.calls(), 1);
    const restarted = await setup(receipts, undefined, false, s.profile.id);
    assert.equal((await restarted.runtime.placeOrder(s.profile.id, request)).accepted, false); assert.equal(restarted.calls(), 0);
  }
  {
    const receipts: OrderReceiptStore = { async claim() { throw new Error("Synthetic receipt outage"); }, async resolve() { throw new Error("Must not run"); } };
    const s = await setup(receipts); const rejected = await s.runtime.placeOrder(s.profile.id, request);
    assert.equal(rejected.accepted, false); assert.match(rejected.reason!, /Nessun ordine inviato/); assert.equal(s.calls(), 0);
  }
  {
    const underlying = createMemoryOrderReceiptStore();
    const s = await setup({ claim: underlying.claim, async resolve() { throw new Error("Synthetic completion outage"); } });
    assert.equal((await s.runtime.placeOrder(s.profile.id, request)).accepted, false);
    assert.equal((await s.runtime.placeOrder(s.profile.id, request)).accepted, false); assert.equal(s.calls(), 1);
    assert.equal((await s.runtime.getSnapshot(s.profile.id)).positions.length, 1);
  }
  {
    const s = await setup(createMemoryOrderReceiptStore(), undefined, true);
    const confirmed = await s.runtime.placeOrder(s.profile.id, request); assert.equal(confirmed.accepted, true);
    assert.deepEqual(await s.runtime.placeOrder(s.profile.id, request), confirmed); assert.equal(s.calls(), 1);
  }
} finally { await Promise.all(runtimes.map(runtime => runtime.close())); }
console.log("broker order receipt concurrency, replay, ambiguity and availability checks passed");
