import assert from "node:assert/strict";
import { HUBS, matchHub, splitHubItems, TORNEI_ITEM } from "./navHubs";

// matchHub: route → hub resolution
assert.equal(matchHub("/"), undefined, "home is not inside any hub");
assert.equal(matchHub("/backtest"), undefined, "backtest has no hub (flat page)");
assert.equal(matchHub("/wiki"), undefined, "wiki has no hub (flat page)");

assert.equal(matchHub("/chat")?.id, "community");
assert.equal(matchHub("/chat/sub")?.id, "community", "nested chat path still matches");
assert.equal(matchHub("/tornei")?.id, "community", "tornei is part of the community hub");
assert.equal(matchHub("/journal")?.id, "journal");
assert.equal(matchHub("/journal/anything")?.id, "journal");
assert.equal(matchHub("/zen"), undefined, "zen no longer exists as a route");
assert.equal(matchHub("/routine"), undefined, "routine has no hub (flat page, absorbed zen's content instead)");

// Registry shape
assert.equal(HUBS.length, 2, "two hubs registered: community, journal");
assert.deepEqual(
  HUBS.map((h) => h.id).sort(),
  ["community", "journal"],
);

const community = HUBS.find((h) => h.id === "community")!;
const journal = HUBS.find((h) => h.id === "journal")!;

assert.equal(community.items.length, 5, "community keeps its 5 existing sub-items");
assert.equal(journal.items.length, 6, "journal exposes its 6 in-page tabs");

for (const hub of HUBS) {
  for (const item of hub.items) {
    assert.ok(item.href, `${hub.id} item has an href`);
    assert.ok(item.labelKey, `${hub.id} item has a labelKey`);
    assert.ok(item.icon, `${hub.id} item has an icon`);
  }
}

// splitHubItems: mobile pill fit rule — cap at 5 direct items, else 4 + overflow
const five = community.items;
const splitFive = splitHubItems(five);
assert.equal(splitFive.primary.length, 5);
assert.equal(splitFive.overflow.length, 0);

const six = journal.items;
const splitSix = splitHubItems(six);
assert.equal(splitSix.primary.length, 4);
assert.equal(splitSix.overflow.length, 2);
assert.deepEqual(splitSix.primary, six.slice(0, 4));
assert.deepEqual(splitSix.overflow, six.slice(4));

assert.equal(TORNEI_ITEM.href, "/tornei", "TORNEI_ITEM is the desktop standalone Tornei shortcut");

console.log("navHubs unit checks passed");
