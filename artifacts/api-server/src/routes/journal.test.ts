import assert from "node:assert/strict";

process.env.DATABASE_URL ??= "postgres://user:pass@127.0.0.1:5432/test";

const {
  default: journalRouter,
  mergeJournalTagSummaries,
  normalizeJournalTags,
  summarizeJournalEntryTags,
  serializeJournalTags,
  serializeJournalEntry,
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
const recapsIndex = getStack.indexOf("/journal/recaps");
const dynamicEntryIndex = getStack.indexOf("/journal/:id");

assert.notEqual(tagsIndex, -1);
assert.notEqual(recapsIndex, -1);
assert.notEqual(dynamicEntryIndex, -1);
assert.equal(tagsIndex < dynamicEntryIndex, true);
assert.equal(recapsIndex < dynamicEntryIndex, true);
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

// serializeJournalEntry maps an entry row + its already-loaded images to the API
// shape. The GET /journal list path relies on this (with images batch-loaded in a
// single query) instead of re-fetching each entry + its images per row (the old
// 2N+1 query pattern). Same shape as the single-entry path.
const serializedEntry = serializeJournalEntry(
  {
    id: 7,
    title: "Breakout long",
    content: "notes",
    tradeDate: "2026-01-01",
    result: "win",
    tags: "Breakout",
    createdAt: new Date("2026-01-02T03:04:05.000Z"),
    updatedAt: new Date("2026-01-02T03:04:06.000Z"),
  } as never,
  [
    { id: 11, filePath: "abc.png" },
    { id: 12, filePath: "def.png" },
  ] as never,
);

assert.equal(serializedEntry.id, 7);
assert.equal(serializedEntry.title, "Breakout long");
assert.equal(serializedEntry.images.length, 2);
assert.equal(serializedEntry.images[0].url, "/api/journal/image/abc.png");
assert.equal(serializedEntry.images[1].id, 12);
assert.equal(serializedEntry.createdAt, "2026-01-02T03:04:05.000Z");
assert.equal(serializedEntry.updatedAt, "2026-01-02T03:04:06.000Z");

// No images → empty array, not undefined.
const serializedNoImages = serializeJournalEntry(
  {
    id: 8,
    title: "Flat day",
    content: "",
    tradeDate: null,
    result: null,
    tags: null,
    createdAt: new Date("2026-02-02T00:00:00.000Z"),
    updatedAt: new Date("2026-02-02T00:00:00.000Z"),
  } as never,
  [] as never,
);
assert.deepEqual(serializedNoImages.images, []);

console.log("journal route and tag helper checks passed");
