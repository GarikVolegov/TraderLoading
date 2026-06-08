export type RoutineStartProgram = "morning" | "evening";

export function getRoutineStartProgram(location: string): RoutineStartProgram | null {
  const queryStart = location.indexOf("?");
  const query =
    queryStart >= 0
      ? location.slice(queryStart + 1)
      : location.startsWith("?")
        ? location.slice(1)
        : "";

  if (!query) return null;

  const requested = new URLSearchParams(query).get("start");
  return requested === "morning" || requested === "evening" ? requested : null;
}
