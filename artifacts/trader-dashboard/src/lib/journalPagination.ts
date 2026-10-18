export const JOURNAL_PAGE_SIZE = 24;
export function orderJournalEntries<T extends { id: number; tradeDate: string }>(entries: readonly T[]): T[] {
  return [...entries].sort((a, b) => b.tradeDate.localeCompare(a.tradeDate) || b.id - a.id);
}
export function journalPage<T>(entries: readonly T[], requestedPage: number) {
  const pages = Math.max(1, Math.ceil(entries.length / JOURNAL_PAGE_SIZE));
  const page = Math.min(Math.max(1, Math.trunc(requestedPage) || 1), pages);
  return { page, pages, entries: entries.slice((page - 1) * JOURNAL_PAGE_SIZE, page * JOURNAL_PAGE_SIZE) };
}
