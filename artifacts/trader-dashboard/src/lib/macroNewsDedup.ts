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

// Two slots count as "the same news" when ~70%+ of the shorter one's words overlap. This
// catches headlines vs summaries that differ by only a few words (e.g. "mette al centro"
// vs "mette a fuoco") while leaving genuinely different analysis text (which shares far
// fewer words with the headline) visible.
const REDUNDANT_COVERAGE_THRESHOLD = 0.7;

/**
 * True when `candidate` says essentially the same thing as something already shown — i.e.
 * one of them is ~contained in the other (≥90% word overlap relative to the *shorter* of
 * the two). Measuring against the shorter string catches a restatement in either
 * direction: a summary that just echoes the title, AND an "enriched" what-happened that is
 * the title/summary plus a tacked-on source/recency line. Genuinely distinct analysis
 * (why it matters / how it impacts) shares few words with the headline and is kept.
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
    const denominator = Math.min(candidateWords.size, prevWords.size);
    if (overlap / denominator >= REDUNDANT_COVERAGE_THRESHOLD) return true;
  }
  return false;
}
