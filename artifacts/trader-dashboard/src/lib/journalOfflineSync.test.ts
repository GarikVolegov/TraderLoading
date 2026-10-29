import assert from "node:assert/strict";
import {
  queueOfflineMutation,
  getPendingMutations,
  removeOfflineMutation,
  updateOfflineMutation,
  cacheJournalEntries,
  getCachedJournalEntries,
  resetJournalOfflineSyncForTesting,
  type OfflineJournalMutation,
} from "./journalOfflineSync";
import type { JournalEntry } from "@workspace/api-client-react";

async function testJournalOfflineSync() {
  console.log("Testing JournalOfflineSync queue, local caching and state management...");

  resetJournalOfflineSyncForTesting();

  // 1. Queue a "create_entry" mutation
  const createPayload = {
    data: {
      title: "XAUUSD · LONG · Svolta Sovrana",
      content: "Entry: 2650.50\nExit: 2665.00\nProfit: +1450.00€",
      tradeDate: "2026-10-25",
      result: "win" as const,
      tags: "XAUUSD, LONG, AUREUS",
    },
  };

  const id1 = await queueOfflineMutation({
    type: "create_entry",
    payload: createPayload,
  });

  assert.ok(id1.startsWith("mut_"), "Mutation ID should start with mut_");

  // 2. Queue an "update_note" mutation
  const id2 = await queueOfflineMutation({
    type: "update_note",
    entryId: 42,
    payload: { content: "Nota aggiunta offline dal treno." },
  });

  // 3. Verify pending mutations list
  const pending = await getPendingMutations();
  assert.equal(pending.length, 2, "There should be 2 pending mutations in the queue");
  assert.equal(pending[0].id, id1);
  assert.equal(pending[1].id, id2);
  assert.equal(pending[1].entryId, 42);

  // 4. Update mutation status to failed on retry
  const mutToUpdate: OfflineJournalMutation = {
    ...pending[1],
    status: "failed",
    retryCount: 1,
    lastError: "Network timeout offline",
  };
  await updateOfflineMutation(mutToUpdate);

  const updatedPending = await getPendingMutations();
  assert.equal(updatedPending[1].status, "failed");
  assert.equal(updatedPending[1].retryCount, 1);
  assert.equal(updatedPending[1].lastError, "Network timeout offline");

  // 5. Remove completed mutation
  await removeOfflineMutation(id1);
  const remaining = await getPendingMutations();
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0].id, id2);

  // 6. Test offline entries cache
  const mockEntries: JournalEntry[] = [
    {
      id: 101,
      title: "EURUSD · SHORT",
      content: "Trade disciplinato 2R",
      tradeDate: "2026-10-25",
      result: "win",
      tags: "EURUSD",
      images: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 102,
      title: "BTCUSD · LONG",
      content: "Breakout confermato",
      tradeDate: "2026-10-25",
      result: "breakeven",
      tags: "BTCUSD",
      images: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  await cacheJournalEntries(mockEntries);
  const cached = await getCachedJournalEntries();
  assert.equal(cached.length, 2, "Cached entries must store and return both records");
  assert.equal(cached[0].id, 101);
  assert.equal(cached[1].id, 102);

  console.log("JournalOfflineSync tests passed with 100% precision!");
}

await testJournalOfflineSync();
