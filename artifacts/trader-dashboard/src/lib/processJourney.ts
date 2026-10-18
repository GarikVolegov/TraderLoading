import type { ProcessState } from "./traderProcessApi";

/** Presentation only: the server owns priority, eligibility and the destination. */
export function processScreen(state: ProcessState, practiceRequested = false) {
  const guidance = state.guidance;
  if (!guidance) return "unavailable" as const;
  if (guidance.action === "resume_session") {
    if (!state.session || state.session.id !== guidance.sessionId) return "unavailable" as const;
    return state.session.state === "operation" ? "operation" as const : "preparation" as const;
  }
  if (guidance.action === "define_method") return "method" as const;
  if (guidance.action === "confirm_verification") return "protocol" as const;
  if (guidance.action === "review_period") return "review" as const;
  if (guidance.action === "check_in") return "preparation" as const;
  if (guidance.action === "done") return "done" as const;
  if (guidance.action === "collect_evidence" && practiceRequested && guidance.sessionMode !== "application") return "preparation" as const;
  return "next" as const;
}
