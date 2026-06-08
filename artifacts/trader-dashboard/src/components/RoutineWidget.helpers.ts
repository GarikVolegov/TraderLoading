import type { FriendListItem } from "@workspace/api-client-react";

export type RoutineProgram = "morning" | "evening";

export function getRoutineStatusCopy(done: number): string {
  if (done <= 0) return "Nessuna sessione completata";
  if (done === 1) return "Una sessione completata";
  return "Sessioni completate";
}

export function getRoutineProgramHref(program: RoutineProgram): string {
  return `/routine?start=${program}`;
}

export function getNextRoutineProgram(morningDone: boolean, eveningDone: boolean): RoutineProgram | null {
  if (!morningDone) return "morning";
  if (!eveningDone) return "evening";
  return null;
}

export function getRoutineSocialMetrics(
  friends: FriendListItem[] | undefined,
) {
  return {
    activeChallengeFriends: friends?.filter((friend) => friend.online).length ?? 0,
  };
}
