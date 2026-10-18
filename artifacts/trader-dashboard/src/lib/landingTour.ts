export const TOUR_STEPS = ["prepare", "test", "plan", "review"] as const;
export const TOUR_SCENE_COUNT = TOUR_STEPS.length;
export type TourStep = (typeof TOUR_STEPS)[number];

export interface TourState {
  index: number;
  visited: readonly number[];
  started: boolean;
}

export type TourAction =
  | { type: "start" }
  | { type: "next" }
  | { type: "prev" }
  | { type: "replay" }
  | { type: "goto"; index: number };

// No timers: the visitor chooses when to advance, including with a keyboard.
export const initialTourState: TourState = { index: 0, visited: [0], started: false };

export function isTourComplete(state: TourState): boolean {
  return state.started && TOUR_STEPS.every((_, index) => state.visited.includes(index));
}

export function tourReducer(state: TourState, action: TourAction): TourState {
  if (action.type === "start") return { ...state, started: true };
  if (action.type === "replay") return { ...initialTourState, started: true };
  const requested =
    action.type === "goto" ? action.index : state.index + (action.type === "next" ? 1 : -1);
  if (!Number.isFinite(requested)) return state;
  const index = Math.max(0, Math.min(TOUR_SCENE_COUNT - 1, Math.trunc(requested)));
  return {
    index,
    started: true,
    visited: state.visited.includes(index) ? state.visited : [...state.visited, index],
  };
}
