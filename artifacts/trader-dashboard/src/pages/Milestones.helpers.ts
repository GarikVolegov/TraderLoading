/**
 * Parse the `skills` JSON column of a milestone defensively: the value is
 * admin-authored, so malformed JSON or a non-array payload must degrade to an
 * empty list instead of crashing the render.
 */
export function parseSkills(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}
