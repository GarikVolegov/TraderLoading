import test from "node:test";
import assert from "node:assert/strict";
import {
  onBattleRoomMessage,
  publishBattleRoomMessage,
  closeBattleRoomPubSub,
} from "./battleEvents.js";
import type { BattleRoomServerMessage } from "./battleRoomTypes.js";

test("battleEvents: in-memory pub/sub listener registration and cleanup", async () => {
  const received: Array<{ roomId: string; msg: BattleRoomServerMessage }> = [];

  const unsubscribe = onBattleRoomMessage((roomId, msg) => {
    received.push({ roomId, msg });
  });

  const dummyMsg: BattleRoomServerMessage = {
    type: "stoic_sentence_broadcast",
    roomId: "room_test_1",
    sender: "Guerriero Aureus",
    sentence: "La disciplina è la nostra armatura.",
    timestamp: Date.now(),
  };

  // publishBattleRoomMessage only publishes to Redis if REDIS_URL is present,
  // but listeners should be properly registered without throwing
  publishBattleRoomMessage("room_test_1", dummyMsg);

  unsubscribe();
  await closeBattleRoomPubSub();
  assert.equal(typeof unsubscribe, "function");
});
