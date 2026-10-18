import assert from "node:assert/strict";
import {
  loadSharedPushPreferences,
  resetSharedPushPreferencesForTest,
  setSharedPushPreferences,
} from "./pushPreferencesStore.js";

try {
  resetSharedPushPreferencesForTest();

  let fetchCount = 0;
  const first = loadSharedPushPreferences(async () => {
    fetchCount += 1;
    await Promise.resolve();
    return { sessions: false };
  });
  const second = loadSharedPushPreferences(async () => {
    fetchCount += 1;
    return { sessions: true };
  });

  assert.deepEqual(await Promise.all([first, second]), [{ sessions: false }, { sessions: false }]);
  assert.equal(fetchCount, 1);
  // A second identity must not reuse the first account's values or pending call.
  const accountA = loadSharedPushPreferences(async () => ({ messages: false }), "account-a");
  const accountB = loadSharedPushPreferences(async () => ({ messages: true }), "account-b");
  assert.deepEqual(await accountA, { messages: false });
  assert.deepEqual(await accountB, { messages: true });
  setSharedPushPreferences({ messages: false }, "account-b");
  assert.deepEqual(await loadSharedPushPreferences(async () => ({}), "account-a"), {
    messages: false,
  });
  assert.deepEqual(await loadSharedPushPreferences(async () => ({}), "account-b"), {
    messages: false,
  });
  await assert.rejects(
    loadSharedPushPreferences(async () => {
      throw new Error("Synthetic failed fetch");
    }, "account-failure"),
  );
  assert.deepEqual(
    await loadSharedPushPreferences(async () => ({ goals: true }), "account-failure"),
    { goals: true },
  );

  assert.deepEqual(
    await loadSharedPushPreferences(async () => {
      fetchCount += 1;
      return { sessions: true };
    }),
    { sessions: false },
  );
  assert.equal(fetchCount, 1);

  setSharedPushPreferences({ dailyReminder: false });
  assert.deepEqual(
    await loadSharedPushPreferences(async () => {
      fetchCount += 1;
      return { sessions: true };
    }),
    { dailyReminder: false },
  );
  assert.equal(fetchCount, 1);
} finally {
  resetSharedPushPreferencesForTest();
}

console.log("push preferences store checks passed");
