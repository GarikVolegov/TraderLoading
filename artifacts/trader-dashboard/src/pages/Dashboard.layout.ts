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

/**
 * Widgets that are redundant on desktop because the ClockWidget banner already
 * surfaces them there. On desktop (`lg` ≥ 1024px, matching the banner's `lg:flex`
 * inline quote) these are dropped from the grid entirely — including layout-edit
 * mode — and reappear on mobile/tablet where the banner hides its inline copy.
 */
export const DESKTOP_HIDDEN_WIDGET_IDS = ["quote"] as const;

/**
 * The ordered widget ids to render for the current viewport and mode.
 *
 * - On desktop, {@link DESKTOP_HIDDEN_WIDGET_IDS} are removed first (always).
 * - In edit mode every remaining widget is shown (hidden ones render as ghosts).
 * - In normal mode hidden widgets are filtered out.
 */
export function visibleWidgetOrder(
  order: string[],
  hidden: Record<string, boolean>,
  opts: { isEditing: boolean; isDesktop: boolean },
): string[] {
  const base = opts.isDesktop
    ? order.filter((id) => !(DESKTOP_HIDDEN_WIDGET_IDS as readonly string[]).includes(id))
    : order;
  return opts.isEditing ? base : base.filter((id) => !hidden[id]);
}
