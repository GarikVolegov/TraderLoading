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

  assert.deepEqual(await Promise.all([first, second]), [
    { sessions: false },
    { sessions: false },
  ]);
  assert.equal(fetchCount, 1);

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
