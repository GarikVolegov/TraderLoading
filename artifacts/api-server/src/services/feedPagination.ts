// Pure cursor-pagination helpers for the social feed/stories (finding 2.8): the
// endpoints used a fixed limit(50) with no cursor, so nothing older could load.
// Keyset pagination over the post id (descending): WHERE id < cursor LIMIT n.

export interface FeedPagination {
  /** How many rows to fetch (clamped 1..MAX). */
  limit: number;
  /** Fetch rows with id strictly below this, or null for the first page. */
  cursor: number | null;
}

export const FEED_DEFAULT_LIMIT = 20;
export const FEED_MAX_LIMIT = 50;

export function parseFeedPagination(
  query: { cursor?: unknown; limit?: unknown },
  defaultLimit: number = FEED_DEFAULT_LIMIT,
): FeedPagination {
  const rawLimit = typeof query.limit === "string" || typeof query.limit === "number" ? Number(query.limit) : Number.NaN;
  const limit = Number.isFinite(rawLimit)
    ? Math.min(FEED_MAX_LIMIT, Math.max(1, Math.floor(rawLimit)))
    : defaultLimit;

  const rawCursor = typeof query.cursor === "string" || typeof query.cursor === "number" ? Number(query.cursor) : Number.NaN;
  const cursor = Number.isFinite(rawCursor) && rawCursor > 0 ? Math.floor(rawCursor) : null;

  return { limit, cursor };
}

/** The cursor for the NEXT page: the last row's id when the page was full, else null
 *  (a short page means there is nothing more to load). */
export function nextFeedCursor(items: ReadonlyArray<{ id: number }>, limit: number): number | null {
  return items.length >= limit && items.length > 0 ? items[items.length - 1].id : null;
}
