import type { ProcessState } from "../../../../contracts/trader-process";
/** Only the active version's latest documented correction is carried forward. */
export function cockpitImprovement(state: ProcessState) {
  const version = state.activeMethod?.id;
  if (state.improvement && state.improvement.methodVersionId === version)
    return { action: state.improvement.action, criterion: state.improvement.criterion };
  const previous = [...(state.sessions ?? [])]
    .filter(
      (s) => s.state === "closed" && s.methodVersionId === version && s.closure?.correction?.trim(),
    )
    .sort((a, b) => b.day.localeCompare(a.day))[0];
  return previous?.closure?.correction
    ? { action: previous.closure.correction, criterion: null }
    : null;
}
