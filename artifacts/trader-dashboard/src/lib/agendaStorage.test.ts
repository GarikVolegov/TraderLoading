import assert from "node:assert/strict";
import { accountStorage } from "./accountStorage";
import { AGENDA_ITEMS_KEY, parseAgendaItems, readAgendaItems, mergeAgendaItems, type ManualPlannerItem } from "./agendaStorage";

const values = new Map<string, string>();
const storage = {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => { values.set(key, value); },
  removeItem: (key: string) => { values.delete(key); },
};
const item: ManualPlannerItem = {
  id: "legacy-1", title: "Review", notes: "Weekly review", type: "review", priority: "medium",
  startAt: "2026-10-04T09:00:00.000Z", endAt: null, createdAt: "2026-10-03T09:00:00.000Z",
};
const legacy = JSON.stringify([item]);
storage.setItem(AGENDA_ITEMS_KEY, legacy);
const firstAccount = accountStorage("first-account", storage)!;
const secondAccount = accountStorage("second-account", storage)!;

assert.deepEqual(readAgendaItems(firstAccount), [], "legacy data is never assigned implicitly");
assert.deepEqual(readAgendaItems(secondAccount), []);
assert.deepEqual(readAgendaItems(), [], "no account does not expose shared appointments");
const imported = mergeAgendaItems(readAgendaItems(firstAccount), readAgendaItems(storage));
firstAccount.setItem(AGENDA_ITEMS_KEY, JSON.stringify(imported));
assert.deepEqual(readAgendaItems(firstAccount), [item]);
assert.deepEqual(readAgendaItems(secondAccount), [], "import stays in the chosen account");
assert.equal(storage.getItem(AGENDA_ITEMS_KEY), legacy, "explicit import preserves the original legacy copy");
assert.deepEqual(mergeAgendaItems(imported, [item]), imported, "repeat import is idempotent");
assert.deepEqual(mergeAgendaItems(imported, [{ ...item, id: "different-id" }]), imported, "equivalent appointments are not duplicated");
assert.deepEqual(parseAgendaItems("broken-json"), []);
assert.deepEqual(parseAgendaItems(JSON.stringify([{ ...item, startAt: "not-a-date" }])), []);
assert.deepEqual(parseAgendaItems(JSON.stringify([{ ...item, type: "unknown" }])), []);
console.log("agenda account isolation and explicit import checks passed");
