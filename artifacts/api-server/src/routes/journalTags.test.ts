import assert from "node:assert/strict";

process.env.DATABASE_URL ??= "postgres://user:pass@127.0.0.1:5432/test";

const {
  default: journalRouter,
  mergeJournalTagSummaries,
  normalizeJournalTags,
  summarizeJournalEntryTags,
  serializeJournalTags,
} = await import("./journal.js");

type RouteLayer = {
  route?: {
    path?: string;
    methods?: Record<string, boolean>;
  };
};

const stack = ((journalRouter as unknown as { stack?: RouteLayer[] }).stack ?? [])
  .map((layer) => ({ path: layer.route?.path, methods: layer.route?.methods }))
  .filter((layer) => layer.path);

const getStack = stack.filter((layer) => layer.methods?.get).map((layer) => layer.path);
const postStack = stack.filter((layer) => layer.methods?.post).map((layer) => layer.path);
const tagsIndex = getStack.indexOf("/journal/tags");
const dynamicEntryIndex = getStack.indexOf("/journal/:id");

assert.notEqual(tagsIndex, -1);
assert.notEqual(dynamicEntryIndex, -1);
assert.equal(tagsIndex < dynamicEntryIndex, true);
assert.notEqual(postStack.indexOf("/journal/tags"), -1);

assert.deepEqual(
  normalizeJournalTags(" Breakout, breakout, NY Open, , London "),
  ["Breakout", "NY Open", "London"],
);

assert.equal(
  serializeJournalTags(" Breakout, breakout, NY Open "),
  "Breakout, NY Open",
);

assert.deepEqual(
  mergeJournalTagSummaries(
    [
      { tag: "breakout", count: 2 },
      { tag: "NY Open", count: 1 },
    ],
    ["Breakout", "London"],
  ),
  [
    { tag: "Breakout", count: 2 },
    { tag: "NY Open", count: 1 },
    { tag: "London", count: 0 },
  ],
);

assert.deepEqual(
  summarizeJournalEntryTags(["NY Open, breakout", "Breakout, London"]),
  [
    { tag: "breakout", count: 2 },
    { tag: "London", count: 1 },
    { tag: "NY Open", count: 1 },
  ],
);

console.log("journal saved tags route and helper checks passed");
