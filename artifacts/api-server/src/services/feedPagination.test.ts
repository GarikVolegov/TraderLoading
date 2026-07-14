import assert from "node:assert/strict";
import { parseFeedPagination, nextFeedCursor, FEED_DEFAULT_LIMIT, FEED_MAX_LIMIT } from "./feedPagination.js";

// Defaults when the query is empty.
assert.deepEqual(parseFeedPagination({}), { limit: FEED_DEFAULT_LIMIT, cursor: null });

// limit is clamped to [1, MAX]; junk falls back to the default.
assert.equal(parseFeedPagination({ limit: "10" }).limit, 10);
assert.equal(parseFeedPagination({ limit: 999 }).limit, FEED_MAX_LIMIT);
assert.equal(parseFeedPagination({ limit: 0 }).limit, 1);
assert.equal(parseFeedPagination({ limit: "abc" }).limit, FEED_DEFAULT_LIMIT);
assert.equal(parseFeedPagination({ limit: -5 }).limit, 1);

// cursor: a positive integer, else null (first page).
assert.equal(parseFeedPagination({ cursor: "1234" }).cursor, 1234);
assert.equal(parseFeedPagination({ cursor: 0 }).cursor, null);
assert.equal(parseFeedPagination({ cursor: "nope" }).cursor, null);
assert.equal(parseFeedPagination({ cursor: -3 }).cursor, null);

// nextFeedCursor: last id when the page filled, else null (nothing more).
assert.equal(nextFeedCursor([{ id: 9 }, { id: 7 }, { id: 5 }], 3), 5);
assert.equal(nextFeedCursor([{ id: 9 }, { id: 7 }], 3), null); // short page
assert.equal(nextFeedCursor([], 3), null);

console.log("feed pagination checks passed");
