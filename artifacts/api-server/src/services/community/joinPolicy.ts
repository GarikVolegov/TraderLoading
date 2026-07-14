// Pure decisions for private-community join/visibility (audit 0.5b). No I/O — the
// routes resolve isPublic/isMember/isBanned from the DB and delegate here.
export type JoinOutcome = "join" | "request" | "already-member" | "blocked";

export function decideJoin(input: { isPublic: boolean; isMember: boolean; isBanned: boolean }): JoinOutcome {
  if (input.isBanned) return "blocked";
  if (input.isMember) return "already-member";
  return input.isPublic ? "join" : "request";
}

/** A user may (re)enter the pending state only if they have no request yet or the
 *  last one was rejected. Pending/approved are terminal for re-requesting. */
export function canRequestJoin(existing: { status: string } | null): boolean {
  return existing === null || existing.status === "rejected";
}

/** Whether a viewer sees the full community (channels/messages) vs. cover-only. */
export function canSeeFullCommunity(input: { isPublic: boolean; isMember: boolean; isOwner: boolean }): boolean {
  return input.isPublic || input.isMember || input.isOwner;
}
