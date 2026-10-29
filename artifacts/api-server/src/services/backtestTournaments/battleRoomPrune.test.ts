import assert from "node:assert/strict";

process.env.DATABASE_URL ??= "postgres://user:pass@127.0.0.1:5432/test";

const { battleRoomManager } = await import("./battleRoomManager.js");

// Reset state
battleRoomManager.resetForTesting();

// Create an active custom room
const room1 = battleRoomManager.getOrCreateRoom("custom_test_active", 1, { title: "Active" });
assert.equal(battleRoomManager.getSnapshot("custom_test_active").length, 0);

// Add a participant
battleRoomManager.joinRoom("custom_test_active", 1, {
  userId: "user_1",
  displayName: "Operator",
  country: "IT",
  gradeTitle: "Iniziato",
  isReady: true,
  currentProfitPct: 0,
  currentDrawdownPct: 0,
  tradesCount: 0,
});

// Prune now: room is active, has human participant -> should NOT be pruned
const prunedNow = battleRoomManager.pruneInactiveRooms(Date.now());
assert.equal(prunedNow, 0);

// Leave room so no participants remain
battleRoomManager.leaveRoom("custom_test_active", "user_1");

// Create another room that ended 20 minutes ago
const room2 = battleRoomManager.getOrCreateRoom("custom_test_ended", 1, { title: "Ended" });
room2.matchEndsAt = Date.now() - 20 * 60 * 1000;

// Prune now: room2 has no human participants, no subscribers and ended > 15m ago -> pruned!
const prunedAfter = battleRoomManager.pruneInactiveRooms(Date.now());
assert.equal(prunedAfter, 1);

battleRoomManager.stop();
console.log("battle room pruning and timer lifecycle cleanup tests passed");
