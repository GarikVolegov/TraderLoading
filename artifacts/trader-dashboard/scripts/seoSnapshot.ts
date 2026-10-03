/**
 * Decides whether a prerendered snapshot is real content or a broken render.
 * Checked BEFORE the error-boundary's own <h1>("Something went wrong") could
 * otherwise pass a naive "has an h1" check.
 */
export function isValidSnapshot(html: string): boolean {
  if (html.includes("data-root-error-boundary")) return false;
  if (!/<h1[\s>]/.test(html)) return false;
  return true;
}
