/** Viewport width → masonry column count (Claude Design kit: 3 ≥1080, 2 ≥680, else 1). */
export function columnsForWidth(width: number): number {
  return width >= 1080 ? 3 : width >= 680 ? 2 : 1;
}

/**
 * Round-robin distribution of `ids` into `cols` columns: id at index `i` goes to
 * column `i % n`. Each column stacks independently → no interior vertical gaps.
 */
export function distributeColumns<T>(ids: T[], cols: number): T[][] {
  const n = Math.max(1, Math.floor(cols));
  const columns: T[][] = Array.from({ length: n }, () => []);
  ids.forEach((id, i) => columns[i % n].push(id));
  return columns;
}
