// Dedup helpers for the macro-news detail dialog: a news item's title, summary and
// deep-dive "what happened" often collapse to the same sentence (the backend frequently
// emits summary === title). These helpers let the dialog skip any slot that merely
// restates text already shown above it, so the same headline never appears two or three
// times. Kept JSX-free so it can be unit-tested with the repo's node:test runner.

/** Lowercase, strip diacritics + punctuation, split into words. */
export function normalizeWords(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

const REDUNDANT_COVERAGE_THRESHOLD = 0.9;

/**
 * True when `candidate` adds essentially nothing over the strings already shown — i.e.
 * at least ~90% of its words already appear in one of them. Coverage is measured against
 * the candidate (not the shorter string), so an *enriched* text that contains an earlier
 * line but adds new detail (figures, source, recency) is still kept.
 */
export function isRedundantText(candidate: string, shown: string[]): boolean {
  const candidateWords = new Set(normalizeWords(candidate));
  if (candidateWords.size === 0) return true;

  for (const prev of shown) {
    const prevWords = new Set(normalizeWords(prev));
    if (prevWords.size === 0) continue;
    let overlap = 0;
    for (const word of candidateWords) {
      if (prevWords.has(word)) overlap++;
    }
    if (overlap / candidateWords.size >= REDUNDANT_COVERAGE_THRESHOLD) return true;
  }
  return false;
}
